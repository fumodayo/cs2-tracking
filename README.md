# CS2 Tracking

CS2 Tracking là ứng dụng Next.js dùng để theo dõi portfolio vật phẩm Counter-Strike 2, quét inventory Steam, đồng bộ nhiều tài khoản Steam, quản lý Storage Unit, lấy giá Steam/BUFF163 và phân tích bài đăng bằng AI.

Tài liệu này là lối vào nhanh cho người mới mở repo. Nếu cần chi tiết hơn:

- [Kiến trúc hệ thống](./docs/ARCHITECTURE.md)
- [API reference](./docs/api-reference.md)
- [Hướng dẫn deploy](./docs/DEPLOYMENT.md)

## Chức Năng Chính

- **Portfolio**: thêm, sửa, xóa, import/export Excel, tính tổng vốn, giá hiện tại, lợi nhuận và phân bổ vật phẩm.
- **Inventory Scanner**: quét inventory Steam public/private, hỗ trợ cookie, Family View, item đang bán trên Market, trade hold và Storage Unit.
- **Steam Accounts Sync**: liên kết nhiều tài khoản Steam, đồng bộ từng account hoặc tất cả account vào portfolio.
- **Giá và pattern**: lấy giá Steam Market, BUFF163 qua CS2Cap, inspect float/paint seed qua CSFloat, tính overpay cho một số pattern.
- **Post Analyzer**: dùng Gemini để phân tích bài đăng/HTML/ảnh và trích xuất danh sách vật phẩm.
- **Auth và admin**: Google OAuth, session cookie, guest data, admin bug reports.
- **i18n**: giao diện tiếng Việt và tiếng Anh.

## Tech Stack

| Phần | Công nghệ |
| --- | --- |
| Framework | Next.js App Router, React 19, TypeScript |
| UI | Tailwind CSS, Radix UI, lucide-react, framer-motion |
| Data fetching | TanStack Query, fetch API |
| Database | MongoDB |
| Validation | Zod |
| AI | Google Gemini |
| External CS2 | Steam Community/Market, CS2Cap, CSFloat, CSGOTrader fallback |
| Tooling | ESLint, Prettier, Vitest |

## Chạy Local

### 1. Yêu cầu

- Node.js 20+
- npm
- MongoDB local hoặc MongoDB Atlas

### 2. Cài dependencies

```bash
npm install
```

### 3. Tạo file môi trường

Copy `.env.example` thành `.env.local` hoặc `.env`, rồi điền các biến cần thiết.

Tối thiểu để app khởi động:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=cs2_case_tracker
AUTH_SECRET=replace-with-a-long-random-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Bật thêm tính năng theo nhu cầu:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ADMIN_EMAILS=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

CS2CAP_API_KEY=
CSFLOAT_API_KEY=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### 4. Chạy dev server

```bash
npm run dev
```

Mở `http://localhost:3000`.

## Scripts

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy Next.js dev server |
| `npm run build` | Build production |
| `npm run start` | Chạy build production |
| `npm run typecheck` | Kiểm tra TypeScript |
| `npm run lint` | Kiểm tra ESLint |
| `npm run lint:fix` | Tự động sửa một phần lỗi lint |
| `npm run format` | Format bằng Prettier |
| `npm run test` | Chạy Vitest watch mode |
| `npm run test:run` | Chạy Vitest một lần |

## Bản Đồ Thư Mục

```text
src/
  app/                  Next.js pages, layouts và API routes
  components/           UI theo từng feature
  data/                 Dữ liệu tĩnh như tier/pattern/sticker map
  domain/               Entity, domain type, repository interface
  hooks/                React hooks dùng chung
  i18n/                 Bản dịch vi/en
  infrastructure/       MongoDB, repository implementation, Steam, price provider
  lib/api-client/       Client-side fetch wrappers cho UI
  services/             Application services và server-side business logic
  stores/               Micro stores cho toast, import progress, sync progress
  types/                TypeScript types dùng chung
  utils/                Format, validation, error, cookie, URL, local helpers
```

### Hướng phụ thuộc mong muốn

```text
components -> lib/api-client -> app/api
app/api -> services -> domain
services -> infrastructure khi cần gọi DB/driver cụ thể
domain -> không phụ thuộc layer khác
```

