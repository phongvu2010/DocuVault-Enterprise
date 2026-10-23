# DocuVault Enterprise 🏛️🧠

**Hệ thống Quản lý Văn bản Doanh nghiệp Thông minh kết hợp Bộ nhớ Tri thức Thứ hai (Obsidian Second Brain)**

DocuVault Enterprise biến các tệp scan `.pdf` (văn bản hành chính, quyết định, công văn, hợp đồng) thành dữ liệu có cấu trúc trong CSDL quản trị, đồng thời tự động khởi tạo **Mạng lưới Tri thức (Knowledge Graph)** trong **Obsidian Vault** với đầy đủ YAML Frontmatter, `[[Wikilinks]]`, `#tags` và Checklist nhiệm vụ (`- [ ]`).

---

## 🌟 Tính Năng Cốt Lõi

1. **Quét & Bóc tách Thể thức AI (Multimodal Document Vision)**:
   - Tiếp nhận tệp scan `.pdf` từ nhân viên văn thư.
   - Tự động nhận diện thể thức văn bản hành chính Việt Nam (chuẩn *Nghị định 30/2020/NĐ-CP*):
     - **Số & Ký hiệu** (VD: `142/QĐ-UBND`)
     - **Loại văn bản** (Quyết định, Công văn, Tờ trình, Thông báo...)
     - **Ngày ban hành** (`YYYY-MM-DD`)
     - **Cơ quan / Đơn vị ban hành**
     - **Người ký & Chức vụ**
     - **Trích yếu nội dung & Tóm tắt điều hành**
     - **Nhiệm vụ & Chỉ đạo thực hiện (Action Items)**
     - **Thực thể liên quan (Wikilinks) & Phân loại Tags**
2. **Cơ chế Kiểm duyệt Thẩm quyền (Human-in-the-Loop)**:
   - Màn hình chia đôi (Split View): Bên trái xem file PDF scan gốc để đối soát, bên phải là form dữ liệu do AI điền sẵn.
   - Văn thư có thể bổ sung, sửa đổi hoặc thêm bớt các đầu việc trước khi bấm xác nhận.
3. **Đồng bộ Tự động vào Obsidian Second Brain**:
   - Tự động tạo note Markdown trong `vault/VanBan/YYYY/MM/<slug>.md`.
   - Lưu trữ file PDF scan gốc trong `vault/Attachments/`.
   - Sinh `[[Wikilinks]]` liên kết người ký, cơ quan, văn bản căn cứ để mở ra đồ thị Graph View trong Obsidian.
4. **Sổ Đăng Ký Văn Bản Quản Trị**:
   - Thống kê Dashboard tổng quan (Tổng văn bản, Đầu việc cần làm, Note trong Vault).
   - Tra cứu, tìm kiếm nhanh theo trích yếu, số hiệu, người ký, phòng ban.
   - Xem chi tiết, xem PDF scan nhúng trực tiếp hoặc sao chép mã nguồn Markdown.
5. **Trợ Lý Tri Thức AI (Second Brain Assistant)**:
   - Chatbot AI (hỗ trợ cả **Gemini 2.5 Flash** và **OpenAI GPT-4o-mini**) kết nối trực tiếp với CSDL và Obsidian Vault.
   - Có thể hỏi: *"Tổng hợp các nhiệm vụ cần thực hiện trong tháng này"*, *"Tìm các quyết định do ông Nguyễn Văn A ký"*, *"Đọc tóm tắt văn bản số 142"*.

---

## 🏗️ Cấu Trúc Dự Án

```
DocuVault Enterprise/
├── backend/
│   ├── database.py       # Cấu hình SQLite / PostgreSQL & thư mục Vault
│   ├── models.py         # SQLAlchemy Model Document
│   ├── schemas.py        # Pydantic Schemas (Metadata, Scan, Chat)
│   ├── services.py       # PyMuPDF rendering, Gemini/OpenAI Vision, sinh Markdown
│   ├── main.py           # FastAPI endpoints, CORS & Chat Tools
│   ├── requirements.txt  # Thư viện Python
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx           # Thanh điều hướng & chọn AI engine
│   │   │   ├── DocumentRegistry.jsx # Sổ văn bản, thống kê & modal chi tiết
│   │   │   ├── ScanIngestion.jsx    # Upload scan, AI extract & Split Review
│   │   │   └── SecondBrainChat.jsx  # Chatbot hỏi đáp kho tri thức
│   │   ├── api.js                   # Client kết nối API
│   │   ├── App.jsx                  # Main component
│   │   ├── index.css                # Tailwind CSS v4 & Obsidian theme
│   │   └── main.jsx
│   ├── package.json
│   └── Dockerfile
├── vault/                # Thư mục Obsidian Vault gốc (Second Brain)
│   ├── Attachments/      # Lưu trữ file scan .pdf
│   ├── VanBan/           # Lưu trữ các file ghi chú Markdown theo năm/tháng
│   └── docuvault.db      # CSDL SQLite quản trị (tự động đồng bộ)
├── docker-compose.yml    # Cấu hình khởi chạy trọn gói bằng Docker
├── .env                  # Cấu hình API Keys (OPENAI_API_KEY, GEMINI_API_KEY)
└── README.md
```

---

## 🚀 Hướng Dẫn Khởi Chạy

### Cách 1: Sử dụng Docker Compose (Khuyên Dùng)

1. Đảm bảo file `.env` đã có các API Key:
   ```env
   VAULT_PATH=/DocuVault-Memory
   GEMINI_API_KEY=AIzaSy...
   OPENAI_API_KEY=sk-proj-...
   ```
2. Khởi chạy toàn bộ hệ thống:
   ```bash
   docker compose up -d --build
   ```
3. Truy cập:
   - **Giao diện Web**: [http://localhost:5173](http://localhost:5173)
   - **Tài liệu API Swagger**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Cách 2: Khởi chạy Trực tiếp trên Máy tính (Local Dev)

#### 1. Khởi chạy Backend (Python 3.12+):
```bash
cd backend
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Khởi chạy Frontend (Node 20+):
```bash
cd frontend
npm install
npm run dev
```
Trình duyệt sẽ mở tại `http://localhost:5173`.
