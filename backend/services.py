import base64
import json
import os
import re
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

import pymupdf  # PyMuPDF
from PIL import Image
from openai import OpenAI
from google import genai
from google.genai import types

from database import VAULT_DIR, ATTACHMENTS_DIR, DOCUMENTS_VAULT_DIR
from schemas import DocumentMetadata

# Thư mục tạm lưu PDF scan đang chờ thẩm duyệt
TEMP_DIR = VAULT_DIR / ".temp_scans"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# Khởi tạo API Clients
openai_client = OpenAI() if os.getenv("OPENAI_API_KEY") else None
gemini_client = genai.Client() if os.getenv("GEMINI_API_KEY") else None

def slugify(text: str) -> str:
    """Tạo slug an toàn cho tên file từ tiêu đề/số hiệu văn bản"""
    if not text:
        return f"doc_{uuid.uuid4().hex[:8]}"
    text = re.sub(r'[^\w\s-]', '_', text.strip())
    text = re.sub(r'[-\s]+', '_', text)
    return text[:60]

def extract_pdf_pages_and_preview(pdf_bytes: bytes, max_pages: int = 2) -> Tuple[List[bytes], Optional[str], int, str]:
    """
    Sử dụng PyMuPDF để:
    1. Lấy tổng số trang.
    2. Render trang 1 (tiêu đề, số hiệu, trích yếu) và trang cuối (chữ ký, con dấu, nơi nhận) thành ảnh JPEG.
    3. Tạo ảnh thumbnail base64 của trang 1 để xem trước nhanh trên web.
    4. Trích xuất text layer nếu có.
    """
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    num_pages = len(doc)
    extracted_text = ""
    page_images_bytes = []
    thumbnail_base64 = None

    if num_pages == 0:
        raise ValueError("File PDF rỗng, không chứa trang nào.")

    # Xác định các trang cần render cho AI phân tích
    # Thường trang 0 là đầu văn bản, trang cuối num_pages - 1 là nơi ký tên & đóng dấu
    pages_to_render = [0]
    if num_pages > 1:
        pages_to_render.append(num_pages - 1)

    for idx, page_num in enumerate(pages_to_render):
        page = doc.load_page(page_num)
        
        # Trích xuất text nếu có sẵn
        extracted_text += f"\n--- Trang {page_num + 1} ---\n" + page.get_text()

        # Render ảnh độ phân giải cao cho AI Vision (DPI 150)
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("jpeg")
        page_images_bytes.append(img_bytes)

        # Tạo thumbnail cho trang đầu tiên (DPI 72 hoặc thu nhỏ)
        if idx == 0:
            thumb_pix = page.get_pixmap(dpi=72)
            thumb_b64 = base64.b64encode(thumb_pix.tobytes("jpeg")).decode("utf-8")
            thumbnail_base64 = f"data:image/jpeg;base64,{thumb_b64}"

    return page_images_bytes, thumbnail_base64, num_pages, extracted_text

def render_pdf_page_image(pdf_path: Path, page_num: int = 0, dpi: int = 150) -> bytes:
    """Render một trang cụ thể của file PDF thành ảnh JPEG chất lượng cao để xem trực tiếp"""
    doc = pymupdf.open(pdf_path)
    if page_num < 0 or page_num >= len(doc):
        raise IndexError(f"Trang {page_num + 1} vượt quá tổng số {len(doc)} trang.")
    page = doc.load_page(page_num)
    pix = page.get_pixmap(dpi=dpi)
    return pix.tobytes("jpeg")

def get_pdf_total_pages(pdf_path: Path) -> int:
    """Lấy tổng số trang của file PDF"""
    doc = pymupdf.open(pdf_path)
    return len(doc)

