import json
import os
import re
import shlex
import subprocess
import urllib.parse
import uuid
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import engine, get_db, Base, VAULT_DIR, ATTACHMENTS_DIR, DOCUMENTS_VAULT_DIR, DATABASE_URL
from models import Document
from schemas import (
    DocumentMetadata,
    ScanResponse,
    ConfirmDocumentRequest,
    DocumentUpdate,
    ChatRequest,
    NoteContent,
)
from services import (
    TEMP_DIR,
    extract_pdf_pages_and_preview,
    analyze_document_with_ai,
    build_obsidian_markdown,
    save_document_bundle,
    render_pdf_page_image,
    get_pdf_total_pages,
    slugify,
    gemini_client,
    openai_client,
)

def safe_content_disposition(disposition: str, filename: str) -> str:
    """Tạo Content-Disposition header an toàn chuẩn RFC 6266 ngăn ngừa lỗi Unicode latin-1"""
    ascii_name = re.sub(r'[^\x20-\x7E]', '_', filename)
    encoded_name = urllib.parse.quote(filename, safe='')
    return f'{disposition}; filename="{ascii_name}"; filename*=UTF-8\'\'{encoded_name}'
from google.genai import types

# Khởi tạo CSDL
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DocuVault Enterprise API",
    description="Hệ thống Quản lý Văn bản Thông minh kết hợp Obsidian Second Brain",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_COMMANDS = {"ls", "df", "top", "free", "docker", "cat", "pwd", "whoami", "ps", "echo"}

def get_safe_path(filename: str) -> Path:
    """Đảm bảo đường dẫn file an toàn bên trong thư mục Vault"""
    if not filename.endswith(".md"):
        filename += ".md"
    file_path = (VAULT_DIR / filename).resolve()
    if VAULT_DIR not in file_path.parents and file_path != VAULT_DIR:
        raise HTTPException(status_code=400, detail="Path Traversal detected.")
    return file_path

# ==========================================
# CÁC HÀM CÔNG CỤ (TOOLS CHO AI ASSISTANT)
# ==========================================
def execute_read_note(filename: str) -> str:
    file_path = get_safe_path(filename)
    if not file_path.exists():
        return f"Lỗi: Không tìm thấy ghi chú '{filename}'."
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"Lỗi khi đọc file: {str(e)}"

def execute_write_note(filename: str, content: str) -> str:
    try:
        file_path = get_safe_path(filename)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Ghi thành công vào Obsidian Vault: {filename}"
    except Exception as e:
        return f"Lỗi khi ghi file: {str(e)}"

