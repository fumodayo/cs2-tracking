# CS2 Tracking

CS2 Tracking là ứng dụng Next.js dùng để theo dõi portfolio vật phẩm Counter-Strike 2, quét inventory Steam, đồng bộ nhiều Steam account, quản lý Storage Unit, lấy giá Steam/BUFF163 và phân tích bài đăng bằng AI.

Tài liệu chi tiết:

- [Kiến trúc hệ thống](./docs/ARCHITECTURE.md)
- [API reference](./docs/api-reference.md)
- [Hướng dẫn deploy](./docs/DEPLOYMENT.md)

## Tính Năng Chính

- **Portfolio**: thêm, sửa, xóa, import Excel/CSV, refresh giá, tính vốn, giá hiện tại, lời/lỗ và phân bổ vật phẩm.
- **Inventory Scanner**: quét Steam inventory public/private, hỗ trợ cookie, Family View, market listings, trade hold và Storage Unit.
- **Steam Accounts Sync**: liên kết nhiều Steam account, đồng bộ từng account hoặc toàn bộ account vào portfolio.
- **BUFF163 pricing**: lấy giá BUFF163 qua CS2Cap, cho phép chọn giá BUFF thủ công theo từng item.
- **Realtime portfolio**: khi một tab/máy thay đổi portfolio, tab/máy khác cùng tài khoản tự cập nhật UI.
- **Post Analyzer**: dùng Gemini để phân tích text/HTML/ảnh và trích xuất danh sách vật phẩm.
- **Auth và admin**: Google OAuth, session cookie, guest owner, admin bug reports.
- **i18n**: giao diện tiếng Việt và tiếng Anh.

## Hành Vi Dữ Liệu Quan Trọng

### Owner và login

- User đã login có `ownerId` dạng `google:<googleUserId>`.
- User chưa login có guest owner dạng `guest:<uuid>` lưu bằng cookie `cs2t_guest_id`.
- Khi login Google thành công, dữ liệu guest trong MongoDB được gộp sang owner Google:
  - `portfolio_items`
  - `storage_units`
  - `portfolio_accounts`

### BUFF price thủ công

- Chưa login: giá BUFF thủ công chỉ lưu trong `localStorage` với key `cs2t_buffPricesCny`.
- Đã login: giá BUFF thủ công lưu trong MongoDB collection `user_buff_prices`.
- Khi user login và có dữ liệu local cũ, app merge local BUFF price lên DB rồi xóa local key.
- Một số UI preference vẫn dùng `localStorage`, ví dụ tỷ giá BUFF CNY/VND, column visibility, draft form. Đây không phải dữ liệu tài khoản chính.

### Realtime portfolio

- Server gọi `publishPortfolioChanged()` sau các thao tác tạo, sửa, xóa, import, sync hoặc refresh giá portfolio.
- Nếu có `ABLY_API_KEY`, client dùng Ably để nhận event realtime theo channel `portfolio:<ownerId>`.
- Nếu chưa cấu hình Ably, app fallback sang SSE route `/api/realtime/portfolio` và MongoDB event log.
- Khi nhận event, client invalidate TanStack Query cho portfolio, Storage Unit và Steam accounts.

## Tech Stack

| Phần          | Công nghệ                                                    |
| ------------- | ------------------------------------------------------------ |
| Framework     | Next.js App Router, React 19, TypeScript                     |
| UI            | Tailwind CSS, Radix UI, lucide-react, framer-motion          |
| Data fetching | TanStack Query, fetch API                                    |
| Database      | MongoDB                                                      |
| Realtime      | Ably tùy chọn, SSE fallback, MongoDB event log               |
| Validation    | Zod                                                          |
| AI            | Google Gemini                                                |
| External CS2  | Steam Community/Market, CS2Cap, CSFloat, CSGOTrader fallback |
| Tooling       | ESLint, Prettier, Vitest                                     |

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

Tạo `.env` hoặc `.env.local` dựa trên `.env.example`.

Tối thiểu để app chạy:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=cs2_case_tracker
AUTH_SECRET=replace-with-a-long-random-secret-at-least-32-chars
DATA_ENCRYPTION_KEY=replace-with-a-separate-long-random-data-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Bật thêm tính năng theo nhu cầu:

```env
# Google login
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ADMIN_EMAILS=

# AI analyzer
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# CS2 pricing / inspect
CS2CAP_API_KEY=
CSFLOAT_API_KEY=

# Cloudinary image upload
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Realtime production
ABLY_API_KEY=
```

### 4. Chạy dev server

```bash
npm run dev
```

Mở `http://localhost:3000`.

## Scripts

| Lệnh                 | Mục đích                 |
| -------------------- | ------------------------ |
| `npm run dev`        | Chạy Next.js dev server  |
| `npm run build`      | Build production         |
| `npm run start`      | Chạy production build    |
| `npm run typecheck`  | Kiểm tra TypeScript      |
| `npm run lint`       | Kiểm tra ESLint          |
| `npm run lint:fix`   | Tự sửa một phần lỗi lint |
| `npm run format`     | Format bằng Prettier     |
| `npm run test`       | Chạy Vitest watch mode   |
| `npm run test:run`   | Chạy Vitest một lần      |
| `npm run db:migrate` | Chạy script migrate v1   |

