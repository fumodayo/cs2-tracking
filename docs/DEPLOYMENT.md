# Deployment Guide

Tài liệu này ghi lại cách chạy production, cấu hình env và kiểm tra các tính năng chính của CS2 Tracking sau khi deploy.

## Checklist Nhanh

Trước khi deploy:

- Node.js 20+.
- MongoDB đang hoạt động.
- `MONGODB_URI`, `AUTH_SECRET`, `DATA_ENCRYPTION_KEY` đã cấu hình.
- `NEXT_PUBLIC_APP_URL` đúng domain production.
- Nếu dùng Google login, Google OAuth redirect URI đã đúng.
- Nếu muốn realtime ổn định trên production, cấu hình `ABLY_API_KEY`.
- Chạy kiểm tra:

```bash
npm run typecheck
npm run lint
npm run build
```

Nếu muốn chạy test:

```bash
npm run test:run
```

## Biến Môi Trường

Tạo env từ `.env.example` và cấu hình trong hosting provider.

### Bắt buộc / nên có cho production

| Biến                  | Mục đích                                   | Ghi chú                                     |
| --------------------- | ------------------------------------------ | ------------------------------------------- |
| `MONGODB_URI`         | Connection string MongoDB                  | Nên dùng MongoDB Atlas hoặc MongoDB có auth |
| `MONGODB_DB`          | Tên database                               | Nếu trống, app dùng default trong code      |
| `AUTH_SECRET`         | Ký session cookie                          | Tối thiểu 32 ký tự                          |
| `DATA_ENCRYPTION_KEY` | Mã hóa dữ liệu nhạy cảm như cookie/API key | Nên tách riêng với `AUTH_SECRET`            |
| `NEXT_PUBLIC_APP_URL` | URL public của app                         | Ví dụ `https://your-domain.com`             |

Ví dụ local:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=cs2_case_tracker
AUTH_SECRET=replace-with-a-long-random-secret-at-least-32-chars
DATA_ENCRYPTION_KEY=replace-with-a-separate-long-random-data-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Auth và admin

| Biến                   | Mục đích                                       | Bắt buộc khi nào           |
| ---------------------- | ---------------------------------------------- | -------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                         | Khi dùng Google login      |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                     | Khi dùng Google login      |
| `ADMIN_EMAILS`         | Danh sách email admin, cách nhau bằng dấu phẩy | Khi dùng admin bug reports |

Redirect URI Google OAuth:

```text
https://your-domain.com/api/auth/google/callback
```

Local dev:

```text
http://localhost:3000/api/auth/google/callback
```

### Realtime portfolio với Ably

| Biến           | Mục đích                                            | Bắt buộc khi nào           |
| -------------- | --------------------------------------------------- | -------------------------- |
| `ABLY_API_KEY` | Server dùng để cấp token và publish event portfolio | Khuyến nghị cho production |

Luồng hiện tại:

1. Client đã login gọi `GET /api/realtime/ably-token`.
2. Server dùng `ABLY_API_KEY` để cấp token chỉ được subscribe channel `portfolio:<ownerId>`.
3. Server publish event lên Ably sau các mutation portfolio.
4. Client nhận event và tự refetch UI.

Nếu không set `ABLY_API_KEY`, app vẫn chạy. Client fallback sang SSE `/api/realtime/portfolio` và MongoDB event log. Fallback phù hợp local/dev, còn production nhiều instance hoặc serverless nên dùng Ably.

Không dùng `NEXT_PUBLIC_` cho Ably key. `ABLY_API_KEY` phải là server-side secret.

### AI, price và external services

| Biến              | Mục đích                            | Bắt buộc khi nào                   |
| ----------------- | ----------------------------------- | ---------------------------------- |
| `GEMINI_API_KEY`  | Post Analyzer text/HTML/image       | Khi dùng AI analyzer               |
| `GEMINI_MODEL`    | Gemini model                        | Mặc định nên để `gemini-2.5-flash` |
| `CS2CAP_API_KEY`  | Server fallback key cho BUFF163     | Khi muốn có key BUFF mặc định      |
| `CSFLOAT_API_KEY` | Giảm rate limit khi inspect pattern | Khi dùng inspect nhiều             |

### Cloudinary

| Biến                    | Mục đích         |
| ----------------------- | ---------------- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud |
| `CLOUDINARY_API_KEY`    | API key          |
| `CLOUDINARY_API_SECRET` | API secret       |

Cloudinary cần cho upload ảnh trong analyzer/bug report.

### Runtime controls

| Biến                  | Mục đích                                                     |
| --------------------- | ------------------------------------------------------------ |
| `LOG_LEVEL`           | Điều khiển log level                                         |
| `SKIP_ENV_VALIDATION` | Bỏ qua env validation runtime trong một số pipeline đặc biệt |
| `NODE_ENV`            | `development`, `test`, `production`                          |

## Local Production Check

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run start
```

Mở `http://localhost:3000`.

## Deploy Lên Vercel

1. Import repo vào Vercel.
2. Chọn framework Next.js.
3. Set environment variables trong Project Settings.
4. Đảm bảo `NEXT_PUBLIC_APP_URL` trỏ về domain Vercel/custom domain.
5. Nếu dùng Google OAuth, thêm redirect URI production vào Google Cloud Console.
6. Nếu dùng realtime production, thêm `ABLY_API_KEY`.
7. Deploy.
8. Kiểm tra `/api/health`.

Build command:

```bash
npm run build
```

Start command thường do Vercel quản lý tự động.

## Deploy Lên VPS/Server Riêng

Ví dụ chạy bằng Node process manager:

```bash
npm install
npm run build
npm run start
```

Cần đảm bảo:

- Reverse proxy trỏ tới port Next.js.
- HTTPS đã bật.
- Env production được inject vào process.
- MongoDB cho phép server kết nối.
- Process có quyền ghi file `steam_prices_fallback_cache.json` nếu dùng fallback cache file.
- Nếu không dùng Ably, reverse proxy không buffer SSE route `/api/realtime/portfolio`.

## MongoDB

App tạo index cần thiết khi `getDatabase()` được gọi lần đầu. Logic nằm ở:

```text
src/infrastructure/db/ensure-indexes.ts
```

Index quan trọng:

- `portfolio_items.ownerId`
- `portfolio_items.ownerId + createdAt`
- `portfolio_accounts.ownerId + steamId64` unique
- `storage_units.ownerId`
- `storage_units.ownerId + steamId64`
- `users.id` unique
- `users.provider + providerAccountId` unique
- `user_buff_prices.ownerId + marketHashName` unique
- `portfolio_realtime_events.ownerId + createdAt`
- TTL 1 giờ cho `portfolio_realtime_events.createdAt`
- TTL cho `inventory_scan_cache.expiresAt`
- TTL 1 giờ cho `scan_jobs.createdAt`
- TTL 1 giờ cho `rate_limits.updatedAt`

Sau deploy lần đầu, nên mở log để chắc chắn index bootstrap không lỗi.

## Health Check

Endpoint:

```text
GET /api/health
```

Dùng để kiểm tra:

- Server còn sống.
- MongoDB kết nối được không.
- Một số env quan trọng đã configured hay missing.

Route không được trả secret thật ra response.

## Kiểm Tra Tính Năng Sau Deploy

### Login Google

1. Mở app production.
2. Login bằng Google.
3. Kiểm tra `/api/auth/session` trả user.
4. Tạo/sửa một portfolio item.

### BUFF price sync theo tài khoản

1. Login cùng tài khoản trên hai browser/máy.
2. Chọn giá BUFF thủ công cho một item.
3. Mở lại portfolio/scanner ở máy khác.
4. Giá BUFF phải được load từ `user_buff_prices`.

### Realtime portfolio

1. Login cùng tài khoản trên hai browser/máy.
2. Ở máy 1, xóa hoặc sửa portfolio item.
3. Máy 2 phải tự cập nhật UI mà không cần reload.
4. Nếu không tự cập nhật:
   - Kiểm tra `ABLY_API_KEY`.
   - Kiểm tra `GET /api/realtime/ably-token` khi đã login.
   - Kiểm tra CSP/network có cho phép `*.ably.io` và `wss://*.ably.io`.

## Secret Rotation

### `AUTH_SECRET`

Tác động: session hiện tại mất hiệu lực, user cần login lại.

1. Tạo secret mới.
2. Cập nhật env trong hosting provider.
3. Redeploy/restart app.
4. Kiểm tra login/logout.

### `DATA_ENCRYPTION_KEY`

Tác động: dữ liệu đã mã hóa bằng key cũ có thể không giải mã được nếu chưa migrate. Cần lên kế hoạch rotate riêng nếu production đã có Steam cookie hoặc CS2Cap key.

### Google OAuth Secret

1. Vào Google Cloud Console.
2. Mở OAuth 2.0 Client.
3. Tạo/reset client secret.
4. Cập nhật `GOOGLE_CLIENT_SECRET`.
5. Redeploy/restart.
6. Kiểm tra flow `/api/auth/google`.

### Ably API Key

1. Tạo key mới trong Ably app.
2. Cập nhật `ABLY_API_KEY`.
3. Redeploy/restart.
4. Login và test `/api/realtime/ably-token`.
5. Test realtime bằng hai tab/máy.
6. Thu hồi key cũ.

### CS2Cap Key

1. Tạo key mới trên CS2Cap.
2. Cập nhật `CS2CAP_API_KEY`.
3. Redeploy/restart.
4. Test `/api/user/cs2cap/status` và BUFF price.

### CSFloat Key

1. Tạo key mới nếu cần.
2. Cập nhật `CSFLOAT_API_KEY`.
3. Redeploy/restart.
4. Test inspect pattern.

## Troubleshooting Production

| Triệu chứng                              | Kiểm tra                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| App crash khi start                      | `MONGODB_URI`, `AUTH_SECRET`, env validation                           |
| Login Google redirect sai                | `NEXT_PUBLIC_APP_URL`, Google redirect URI                             |
| Portfolio không load                     | MongoDB connection, owner filter, `/api/health`                        |
| Máy khác không tự cập nhật portfolio     | `ABLY_API_KEY`, `/api/realtime/ably-token`, CSP Ably, SSE fallback     |
| BUFF price thủ công không sync sau login | Session Google, `/api/user/buff-prices`, collection `user_buff_prices` |
| Analyzer lỗi                             | `GEMINI_API_KEY`, rate limit, Cloudinary nếu có ảnh                    |
| BUFF163 fetch lỗi                        | `CS2CAP_API_KEY` hoặc user CS2Cap key                                  |
| Pattern inspect rate limited             | `CSFLOAT_API_KEY`                                                      |
| Sync Steam lỗi                           | Steam cookie hết hạn, Family View, Steam rate limit                    |