def execute_search_notes(keyword: str) -> str:
    matches = []
    try:
        for file_path in VAULT_DIR.rglob("*.md"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if keyword.lower() in content.lower():
                        rel = file_path.relative_to(VAULT_DIR)
                        matches.append(str(rel).replace("\\", "/"))
            except Exception:
                continue
        if not matches:
            return f"Không tìm thấy ghi chú nào trong Second Brain chứa từ khóa '{keyword}'."
        return f"Tìm thấy '{keyword}' trong các ghi chú sau:\n" + "\n".join(matches)
    except Exception as e:
        return f"Lỗi khi tìm kiếm ghi chú: {str(e)}"

def execute_query_documents(keyword: str) -> str:
    """Tìm kiếm văn bản trong CSDL DocuVault"""
    try:
        with Session(engine) as db:
            query = db.query(Document).filter(
                or_(
                    Document.title.ilike(f"%{keyword}%"),
                    Document.doc_number.ilike(f"%{keyword}%"),
                    Document.sender_org.ilike(f"%{keyword}%"),
                    Document.signer_name.ilike(f"%{keyword}%"),
                    Document.summary.ilike(f"%{keyword}%"),
                    Document.tags_json.ilike(f"%{keyword}%"),
                )
            ).limit(10).all()

            if not query:
                return f"Không tìm thấy văn bản nào trong Sổ văn bản khớp với '{keyword}'."

            lines = [f"Tìm thấy {len(query)} văn bản liên quan:"]
            for doc in query:
                lines.append(
                    f"- ID {doc.id} | [{doc.document_type}] Số: {doc.doc_number or 'Chưa rõ'} | "
                    f"Ngày: {doc.issue_date} | Đơn vị: {doc.sender_org} | Ký bởi: {doc.signer_name}\n"
                    f"  Trích yếu: {doc.title}\n"
                    f"  File note: [[{doc.markdown_filename}]]"
                )
            return "\n".join(lines)
    except Exception as e:
        return f"Lỗi khi tra cứu CSDL văn bản: {str(e)}"

def execute_shell_command(command: str) -> str:
    try:
        parts = shlex.split(command)
        if not parts:
            return "Lỗi: Lệnh không hợp lệ hoặc trống."
        base_cmd = parts[0]
        if base_cmd not in ALLOWED_COMMANDS:
            return f"🚫 LỖI BẢO MẬT: Lệnh '{base_cmd}' bị hệ thống từ chối. Chỉ cho phép các lệnh: {', '.join(ALLOWED_COMMANDS)}"
        if base_cmd == "docker":
            allowed_docker_subcmds = {"ps", "logs", "info", "images", "stats"}
            if len(parts) < 2 or parts[1] not in allowed_docker_subcmds:
                return f"🚫 LỖI BẢO MẬT: Lệnh Docker bị chặn. Chỉ cho phép: docker {', '.join(allowed_docker_subcmds)}"

        result = subprocess.run(parts, shell=False, text=True, capture_output=True, timeout=30)
        output = result.stdout.strip()
        error = result.stderr.strip()
        return output if result.returncode == 0 else f"Lỗi (Mã {result.returncode}): {error}"
    except Exception as e:
        return f"Lỗi thực thi lệnh: {str(e)}"

# Schema tool cho OpenAI
OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_documents",
            "description": "Tìm kiếm văn bản trong Sổ đăng ký văn bản (CSDL DocuVault) theo từ khóa (tiêu đề, số hiệu, cơ quan, người ký, nội dung).",
            "parameters": {
                "type": "object",
                "properties": {"keyword": {"type": "string", "description": "Từ khóa cần tìm kiếm"}},
                "required": ["keyword"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_note",
            "description": "Đọc nội dung một file ghi chú Markdown trong thư mục Obsidian Vault.",
            "parameters": {
                "type": "object",
                "properties": {"filename": {"type": "string", "description": "Tên file hoặc đường dẫn tương đối (vd: 'VanBan/2026/10/quyet_dinh_142.md')"}},
                "required": ["filename"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_notes",
            "description": "Tìm kiếm toàn văn từ khóa trong tất cả các file ghi chú Markdown của Obsidian Vault.",
            "parameters": {
                "type": "object",
                "properties": {"keyword": {"type": "string", "description": "Từ khóa tìm kiếm trong Vault"}},
                "required": ["keyword"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_note",
            "description": "Tạo hoặc ghi đè một ghi chú Markdown vào Obsidian Vault.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Tên file (vd: 'Projects/BaoCao.md')"},
                    "content": {"type": "string", "description": "Nội dung Markdown cần ghi"},
                },
                "required": ["filename", "content"],
            },
        },
    },
]

# Tool list cho Gemini
GEMINI_TOOLS = [execute_query_documents, execute_read_note, execute_search_notes, execute_write_note]

# ==========================================
# ENDPOINTS QUẢN LÝ VĂN BẢN (DOCUMENTS)
# ==========================================

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": "DocuVault Enterprise",
        "vault_dir": str(VAULT_DIR),
        "attachments_dir": str(ATTACHMENTS_DIR),
        "database": str(DATABASE_URL),
    }

@app.get("/api/stats")
async def get_system_stats(db: Session = Depends(get_db)):
    """Thống kê tổng quan cho Dashboard"""
    total_docs = db.query(Document).count()
    
    # Đếm số task hành động
    docs = db.query(Document).all()
    total_actions = sum(len(d.action_items) for d in docs)
    
    # Thống kê theo loại
    type_counts = {}
    for d in docs:
        type_counts[d.document_type] = type_counts.get(d.document_type, 0) + 1

    # Đếm tổng số file markdown trong vault
    total_notes = len(list(VAULT_DIR.rglob("*.md")))

    return {
        "total_documents": total_docs,
        "total_action_items": total_actions,
        "total_vault_notes": total_notes,
        "documents_by_type": type_counts,
        "vault_name": VAULT_DIR.name,
    }