SYSTEM_EXTRACTION_PROMPT = """Bạn là Chuyên gia Văn thư Lưu trữ & AI phân tích thể thức văn bản hành chính Việt Nam (theo Nghị định 30/2020/NĐ-CP).
Nhiệm vụ của bạn là đọc các trang scan văn bản (được cung cấp dạng hình ảnh và/hoặc text) và bóc tách CHÍNH XÁC các thông tin sau thành JSON có cấu trúc:

1. doc_number: Số và ký hiệu văn bản (vd: "142/QĐ-UBND", "56/TTr-STTTT", "210/BC-KH"). Nếu không có, ghi "".
2. document_type: Loại văn bản (Quyết định, Công văn, Tờ trình, Thông báo, Chỉ thị, Báo cáo, Kế hoạch, Hợp đồng, Quy chế, v.v.).
3. title: Trích yếu nội dung hoặc Tiêu đề văn bản (thường ở dưới số ký hiệu hoặc sau cụm từ 'V/v: ...').
4. sender_org: Cơ quan, đơn vị, doanh nghiệp hoặc tổ chức ban hành (ở góc trên bên trái trang đầu).
5. signer_name: Họ tên người ký văn bản (thường ở góc dưới bên phải trang cuối, phía dưới chức danh và chữ ký).
6. signer_title: Chức vụ người ký (vd: Chủ tịch, Phó Giám đốc, Trưởng phòng, Kế toán trưởng).
7. issue_date: Ngày tháng năm ban hành văn bản chuẩn định dạng 'YYYY-MM-DD'. Ví dụ: 'ngày 15 tháng 10 năm 2026' -> '2026-10-15'. Nếu không rõ năm, suy luận hợp lý hoặc ghi ngày hiện tại.
8. recipients: Danh sách tên cơ quan, phòng ban nhận văn bản (ở mục 'Nơi nhận:' góc dưới bên trái trang cuối).
9. urgency: Độ khẩn ('Bình thường', 'Khẩn', 'Thượng khẩn', 'Hỏa tốc').
10. summary: Bản tóm tắt súc tích (3-5 câu) nêu rõ: Mục đích văn bản, nội dung chính, ngân sách/thời hạn (nếu có), đối tượng chịu trách nhiệm.
11. action_items: Danh sách các nhiệm vụ cụ thể, chỉ đạo giao việc hoặc deadline bắt buộc thực hiện (vd: ['Phòng CNTT lập hồ sơ mời thầu trước ngày 15/11', 'Sở Tài chính phân bổ dự toán']).
12. tags: Danh sách các hashtag phân loại để đưa vào Obsidian, luôn bắt đầu bằng dấu # (vd: ['#vanban/den', '#loai/quyetdinh', '#duan/chuyendoiso']).
13. related_entities: Danh sách các thực thể quan trọng (tên người, tên cơ quan, tên dự án, số văn bản liên quan) để tạo liên kết Wikilinks trong Obsidian Second Brain (vd: ['UBND Tỉnh X', 'Nguyễn Văn A', 'Dự án Cổng Dịch vụ công']).

BẮT BUỘC TRẢ VỀ DUY NHẤT MỘT ĐỐI TƯỢNG JSON HỢP LỆ VỚI CÁC TRƯỜNG TRÊN. Không thêm bất kỳ lời dẫn nào ngoài JSON."""

def analyze_document_with_ai(page_images: List[bytes], extracted_text: str, provider: str = "gemini") -> DocumentMetadata:
    """
    Gửi ảnh scan trang văn bản tới AI Vision (Gemini 2.5 Flash hoặc GPT-4o-mini)
    để trích xuất metadata theo chuẩn hành chính.
    """
    provider = provider.lower()

    # Ưu tiên Gemini vì xử lý ảnh tiếng Việt xuất sắc và hỗ trợ Structured JSON native
    if provider == "gemini" and gemini_client:
        try:
            parts = []
            for img in page_images:
                parts.append(types.Part.from_bytes(data=img, mime_type="image/jpeg"))

            prompt_text = SYSTEM_EXTRACTION_PROMPT
            if extracted_text and extracted_text.strip():
                prompt_text += f"\n\nNội dung văn bản trích xuất được từ PDF:\n{extracted_text[:4000]}"

            parts.append(types.Part.from_text(text=prompt_text))

            response = gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=parts,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                )
            )

            raw_json = response.text.strip()
            data = json.loads(raw_json)
            return DocumentMetadata(**data)
        except Exception as e:
            # Fallback sang OpenAI nếu Gemini gặp lỗi
            if openai_client:
                return _analyze_with_openai(page_images, extracted_text)
            raise RuntimeError(f"Lỗi phân tích tài liệu bằng Gemini: {str(e)}")

    elif openai_client:
        return _analyze_with_openai(page_images, extracted_text)
    else:
        raise RuntimeError("Không tìm thấy cấu hình API Key cho Gemini hoặc OpenAI trong hệ thống.")

def _analyze_with_openai(page_images: List[bytes], extracted_text: str) -> DocumentMetadata:
    """Phân tích văn bản bằng GPT-4o-mini Vision"""
    try:
        content_items = [
            {"type": "text", "text": SYSTEM_EXTRACTION_PROMPT + (f"\n\nText trích xuất:\n{extracted_text[:4000]}" if extracted_text else "")}
        ]
        for img in page_images:
            b64_img = base64.b64encode(img).decode("utf-8")
            content_items.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64_img}", "detail": "high"}
            })

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": content_items}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        data = json.loads(response.choices[0].message.content)
        return DocumentMetadata(**data)
    except Exception as e:
        raise RuntimeError(f"Lỗi phân tích tài liệu bằng OpenAI: {str(e)}")

