# API Reference

Tài liệu này liệt kê các API route nội bộ, client API module và external service mà dự án đang dùng.

Tất cả internal route nằm trong `src/app/api`.

## Quy Ước Chung

- Response mặc định là JSON, trừ một số route streaming/SSE.
- API đọc/ghi data user phải xác định `ownerId`.
- User login có `ownerId = google:<googleUserId>`.
- User chưa login có `ownerId = guest:<uuid>`.
- API admin cần email nằm trong `ADMIN_EMAILS`.
- Secret/API key chỉ đọc server-side, không đưa vào client bundle.
- API tốn tài nguyên nên có validation/rate limit.

## Internal API Routes

### Auth

| Method | Route                       | Mục đích                                            | File                                        |
| ------ | --------------------------- | --------------------------------------------------- | ------------------------------------------- |
| `GET`  | `/api/auth/google`          | Tạo URL Google OAuth và redirect                    | `src/app/api/auth/google/route.ts`          |
| `GET`  | `/api/auth/google/callback` | Xử lý OAuth callback, tạo session, merge guest data | `src/app/api/auth/google/callback/route.ts` |
| `GET`  | `/api/auth/session`         | Lấy session hiện tại                                | `src/app/api/auth/session/route.ts`         |
| `POST` | `/api/auth/logout`          | Đăng xuất, xóa session cookie                       | `src/app/api/auth/logout/route.ts`          |

### Portfolio

| Method   | Route                              | Mục đích                                     | File                                               |
| -------- | ---------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| `GET`    | `/api/portfolio`                   | Lấy portfolio report theo owner              | `src/app/api/portfolio/route.ts`                   |
| `POST`   | `/api/portfolio`                   | Thêm item vào portfolio                      | `src/app/api/portfolio/route.ts`                   |
| `DELETE` | `/api/portfolio`                   | Xóa nhiều item                               | `src/app/api/portfolio/route.ts`                   |
| `PATCH`  | `/api/portfolio/[id]`              | Cập nhật item                                | `src/app/api/portfolio/[id]/route.ts`              |
| `DELETE` | `/api/portfolio/[id]`              | Xóa một item                                 | `src/app/api/portfolio/[id]/route.ts`              |
| `POST`   | `/api/portfolio/import`            | Import Excel/CSV rows, có streaming progress | `src/app/api/portfolio/import/route.ts`            |
| `POST`   | `/api/portfolio/import-inventory`  | Import kết quả inventory scan vào portfolio  | `src/app/api/portfolio/import-inventory/route.ts`  |
| `POST`   | `/api/portfolio/migrate`           | Chạy migration portfolio nội bộ              | `src/app/api/portfolio/migrate/route.ts`           |
| `GET`    | `/api/portfolio/find-inspect-link` | Tìm inspect link cho item portfolio          | `src/app/api/portfolio/find-inspect-link/route.ts` |

Các mutation portfolio publish realtime event sau khi ghi dữ liệu thành công.

### Steam Accounts

| Method   | Route                                 | Mục đích                            | File                                                  |
| -------- | ------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `GET`    | `/api/portfolio/accounts`             | Lấy danh sách Steam account đã link | `src/app/api/portfolio/accounts/route.ts`             |
| `POST`   | `/api/portfolio/accounts`             | Link Steam account mới              | `src/app/api/portfolio/accounts/route.ts`             |
| `PATCH`  | `/api/portfolio/accounts`             | Cập nhật Steam cookie               | `src/app/api/portfolio/accounts/route.ts`             |
| `DELETE` | `/api/portfolio/accounts?id=...`      | Xóa Steam account                   | `src/app/api/portfolio/accounts/route.ts`             |
| `POST`   | `/api/portfolio/accounts/check`       | Kiểm tra cookie/account status      | `src/app/api/portfolio/accounts/check/route.ts`       |
| `POST`   | `/api/portfolio/accounts/sync`        | Đồng bộ tất cả account              | `src/app/api/portfolio/accounts/sync/route.ts`        |
| `POST`   | `/api/portfolio/accounts/sync/single` | Đồng bộ một account                 | `src/app/api/portfolio/accounts/sync/single/route.ts` |

Sync route cũng publish realtime event `synced`.

### Storage Units

