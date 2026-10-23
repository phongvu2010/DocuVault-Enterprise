import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    doc_number = Column(String(100), index=True, nullable=True)  # Số ký hiệu văn bản (vd: 142/QĐ-UBND)
    document_type = Column(String(50), index=True, default="Văn bản")  # Quyết định, Công văn, Tờ trình...
    title = Column(Text, nullable=False)  # Trích yếu / Tiêu đề văn bản
    sender_org = Column(String(255), index=True, nullable=True)  # Cơ quan ban hành
    signer_name = Column(String(150), index=True, nullable=True)  # Người ký
    signer_title = Column(String(150), nullable=True)  # Chức vụ người ký
    issue_date = Column(String(20), index=True, nullable=True)  # Ngày ban hành (YYYY-MM-DD)
    recipients_json = Column(Text, default="[]")  # Danh sách nơi nhận (JSON)
    urgency = Column(String(50), default="Bình thường")  # Bình thường, Khẩn, Hỏa tốc
    summary = Column(Text, nullable=True)  # Tóm tắt cốt lõi
    action_items_json = Column(Text, default="[]")  # Danh sách việc cần làm / checklist (JSON)
    tags_json = Column(Text, default="[]")  # Tags phân loại (JSON)
    related_entities_json = Column(Text, default="[]")  # Thực thể để tạo Wikilinks (JSON)
    
    # Liên kết file
    pdf_filename = Column(String(255), nullable=True)  # Tên file PDF trong Attachments/
    markdown_filename = Column(String(255), nullable=True)  # Đường dẫn file .md trong Vault
    status = Column(String(50), default="verified")  # verified, pending
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def recipients(self):
        try:
            return json.loads(self.recipients_json or "[]")
        except Exception:
            return []

    @recipients.setter
    def recipients(self, val):
        self.recipients_json = json.dumps(val, ensure_ascii=False)

    @property
    def action_items(self):
        try:
            return json.loads(self.action_items_json or "[]")
        except Exception:
            return []

    @action_items.setter
    def action_items(self, val):
        self.action_items_json = json.dumps(val, ensure_ascii=False)

    @property
    def tags(self):
        try:
            return json.loads(self.tags_json or "[]")
        except Exception:
            return []

    @tags.setter
    def tags(self, val):
        self.tags_json = json.dumps(val, ensure_ascii=False)

    @property
    def related_entities(self):
        try:
            return json.loads(self.related_entities_json or "[]")
        except Exception:
            return []

    @related_entities.setter
    def related_entities(self, val):
        self.related_entities_json = json.dumps(val, ensure_ascii=False)

    def to_dict(self):
        return {
            "id": self.id,
            "doc_number": self.doc_number,
            "document_type": self.document_type,
            "title": self.title,
            "sender_org": self.sender_org,
            "signer_name": self.signer_name,
            "signer_title": self.signer_title,
            "issue_date": self.issue_date,
            "recipients": self.recipients,
            "urgency": self.urgency,
            "summary": self.summary,
            "action_items": self.action_items,
            "tags": self.tags,
            "related_entities": self.related_entities,
            "pdf_filename": self.pdf_filename,
            "markdown_filename": self.markdown_filename,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
