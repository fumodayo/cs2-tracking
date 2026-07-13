# Deployment Guide

Tài liệu này mô tả cách chạy production, cấu hình env, MongoDB/index, realtime và checklist kiểm tra sau deploy theo code hiện tại.

## Checklist Nhanh

Trước khi deploy:

- Node.js 20.9+ và npm (Next.js 16.2.10 đang cài yêu cầu `>=20.9.0`).
- MongoDB có thể truy cập từ runtime.
- `MONGODB_URI` và `AUTH_SECRET` đã cấu hình; `AUTH_SECRET` dài ít nhất 32 ký tự.
- Cấu hình `DATA_ENCRYPTION_KEY` riêng nếu lưu Steam cookie/CS2Cap key.
- `NEXT_PUBLIC_APP_URL` đúng domain production.
- Nếu dùng Google login/admin/Post Analyzer, cấu hình Google OAuth và `ADMIN_EMAILS`.
- Nếu cần realtime ổn định trên nhiều instance/serverless, cấu hình `ABLY_API_KEY` có quyền cấp token và publish.
- Nếu dùng upload ảnh analyzer/bug report, cấu hình đủ ba biến Cloudinary.
- Chạy:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

## Biến Môi Trường

Tạo env từ `.env.example` và set trong hosting provider.

### Core

| Biến                  | Mục đích                            | Trạng thái trong code                                                |
| --------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `MONGODB_URI`         | MongoDB connection string           | Bắt buộc để `getDatabase()` hoạt động                                |
| `MONGODB_DB`          | Tên database                        | Tùy chọn; mặc định `cs2_case_tracker`                                |
| `AUTH_SECRET`         | Ký session; fallback encryption key | Production yêu cầu tối thiểu 32 ký tự                                |
| `DATA_ENCRYPTION_KEY` | Mã hóa Steam cookie/CS2Cap key      | Tùy chọn trong schema nhưng rất nên có riêng; fallback `AUTH_SECRET` |
| `NEXT_PUBLIC_APP_URL` | Public base URL/callback URL        | Nên có cho local và production                                       |

Ví dụ local:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=cs2_case_tracker
AUTH_SECRET=replace-with-a-long-random-secret-at-least-32-chars
DATA_ENCRYPTION_KEY=replace-with-a-separate-long-random-data-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Env validation nằm trong `src/env.ts`:

- Test không ép validation.
- Static production build không bị dừng chỉ vì env runtime chưa inject.
- Runtime production throw nếu env sai và không có `SKIP_ENV_VALIDATION`.
- Development log lỗi validation nhưng một số service còn có fallback dev; MongoDB vẫn cần `MONGODB_URI`.

### Auth, admin và Post Analyzer

| Biến                   | Mục đích                             | Bắt buộc khi nào                             |
| ---------------------- | ------------------------------------ | -------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID               | Khi dùng login/admin                         |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret           | Khi dùng login/admin                         |
| `ADMIN_EMAILS`         | Email admin, phân tách bằng dấu phẩy | Bug-report admin và Post Analyzer production |
| `GEMINI_API_KEY`       | Phân tích text/HTML/image            | Khi dùng Post Analyzer                       |
| `GEMINI_MODEL`         | Model Gemini                         | Tùy chọn; code fallback `gemini-2.5-flash`   |

Redirect URI:

```text
https://your-domain.com/api/auth/google/callback
```

Local:

```text
http://localhost:3000/api/auth/google/callback
```

Post Analyzer hiện kiểm tra `isAdminAccessAllowed()` cho các route analyze/extract và xóa history:

- Khi Google OAuth đã cấu hình: session email phải nằm trong `ADMIN_EMAILS`.
- Khi OAuth chưa cấu hình: chỉ non-production được phép dùng admin access fallback.
- Vì vậy production muốn dùng Post Analyzer phải cấu hình cả Google OAuth, `ADMIN_EMAILS` và `GEMINI_API_KEY`.

Trang `/admin/bug-reports` luôn yêu cầu Google user có email trong `ADMIN_EMAILS`.

### CS2 pricing và inspect

| Biến              | Mục đích                            | Ghi chú                                 |
| ----------------- | ----------------------------------- | --------------------------------------- |
| `CS2CAP_API_KEY`  | Server fallback key cho BUFF163     | User active key được ưu tiên trước      |
| `CSFLOAT_API_KEY` | Giảm rate limit khi inspect pattern | Tùy chọn nhưng nên có khi inspect nhiều |