## Bản Đồ Thư Mục

```text
src/
  app/                  Next.js pages, layouts và API routes
  components/           UI theo từng feature
  data/                 Dữ liệu tĩnh như tier/pattern/sticker map
  domain/               Entity, domain type, repository interface
  hooks/                React hooks dùng chung
  i18n/                 Bản dịch vi/en
  infrastructure/       MongoDB, repository, Steam, price provider
  lib/api-client/       Client-side fetch wrappers cho UI
  services/             Application services và server-side business logic
  stores/               Store nhỏ cho toast, import progress, sync progress
  types/                TypeScript types dùng chung
  utils/                Format, validation, error, cookie, URL, local helpers
```

Hướng phụ thuộc mong muốn:

```text
components -> lib/api-client -> app/api
app/api -> services -> domain
services -> infrastructure khi cần DB/driver cụ thể
domain -> không phụ thuộc layer khác
```

## Luồng Chính

### Portfolio

1. UI trong `src/components/dashboard` và `src/components/portfolio`.
2. UI gọi client API trong `src/lib/api-client/portfolio-api.ts`.
3. API route nằm ở `src/app/api/portfolio`.
4. Route xác định `ownerId`, thao tác MongoDB/service, rồi trả `PortfolioReportDto`.
5. Sau mutation, route publish realtime event để các tab/máy khác refetch.

### Inventory Scanner

1. UI trong `src/components/inventory-scanner`.
2. `POST /api/inventory/scan` tạo scan job.
3. Client poll `GET /api/inventory/scan?jobId=...`.
4. `scan-service` gọi Steam inventory, price provider và cache.
5. User có thể import kết quả scan vào portfolio qua `/api/portfolio/import-inventory`.

### Steam Account Sync

1. UI trong `src/components/steam-accounts`.
2. Account/cookie lưu trong `portfolio_accounts`.
3. Sync gọi `/api/portfolio/accounts/sync` hoặc `/sync/single`.
4. Route scan inventory, đối chiếu portfolio, cập nhật item, Storage Unit và last synced.
5. Sau sync, server publish realtime event `synced`.

### BUFF Price

1. Giá BUFF fetch từ `/api/inventory/buff-price`.
2. Giá BUFF thủ công của user login lưu qua `/api/user/buff-prices`.
3. Dashboard và scanner dùng chung helper `src/utils/buff-prices.ts`.
4. Guest dùng localStorage; user login dùng MongoDB.

### Realtime

1. Client gọi `usePortfolioRealtime(Boolean(user), ownerId)` trong dashboard.
2. Hook thử lấy Ably token từ `/api/realtime/ably-token`.
3. Nếu thành công, subscribe Ably channel `portfolio:<ownerId>`.
4. Nếu fail hoặc thiếu Ably config, fallback sang `/api/realtime/portfolio`.
5. Khi nhận `portfolio.changed`, client invalidate query và UI tự cập nhật.

## Database Chính

| Collection                  | Nội dung                                        |
| --------------------------- | ----------------------------------------------- |
| `users`                     | User Google OAuth và CS2Cap key đã mã hóa       |
| `portfolio_accounts`        | Steam account đã liên kết và cookie mã hóa      |
| `portfolio_items`           | Item trong portfolio                            |
| `cases`                     | Catalog item/case CS2                           |
| `storage_units`             | Storage Unit và item bên trong                  |
| `user_buff_prices`          | Giá BUFF thủ công theo user và market hash name |
| `portfolio_realtime_events` | Event realtime ngắn hạn cho SSE/catch-up        |
| `price_snapshots`           | Lịch sử giá                                     |
| `inventory_scan_cache`      | Cache kết quả scan Steam                        |
| `scan_jobs`                 | Trạng thái job scan ngắn hạn                    |
| `post_analysis_history`     | Lịch sử/cache phân tích bài đăng                |
| `rate_limits`               | Rate limit theo key/IP                          |
| `bug_reports`               | Bug report từ người dùng                        |

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

| Path                 | Mục đích                              |
| -------------------- | ------------------------------------- |
| `/`                  | Trang tổng quan/home                  |
| `/portfolio`         | Dashboard portfolio và Steam accounts |
| `/inventory-scanner` | Quét inventory Steam                  |
| `/post-analysis`     | Phân tích bài đăng/ảnh bằng AI        |
| `/admin/bug-reports` | Quản lý bug report cho admin          |

## Troubleshooting Nhanh

| Vấn đề                                    | Kiểm tra                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| App không start                           | `MONGODB_URI`, `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, env validation             |
| Không login Google được                   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect URI, `NEXT_PUBLIC_APP_URL` |
| Portfolio máy khác không tự cập nhật      | `ABLY_API_KEY`; nếu không dùng Ably thì kiểm tra SSE `/api/realtime/portfolio`  |
| BUFF price của tài khoản login không sync | `/api/user/buff-prices`, collection `user_buff_prices`, session Google          |
| BUFF163 không fetch được giá              | `CS2CAP_API_KEY` hoặc user CS2Cap key                                           |
| Post Analyzer không chạy                  | `GEMINI_API_KEY`                                                                |
| Ảnh upload không có URL                   | Cloudinary env                                                                  |
| CSFloat bị rate limit                     | `CSFLOAT_API_KEY`                                                               |
