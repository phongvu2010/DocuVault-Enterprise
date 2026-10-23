from typing import List, Optional
from pydantic import BaseModel, Field

class DocumentMetadata(BaseModel):
    doc_number: Optional[str] = Field(default="", description="Số và ký hiệu văn bản (vd: 142/QĐ-UBND)")
    document_type: str = Field(default="Công văn", description="Loại văn bản: Quyết định, Công văn, Tờ trình, Thông báo, Chỉ thị, Hợp đồng...")
    title: str = Field(default="", description="Trích yếu hoặc Tiêu đề văn bản")
    sender_org: Optional[str] = Field(default="", description="Cơ quan, đơn vị hoặc tổ chức ban hành")
    signer_name: Optional[str] = Field(default="", description="Họ và tên người ký")
    signer_title: Optional[str] = Field(default="", description="Chức vụ người ký (vd: Chủ tịch, Giám đốc, Trưởng phòng)")
    issue_date: Optional[str] = Field(default="", description="Ngày tháng năm ban hành văn bản định dạng YYYY-MM-DD")
    recipients: List[str] = Field(default_factory=list, description="Danh sách nơi nhận hoặc đối tượng thi hành")
    urgency: str = Field(default="Bình thường", description="Độ khẩn: Bình thường, Khẩn, Thượng khẩn, Hỏa tốc")
    summary: str = Field(default="", description="Tóm tắt ngắn gọn 2-4 câu nội dung cốt lõi của văn bản")
    action_items: List[str] = Field(default_factory=list, description="Các đầu việc cụ thể, chỉ đạo hành động, nhiệm vụ hoặc deadline")
    tags: List[str] = Field(default_factory=list, description="Các thẻ phân loại bắt đầu bằng # (vd: #vanban/den, #kehoach)")
    related_entities: List[str] = Field(default_factory=list, description="Các thực thể, dự án, cá nhân hoặc văn bản liên quan để tạo Wikilinks")

class ScanResponse(BaseModel):
    temp_token: str
    metadata: DocumentMetadata
    markdown_preview: str
    num_pages: int
    original_filename: str
    thumbnail_base64: Optional[str] = None

class ConfirmDocumentRequest(BaseModel):
    temp_token: str
    metadata: DocumentMetadata
    status: Optional[str] = "verified"

class DocumentUpdate(BaseModel):
    doc_number: Optional[str] = None
    document_type: Optional[str] = None
    title: Optional[str] = None
    sender_org: Optional[str] = None
    signer_name: Optional[str] = None
    signer_title: Optional[str] = None
    issue_date: Optional[str] = None
    recipients: Optional[List[str]] = None
    urgency: Optional[str] = None
    summary: Optional[str] = None
    action_items: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    related_entities: Optional[List[str]] = None
    status: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    provider: str = "gemini"  # Hoặc 'openai'

class NoteContent(BaseModel):
    content: str