@app.post("/api/documents/scan", response_model=ScanResponse)
async def scan_and_extract_document(
    file: UploadFile = File(...),
    provider: str = Form("gemini"),
):
    """
    Tiếp nhận file scan PDF từ văn thư:
    1. Lưu tạm file PDF.
    2. Render trang 1 & trang cuối thành ảnh.
    3. AI Vision phân tích thể thức & trích xuất Metadata.
    4. Sinh bản xem trước ghi chú Obsidian Markdown.
    5. Trả về kết quả cho văn thư soát xét (Human-in-the-loop).
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file định dạng .pdf (Scan hoặc Digital).")

    temp_token = uuid.uuid4().hex
    temp_pdf_path = TEMP_DIR / f"{temp_token}.pdf"

    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="File PDF tải lên rỗng.")

        # Lưu file tạm
        temp_pdf_path.write_bytes(content)

        # 1. Trích xuất trang & render ảnh
        page_images, thumbnail_b64, num_pages, extracted_text = extract_pdf_pages_and_preview(content)

        # 2. Phân tích qua AI Vision
        metadata = analyze_document_with_ai(page_images, extracted_text, provider=provider)

        # 3. Tạo bản xem trước Markdown Obsidian
        markdown_preview = build_obsidian_markdown(metadata, f"temp_{file.filename}", status="pending")

        return ScanResponse(
            temp_token=temp_token,
            metadata=metadata,
            markdown_preview=markdown_preview,
            num_pages=num_pages,
            original_filename=file.filename,
            thumbnail_base64=thumbnail_b64,
        )

    except Exception as e:
        if temp_pdf_path.exists():
            try:
                temp_pdf_path.unlink()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích file scan: {str(e)}")

@app.post("/api/documents/confirm")
async def confirm_and_save_document(
    payload: ConfirmDocumentRequest,
    db: Session = Depends(get_db)
):
    """
    Văn thư xác nhận kết quả sau khi chỉnh sửa:
    1. Chuyển PDF vào Attachments.
    2. Ghi file Markdown hoàn chỉnh vào Obsidian Vault.
    3. Lưu bản ghi vào CSDL DocuVault.
    """
    try:
        pdf_filename, relative_md_path = save_document_bundle(
            temp_token=payload.temp_token,
            metadata=payload.metadata,
            status=payload.status or "verified"
        )

        doc = Document(
            doc_number=payload.metadata.doc_number,
            document_type=payload.metadata.document_type,
            title=payload.metadata.title,
            sender_org=payload.metadata.sender_org,
            signer_name=payload.metadata.signer_name,
            signer_title=payload.metadata.signer_title,
            issue_date=payload.metadata.issue_date,
            urgency=payload.metadata.urgency,
            summary=payload.metadata.summary,
            pdf_filename=pdf_filename,
            markdown_filename=relative_md_path,
            status=payload.status or "verified",
        )
        doc.recipients = payload.metadata.recipients
        doc.action_items = payload.metadata.action_items
        doc.tags = payload.metadata.tags
        doc.related_entities = payload.metadata.related_entities

        db.add(doc)
        db.commit()
        db.refresh(doc)

        return {
            "message": "Lưu trữ văn bản và đồng bộ Obsidian Second Brain thành công!",
            "document": doc.to_dict(),
        }

    except FileNotFoundError as fnf:
        raise HTTPException(status_code=404, detail=str(fnf))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu văn bản: {str(e)}")

@app.get("/api/documents")
async def list_documents(
    q: Optional[str] = Query(None, description="Từ khóa tìm kiếm"),
    doc_type: Optional[str] = Query(None, description="Lọc theo loại văn bản"),
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Lấy danh sách sổ văn bản có tìm kiếm và bộ lọc"""
    query = db.query(Document)

    if doc_type and doc_type != "Tất cả":
        query = query.filter(Document.document_type == doc_type)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Document.title.ilike(term),
                Document.doc_number.ilike(term),
                Document.sender_org.ilike(term),
                Document.signer_name.ilike(term),
                Document.summary.ilike(term),
                Document.tags_json.ilike(term),
            )
        )

    total = query.count()
    documents = query.order_by(Document.id.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "documents": [d.to_dict() for d in documents],
    }