CS2Cap key do user nhập được validate, mã hóa và lưu trong `users`. `DATA_ENCRYPTION_KEY` cần ổn định giữa các deploy để đọc lại dữ liệu cũ.

### Cloudinary

| Biến                    | Mục đích         |
| ----------------------- | ---------------- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud |
| `CLOUDINARY_API_KEY`    | API key          |
| `CLOUDINARY_API_SECRET` | API secret       |

Cloudinary được dùng cho ảnh Post Analyzer và bug report. Nếu thiếu/không hợp lệ, upload ảnh thất bại dù các phần không dùng ảnh vẫn có thể chạy.

### Realtime với Ably

| Biến           | Mục đích                              |
| -------------- | ------------------------------------- |
| `ABLY_API_KEY` | Server request token và publish event |

Không dùng prefix `NEXT_PUBLIC_`; browser chỉ nhận token capability hẹp từ `/api/realtime/ably-token`.

Server hiện publish các channel:

```text
portfolio:<ownerId>
scan:<ownerId>:<jobId>
user:<ownerId>:buff-prices
user:<ownerId>:preferences
user:<ownerId>:recent-imports
user:<ownerId>:settings
admin:bug-reports
admin:post-analysis-history
```

Ably key phải cho phép server:

- request token;
- publish lên các channel trên.

Nếu key cấp token được nhưng thiếu quyền publish, service log warning một lần theo domain. Fallback hiện tại:

| Domain                                        | Fallback                                                    |
| --------------------------------------------- | ----------------------------------------------------------- |
| Portfolio                                     | SSE `/api/realtime/portfolio` + MongoDB event log           |
| Recent imports                                | SSE `/api/realtime/user-recent-imports` + MongoDB event log |
| Scan progress                                 | HTTP polling `/api/inventory/scan?jobId=...`                |
| Bug reports admin                             | Polling 5 giây                                              |
| BUFF prices/preferences/settings/post history | API response hoặc direct refetch                            |

Production nhiều instance/serverless nên dùng Ably. SSE event log hỗ trợ portfolio/recent imports nhưng các domain còn lại không có distributed fallback tương đương.

### Runtime controls

| Biến                  | Mục đích                                        |
| --------------------- | ----------------------------------------------- |
| `LOG_LEVEL`           | `debug`, `info`, `warn`, `error`                |
| `SKIP_ENV_VALIDATION` | Bỏ runtime env validation; chỉ dùng có chủ đích |
| `NODE_ENV`            | `development`, `test`, `production`             |

## Local Production Check

```bash
npm install
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run start
```

Mở `http://localhost:3000` và kiểm tra `GET /api/health`.

`package.json` còn entry `db:migrate`, nhưng repo hiện không có `scripts/migrate-v1.ts`. Không đưa `npm run db:migrate` vào pipeline deploy cho đến khi entry/script được sửa.

## Deploy Lên Vercel

1. Import repo và chọn framework Next.js.
2. Set env cho Production/Preview theo nhu cầu.
3. Đặt `NEXT_PUBLIC_APP_URL` đúng domain public.
4. Thêm callback URL production vào Google Cloud Console.
5. Cấu hình `ABLY_API_KEY` nếu cần realtime cross-instance ổn định.
6. Build bằng `npm run build`.
7. Sau deploy, kiểm tra `/api/health`, login, scan, portfolio mutation và realtime.

Lưu ý cho serverless:

- Portfolio report cache là in-memory 60 giây và không chia sẻ giữa instance. Route kiểm tra MongoDB event log trước khi trả cache; client realtime dùng `fresh=1`.
- In-memory realtime listener chỉ có tác dụng trong cùng instance. Ably là đường cross-instance chính.
- Scan job có bản MongoDB để route khác instance có thể khôi phục khi memory miss.
- Background work trong request/serverless có thể bị giới hạn bởi platform timeout; test scan/sync dài bằng dữ liệu production thực tế.

## Deploy Lên VPS/Server Riêng

```bash
npm install
npm run build
npm run start
```

Cần đảm bảo:

- Reverse proxy chuyển traffic tới Next.js và giữ đúng `Host`/`Origin` để CSRF check không chặn mutation.
- HTTPS được bật; cookie session/guest dùng `secure` ở production.
- Env được inject vào process manager.
- MongoDB cho phép server kết nối.
- Process có quyền ghi `steam_prices_fallback_cache.json` nếu price provider dùng fallback file.
- Nếu không dùng Ably, reverse proxy không buffer SSE và giữ connection cho:
  - `/api/realtime/portfolio`;
  - `/api/realtime/user-recent-imports`;
  - `/api/portfolio/accounts/sync`;
  - `/api/portfolio/accounts/sync/single`.
