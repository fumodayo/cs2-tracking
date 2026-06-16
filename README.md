# CS2 Case Tracker 📦

Ứng dụng theo dõi, quản lý kho hòm (Cases) Counter-Strike 2, tích hợp cập nhật giá tự động qua Steam Market API và phân tích bài viết/hình ảnh kho đồ (Post & Image Inventory Analysis) sử dụng AI.

---

## 🚀 Tính Năng Chính

- **Quản lý Portfolio:** Theo dõi số lượng hòm, giá mua (VND), tính toán lợi nhuận/thua lỗ (Profit/Loss) thời gian thực.
- **Định Giá Đa Nguồn (Steam & BUFF163):** 
  - Tự động lấy giá trực tiếp từ Steam Market (VND).
  - Tích hợp cổng API CS2Cap để lấy giá BUFF163 (CNY), tự động chuyển đổi sang VND theo tỷ giá tùy chỉnh.
  - Cơ chế fallback thông minh sử dụng cơ sở dữ liệu giá của CSGOTrader khi bị rate limit (lỗi 429) kèm cache giá local 6 giờ.
- **Quét Kho Đồ Chuyên Sâu (Inventory Scanner):**
  - Quét trực tiếp kho đồ Steam qua SteamID64 (hỗ trợ cả kho đồ public và private/Family View qua cookie bảo mật `steamLoginSecure` và `steamparental`).
  - Hỗ trợ nhập và tự động gộp số lượng hòm nằm bên trong các **Storage Units**.
  - Phân tích chi tiết trạng thái hòm: tradeable (giao dịch được), hold (bị giữ giao dịch với chi tiết số ngày hold), trade-protected (được bảo vệ) và item đang treo trên Steam Market.
  - Cơ chế lưu cache quét kho đồ thông minh, tự động hết hạn vào lúc 14:00 hàng ngày (giờ UTC+7) để giảm thiểu số lượt gọi Steam API.
- **Trình Phân Tích Bài Đăng & Hình Ảnh (Post Analyzer):** 
  - Sử dụng Google Gemini AI (`gemini-2.5-flash`) để phân tích danh sách hòm từ bài đăng Facebook (văn bản) hoặc ảnh chụp màn hình kho đồ để trích xuất số lượng và định giá nhanh.
  - Cơ chế chống quá tải rate limit cho Gemini AI và cache kết quả phân tích theo MD5 fingerprint để tiết kiệm chi phí gọi API.
- **Import/Export Excel:** Nhập hoặc xuất danh sách hòm theo dõi thông qua file Excel nhanh chóng.
- **Hỗ trợ Đa ngôn ngữ (i18n) & Bảo mật:** Giao diện song ngữ Việt - Anh, hỗ trợ đăng nhập qua Google OAuth và mã hóa AES các thông tin cookie nhạy cảm của người dùng.

---

## 📁 Cấu Trúc Thư Mục Dự Án (`src/`)

Dự án áp dụng mô hình **Clean Architecture / Domain-Driven Design (DDD) lai** tối ưu hóa các module tính năng (Feature-based Modular UI):

