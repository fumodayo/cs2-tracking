# Deployment Guide

Tài liệu này gồm các bước chạy production, cấu hình biến môi trường và rotate secret cho CS2 Tracking.

## Checklist Nhanh

Trước khi deploy:

- Node.js 20+.
- MongoDB đang hoạt động.
- `MONGODB_URI` và `AUTH_SECRET` đã cấu hình.
- `NEXT_PUBLIC_APP_URL` đúng domain production.
- Nếu bật login Google: cấu hình Google OAuth redirect URI.
- Nếu bật Post Analyzer: cấu hình `GEMINI_API_KEY`.
- Nếu bật upload ảnh: cấu hình Cloudinary.
- Chạy `npm run typecheck`, `npm run lint`, `npm run build`.

## Biến Môi Trường

Copy `.env.example` và cấu hình trong hosting provider.

### Bắt buộc cho production

| Biến | Mục đích | Ghi chú |
| --- | --- | --- |
| `MONGODB_URI` | Connection string MongoDB | Nên dùng MongoDB Atlas hoặc MongoDB có auth |
| `MONGODB_DB` | Tên database | Mặc định trong code là `cs2_case_tracker` nếu để trống |
| `AUTH_SECRET` | Ký/mã hóa session và dữ liệu nhạy cảm | Nên là chuỗi dài, random |
| `NEXT_PUBLIC_APP_URL` | URL public của app | Ví dụ `https://your-domain.com` |

### Auth và admin

| Biến | Mục đích | Bắt buộc khi nào |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Khi dùng Google login |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Khi dùng Google login |
| `ADMIN_EMAILS` | Danh sách admin, cách nhau bằng dấu phẩy | Khi dùng admin bug reports |

Redirect URI Google OAuth nên là:

```text
https://your-domain.com/api/auth/google/callback
```

Local dev:

```text
http://localhost:3000/api/auth/google/callback
```

### AI, price và external services

| Biến | Mục đích | Bắt buộc khi nào |
| --- | --- | --- |
| `GEMINI_API_KEY` | Post Analyzer text/HTML/image | Khi dùng AI analyzer |
| `GEMINI_MODEL` | Gemini model | Mặc định nên để `gemini-2.5-flash` |
| `CS2CAP_API_KEY` | Server fallback key cho BUFF163 | Khi muốn có key mặc định |
| `CSFLOAT_API_KEY` | Giảm rate limit khi inspect pattern | Khi dùng pattern inspect nhiều |

### Cloudinary

| Biến | Mục đích |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud |
| `CLOUDINARY_API_KEY` | API key |
| `CLOUDINARY_API_SECRET` | API secret |

Cloudinary cần cho tính năng upload ảnh trong analyzer/bug report.

### Tùy chọn khác

| Biến | Mục đích |
| --- | --- |
| `LOG_LEVEL` | Điều khiển log level của logger |
| `SKIP_ENV_VALIDATION` | Bỏ qua env validation lúc production startup/build trong một số pipeline |
| `NODE_ENV` | `development`, `test`, `production` |

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
6. Deploy.
7. Kiểm tra `/api/health`.

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
- Process có quyền ghi file `steam_prices_fallback_cache.json` nếu dùng fallback cache file trong repo/server.

## MongoDB

App sẽ tạo một số index cần thiết khi `getDatabase()` được gọi lần đầu. Logic nằm trong:

```text
src/infrastructure/db/ensure-indexes.ts
```

Index quan trọng:

- `portfolio_items.ownerId`
- `portfolio_accounts.ownerId + steamId64`
- `storage_units.ownerId + steamId64`
- TTL cho `inventory_scan_cache.expiresAt`
- TTL cho `scan_jobs.createdAt`
- TTL cho `rate_limits.updatedAt`

Sau deploy lần đầu, nên mở log để chắc chắn index bootstrap không lỗi.

## Health Check

Endpoint:

```text
GET /api/health
```

Dùng để kiểm tra:

- Server còn sống.
- MongoDB có kết nối được không.
- Một số env quan trọng đã configured hay missing.

Không nên public thông tin secret; route chỉ nên hiện trạng thái configured/missing.

## Secret Rotation

### `AUTH_SECRET`

Tác động: tất cả session hiện tại sẽ mất hiệu lực, user cần login lại.

1. Tạo secret mới:

```bash
openssl rand -base64 32
```

2. Cập nhật env trong hosting provider.
3. Redeploy/restart app.
4. Kiểm tra login/logout.

### Google OAuth Secret

1. Vào Google Cloud Console.
2. Mở OAuth 2.0 Client.
3. Tạo/reset client secret.
4. Cập nhật `GOOGLE_CLIENT_SECRET`.
5. Redeploy/restart.
6. Kiểm tra flow `/api/auth/google`.

### Cloudinary Key

1. Tạo API key/secret mới trong Cloudinary.
2. Cập nhật `CLOUDINARY_API_KEY` và `CLOUDINARY_API_SECRET`.
3. Redeploy/restart.
4. Test upload ảnh.
5. Thu hồi key cũ.

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

| Triệu chứng | Kiểm tra |
| --- | --- |
| App crash ngay khi start | `MONGODB_URI`, `AUTH_SECRET`, env validation |
| Login Google redirect sai | `NEXT_PUBLIC_APP_URL`, Google redirect URI |
| Portfolio không load | MongoDB connection, owner filter, `/api/health` |
| Analyzer lỗi | `GEMINI_API_KEY`, rate limit, Cloudinary nếu có ảnh |
| BUFF price lỗi | `CS2CAP_API_KEY` hoặc user key |
| Pattern inspect rate limited | `CSFLOAT_API_KEY` |
| Sync Steam lỗi | Steam cookie hết hạn, Family View, Steam rate limit |

## Lệnh Kiểm Tra Trước Khi Merge/Deploy

```bash
npm run typecheck
npm run lint
npm run build
```

Nếu có test trong repo và muốn chạy:

```bash
npm run test:run
```
