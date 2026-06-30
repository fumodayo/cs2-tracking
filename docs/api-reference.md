# API Reference

Tài liệu này liệt kê các API route nội bộ, client API module và external service mà dự án đang dùng.

Tất cả internal route nằm trong `src/app/api`.

## Quy Ước Chung

- Response mặc định là JSON, trừ một số route streaming progress.
- API cần session/owner sẽ đọc user từ cookie session hoặc guest owner.
- API admin cần email nằm trong `ADMIN_EMAILS`.
- API tốn tài nguyên cao có rate limit.
- Secret/API key chỉ đọc server-side, không đưa vào client bundle.

## Internal API Routes

### Auth

| Method | Route | Mục đích | File |
| --- | --- | --- | --- |
| `GET` | `/api/auth/google` | Tạo URL Google OAuth và redirect | `src/app/api/auth/google/route.ts` |
| `GET` | `/api/auth/google/callback` | Xử lý callback OAuth, tạo session | `src/app/api/auth/google/callback/route.ts` |
| `GET` | `/api/auth/session` | Lấy session hiện tại | `src/app/api/auth/session/route.ts` |
| `POST` | `/api/auth/logout` | Đăng xuất, xóa session cookie | `src/app/api/auth/logout/route.ts` |

### Portfolio

| Method | Route | Mục đích | File |
| --- | --- | --- | --- |
| `GET` | `/api/portfolio` | Lấy portfolio report | `src/app/api/portfolio/route.ts` |
| `POST` | `/api/portfolio` | Thêm item vào portfolio | `src/app/api/portfolio/route.ts` |
| `DELETE` | `/api/portfolio` | Xóa nhiều item | `src/app/api/portfolio/route.ts` |
| `PATCH` | `/api/portfolio/[id]` | Cập nhật item | `src/app/api/portfolio/[id]/route.ts` |
| `DELETE` | `/api/portfolio/[id]` | Xóa một item | `src/app/api/portfolio/[id]/route.ts` |
| `POST` | `/api/portfolio/import` | Import Excel/CSV rows, có streaming progress | `src/app/api/portfolio/import/route.ts` |
| `POST` | `/api/portfolio/import-inventory` | Import kết quả inventory scan vào portfolio | `src/app/api/portfolio/import-inventory/route.ts` |
| `POST` | `/api/portfolio/migrate` | Chạy migration portfolio nội bộ | `src/app/api/portfolio/migrate/route.ts` |
| `GET` | `/api/portfolio/find-inspect-link` | Tìm inspect link cho item portfolio | `src/app/api/portfolio/find-inspect-link/route.ts` |

### Steam Accounts

| Method | Route | Mục đích | File |
| --- | --- | --- | --- |
| `GET` | `/api/portfolio/accounts` | Lấy danh sách Steam account đã link | `src/app/api/portfolio/accounts/route.ts` |
| `POST` | `/api/portfolio/accounts` | Link Steam account mới | `src/app/api/portfolio/accounts/route.ts` |
| `PATCH` | `/api/portfolio/accounts` | Cập nhật Steam cookie | `src/app/api/portfolio/accounts/route.ts` |
| `DELETE` | `/api/portfolio/accounts?id=...` | Xóa Steam account | `src/app/api/portfolio/accounts/route.ts` |
| `POST` | `/api/portfolio/accounts/check` | Kiểm tra cookie/account status | `src/app/api/portfolio/accounts/check/route.ts` |
| `POST` | `/api/portfolio/accounts/sync` | Đồng bộ tất cả account | `src/app/api/portfolio/accounts/sync/route.ts` |
| `POST` | `/api/portfolio/accounts/sync/single` | Đồng bộ một account | `src/app/api/portfolio/accounts/sync/single/route.ts` |

### Storage Units

