# Sử dụng image Node.js 22 gọn nhẹ
FROM node:22-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy các file cấu hình và cài đặt dependencies
COPY package*.json ./
RUN npm install

# Copy toàn bộ mã nguồn frontend vào container
COPY . .

# Mở cổng 5173 cho Vite
EXPOSE 5173

# Khởi chạy Vite server, bind vào 0.0.0.0 để có thể truy cập từ bên ngoài container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