- Proxy cho phép WebSocket tới `wss://*.ably.io` từ browser.

## MongoDB

### Index bootstrap

`src/infrastructure/db/ensure-indexes.ts` chạy lazy khi `getDatabase()` thành công.

| Collection                  | Index hiện tại                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `portfolio_items`           | `ownerId`; `ownerId + createdAt`                                                             |
| `portfolio_accounts`        | `ownerId + steamId64` unique                                                                 |
| `storage_units`             | `ownerId`; `ownerId + steamId64`                                                             |
| `users`                     | `id` unique; `provider + providerAccountId` unique                                           |
| `user_buff_prices`          | `ownerId + marketHashName` unique; `ownerId`                                                 |
| `portfolio_realtime_events` | `ownerId + createdAt`; TTL 1 giờ                                                             |
| `bug_reports`               | `createdAt`; `status`                                                                        |
| `inventory_scan_cache`      | `expiresAt` TTL với `expireAfterSeconds=86400`; `steamId64`; `cacheKey`; owner/private scope |
| `scan_jobs`                 | `id` unique; TTL 1 giờ                                                                       |
| `rate_limits`               | `key` unique; TTL 1 giờ                                                                      |

Code còn chủ động xóa unique index legacy `importSource_1_caseId_1` trên `portfolio_items` để cho phép nhiều lot cùng case.

Repository/service tự tạo thêm:

- `cases.marketHashName` unique và text index `name + marketHashName`;
- `post_analysis_history.fingerprint` unique và `updatedAt` descending;
- price snapshot index;
- kiểm tra/thay TTL index của `inventory_scan_cache` nếu cấu hình cũ khác 24 giờ.

### Collections chưa có central bootstrap index

Code hiện chưa thêm index trung tâm cho:

- `user_preferences`;
- `user_recent_imports`;
- `user_recent_import_realtime_events`;
- `pattern_inspect_cache`.

Với dữ liệu nhỏ app vẫn chạy, nhưng production tăng trưởng cần theo dõi query latency và dung lượng. Đặc biệt `user_recent_import_realtime_events` hiện được dùng cho SSE catch-up nhưng chưa có TTL bootstrap như `portfolio_realtime_events`; cần có kế hoạch cleanup/index trước khi event volume lớn.

### Scan cache retention

`expiresAt` là thời điểm cache không còn fresh, được đặt vào 14:00 giờ Việt Nam tiếp theo. TTL index có `expireAfterSeconds=86400`, nên document được giữ thêm khoảng 24 giờ để live scan lỗi có thể fallback về bản stale.

## Security Headers Và CSRF

`next.config.ts` đặt:

- Content Security Policy;
- HSTS;
- `X-Frame-Options: DENY`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`.

CSP hiện cho phép connect tới app, CS2Cap, CoinGecko và Ably HTTP/WebSocket. Nếu đổi domain external/realtime, cập nhật cả code fetch lẫn CSP.

`src/proxy.ts` yêu cầu `Origin` hoặc `Referer` cùng host cho mọi mutation `/api`. Khi test bằng curl/Postman, thêm ví dụ:

```text
Origin: https://your-domain.com
```

Không nới CSRF proxy toàn cục chỉ để sửa một client thiếu header.

## Health Check

Endpoint:

```text
GET /api/health
```

Response public chỉ có:

- `status`;
- `timestamp`.

Nếu request có session admin, response thêm:

- MongoDB status và latency;
- env status dạng `configured`/`missing` cho một số biến;
- uptime;
- memory usage.

Route không trả giá trị secret. Non-admin chỉ xác minh có DB connection; admin chạy `db.command({ ping: 1 })`.

## Kiểm Tra Sau Deploy

### 1. Auth và owner

1. Ở trạng thái guest, tạo portfolio item và kiểm tra cookie `cs2t_guest_id`.
2. Login Google.
3. Xác nhận item guest chuyển sang user và session route trả user.
4. Logout/login lại để chắc dữ liệu vẫn theo đúng owner.

### 2. Portfolio và Excel

1. Tạo item BUFF và item non-BUFF; kiểm tra hai nhánh công thức giá.
2. Sửa quantity/buy price, gán Storage Unit và kiểm tra capacity.
3. Import `.xlsx`, xem progress, lịch sử import và thử undo.
4. Export `.xlsx` và mở lại file.

### 3. Scanner

1. Scan inventory public.
2. Scan private bằng cookie và kiểm tra wallet/Storage Unit chỉ xuất hiện ở private result.
3. Kiểm tra progress qua Ably; tắt/chặn Ably tạm thời và xác nhận polling vẫn hoàn tất.
4. Login rồi import kết quả scanner vào portfolio.
5. Kiểm tra log khi Steam rate-limit và stale cache fallback.

### 4. User data sync

Mở cùng account trên hai browser:

1. Đổi BUFF price thủ công.
2. Đổi `rateSi`, `rateLe` hoặc tỷ giá CNY/VND.
3. Tạo Excel mapping template.
4. Import file và kiểm tra recent imports.
5. Xác nhận máy còn lại refetch sau realtime event; recent imports phải hoạt động cả qua SSE fallback.

### 5. Admin

1. User thường gửi bug report có nhiều ảnh.
2. Admin mở `/admin/bug-reports`, kiểm tra Ably hoặc polling 5 giây.
3. Admin chạy Post Analyzer và kiểm tra history.
4. User không nằm trong `ADMIN_EMAILS` phải nhận `adminOnlyAction`/redirect phù hợp.

## Secret Rotation

### `AUTH_SECRET`

Đổi key làm session cũ mất hiệu lực. Nếu trước đó không có `DATA_ENCRYPTION_KEY`, `AUTH_SECRET` cũng có thể đang mã hóa Steam cookie/CS2Cap key.

- Nếu `DATA_ENCRYPTION_KEY` đã dùng riêng: rotate `AUTH_SECRET`, redeploy và yêu cầu user login lại.
- Nếu encryption đang fallback `AUTH_SECRET`: không đổi trực tiếp nếu chưa migrate/re-encrypt dữ liệu nhạy cảm.

### `DATA_ENCRYPTION_KEY`

Code decrypt thử primary key rồi thử `AUTH_SECRET`; không có key ring cho nhiều `DATA_ENCRYPTION_KEY`. Rotate cần migration dữ liệu đã mã hóa hoặc giai đoạn chuyển tiếp có chủ đích.

### Google OAuth secret

1. Tạo/reset secret trong Google Cloud.
2. Cập nhật `GOOGLE_CLIENT_SECRET`.
3. Redeploy/restart.
4. Test login, callback và logout.

### Ably API key

1. Tạo key mới có quyền request token/publish.
2. Cập nhật `ABLY_API_KEY`.
3. Redeploy/restart.
4. Test token mặc định và từng query channel quan trọng.
5. Test hai browser/máy.
6. Thu hồi key cũ.

### CS2Cap/CSFloat

- Rotate `CS2CAP_API_KEY`, test `/api/user/cs2cap/status` và BUFF price.
- Rotate `CSFLOAT_API_KEY`, test `/api/inventory/inspect-pattern`.

## Troubleshooting Production

| Triệu chứng                              | Kiểm tra                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Runtime dừng vì env                      | `MONGODB_URI`, `AUTH_SECRET >= 32`, không lạm dụng `SKIP_ENV_VALIDATION` |
| Login redirect sai                       | `NEXT_PUBLIC_APP_URL`, callback URI Google, proxy host                   |
| Mutation API trả CSRF 403                | `Origin`/`Referer` cùng host, reverse proxy giữ Host đúng                |
| Portfolio trả dữ liệu cũ                 | Thử `?fresh=1`, event log/index, process cache 60 giây                   |
| Realtime chỉ chạy cùng một tab           | Quyền publish của `ABLY_API_KEY`, token capability, CSP/WebSocket        |
| SSE không có event                       | Proxy buffering/timeout, auth session, MongoDB event log                 |
| Scan không có Ably progress              | Token `scanJobId`, job owner; polling phải tự fallback                   |
| Scan lỗi sau deploy serverless           | Platform timeout/background execution, Steam rate limit, scan job DB     |
| Recent imports event log tăng liên tục   | `user_recent_import_realtime_events` chưa có TTL bootstrap               |
| Post Analyzer trả `adminOnlyAction`      | Google session, `ADMIN_EMAILS`, `GEMINI_API_KEY`                         |
| Bug report ảnh lỗi                       | Ba biến Cloudinary và rate limit 3/5 phút                                |
| BUFF price lỗi                           | Active user key, `CS2CAP_API_KEY`, CS2Cap quota                          |
| Không giải mã được cookie/key sau rotate | `DATA_ENCRYPTION_KEY`/`AUTH_SECRET` không khớp dữ liệu cũ                |
| MongoDB index warning                    | Quyền `createIndex`/`dropIndex`, index legacy xung đột                   |
