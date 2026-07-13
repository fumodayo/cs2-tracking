# CS2 Tracking

CS2 Tracking là ứng dụng Next.js để theo dõi portfolio vật phẩm Counter-Strike 2, quét inventory Steam, đồng bộ nhiều Steam account, quản lý Storage Unit, lấy giá Steam/BUFF và phân tích bài đăng bằng Gemini.

Tài liệu chi tiết:

- [Kiến trúc hệ thống](./docs/ARCHITECTURE.md)
- [API reference](./docs/api-reference.md)
- [Hướng dẫn deploy](./docs/DEPLOYMENT.md)

## Tính Năng Chính

- **Portfolio**: thêm/sửa/xóa từng lô, thao tác hàng loạt, lọc bằng URL, import `.xlsx`/`.csv`/`.tsv`, export `.xlsx`, hoàn tác lần import gần đây và theo dõi vốn/lợi nhuận.
- **Định giá theo loại item**: item có giá BUFF dùng công thức CNY × tỷ giá; item không có giá BUFF hiển thị giá market 100% và nhập trực tiếp đơn giá VND. Tổng giá trị lô luôn bằng số lượng × đơn giá.
- **Pattern và phụ kiện**: inspect float/paint seed, Doppler/Fade/Blue Gem/Marble Fade, sticker/charm và phần giá cộng thêm của phụ kiện.
- **Inventory Scanner**: quét inventory public/private, cookie Steam, Family View, market listings, trade hold, wallet và Storage Unit; có retry khi Steam rate-limit và fallback về cache cũ khi live scan lỗi.
- **Steam Accounts Sync**: liên kết nhiều Steam account, kiểm tra cookie, đồng bộ từng account hoặc toàn bộ account vào portfolio.
- **User data sync**: đồng bộ giá BUFF thủ công, tỷ giá, Excel mapping template và lịch sử import giữa các tab/máy của user đã đăng nhập.
- **Realtime**: Ably cho portfolio, scan progress, BUFF price, preferences, recent imports, CS2Cap settings và màn hình admin; mỗi luồng có fallback phù hợp khi Ably không khả dụng.
- **Post Analyzer**: phân tích text/HTML/ảnh bằng Gemini và lưu lịch sử/cache. Các thao tác phân tích hiện là tính năng admin.
- **Auth và admin**: Google OAuth, guest owner, merge dữ liệu guest khi login, bug report nhiều ảnh và trang quản trị report.
- **i18n**: giao diện tiếng Việt và tiếng Anh.

## Hành Vi Dữ Liệu Quan Trọng

### Owner, guest và login

- User đã login có `ownerId = google:<googleUserId>`.
- Guest có `ownerId = guest:<uuid>` trong cookie HTTP-only `cs2t_guest_id`.
- Khi login Google thành công, app chuyển dữ liệu guest trong `portfolio_items`, `storage_units` và `portfolio_accounts` sang owner Google. Steam account trùng `steamId64` được bỏ qua/xóa bản guest.
- Portfolio, Steam accounts, Storage Units và scan job đều được lọc theo owner.
- Import kết quả scanner vào portfolio yêu cầu login. Post Analyzer yêu cầu quyền admin; trong production cần Google OAuth và email trong `ADMIN_EMAILS`.

### MongoDB, IndexedDB và localStorage

| Dữ liệu                                     | Guest                                   | User đã login                       |
| ------------------------------------------- | --------------------------------------- | ----------------------------------- |
| Portfolio, Steam accounts, Storage Units    | MongoDB theo guest owner                | MongoDB theo Google owner           |
| Giá BUFF thủ công                           | `localStorage` key `cs2t_buffPricesCny` | Collection `user_buff_prices`       |
| Tỷ giá và Excel mapping template            | `localStorage`                          | Collection `user_preferences`       |
| 10 lần import gần nhất                      | `localStorage` key `cs2t_recentImports` | Collection `user_recent_imports`    |
| Danh sách account/manual item của scanner   | IndexedDB `cs2t_async_json_storage`     | IndexedDB `cs2t_async_json_storage` |
| Theme, ngôn ngữ, tiền tệ, column visibility | `localStorage`                          | `localStorage`                      |