| Method | Route | Mục đích | File |
| --- | --- | --- | --- |
| `GET` | `/api/portfolio/storage-units` | Lấy Storage Unit theo SteamID/account | `src/app/api/portfolio/storage-units/route.ts` |
| `POST` | `/api/portfolio/storage-units` | Tạo/cập nhật Storage Unit | `src/app/api/portfolio/storage-units/route.ts` |
| `POST` | `/api/portfolio/storage-units/assign` | Gán item vào Storage Unit | `src/app/api/portfolio/storage-units/assign/route.ts` |
| `DELETE` | `/api/portfolio/storage-units/items` | Xóa item khỏi Storage Unit | `src/app/api/portfolio/storage-units/items/route.ts` |
| `POST` | `/api/portfolio/storage-units/resolve-missing` | Xử lý item thiếu/thừa khi sync Storage Unit | `src/app/api/portfolio/storage-units/resolve-missing/route.ts` |

### Inventory Scanner

| Method | Route | Mục đích | File |
| --- | --- | --- | --- |
| `POST` | `/api/inventory/scan` | Tạo scan job | `src/app/api/inventory/scan/route.ts` |
| `GET` | `/api/inventory/scan?jobId=...` | Poll tiến trình scan | `src/app/api/inventory/scan/route.ts` |
| `GET` | `/api/inventory/search-case` | Tìm case/item theo tên | `src/app/api/inventory/search-case/route.ts` |
| `POST` | `/api/inventory/buff-price` | Lấy/refresh giá BUFF163 | `src/app/api/inventory/buff-price/route.ts` |
| `POST` | `/api/inventory/retry-price` | Retry giá Steam cho item bị lỗi | `src/app/api/inventory/retry-price/route.ts` |
| `POST` | `/api/inventory/inspect-pattern` | Inspect float/paint seed/pattern | `src/app/api/inventory/inspect-pattern/route.ts` |
| `POST` | `/api/inventory/sticker-prices` | Lấy giá sticker/charm/accessory | `src/app/api/inventory/sticker-prices/route.ts` |

### Post Analyzer

| Method | Route | Mục đích | File |
| --- | --- | --- | --- |
| `POST` | `/api/post/analyze` | Phân tích text/ảnh | `src/app/api/post/analyze/route.ts` |
| `POST` | `/api/post/analyze-html` | Phân tích HTML bài đăng | `src/app/api/post/analyze-html/route.ts` |
| `POST` | `/api/post/analyze-chatgpt` | Phân tích input JSON từ ChatGPT | `src/app/api/post/analyze-chatgpt/route.ts` |
| `POST` | `/api/post/extract` | Trích xuất text/author/time từ raw HTML | `src/app/api/post/extract/route.ts` |
| `GET` | `/api/post/history` | Lấy lịch sử phân tích | `src/app/api/post/history/route.ts` |
| `DELETE` | `/api/post/history/[id]` | Xóa một history item | `src/app/api/post/history/[id]/route.ts` |

### Prices

| Method | Route | Mục đích | File |
| --- | --- | --- | --- |
| `POST` | `/api/prices/refresh` | Refresh giá cho portfolio | `src/app/api/prices/refresh/route.ts` |

### CS2Cap User Keys

| Method | Route | Mục đích | File |
| --- | --- | --- | --- |
| `GET` | `/api/user/cs2cap` | Lấy danh sách key đã lưu | `src/app/api/user/cs2cap/route.ts` |
| `POST` | `/api/user/cs2cap` | Thêm key mới | `src/app/api/user/cs2cap/route.ts` |
| `PATCH` | `/api/user/cs2cap` | Chọn active key | `src/app/api/user/cs2cap/route.ts` |
| `DELETE` | `/api/user/cs2cap` | Xóa key | `src/app/api/user/cs2cap/route.ts` |
| `GET` | `/api/user/cs2cap/status` | Kiểm tra server/user có key khả dụng không | `src/app/api/user/cs2cap/status/route.ts` |
| `POST` | `/api/user/cs2cap/validate` | Validate key với CS2Cap | `src/app/api/user/cs2cap/validate/route.ts` |

### Utilities And Admin

| Method | Route | Mục đích | File |
| --- | --- | --- | --- |
| `GET` | `/api/cases` | Lấy danh sách cases/items | `src/app/api/cases/route.ts` |
| `GET` | `/api/health` | Health check và env status | `src/app/api/health/route.ts` |
| `GET` | `/api/image-proxy` | Proxy ảnh ngoài, có bảo vệ SSRF | `src/app/api/image-proxy/route.ts` |
| `POST` | `/api/bug-report` | Gửi bug report | `src/app/api/bug-report/route.ts` |
| `GET` | `/api/bug-report` | Admin lấy bug reports | `src/app/api/bug-report/route.ts` |
| `PATCH` | `/api/bug-report` | Admin cập nhật trạng thái bug report | `src/app/api/bug-report/route.ts` |

