import json
import os
import shlex
import subprocess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from openai import OpenAI
from google import genai
from google.genai import types

app = FastAPI(title="Jarvis Obsidian Memory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Chấp nhận request từ mọi nguồn (kể cả cổng 3000)
    allow_credentials=True,
    allow_methods=["*"],  # Cho phép GET, POST,...
    allow_headers=["*"],
)

VAULT_DIR = Path(os.getenv("OBSIDIAN_VAULT_PATH", "./Jarvis-Memory")).resolve()
ALLOWED_COMMANDS = {"ls", "df", "top", "free", "docker", "cat", "pwd", "whoami", "ps", "echo"}

# Cấu hình Client cho các LLM Providers
openai_client = OpenAI()
gemini_client = genai.Client()

class ChatRequest(BaseModel):
    message: str
    provider: str = "openai"  # Giá trị mặc định là "openai", có thể truyền "gemini"

class NoteContent(BaseModel):
    content: str

def get_safe_path(filename: str) -> Path:
    if not filename.endswith(".md"):
        filename += ".md"

    file_path = (VAULT_DIR / filename).resolve()

    # Đảm bảo đường dẫn cuối cùng phải nằm bên trong thư mục Vault
    if VAULT_DIR not in file_path.parents:
        raise HTTPException(status_code=400, detail="Path Traversal detected.")

    return file_path

# ==========================================
# CÁC HÀM THỰC THI CÔNG CỤ (TOOLS LOGIC)
# ==========================================
def execute_read_note(filename: str) -> str:
    file_path = get_safe_path(filename)

    if not file_path.exists():
        return "Lỗi: File không tồn tại."

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

        return "Ghi file thành công vào Obsidian Vault."
    except Exception as e:
        return f"Lỗi khi ghi file: {str(e)}"

def execute_search_notes(keyword: str) -> str:
    matches = []
    try:
        # rglob("*.md") giúp quét đệ quy toàn bộ thư mục và các thư mục con
        for file_path in VAULT_DIR.rglob("*.md"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    # Tìm kiếm không phân biệt chữ hoa/chữ thường
                    if keyword.lower() in content.lower():
                        # Lấy đường dẫn tương đối để AI dễ đọc (vd: 'Projects/Idea.md')
                        relative_path = file_path.relative_to(VAULT_DIR)
                        matches.append(str(relative_path))
            except Exception:
                continue  # Bỏ qua các file bị lỗi quyền đọc nếu có

        if not matches:
            return f"Không tìm thấy ghi chú nào chứa từ khóa '{keyword}'."

        return f"Tìm thấy từ khóa '{keyword}' trong các file sau:\n" + "\n".join(matches)
    except Exception as e:
        return f"Lỗi khi tìm kiếm: {str(e)}"

def execute_shell_command(command: str) -> str:
    try:
        # Sử dụng shlex để tách chuỗi an toàn, ngăn ngừa ký tự độc hại
        parts = shlex.split(command)
        if not parts:
            return "Lỗi: Lệnh không hợp lệ hoặc trống."

        base_cmd = parts[0]

        # 1. Kiểm tra lớp thứ nhất: Lệnh có nằm trong danh sách trắng không?
        if base_cmd not in ALLOWED_COMMANDS:
            return f"🚫 LỖI BẢO MẬT: Lệnh '{base_cmd}' bị hệ thống từ chối. Chỉ cho phép các lệnh đọc: {', '.join(ALLOWED_COMMANDS)}"

        # 2. Kiểm tra lớp thứ hai: Giới hạn riêng cho lệnh Docker
        # Ngăn chặn AI gọi 'docker rm', 'docker run' hay 'docker stop'
        if base_cmd == "docker":
            allowed_docker_subcmds = {"ps", "logs", "info", "images", "stats"}
            if len(parts) < 2 or parts[1] not in allowed_docker_subcmds:
                return f"🚫 LỖI BẢO MẬT: Lệnh Docker này bị chặn. Bạn chỉ được dùng: docker {', '.join(allowed_docker_subcmds)}"

        # 3. Thực thi an toàn với shell=False
        result = subprocess.run(
            parts,
            shell=False,  # Vô hiệu hóa tính năng thực thi qua Shell để chặn toán tử (&&, |, >)
            text=True,
            capture_output=True,
            timeout=30,
        )

        output = result.stdout.strip()
        error = result.stderr.strip()

        if result.returncode == 0:
            return f"Thành công:\n{output}" if output else "Thành công (không có đầu ra)."
        else:
            return f"Lỗi hệ thống (Mã {result.returncode}):\n{error}"
    except subprocess.TimeoutExpired:
        return "Lỗi: Quá trình thực thi vượt giới hạn 30 giây."
    except ValueError as ve:
        # Bắt lỗi cú pháp của shlex (ví dụ: thiếu dấu nháy đóng)
        return f"Lỗi cú pháp lệnh: {str(ve)}"
    except FileNotFoundError:
        return f"Lỗi: Không tìm thấy chương trình '{base_cmd}' trên hệ thống."
    except Exception as e:
        return f"Lỗi không xác định: {str(e)}"

# ==========================================
# KHAI BÁO TOOLS SCHEMA CHO TỪNG BÊN
# ==========================================
# Cấu hình định dạng chuẩn cho OpenAI
OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_note",
            "description": "Đọc nội dung một file Markdown trong thư mục Obsidian.",
            "parameters": {
                "type": "object",
                "properties": {"filename": {"type": "string"}},
                "required": ["filename"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_note",
            "description": "Tạo mới hoặc ghi đè nội dung vào một file Markdown trong Obsidian.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string"},
                    "content": {"type": "string"},
                },
                "required": ["filename", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_notes",
            "description": "Tìm kiếm một từ khóa xuyên suốt toàn bộ nội dung các file Markdown trong Obsidian Vault. Trả về danh sách tên file chứa từ khóa đó.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "Từ khóa cần tìm kiếm (ví dụ: 'Docker', 'FastAPI')",
                    },
                },
                "required": ["keyword"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_shell_command",
            "description": "Thực thi các lệnh shell/terminal trên máy chủ Linux. Sử dụng để kiểm tra hệ thống, quản lý file, hoặc theo dõi Docker.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Lệnh bash/shell cần thực thi (ví dụ: 'df -h', 'docker ps -a')"},
                },
                "required": ["command"],
            },
        },
    },
]