Khi user login, giá BUFF, pricing preferences, Excel mapping templates và recent imports cũ ở `localStorage` được merge lên server rồi xóa bản local. Scanner tự migrate hai key cũ `cs2t_accounts` và `cs2t_manualItems` sang IndexedDB khi trình duyệt hỗ trợ.

### Cache

- Portfolio report được cache trong memory theo owner trong 60 giây. `GET /api/portfolio?fresh=1` bỏ qua cache; event log được kiểm tra trước khi trả cache để tránh dữ liệu cũ sau mutation từ process khác.
- Scan cache hợp lệ đến 14:00 giờ Việt Nam gần nhất tiếp theo. MongoDB giữ bản hết hạn thêm 24 giờ để làm fallback khi Steam lỗi.
- Cache public dùng chung theo SteamID; cache private được scope theo owner và chỉ trả wallet/Storage Unit khi request có cookie.
- Ảnh case/item thiếu được tra từ Steam, lưu lại vào collection `cases` và retry sau 2 phút với lỗi tạm thời hoặc 6 giờ nếu chưa tìm thấy.

### Realtime và fallback

- Client đã login lấy token subscribe từ `GET /api/realtime/ably-token`; token chỉ có quyền trên channel được yêu cầu và có TTL 1 giờ.
- Portfolio mở đồng thời Ably và SSE `/api/realtime/portfolio`; khi có event client fetch report với `fresh=1`.
- Scan progress ưu tiên Ably channel riêng theo job, rồi fallback polling `GET /api/inventory/scan?jobId=...` mỗi 900 ms nếu Ably không dùng được hoặc im lặng quá lâu.
- Recent imports mở Ably và SSE `/api/realtime/user-recent-imports`.
- Bug report admin fallback polling mỗi 5 giây. BUFF prices, preferences, post-analysis history và CS2Cap settings vẫn hoạt động qua API trực tiếp khi realtime không có.

## Tech Stack

| Phần          | Công nghệ                                                    |
| ------------- | ------------------------------------------------------------ |
| Framework     | Next.js 16 App Router, React 19, TypeScript                  |
| UI            | Tailwind CSS 4, Radix UI, lucide-react, framer-motion        |
| Data fetching | TanStack Query 5, fetch API                                  |
| Table/Excel   | TanStack Table, read-excel-file, write-excel-file            |
| Database      | MongoDB                                                      |
| Realtime      | Ably, SSE, HTTP polling, MongoDB event log                   |
| Validation    | Zod 4                                                        |
| AI            | Google Gemini                                                |
| External CS2  | Steam Community/Market, CS2Cap, CSFloat, CSGOTrader fallback |
| Tooling       | ESLint 9, Prettier 3, Vitest 4                               |

## Chạy Local

### 1. Yêu cầu

- Node.js 20.9+ (theo `engines.node` của Next.js đang cài)
- npm
- MongoDB local hoặc MongoDB Atlas

### 2. Cài dependencies

```bash
npm install
```

### 3. Tạo file môi trường

Tạo `.env` hoặc `.env.local` dựa trên `.env.example`.

Cấu hình tối thiểu nên dùng:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=cs2_case_tracker
AUTH_SECRET=replace-with-a-long-random-secret-at-least-32-chars
DATA_ENCRYPTION_KEY=replace-with-a-separate-long-random-data-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`MONGODB_URI` là bắt buộc khi kết nối DB. Production yêu cầu `AUTH_SECRET` tối thiểu 32 ký tự. `DATA_ENCRYPTION_KEY` là tùy chọn trong schema nhưng rất nên cấu hình riêng; nếu bỏ trống, code dùng `AUTH_SECRET` để mã hóa Steam cookie và CS2Cap key.