| Method   | Route                                          | Mục đích                                    | File                                                           |
| -------- | ---------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| `GET`    | `/api/portfolio/storage-units`                 | Lấy Storage Unit theo SteamID/account       | `src/app/api/portfolio/storage-units/route.ts`                 |
| `POST`   | `/api/portfolio/storage-units`                 | Tạo/cập nhật Storage Unit                   | `src/app/api/portfolio/storage-units/route.ts`                 |
| `POST`   | `/api/portfolio/storage-units/assign`          | Gán item vào Storage Unit                   | `src/app/api/portfolio/storage-units/assign/route.ts`          |
| `DELETE` | `/api/portfolio/storage-units/items`           | Xóa item khỏi Storage Unit                  | `src/app/api/portfolio/storage-units/items/route.ts`           |
| `POST`   | `/api/portfolio/storage-units/resolve-missing` | Xử lý item thiếu/thừa khi sync Storage Unit | `src/app/api/portfolio/storage-units/resolve-missing/route.ts` |

### Inventory Scanner

| Method | Route                            | Mục đích                         | File                                             |
| ------ | -------------------------------- | -------------------------------- | ------------------------------------------------ |
| `POST` | `/api/inventory/scan`            | Tạo scan job                     | `src/app/api/inventory/scan/route.ts`            |
| `GET`  | `/api/inventory/scan?jobId=...`  | Poll tiến trình scan             | `src/app/api/inventory/scan/route.ts`            |
| `GET`  | `/api/inventory/search-case`     | Tìm case/item theo tên           | `src/app/api/inventory/search-case/route.ts`     |
| `POST` | `/api/inventory/buff-price`      | Lấy/refresh giá BUFF163          | `src/app/api/inventory/buff-price/route.ts`      |
| `POST` | `/api/inventory/retry-price`     | Retry giá Steam cho item bị lỗi  | `src/app/api/inventory/retry-price/route.ts`     |
| `POST` | `/api/inventory/inspect-pattern` | Inspect float/paint seed/pattern | `src/app/api/inventory/inspect-pattern/route.ts` |
| `POST` | `/api/inventory/sticker-prices`  | Lấy giá sticker/charm/accessory  | `src/app/api/inventory/sticker-prices/route.ts`  |

### User BUFF Prices

Route này chỉ dành cho user đã login. Guest dùng `localStorage`.

| Method  | Route                   | Mục đích                              | File                                    |
| ------- | ----------------------- | ------------------------------------- | --------------------------------------- |
| `GET`   | `/api/user/buff-prices` | Lấy map giá BUFF thủ công của user    | `src/app/api/user/buff-prices/route.ts` |
| `POST`  | `/api/user/buff-prices` | Merge nhiều giá BUFF vào DB           | `src/app/api/user/buff-prices/route.ts` |
| `PUT`   | `/api/user/buff-prices` | Replace toàn bộ map giá BUFF của user | `src/app/api/user/buff-prices/route.ts` |
| `PATCH` | `/api/user/buff-prices` | Update hoặc xóa giá BUFF của một item | `src/app/api/user/buff-prices/route.ts` |

Request/response chính:

```ts
type BuffPricesResponse = {
  pricesCny: Record<string, number>;
};
```

`PATCH` body:

```ts
{
  "marketHashName": "AK-47 | Redline (Field-Tested)",
  "priceCny": 123.45
}
```

Gửi `priceCny: null` hoặc giá không hợp lệ để xóa item đó khỏi DB.

### CS2Cap User Keys

| Method   | Route                       | Mục đích                                   | File                                        |
| -------- | --------------------------- | ------------------------------------------ | ------------------------------------------- |
| `GET`    | `/api/user/cs2cap`          | Lấy danh sách key đã lưu                   | `src/app/api/user/cs2cap/route.ts`          |
| `POST`   | `/api/user/cs2cap`          | Thêm key mới                               | `src/app/api/user/cs2cap/route.ts`          |
| `PATCH`  | `/api/user/cs2cap`          | Chọn active key                            | `src/app/api/user/cs2cap/route.ts`          |
| `DELETE` | `/api/user/cs2cap`          | Xóa key                                    | `src/app/api/user/cs2cap/route.ts`          |
| `GET`    | `/api/user/cs2cap/status`   | Kiểm tra server/user có key khả dụng không | `src/app/api/user/cs2cap/status/route.ts`   |
| `POST`   | `/api/user/cs2cap/validate` | Validate key với CS2Cap                    | `src/app/api/user/cs2cap/validate/route.ts` |

### Realtime

| Method | Route                      | Mục đích                            | File                                       |
| ------ | -------------------------- | ----------------------------------- | ------------------------------------------ |
| `GET`  | `/api/realtime/ably-token` | Cấp Ably token cho user đã login    | `src/app/api/realtime/ably-token/route.ts` |
| `GET`  | `/api/realtime/portfolio`  | SSE fallback cho portfolio realtime | `src/app/api/realtime/portfolio/route.ts`  |