def build_obsidian_markdown(metadata: DocumentMetadata, pdf_filename: str, status: str = "verified") -> str:
    """
    Sinh nội dung Markdown tiêu chuẩn cho Obsidian Second Brain:
    - YAML Frontmatter hoàn chỉnh
    - Wikilinks [[...]] cho người ký, đơn vị, dự án
    - Tags phân loại
    - Callout thông tin trích yếu
    - Tóm tắt điều hành
    - Action Items dạng Checklist: - [ ]
    - Liên kết tới file scan gốc trong Attachments
    """
    recipients_yaml = "\n".join([f'  - "[[{r.strip()}]]"' for r in metadata.recipients if r.strip()])
    if not recipients_yaml:
        recipients_yaml = "  - Không có"

    tags_yaml = "\n".join([f'  - "{t.strip() if t.startswith("#") else f"#{t.strip()}"}"' for t in metadata.tags if t.strip()])
    if not tags_yaml:
        tags_yaml = '  - "#vanban/den"'

    # Format action items checklist
    action_items_md = ""
    if metadata.action_items:
        for item in metadata.action_items:
            action_items_md += f"- [ ] {item}\n"
    else:
        action_items_md = "- [ ] Chưa có nhiệm vụ cụ thể được giao.\n"

    # Format related entities
    entities_links = []
    if metadata.sender_org:
        entities_links.append(f"[[{metadata.sender_org}]]")
    if metadata.signer_name:
        entities_links.append(f"[[{metadata.signer_name}]]")
    for ent in metadata.related_entities:
        if ent and ent not in entities_links:
            entities_links.append(f"[[{ent}]]")
    
    entities_md = ", ".join(entities_links) if entities_links else "Không có"

    doc_num_str = metadata.doc_number if metadata.doc_number else "Chưa có số"
    issue_date_str = metadata.issue_date if metadata.issue_date else datetime.now().strftime("%Y-%m-%d")

    md = f"""---
id: "{slugify(metadata.doc_number or metadata.title)}"
doc_number: "{doc_num_str}"
document_type: "{metadata.document_type}"
issue_date: {issue_date_str}
sender: "[[{metadata.sender_org or 'Chưa xác định'}]]"
signer: "[[{metadata.signer_name or 'Chưa xác định'}]]"
signer_title: "{metadata.signer_title or 'Chưa rõ'}"
urgency: "{metadata.urgency}"
recipients:
{recipients_yaml}
tags:
{tags_yaml}
file_scan: "Attachments/{pdf_filename}"
status: "{status}"
created_at: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
---

# {metadata.document_type} số {doc_num_str}: {metadata.title}

> [!INFO] **Thông tin Thể thức Văn bản:**
> - **Cơ quan ban hành:** [[{metadata.sender_org or 'Chưa rõ'}]]
> - **Người ký:** [[{metadata.signer_name or 'Chưa rõ'}]] ({metadata.signer_title or 'Chức vụ'})
> - **Ngày ban hành:** {issue_date_str}
> - **Độ khẩn:** {metadata.urgency}
> - **Nơi nhận:** {", ".join(metadata.recipients) if metadata.recipients else "Lưu văn thư"}

## 📌 Tóm tắt nội dung điều hành (Executive Summary)
{metadata.summary or 'Chưa có bản tóm tắt nội dung.'}

## ⚡ Nhiệm vụ & Chỉ đạo thực hiện (Action Items)
{action_items_md}
## 🔗 Mạng lưới tri thức liên quan (Second Brain Graph)
- **Thực thể liên kết:** {entities_md}
- **Văn bản scan gốc:** [[Attachments/{pdf_filename}|📄 Xem file scan đính kèm]]

---
*Ghi chú được tự động khởi tạo bởi DocuVault Enterprise Second Brain.*
"""
    return md

def save_document_bundle(
    temp_token: str,
    metadata: DocumentMetadata,
    status: str = "verified"
) -> Tuple[str, str]:
    """
    Hoàn tất việc lưu trữ văn bản:
    1. Đổi tên và di chuyển file scan PDF từ thư mục tạm sang `vault/Attachments/<tên_chuẩn>.pdf`.
    2. Tạo thư mục theo Năm/Tháng trong `vault/VanBan/YYYY/MM/`.
    3. Ghi file Markdown chuẩn Obsidian vào thư mục trên.
    Trả về: (pdf_filename, relative_markdown_path)
    """
    temp_file = TEMP_DIR / f"{temp_token}.pdf"
    if not temp_file.exists():
        raise FileNotFoundError(f"Không tìm thấy file scan tạm thời với mã token: {temp_token}")

    # Đặt tên file chuẩn
    date_part = metadata.issue_date or datetime.now().strftime("%Y-%m-%d")
    year_month = date_part[:7].replace("-", "/")
    
    slug = slugify(f"{date_part}_{metadata.doc_number}_{metadata.document_type}")
    pdf_filename = f"{slug}.pdf"
    final_pdf_path = ATTACHMENTS_DIR / pdf_filename

    # Di chuyển file PDF vào Attachments
    final_pdf_path.write_bytes(temp_file.read_bytes())
    try:
        temp_file.unlink()  # Xóa file tạm
    except Exception:
        pass

    # Tạo thư mục con trong VanBan/YYYY/MM
    target_vault_dir = DOCUMENTS_VAULT_DIR / year_month
    target_vault_dir.mkdir(parents=True, exist_ok=True)

    markdown_filename = f"{slug}.md"
    markdown_path = target_vault_dir / markdown_filename

    # Sinh Markdown và lưu
    md_content = build_obsidian_markdown(metadata, pdf_filename, status=status)
    markdown_path.write_text(md_content, encoding="utf-8")

    # Đường dẫn tương đối từ gốc Vault
    relative_md_path = str(markdown_path.relative_to(VAULT_DIR)).replace("\\", "/")

    return pdf_filename, relative_md_path