Bật thêm tính năng theo nhu cầu:

```env
# Google login và quyền admin
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ADMIN_EMAILS=admin@example.com

# AI analyzer (admin)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# CS2 pricing / inspect
CS2CAP_API_KEY=
CSFLOAT_API_KEY=

# Upload ảnh analyzer / bug report
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

| Lệnh                | Mục đích                             |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Chạy Next.js dev server bằng webpack |
| `npm run build`     | Build production bằng webpack        |
| `npm run start`     | Chạy production build                |
| `npm run typecheck` | Kiểm tra TypeScript                  |
| `npm run lint`      | Kiểm tra ESLint                      |
| `npm run lint:fix`  | Tự sửa phần lỗi lint có thể sửa      |
| `npm run format`    | Format bằng Prettier                 |
| `npm run test`      | Chạy Vitest watch mode               |
| `npm run test:run`  | Chạy Vitest một lần                  |

`package.json` còn khai báo `db:migrate`, nhưng repo hiện không có `scripts/migrate-v1.ts`; không dùng lệnh này cho tới khi script được khôi phục hoặc entry được bỏ.

## Bản Đồ Thư Mục

```text
src/
  app/                  Pages, layout, metadata và API routes
  components/           UI/hook theo feature
  data/                 Tier/pattern/sticker map tĩnh
  domain/               Entity, domain type, repository interface
  hooks/                React hook dùng chung
  i18n/                 Bản dịch vi/en
  infrastructure/       MongoDB, repository, Steam, image/price provider
  lib/                   Browser API clients và IndexedDB JSON storage
  services/             Business logic, cache, sync và realtime publisher
  stores/               Toast/import/sync progress stores
  types/                DTO/type dùng chung
  utils/                Format, validation, error, cookie, URL helpers