Quy ước quan trọng: `services` và `lib/api-client` không import từ `components`. Type/helper dùng chung nên đặt trong `src/types`, `src/utils`, `src/domain` hoặc module riêng phù hợp.

## Các Luồng Chính

### Portfolio

1. UI trong `src/components/dashboard` và `src/components/portfolio`.
2. UI gọi client API trong `src/lib/api-client/portfolio-api.ts`.
3. API route ở `src/app/api/portfolio`.
4. Route gọi service/repository để đọc MongoDB và tính report.
5. Kết quả trả về `PortfolioReportDto` cho UI hiển thị bảng, card và chart.

### Inventory scan

1. UI trong `src/components/inventory-scanner`.
2. `POST /api/inventory/scan` tạo scan job.
3. Client poll `GET /api/inventory/scan?jobId=...`.
4. `scan-service` gọi Steam inventory, price provider và cache.
5. Người dùng có thể import kết quả scan vào portfolio qua `/api/portfolio/import-inventory`.

### Steam account sync

1. UI trong `src/components/steam-accounts`.
2. Account/cookie được lưu trong `portfolio_accounts`.
3. Sync gọi `/api/portfolio/accounts/sync` hoặc `/sync/single`.
4. Route scan inventory, đối chiếu portfolio, cập nhật item, Storage Unit và last synced.

### Post analyzer

1. UI trong `src/components/post-analyzer`.
2. API `/api/post/analyze`, `/api/post/analyze-html`, `/api/post/analyze-chatgpt`.
3. Service tạo fingerprint, kiểm tra cache, gọi Gemini nếu cần.
4. Kết quả lưu vào `post_analysis_history`.

## Database Chính

| Collection | Nội dung |
| --- | --- |
| `users` | User Google OAuth |
| `portfolio_accounts` | Steam account đã liên kết và cookie mã hóa |
| `portfolio_items` | Item trong portfolio |
| `cases` | Catalog item/case CS2 |
| `storage_units` | Storage Unit và item bên trong |
| `price_snapshots` | Lịch sử giá |
| `inventory_scan_cache` | Cache kết quả scan Steam |
| `scan_jobs` | Trạng thái job scan ngắn hạn |
| `post_analysis_history` | Lịch sử/cache phân tích bài đăng |
| `rate_limits` | Rate limit theo key/IP |
| `bug_reports` | Bug report từ người dùng |

Index MongoDB được bootstrap lazy trong `src/infrastructure/db/ensure-indexes.ts` khi app lấy database lần đầu.

## Quy Ước Làm Việc

- UI feature đặt trong `src/components/<feature>`.
- Logic nghiệp vụ server đặt trong `src/services`.
- Client-side fetch wrapper đặt trong `src/lib/api-client`.
- Database driver, Mongo repository và external provider đặt trong `src/infrastructure`.
- Type dùng chung đặt trong `src/types` hoặc `src/domain`.
- Không đưa secret vào client. Route server phải đọc secret từ env.
- Khi thêm API mới, cập nhật [API reference](./docs/api-reference.md).
- Khi thêm collection/index/env mới, cập nhật [Architecture](./docs/ARCHITECTURE.md) và [Deployment](./docs/DEPLOYMENT.md).

## Trang Chính Của App

| Path | Mục đích |
| --- | --- |
| `/` | Trang tổng quan/home |
| `/portfolio` | Dashboard portfolio và Steam accounts |
| `/inventory-scanner` | Quét inventory Steam |
| `/post-analysis` | Phân tích bài đăng/ảnh bằng AI |
| `/admin/bug-reports` | Quản lý bug report cho admin |

## Troubleshooting Nhanh

- **Missing `MONGODB_URI`**: kiểm tra `.env.local` hoặc `.env`.
- **Không login Google được**: kiểm tra `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect URI và `NEXT_PUBLIC_APP_URL`.
- **Post Analyzer không chạy**: cần `GEMINI_API_KEY`.
- **Ảnh upload không có URL**: cần Cloudinary env.
- **CSFloat bị rate limit**: thêm `CSFLOAT_API_KEY`.
- **BUFF163 không có giá**: cần API key CS2Cap server-side hoặc user key trong UI.