@app.get("/api/documents/{doc_id}")
async def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy văn bản.")

    # Đọc kèm nội dung Markdown trong Vault nếu có
    md_content = ""
    if doc.markdown_filename:
        md_file = VAULT_DIR / doc.markdown_filename
        if md_file.exists():
            try:
                md_content = md_file.read_text(encoding="utf-8")
            except Exception:
                pass

    result = doc.to_dict()
    result["markdown_content"] = md_content
    return result

@app.get("/api/documents/{doc_id}/pdf")
async def get_document_pdf(
    doc_id: int,
    download: bool = Query(False, description="Tải về máy thay vì xem trực tiếp"),
    db: Session = Depends(get_db)
):
    """Stream file PDF scan để nhúng vào giao diện xem trực tiếp (inline) hoặc tải về"""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc or not doc.pdf_filename:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin file PDF.")

    pdf_path = ATTACHMENTS_DIR / doc.pdf_filename
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="File PDF không tồn tại trong thư mục Attachments.")

    disposition = "attachment" if download else "inline"
    disp_header = safe_content_disposition(disposition, doc.pdf_filename)
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": disp_header,
            "X-Content-Type-Options": "nosniff",
        }
    )

@app.get("/api/documents/{doc_id}/page-count")
async def get_document_page_count(doc_id: int, db: Session = Depends(get_db)):
    """Lấy tổng số trang của file scan"""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc or not doc.pdf_filename:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin file PDF.")
    pdf_path = ATTACHMENTS_DIR / doc.pdf_filename
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="File PDF không tồn tại.")
    return {"total_pages": get_pdf_total_pages(pdf_path)}

@app.get("/api/documents/{doc_id}/pages/{page_num}")
async def get_document_page_image(doc_id: int, page_num: int, db: Session = Depends(get_db)):
    """Trả về hình ảnh chất lượng cao của từng trang để hiển thị trực tiếp trong viewer nội bộ"""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc or not doc.pdf_filename:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin file PDF.")

    pdf_path = ATTACHMENTS_DIR / doc.pdf_filename
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="File PDF không tồn tại.")

    try:
        img_bytes = render_pdf_page_image(pdf_path, page_num - 1, dpi=160)
        return Response(content=img_bytes, media_type="image/jpeg")
    except IndexError:
        raise HTTPException(status_code=404, detail="Không tìm thấy trang yêu cầu.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/temp-pdf/{token}")
async def get_temp_pdf(token: str):
    """Cho phép xem trước file PDF scan tạm thời trên giao diện Review (inline)"""
    temp_file = TEMP_DIR / f"{token}.pdf"
    if not temp_file.exists():
        raise HTTPException(status_code=404, detail="File tạm không tồn tại hoặc đã hết hạn.")
    return FileResponse(
        path=temp_file,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
        }
    )