```

Hướng phụ thuộc mong muốn:

```text
components -> lib/api-client -> app/api
app/api -> services -> domain
services -> infrastructure khi cần DB/driver cụ thể
domain -> không phụ thuộc layer khác
```

## Luồng Chính

### Portfolio và Excel

1. UI ở `src/components/dashboard` và `src/components/portfolio` gọi `src/lib/api-client/portfolio-api.ts`.
2. API ở `src/app/api/portfolio` xác định owner, cập nhật item/Storage Unit và build `PortfolioReportDto`.
3. Import chấp nhận `.xlsx`, `.csv`, `.tsv`; export tạo `.xlsx` có header cố định và sticky row.
4. User login có thể lưu Excel mapping template và lịch sử 10 lần import gần nhất trên server.
5. Sau mutation, server cập nhật/invalidate report cache và publish realtime event.

### Inventory Scanner

1. `POST /api/inventory/scan` tạo job có owner và chạy scan nền.
2. Client xin Ably token theo `scanJobId`; nếu không dùng được thì poll route scan.
3. Service gọi Steam, price provider, inspect/accessory helpers và cache kết quả.
4. Khi live scan lỗi, service thử cache private hiện tại rồi cache public đã hết hạn trước khi trả lỗi.
5. User login có thể import kết quả qua `/api/portfolio/import-inventory`.

### Steam Account Sync

1. Account/cookie mã hóa nằm trong `portfolio_accounts`.
2. `/api/portfolio/accounts/sync` đồng bộ tất cả account; `/sync/single` đồng bộ một account. Cả hai trả progress bằng SSE.
3. Sync cập nhật portfolio, Storage Units, trạng thái cookie, `lastSyncedAt`, report cache và realtime event `synced`.

### BUFF Price và user preferences

1. Giá BUFF từ CS2Cap đi qua `/api/inventory/buff-price`, ưu tiên key active của user rồi mới dùng `CS2CAP_API_KEY` server.
2. Giá BUFF thủ công của user login đi qua `/api/user/buff-prices`; guest dùng localStorage.
3. `rateSi`, `rateLe`, `buffCnyToVndRate` và Excel mapping templates của user login đi qua `/api/user/preferences`.
4. Các thay đổi được đồng bộ qua Ably khi có cấu hình.

## Collections Chính

| Collection                           | Nội dung                                              |
| ------------------------------------ | ----------------------------------------------------- |
| `users`                              | User Google và danh sách CS2Cap key đã mã hóa         |
| `portfolio_accounts`                 | Steam account và cookie mã hóa                        |
| `portfolio_items`                    | Các lô item trong portfolio                           |
| `storage_units`                      | Storage Unit và item bên trong, tối đa 1000 item/unit |
| `cases`                              | Catalog, rarity, ảnh đã cache và metadata retry ảnh   |
| `user_buff_prices`                   | Giá BUFF thủ công theo owner/item                     |
| `user_preferences`                   | Pricing preferences và Excel mapping templates        |
| `user_recent_imports`                | Tối đa 10 lần import gần nhất được trả về cho user    |
| `portfolio_realtime_events`          | Event log ngắn hạn cho portfolio SSE/cache guard      |
| `user_recent_import_realtime_events` | Event log cho recent-import SSE                       |
| `price_snapshots`                    | Lịch sử giá                                           |
| `inventory_scan_cache`               | Cache scan public/private và stale fallback           |
| `scan_jobs`                          | Trạng thái/progress scan job                          |
| `pattern_inspect_cache`              | Cache kết quả inspect pattern                         |
| `post_analysis_history`              | Lịch sử/cache Post Analyzer                           |
| `rate_limits`                        | Rate limit phân tán theo key/IP                       |
| `bug_reports`                        | Bug report và ảnh Cloudinary                          |

Index MongoDB được bootstrap lazy trong `src/infrastructure/db/ensure-indexes.ts`; một số repository còn tự tạo index riêng khi được gọi.

## Trang Chính

| Path                 | Mục đích                                        |
| -------------------- | ----------------------------------------------- |
| `/`                  | Trang tổng quan/home                            |
| `/portfolio`         | Dashboard portfolio và Steam accounts           |
| `/inventory-scanner` | Quét inventory Steam                            |
| `/post-analysis`     | Post Analyzer; API phân tích hiện yêu cầu admin |
| `/admin/bug-reports` | Quản lý bug report cho admin                    |

## Troubleshooting Nhanh

| Vấn đề                                           | Kiểm tra                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| App không kết nối được DB                        | `MONGODB_URI`, quyền network MongoDB, `/api/health`                                  |
| Production dừng vì env                           | `AUTH_SECRET` đủ 32 ký tự, `MONGODB_URI`, `SKIP_ENV_VALIDATION` chỉ dùng có chủ đích |
| Không login Google được                          | Google client ID/secret, callback URL, `NEXT_PUBLIC_APP_URL`                         |
| Post Analyzer trả `adminOnlyAction`              | Email hiện tại phải nằm trong `ADMIN_EMAILS`; production cần Google OAuth            |
| Import scanner trả `importErrorLoginRequired`    | Login Google trước khi import vào portfolio                                          |
| Portfolio/recent imports máy khác không cập nhật | `ABLY_API_KEY`, token route, CSP/WebSocket; kiểm tra SSE fallback                    |
| Scan progress không realtime                     | Ably token theo `scanJobId`; HTTP polling vẫn phải đọc được scan job cùng owner      |
| BUFF price không fetch được                      | Active CS2Cap user key hoặc `CS2CAP_API_KEY`                                         |
| Steam scan lỗi/rate-limit                        | Cookie, Family View, trạng thái inventory, stale cache fallback                      |
| Upload ảnh lỗi                                   | Ba biến `CLOUDINARY_*`                                                               |
| Inspect pattern rate-limit                       | `CSFLOAT_API_KEY`                                                                    |