# Cấu hình định dạng chuẩn cho Gemini SDK mới
GEMINI_TOOLS = [execute_read_note, execute_write_note, execute_search_notes, execute_shell_command]

# ==========================================
# ENDPOINTS
# ==========================================
@app.on_event("startup")
async def startup_event():
    # Tự động tạo thư mục Vault gốc nếu chưa tồn tại
    VAULT_DIR.mkdir(parents=True, exist_ok=True)

@app.post("/api/chat")
async def chat_with_jarvis(request: ChatRequest):
    # Sử dụng chuỗi đa dòng (docstring) để định dạng System Prompt chi tiết
    system_instruction = """Bạn là Jarvis, trợ lý AI quản trị bộ nhớ cá nhân được tích hợp trực tiếp vào hệ thống Obsidian.
Nhiệm vụ của bạn là hỗ trợ người dùng suy luận, tìm kiếm và tự động hóa việc ghi chép.

Khi bạn tạo mới hoặc ghi đè một file Markdown, bạn PHẢI tuân thủ nghiêm ngặt các quy chuẩn định dạng sau của Obsidian:
1. TIÊU ĐỀ: Bắt đầu file bằng một tiêu đề H1 rõ ràng (ví dụ: # Tiêu đề).
2. LIÊN KẾT NỘI BỘ (WIKILINKS): Chủ động nhận diện các khái niệm cốt lõi, tên dự án, công nghệ hoặc tên người và bọc chúng trong ngoặc vuông kép để tạo liên kết mạng lưới. Ví dụ: "Dự án này sử dụng [[FastAPI]] và [[Docker]]."
3. GẮN THẺ (TAGS): Luôn dành phần cuối cùng của file để chèn các thẻ phân loại. Thêm một đường phân cách `---` và liệt kê ít nhất 3 tags liên quan. Ví dụ: #project #backend #planning.
4. METADATA (Tùy chọn): Nếu đây là một bản ghi chú cuộc họp hoặc nhật ký, hãy thêm ngày tháng hiện tại ở đầu file.

Quy trình xử lý truy vấn:
- Nếu người dùng hỏi thông tin không rõ ràng, hãy dùng công cụ `search_notes` để tìm danh sách file.
- Dùng công cụ `read_note` để đọc nội dung các file liên quan.
- Cuối cùng, tổng hợp câu trả lời hoặc dùng `write_note` để ghi lại kết quả nếu được yêu cầu."""

    # -------------------------------------------------
    # LUỒNG XỬ LÝ 1: OPENAI (GPT-4o / GPT-4o-mini)
    # -------------------------------------------------
    if request.provider.lower() == "openai":
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
            response_message = response.choices[0].message

            if response_message.tool_calls:
                messages.append(response_message)
                for tool_call in response_message.tool_calls:
                    args = json.loads(tool_call.function.arguments)
                    if tool_call.function.name == "read_note":
                        result = execute_read_note(args.get("filename"))
                    elif tool_call.function.name == "write_note":
                        result = execute_write_note(args.get("filename"), args.get("content"))
                    elif tool_call.function.name == "search_notes":
                        result = execute_search_notes(args.get("keyword"))
                    elif tool_call.function.name == "run_shell_command":
                        result = execute_shell_command(args.get("command"))
                    else:
                        result = "Hàm không được hỗ trợ."

                    messages.append(
                        {
                            "tool_call_id": tool_call.id,
                            "role": "tool",
                            "name": tool_call.function.name,
                            "content": result,
                        }
                    )

                final_response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                )

                return {
                    "provider": "openai",
                    "response": final_response.choices[0].message.content,
                }

            return {
                "provider": "openai",
                "response": response_message.content,
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Lỗi hệ thống OpenAI: {str(e)}",
            )

    # -------------------------------------------------
    # LUỒNG XỬ LÝ 2: GEMINI (Gemini 1.5 Flash / Pro)
    # -------------------------------------------------
    elif request.provider.lower() == "gemini":
        try:
            # Thư viện google-genai hỗ trợ tự động thực thi hàm (Automatic Function Calling) cực kỳ gọn nhẹ
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

            return {
                "provider": "gemini",
                "response": response.text,
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Lỗi hệ thống Gemini: {str(e)}",
            )

    else:
        raise HTTPException(
            status_code=400,
            detail="Provider không được hỗ trợ. Hãy chọn 'openai' hoặc 'gemini'.",
        )
