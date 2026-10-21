# Sử dụng image Python base gọn nhẹ
FROM python:3.12-slim

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy file requirements và cài đặt thư viện
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn vào container
COPY jarvis_obsidian_api.py .

# Tạo sẵn một thư mục rỗng để làm điểm mount cho Docker Volume
RUN mkdir -p /Jarvis-Memory

# Mở port 8000 cho FastAPI
EXPOSE 8000

# Lệnh khởi chạy server uvicorn
CMD ["uvicorn", "jarvis_obsidian_api:app", "--host", "0.0.0.0", "--port", "8000"]