## Streaming APIs

Một số route trả dữ liệu theo từng dòng JSON để UI hiện progress:

| Route | Định dạng | Ghi chú |
| --- | --- | --- |
| `POST /api/portfolio/import` | newline-delimited JSON | event `progress`, `complete`, `error` |
| `POST /api/portfolio/import-inventory` | newline-delimited JSON | import scan result vào portfolio |
| `POST /api/portfolio/accounts/sync` | streaming events | đồng bộ nhiều account |
| `POST /api/portfolio/accounts/sync/single` | streaming events | đồng bộ một account |

Client nên đọc `response.body.getReader()` và parse từng dòng/event.

## Client API Modules

Client-side fetch wrapper nằm trong `src/lib/api-client`.

### `portfolio-api.ts`

| Function | API |
| --- | --- |
| `fetchPortfolioReport()` | `GET /api/portfolio` |
| `refreshPortfolioPrices()` | `POST /api/prices/refresh` |
| `addPortfolioItem()` | `POST /api/portfolio` |
| `updatePortfolioItem()` | `PATCH /api/portfolio/[id]` |
| `deletePortfolioItem()` | `DELETE /api/portfolio/[id]` |
| `deleteManyPortfolioItems()` | `DELETE /api/portfolio` |
| `importPortfolioRows()` | `POST /api/portfolio/import` |

### `steam-accounts-api.ts`

| Function | API |
| --- | --- |
| `fetchSteamAccounts()` | `GET /api/portfolio/accounts` |
| `triggerBackgroundSync()` | `POST /api/portfolio/accounts/sync` |
| `checkSteamCookieStatus()` | `POST /api/portfolio/accounts/check` |
| `addSteamAccount()` | `POST /api/portfolio/accounts` |
| `updateSteamAccountCookie()` | `PATCH /api/portfolio/accounts` |
| `deleteSteamAccount()` | `DELETE /api/portfolio/accounts?id=...` |
| `fetchAccountStorageUnits()` | `GET /api/portfolio/storage-units` |

### `buff-api.ts`

| Function | API |
| --- | --- |
| `refreshBuffPrice()` | `POST /api/inventory/buff-price` |

## External Services

| Service | Dùng cho | File chính | Env liên quan |
| --- | --- | --- | --- |
| Google OAuth | Đăng nhập | `src/services/auth-service.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` |
| Google Gemini | AI analyzer | `src/services/parser/gemini-client.ts` | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Steam Community | Profile, inventory, listings, wallet | `src/infrastructure/steam.ts`, `src/services/scan-service.ts` | Steam cookie của user |
| Steam Market | Giá Steam | `src/infrastructure/price/steam-market-price-provider.ts` | không bắt buộc |
| CSGOTrader | Fallback giá Steam | `src/infrastructure/price/steam-market-price-provider.ts` | không bắt buộc |
| CS2Cap | BUFF163 price, key validation | `src/utils/api-client.ts`, `src/services/parser/buff-price-client.ts` | `CS2CAP_API_KEY` |
| CSFloat | Float/paint seed | `src/services/pattern/csfloat-client.ts` | `CSFLOAT_API_KEY` |
| Cloudinary | Upload ảnh | `src/infrastructure/cloudinary.ts` | `CLOUDINARY_*` |
| Exchange Rate API | USD/VND fallback conversion | `src/infrastructure/price/steam-market-price-provider.ts` | không bắt buộc |

## Auth, Owner Và Permission

| Loại API | Yêu cầu |
| --- | --- |
| Portfolio/Steam account | ownerId từ session/guest, phải filter theo owner |
| Admin bug report | admin email trong `ADMIN_EMAILS` |
| CS2Cap user keys | user/session owner |
| Public utilities | vẫn nên validate input và rate limit nếu cần |

Khi thêm route mới có đọc/ghi data người dùng, hãy xác định owner sớm và áp dụng owner filter trong mọi query/update/delete.