`/api/realtime/ably-token`:

- Yêu cầu login.
- Trả `401` nếu chưa login.
- Trả `503` nếu chưa cấu hình `ABLY_API_KEY`.
- Token chỉ có quyền subscribe channel `portfolio:<ownerId>`.

`/api/realtime/portfolio`:

- Yêu cầu login.
- Response là `text/event-stream`.
- Event chính: `portfolio-changed`.
- Có heartbeat định kỳ.
- Có poll MongoDB event log để bắt event missed trong thời gian ngắn.

Realtime event payload:

```ts
type PortfolioRealtimeEvent = {
  id: string;
  type: 'portfolio.changed';
  ownerId: string;
  action:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'deleted_many'
    | 'imported'
    | 'synced'
    | 'prices_refreshed';
  changedAt: string;
  detail?: Record<string, unknown>;
};
```

### Post Analyzer

| Method   | Route                       | Mục đích                                | File                                        |
| -------- | --------------------------- | --------------------------------------- | ------------------------------------------- |
| `POST`   | `/api/post/analyze`         | Phân tích text/ảnh                      | `src/app/api/post/analyze/route.ts`         |
| `POST`   | `/api/post/analyze-html`    | Phân tích HTML bài đăng                 | `src/app/api/post/analyze-html/route.ts`    |
| `POST`   | `/api/post/analyze-chatgpt` | Phân tích input JSON từ ChatGPT         | `src/app/api/post/analyze-chatgpt/route.ts` |
| `POST`   | `/api/post/extract`         | Trích xuất text/author/time từ raw HTML | `src/app/api/post/extract/route.ts`         |
| `GET`    | `/api/post/history`         | Lấy lịch sử phân tích                   | `src/app/api/post/history/route.ts`         |
| `DELETE` | `/api/post/history/[id]`    | Xóa một history item                    | `src/app/api/post/history/[id]/route.ts`    |

### Prices

| Method | Route                 | Mục đích                  | File                                  |
| ------ | --------------------- | ------------------------- | ------------------------------------- |
| `POST` | `/api/prices/refresh` | Refresh giá cho portfolio | `src/app/api/prices/refresh/route.ts` |

Route này publish realtime event `prices_refreshed`.

### Utilities And Admin

| Method  | Route              | Mục đích                             | File                               |
| ------- | ------------------ | ------------------------------------ | ---------------------------------- |
| `GET`   | `/api/cases`       | Lấy danh sách cases/items            | `src/app/api/cases/route.ts`       |
| `GET`   | `/api/health`      | Health check và env status           | `src/app/api/health/route.ts`      |
| `GET`   | `/api/image-proxy` | Proxy ảnh ngoài, có bảo vệ SSRF      | `src/app/api/image-proxy/route.ts` |
| `POST`  | `/api/bug-report`  | Gửi bug report                       | `src/app/api/bug-report/route.ts`  |
| `GET`   | `/api/bug-report`  | Admin lấy bug reports                | `src/app/api/bug-report/route.ts`  |
| `PATCH` | `/api/bug-report`  | Admin cập nhật trạng thái bug report | `src/app/api/bug-report/route.ts`  |

## Streaming APIs

Một số route trả dữ liệu theo từng dòng JSON hoặc SSE:

| Route                                      | Định dạng              | Ghi chú                               |
| ------------------------------------------ | ---------------------- | ------------------------------------- |
| `POST /api/portfolio/import`               | newline-delimited JSON | Event `progress`, `complete`, `error` |
| `POST /api/portfolio/import-inventory`     | newline-delimited JSON | Import scan result vào portfolio      |
| `POST /api/portfolio/accounts/sync`        | streaming events       | Đồng bộ nhiều account                 |
| `POST /api/portfolio/accounts/sync/single` | streaming events       | Đồng bộ một account                   |
| `GET /api/realtime/portfolio`              | Server-Sent Events     | Fallback realtime portfolio           |

Client streaming JSON nên đọc `response.body.getReader()` và parse từng dòng/event.

## Client API Modules

Client-side fetch wrapper nằm trong `src/lib/api-client`.

### `portfolio-api.ts`