```
src/
├── app/                  # Next.js App Router (Pages, API Endpoints)
├── components/           # UI Components chia theo các Feature Modules riêng biệt
│   ├── dashboard/        # Dashboard chính & điều phối (Dashboard Orchestrator, cards...)
│   ├── portfolio/        # Module Portfolio (bảng danh mục, cột, import/export Excel...)
│   ├── post-analyzer/    # Module phân tích bài viết & hình ảnh AI (Facebook, Manual...)
│   ├── steam-accounts/   # Module liên kết & quản lý các tài khoản Steam (Storage Units...)
│   ├── inventory-scanner/# Module quét kho đồ qua Steam API
│   ├── ui/               # Các UI components nguyên bản dùng chung (Button, Dialog...)
│   └── auth/             # Các thành phần xác thực (Session Provider...)
├── domain/               # Core Business Models & Repository Interfaces (Purity)
│   ├── case-item.ts      # Mô hình hòm CS2
│   ├── portfolio-item.ts # Mô hình vật phẩm theo dõi trong danh mục
│   ├── storage-unit.ts   # Mô hình hòm lưu trữ (Storage Unit) của Steam
│   ├── price.ts          # Mô hình giá và lịch sử giá (Price Snapshot)
│   └── repositories.ts   # Định nghĩa Interface cho các Repository
├── infrastructure/       # Triển khai kỹ thuật (Database, Steam Driver, Gemini Client...)
│   ├── db/               # Kết nối MongoDB (mongo-client.ts) và mappers dữ liệu
│   ├── price/            # Steam Market API Client & CSGOTrader Price Fallback
│   ├── repositories/     # Triển khai cụ thể các Repository với MongoDB
│   ├── steam.ts          # Steam Integration Driver (fetch API, parse cookies)
│   └── gemini-retry.ts   # Cơ chế retry & chống quá tải (rate limit) khi gọi Gemini AI
├── services/             # Application Services (Xử lý logic nghiệp vụ chính)
│   ├── parser/           # Engine phân tích dữ liệu Facebook (parser, image-extractor)
│   ├── portfolio-service.ts        # Quản lý thêm/sửa/xóa portfolio
│   ├── portfolio-report-service.ts # Tính toán tổng quan, thống kê, phân phối hòm
│   ├── price-service.ts            # Quản lý cập nhật giá hòm
│   ├── post-analysis-service.ts    # Logic gọi Gemini AI phân tích bài đăng/hình ảnh
│   └── auth-service.ts             # Xử lý xác thực người dùng
├── stores/               # Các micro-state store (import-store, sync-store, toast-store)
├── types/                # TypeScript type definitions chung
└── utils/                # Các hàm tiện ích định dạng (format.ts) và css (cn.ts)
```

---

## 🗄️ Cấu Trúc Database (MongoDB)

Dự án sử dụng cơ sở dữ liệu MongoDB để lưu trữ dữ liệu. Cấu trúc chi tiết các Collection và mối quan hệ được trình bày chi tiết tại:  
👉 [Tài liệu Kiến trúc & Database (docs/ARCHITECTURE.md)](./docs/ARCHITECTURE.md)

Các Collection chính:
1. `cases`: Danh mục các loại hòm CS2 được hỗ trợ (ID, tên hiển thị, tên market_hash_name, ảnh, độ hiếm...).
2. `portfolio_items`: Danh sách các hòm người dùng đang theo dõi (số lượng, giá mua, tài khoản nguồn, storage unit, ngày hết hold, trạng thái...).
3. `price_snapshots`: Lịch sử biến động giá của hòm theo thời gian để vẽ biểu đồ (VND, nguồn: steam-market hoặc csgotrader-fallback).
4. `storage_units`: Thông tin các hòm lưu trữ (Storage Units) được import từ Steam (ID, tên, tổng số lượng, danh sách item bên trong).
5. `post_analysis_history`: Nhật ký và cache kết quả phân tích bài đăng/hình ảnh kho đồ qua Gemini AI, sử dụng fingerprint MD5 để tránh trùng lặp.
6. `portfolio_accounts`: Danh sách tài khoản Steam được người dùng liên kết (SteamID64, profile name, avatar, steamCookie mã hóa...).
7. `inventory_scan_cache`: Cache lưu trữ dữ liệu quét kho đồ của từng tài khoản Steam, tự động hết hạn hàng ngày.
8. `users`: Thông tin tài khoản người dùng đăng nhập bằng Google OAuth.

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy Dự Án

### 1. Yêu Cầu Hệ Thống
- Node.js 18+ hoặc 20+
- MongoDB instance (đang chạy local hoặc MongoDB Atlas)

### 2. Thiết Lập Biến Môi Trường (`.env`)
Tạo file `.env` từ file `.env.example` và điền đầy đủ thông tin:
```bash
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=cs2_case_tracker

# API Key của Gemini cho tính năng Post Analyzer
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# API Key của CS2Cap cho tính năng lấy giá BUFF163
CS2CAP_API_KEY=your_cs2cap_api_key

# Cấu hình Google OAuth (Xác thực)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
AUTH_SECRET=your_auth_secret

# Cấu hình lưu trữ ảnh Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Cài Đặt và Chạy Dev Mode
```bash
# Cài đặt các thư viện phụ thuộc
npm install

# Chạy server ở chế độ phát triển
npm run dev
```
Ứng dụng sẽ hoạt động tại địa chỉ: [http://localhost:3000](http://localhost:3000)