@app.get("/api/temp-pdf/{token}/pages/{page_num}")
async def get_temp_pdf_page_image(token: str, page_num: int):
    """Render trang ảnh cho file PDF tạm thời"""
    temp_file = TEMP_DIR / f"{token}.pdf"
    if not temp_file.exists():
        raise HTTPException(status_code=404, detail="File tạm không tồn tại.")
    try:
        img_bytes = render_pdf_page_image(temp_file, page_num - 1, dpi=160)
        return Response(content=img_bytes, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/documents/{doc_id}")
async def update_document(
    doc_id: int,
    payload: DocumentUpdate,
    db: Session = Depends(get_db)
):
    """Cập nhật thông tin văn bản & đồng bộ lại file Markdown trong Vault"""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy văn bản.")

    update_data = payload.dict(exclude_unset=True)
    for field, val in update_data.items():
        if field in ["recipients", "action_items", "tags", "related_entities"]:
            setattr(doc, field, val)
        else:
            setattr(doc, field, val)

    # Cập nhật lại file Markdown tương ứng trong Vault
    if doc.markdown_filename:
        md_file = VAULT_DIR / doc.markdown_filename
        if md_file.exists():
            meta = DocumentMetadata(
                doc_number=doc.doc_number or "",
                document_type=doc.document_type,
                title=doc.title,
                sender_org=doc.sender_org or "",
                signer_name=doc.signer_name or "",
                signer_title=doc.signer_title or "",
                issue_date=doc.issue_date or "",
                recipients=doc.recipients,
                urgency=doc.urgency,
                summary=doc.summary or "",
                action_items=doc.action_items,
                tags=doc.tags,
                related_entities=doc.related_entities,
            )
            new_md = build_obsidian_markdown(meta, doc.pdf_filename or "", status=doc.status)
            md_file.write_text(new_md, encoding="utf-8")

    db.commit()
    db.refresh(doc)
    return {"message": "Cập nhật văn bản thành công!", "document": doc.to_dict()}

@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy văn bản.")

    db.delete(doc)
    db.commit()
    return {"message": "Đã xóa văn bản khỏi Sổ lưu trữ."}

# ==========================================
# ENDPOINT CHATBOT AI VÀ SECOND BRAIN (JARVIS)
# ==========================================

@app.post("/api/chat")
async def chat_with_assistant(request: ChatRequest):
    """
    Trợ lý AI Doanh nghiệp (DocuVault AI Assistant)
    Tích hợp sâu với Obsidian Second Brain & CSDL văn bản.
    """
    system_instruction = """Bạn là Trợ lý AI Quản trị Tri thức Doanh nghiệp (DocuVault Assistant), kết nối trực tiếp với Obsidian Second Brain và Sổ văn bản lưu trữ.

Trách nhiệm của bạn:
1. Hỗ trợ tra cứu nhanh các văn bản đến/đi, quyết định, công văn, chỉ đạo bằng công cụ `query_documents`.
2. Đọc và phân tích các ghi chú tri thức, mạng lưới liên kết trong Obsidian Vault qua công cụ `read_note` và `search_notes`.
3. Giúp tóm tắt, trích xuất danh sách công việc (`- [ ]`), tổng hợp báo cáo chỉ đạo và hỗ trợ soạn thảo ghi chú mới với `write_note`.
4. Luôn giữ phong cách giao tiếp chuyên nghiệp, chuẩn mực công vụ, rõ ràng và mạch lạc.
5. Khi nhắc đến các thực thể, văn bản hoặc phòng ban, hãy sử dụng định dạng Wikilinks `[[Tên]]` để tương thích với Obsidian."""

    # -------------------------------------------------
    # LUỒNG 1: GEMINI (Mặc định - Nhanh, thông minh, hỗ trợ function calling)
    # -------------------------------------------------
    if request.provider.lower() == "gemini":
        if not gemini_client:
            raise HTTPException(status_code=500, detail="Chưa cấu hình GEMINI_API_KEY.")
        try:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=GEMINI_TOOLS,
                temperature=0.3,
            )
            response = gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=request.message,
                config=config,
            )
            return {"provider": "gemini", "response": response.text}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Lỗi AI Gemini: {str(e)}")

    # -------------------------------------------------
    # LUỒNG 2: OPENAI (GPT-4o-mini)
    # -------------------------------------------------
    elif request.provider.lower() == "openai":
        if not openai_client:
            raise HTTPException(status_code=500, detail="Chưa cấu hình OPENAI_API_KEY.")
        try:
            messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": request.message},
            ]
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=OPENAI_TOOLS,
                tool_choice="auto",
            )
            resp_msg = response.choices[0].message

            if resp_msg.tool_calls:
                messages.append(resp_msg)
                for tool_call in resp_msg.tool_calls:
                    fn_name = tool_call.function.name
                    args = json.loads(tool_call.function.arguments)

                    if fn_name == "query_documents":
                        res = execute_query_documents(args.get("keyword", ""))
                    elif fn_name == "read_note":
                        res = execute_read_note(args.get("filename", ""))
                    elif fn_name == "search_notes":
                        res = execute_search_notes(args.get("keyword", ""))
                    elif fn_name == "write_note":
                        res = execute_write_note(args.get("filename", ""), args.get("content", ""))
                    else:
                        res = "Công cụ không được hỗ trợ."

                    messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": fn_name,
                        "content": res,
                    })

                final_resp = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                )
                return {"provider": "openai", "response": final_resp.choices[0].message.content}

            return {"provider": "openai", "response": resp_msg.content}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Lỗi AI OpenAI: {str(e)}")

    else:
        raise HTTPException(status_code=400, detail="Provider không hợp lệ. Chọn 'gemini' hoặc 'openai'.")