| Function                     | API                          |
| ---------------------------- | ---------------------------- |
| `fetchPortfolioReport()`     | `GET /api/portfolio`         |
| `refreshPortfolioPrices()`   | `POST /api/prices/refresh`   |
| `addPortfolioItem()`         | `POST /api/portfolio`        |
| `updatePortfolioItem()`      | `PATCH /api/portfolio/[id]`  |
| `deletePortfolioItem()`      | `DELETE /api/portfolio/[id]` |
| `deleteManyPortfolioItems()` | `DELETE /api/portfolio`      |
| `importPortfolioRows()`      | `POST /api/portfolio/import` |

### `steam-accounts-api.ts`

| Function                     | API                                     |
| ---------------------------- | --------------------------------------- |
| `fetchSteamAccounts()`       | `GET /api/portfolio/accounts`           |
| `triggerBackgroundSync()`    | `POST /api/portfolio/accounts/sync`     |
| `checkSteamCookieStatus()`   | `POST /api/portfolio/accounts/check`    |
| `addSteamAccount()`          | `POST /api/portfolio/accounts`          |
| `updateSteamAccountCookie()` | `PATCH /api/portfolio/accounts`         |
| `deleteSteamAccount()`       | `DELETE /api/portfolio/accounts?id=...` |
| `fetchAccountStorageUnits()` | `GET /api/portfolio/storage-units`      |

### `user-buff-prices-api.ts`

| Function                  | API                           |
| ------------------------- | ----------------------------- |
| `fetchUserBuffPrices()`   | `GET /api/user/buff-prices`   |
| `mergeUserBuffPrices()`   | `POST /api/user/buff-prices`  |
| `replaceUserBuffPrices()` | `PUT /api/user/buff-prices`   |
| `updateUserBuffPrice()`   | `PATCH /api/user/buff-prices` |

### `buff-api.ts`

| Function             | API                              |
| -------------------- | -------------------------------- |
| `refreshBuffPrice()` | `POST /api/inventory/buff-price` |

### Realtime hook

Realtime portfolio không có client API wrapper riêng. Dashboard dùng:

```ts
usePortfolioRealtime(Boolean(user), user ? `google:${user.id}` : undefined);
```

Hook này tự thử Ably trước, rồi fallback SSE nếu cần.

## External Services

| Service           | Dùng cho                             | File chính                                                                         | Env liên quan                                             |
| ----------------- | ------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Google OAuth      | Đăng nhập                            | `src/services/auth-service.ts`                                                     | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` |
| Ably              | Realtime portfolio                   | `src/services/realtime/portfolio-events.ts`, `src/hooks/use-portfolio-realtime.ts` | `ABLY_API_KEY`                                            |
| Google Gemini     | AI analyzer                          | `src/services/parser/gemini-client.ts`                                             | `GEMINI_API_KEY`, `GEMINI_MODEL`                          |
| Steam Community   | Profile, inventory, listings, wallet | `src/infrastructure/steam.ts`, `src/services/scan-service.ts`                      | User Steam cookie                                         |
| Steam Market      | Giá Steam                            | `src/infrastructure/price/steam-market-price-provider.ts`                          | Không bắt buộc                                            |
| CSGOTrader        | Fallback giá Steam                   | `src/infrastructure/price/steam-market-price-provider.ts`                          | Không bắt buộc                                            |
| CS2Cap            | BUFF163 price, key validation        | `src/services/parser/buff-price-client.ts`                                         | `CS2CAP_API_KEY`                                          |
| CSFloat           | Float/paint seed                     | `src/services/pattern/csfloat-client.ts`                                           | `CSFLOAT_API_KEY`                                         |
| Cloudinary        | Upload ảnh                           | `src/infrastructure/cloudinary.ts`                                                 | `CLOUDINARY_*`                                            |
| Exchange Rate API | USD/VND fallback conversion          | `src/infrastructure/price/steam-market-price-provider.ts`                          | Không bắt buộc                                            |

## Auth, Owner Và Permission

| Loại API                             | Yêu cầu                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| Portfolio/Steam account/Storage Unit | `ownerId`, luôn filter query/update/delete theo owner   |
| User BUFF prices                     | Phải login Google                                       |
| Realtime Ably token                  | Phải login Google, chỉ subscribe channel của chính user |
| Realtime SSE fallback                | Phải login Google                                       |
| Admin bug report                     | Email nằm trong `ADMIN_EMAILS`                          |
| CS2Cap user keys                     | User/session owner                                      |
| Public utilities                     | Validate input và rate limit nếu cần                    |

Khi thêm route mới có đọc/ghi dữ liệu người dùng, xác định owner sớm và áp dụng owner filter trong mọi query/update/delete.
