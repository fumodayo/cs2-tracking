# API Reference

Tất cả internal API route nằm trong `src/app/api`. Tài liệu này phản ánh method, quyền truy cập, streaming format, realtime channel và browser API client đang có trong code.

## Quy Ước Chung

- Response mặc định là JSON; ngoại lệ được liệt kê ở mục [Streaming APIs](#streaming-apis).
- Portfolio data được scope bằng `ownerId`: `google:<userId>` hoặc `guest:<uuid>`.
- Route user-only lấy Google session bằng `getCurrentUser()` và trả `401` nếu chưa login.
- Route admin kiểm tra email trong `ADMIN_EMAILS` hoặc dùng `isAdminAccessAllowed()` theo ghi chú từng route.
- Secret/API key chỉ được đọc server-side.
- `src/proxy.ts` chặn mọi mutation API (`POST`, `PUT`, `PATCH`, `DELETE`) nếu thiếu `Origin`/`Referer` cùng host. Client ngoài browser phải gửi header phù hợp.
- Error body thường có `{ "message": "translationKeyOrError" }`; route rate-limit có thể kèm `details.retryAfter` và header `Retry-After`.

## Auth Và Owner

| Loại route                                         | Quyền                                                        |
| -------------------------------------------------- | ------------------------------------------------------------ |
| Portfolio/account/Storage Unit/scan                | Owner guest hoặc Google; dữ liệu luôn phải filter theo owner |
| Import inventory scan                              | Google session                                               |
| User BUFF prices/preferences/recent imports/CS2Cap | Google session                                               |
| Ably token, portfolio SSE, recent-import SSE       | Google session                                               |
| Bug report submit                                  | Guest hoặc user                                              |
| Bug report admin                                   | Google session + email trong `ADMIN_EMAILS`                  |
| Post Analyzer mutation/delete history              | Admin access; production cần Google session + admin email    |
| Post-analysis history `GET`                        | `checkAuth().authorized`; khi OAuth đã bật thì cần login     |

`checkAuth()` có một hành vi cần lưu ý: nếu Google OAuth chưa được cấu hình, guest được coi là authorized. Tuy nhiên `isAdminAccessAllowed()` chỉ cho phép guest ở non-production, nên Post Analyzer không hoạt động cho guest production.

## Internal API Routes

### Auth

| Method | Route                       | Mục đích                                                    |
| ------ | --------------------------- | ----------------------------------------------------------- |
| `GET`  | `/api/auth/google`          | Tạo authorization URL, state cookie và redirect sang Google |
| `GET`  | `/api/auth/google/callback` | Exchange code, upsert user, merge guest data, tạo session   |
| `GET`  | `/api/auth/session`         | Trả session hiện tại, trạng thái Google config/admin        |
| `POST` | `/api/auth/logout`          | Xóa session và guest cookie                                 |

### Portfolio

| Method   | Route                              | Mục đích / ghi chú                                         |
| -------- | ---------------------------------- | ---------------------------------------------------------- |
| `GET`    | `/api/portfolio`                   | Build hoặc trả report cache theo owner                     |
| `GET`    | `/api/portfolio?fresh=1`           | Bỏ qua cache 60 giây và build report mới                   |
| `POST`   | `/api/portfolio`                   | Tạo lot; cập nhật Storage Unit nếu có; trả report mới      |
| `DELETE` | `/api/portfolio`                   | Xóa nhiều item/virtual Storage Unit item                   |
| `PATCH`  | `/api/portfolio/[id]`              | Sửa lot, ownership, inspect/pattern, accessory pricing     |
| `DELETE` | `/api/portfolio/[id]`              | Xóa một lot và điều chỉnh Storage Unit                     |
| `POST`   | `/api/portfolio/import`            | Import rows bằng NDJSON progress                           |
| `POST`   | `/api/portfolio/import-inventory`  | Import kết quả scanner; yêu cầu login; JSON-lines progress |
| `POST`   | `/api/portfolio/migrate`           | Migration portfolio nội bộ/legacy                          |
| `GET`    | `/api/portfolio/find-inspect-link` | Tìm inspect link cho portfolio item                        |

`DELETE /api/portfolio` body:

```json
{
  "ids": ["mongoObjectId", "virtual_caseId"],
  "recentImportId": "optional-id-used-by-undo"
}
```

Nếu có `recentImportId` và owner đã login, route xóa luôn record trong `user_recent_imports` và publish recent-import event.

`PATCH /api/portfolio/[id]` chấp nhận các field đang được UI/API client dùng:

```ts
type PortfolioItemPatch = {
  quantity?: number;
  buyPrice?: number;
  buyDate?: string;
  note?: string;
  sourceAccounts?: Array<Record<string, unknown>>;
  storageUnitId?: string | null;
  tradeHoldUntil?: string | null;
  dopplerPhase?: string;
  inspectLink?: string;
  patternInfo?: Record<string, unknown>;
  stickerPriceRate?: number;
  stickerBuyPriceRate?: number;
  stickerScanTotalPrice?: number;
  stickerScanPriceCapturedAt?: string;
};
```

Các mutation portfolio publish `portfolio.changed`. Tạo/sửa/xóa trả `PortfolioReportDto`; import/sync dài cập nhật cache và event sau khi hoàn tất.

### Steam Accounts

| Method   | Route                                 | Mục đích                                     |
| -------- | ------------------------------------- | -------------------------------------------- |
| `GET`    | `/api/portfolio/accounts`             | Lấy linked Steam accounts theo owner         |
| `POST`   | `/api/portfolio/accounts`             | Link account mới và lưu cookie mã hóa nếu có |
| `PATCH`  | `/api/portfolio/accounts`             | Cập nhật cookie/account data                 |
| `DELETE` | `/api/portfolio/accounts?id=...`      | Xóa account                                  |
| `POST`   | `/api/portfolio/accounts/check`       | Kiểm tra cookie/account status               |
| `POST`   | `/api/portfolio/accounts/sync`        | Sync toàn bộ account, trả SSE progress       |
| `POST`   | `/api/portfolio/accounts/sync/single` | Sync một account, trả SSE progress           |

`/sync?bypassCooldown=true` chỉ bỏ cooldown khi `isAdminAccessAllowed()` trả true.

### Storage Units

| Method   | Route                                          | Mục đích                                         |
| -------- | ---------------------------------------------- | ------------------------------------------------ |
| `GET`    | `/api/portfolio/storage-units`                 | Lấy Storage Units, có thể filter SteamID/account |
| `POST`   | `/api/portfolio/storage-units`                 | Tạo/upsert Storage Unit                          |
| `POST`   | `/api/portfolio/storage-units/assign`          | Gán item vào Storage Unit                        |
| `DELETE` | `/api/portfolio/storage-units/items`           | Xóa item khỏi Storage Unit                       |
| `POST`   | `/api/portfolio/storage-units/resolve-missing` | Giải quyết item thiếu/thừa sau sync              |

Capacity domain hiện là 1000 item cho mỗi Storage Unit. Route tạo/sửa lot kiểm tra capacity trước khi ghi.

### Inventory Scanner Và Pricing

| Method | Route                            | Mục đích                                    |
| ------ | -------------------------------- | ------------------------------------------- |
| `POST` | `/api/inventory/scan`            | Tạo scan job hoặc chạy synchronous fallback |
| `GET`  | `/api/inventory/scan?jobId=...`  | Đọc job/progress/result, kiểm tra owner     |
| `GET`  | `/api/inventory/search-case`     | Tìm case/item theo tên                      |
| `POST` | `/api/inventory/buff-price`      | Lấy/refresh giá BUFF163                     |
| `POST` | `/api/inventory/retry-price`     | Retry Steam price cho item lỗi              |
| `POST` | `/api/inventory/inspect-pattern` | Inspect float, paint seed, phase/pattern    |
| `POST` | `/api/inventory/sticker-prices`  | Lấy giá sticker/charm/accessory             |

Scan request async chuẩn:

```json
{
  "steamUrl": "https://steamcommunity.com/id/example",
  "steamCookie": "optional-cookie",
  "steamSessionId": "optional-session-id",
  "forceRefresh": false,
  "progress": true
}
```

Response ban đầu là `{ "jobId": "..." }`. Client sau đó xin Ably token theo job; nếu không được thì poll route `GET`.

BUFF price chọn API key theo thứ tự:

1. CS2Cap active key của user đã login.
2. `CS2CAP_API_KEY` của server.

### User BUFF Prices

Chỉ dành cho user đã login. Guest dùng `localStorage` key `cs2t_buffPricesCny`.

| Method  | Route                   | Mục đích            |
| ------- | ----------------------- | ------------------- |
| `GET`   | `/api/user/buff-prices` | Lấy map giá CNY     |
| `POST`  | `/api/user/buff-prices` | Merge map vào DB    |
| `PUT`   | `/api/user/buff-prices` | Replace toàn bộ map |
| `PATCH` | `/api/user/buff-prices` | Update/xóa một item |

Response:

```ts
type BuffPricesResponse = {
  pricesCny: Record<string, number>;
};
```

`PATCH` body:

```json
{
  "marketHashName": "AK-47 | Redline (Field-Tested)",
  "priceCny": 123.45
}
```

Gửi `priceCny: null` hoặc giá không hợp lệ để xóa giá của item. Mutation publish event `user-buff-prices.changed`.

### User Preferences

Chỉ dành cho user đã login.

| Method  | Route                   | Mục đích                                           |
| ------- | ----------------------- | -------------------------------------------------- |
| `GET`   | `/api/user/preferences` | Lấy Excel mapping templates và pricing preferences |
| `PATCH` | `/api/user/preferences` | Cập nhật một hoặc cả hai section                   |

Response:

```ts
type UserPreferencesResponse = {
  preferences: {
    excelMappingTemplates: Array<{
      id: string;
      label: string;
      headerFingerprint: string;
      mapping: {
        name: number;
        quantity?: number;
        buyPrice?: number;
        buyDate?: number;
        note?: number;
        caseId?: number;
      };
      createdAt: string;
    }>;
    pricing: {
      rateSi?: number;
      rateLe?: number;
      buffCnyToVndRate?: number;
    };
  };
};
```

Giới hạn normalize hiện tại:

- tối đa 50 mapping templates;
- column index từ 0 đến 200;
- `rateSi`, `rateLe`: 0–100;
- `buffCnyToVndRate`: 1–100000.

Mutation publish `user-preferences.changed` với danh sách section đã đổi.

### User Recent Imports

Chỉ dành cho user đã login. API trả tối đa 10 record gần nhất.

| Method   | Route                             | Mục đích                                      |
| -------- | --------------------------------- | --------------------------------------------- |
| `GET`    | `/api/user/recent-imports`        | Lấy lịch sử import gần nhất                   |
| `POST`   | `/api/user/recent-imports`        | Upsert một `import` hoặc merge mảng `imports` |
| `DELETE` | `/api/user/recent-imports?id=...` | Xóa một record                                |
| `DELETE` | `/api/user/recent-imports`        | Xóa toàn bộ record của owner                  |

```ts
type RecentImport = {
  id: string;
  fileName: string;
  date: string;
  importedCount: number;
  importedIds: string[]; // tối đa 10.000
  items?: Array<{
    name: string;
    quantity: number;
    buyPrice: number;
    buyDate?: string;
    note?: string;
    createdAt?: string;
  }>; // tối đa 1.000 details
};
```

Mutation publish `user-recent-imports.changed`. Guest lưu cùng DTO trong `cs2t_recentImports`, rồi merge lên API khi login.

### CS2Cap User Keys

Route hiện chỉ export `GET` và `POST`; các method `PATCH`/`DELETE` cũ không còn tồn tại.

| Method | Route                       | Mục đích                                          |
| ------ | --------------------------- | ------------------------------------------------- |
| `GET`  | `/api/user/cs2cap`          | Lấy danh sách prefix, active key và account stats |
| `POST` | `/api/user/cs2cap`          | Thêm key mới; hoặc action `select`/`delete`       |
| `GET`  | `/api/user/cs2cap/status`   | Kiểm tra user/server có key khả dụng              |
| `POST` | `/api/user/cs2cap/validate` | Validate key với CS2Cap, có rate limit            |

Ví dụ action:

```json
{ "action": "select", "keyPrefix": "first-12-chars••••" }
```

```json
{ "action": "delete", "keyPrefix": "first-12-chars••••" }
```

Thêm/chọn/xóa key publish `user-settings.changed`.

### Realtime

| Method | Route                               | Mục đích                                            |
| ------ | ----------------------------------- | --------------------------------------------------- |
| `GET`  | `/api/realtime/ably-token`          | Cấp token mặc định cho portfolio                    |
| `GET`  | `/api/realtime/portfolio`           | SSE portfolio, heartbeat và event-log catch-up      |
| `GET`  | `/api/realtime/user-recent-imports` | SSE recent imports, heartbeat và event-log catch-up |

`/api/realtime/ably-token` yêu cầu login, trả `503` nếu thiếu `ABLY_API_KEY`, TTL token 1 giờ và capability chỉ có `subscribe`.

| Query                 | Channel trả về                  | Kiểm tra thêm        |
| --------------------- | ------------------------------- | -------------------- |
| không có              | `portfolio:<ownerId>`           | —                    |
| `scanJobId=<id>`      | `scan:<ownerId>:<jobId>`        | Job phải thuộc owner |
| `adminBugReports=1`   | `admin:bug-reports`             | Admin email          |
| `adminPostAnalysis=1` | `admin:post-analysis-history`   | Admin email          |
| `userBuffPrices=1`    | `user:<ownerId>:buff-prices`    | —                    |
| `userPreferences=1`   | `user:<ownerId>:preferences`    | —                    |
| `userRecentImports=1` | `user:<ownerId>:recent-imports` | —                    |
| `userSettings=1`      | `user:<ownerId>:settings`       | —                    |

Khi query chọn channel đặc biệt, response có dạng:

```ts
type RealtimeTokenResponse = {
  tokenDetails: Ably.TokenDetails;
  channelName: string;
};
```

Mặc định portfolio trả trực tiếp `tokenDetails` để tương thích hook hiện tại.

### Post Analyzer

Các mutation dưới đây hiện yêu cầu admin access và có Gemini rate limit:

| Method   | Route                       | Mục đích                                             |
| -------- | --------------------------- | ---------------------------------------------------- |
| `POST`   | `/api/post/analyze`         | Phân tích text/ảnh                                   |
| `POST`   | `/api/post/analyze-html`    | Phân tích HTML bài đăng                              |
| `POST`   | `/api/post/analyze-chatgpt` | Nhập/phân tích JSON từ ChatGPT                       |
| `POST`   | `/api/post/extract`         | Trích text/author/time/image từ raw HTML             |
| `GET`    | `/api/post/history`         | List 30 record hoặc tìm theo `postUrl`/`fingerprint` |
| `DELETE` | `/api/post/history/[id]`    | Xóa history item; admin-only                         |

Save/touch/delete history publish `post-analysis-history.changed`. History collection hiện là global, không gắn owner.

### Prices

| Method | Route                 | Mục đích                                                                  |
| ------ | --------------------- | ------------------------------------------------------------------------- |
| `POST` | `/api/prices/refresh` | Refresh portfolio prices, update report cache, publish `prices_refreshed` |

### Utilities Và Admin

| Method  | Route              | Mục đích                                                       |
| ------- | ------------------ | -------------------------------------------------------------- |
| `GET`   | `/api/cases`       | Lấy/tìm catalog case/item; repository có thể enrich ảnh/rarity |
| `GET`   | `/api/health`      | Health status; chỉ admin nhận env/memory/uptime chi tiết       |
| `GET`   | `/api/image-proxy` | Proxy ảnh từ allowlisted host, có SSRF guard                   |
| `POST`  | `/api/bug-report`  | Gửi report, hỗ trợ ảnh đơn legacy hoặc nhiều ảnh               |
| `GET`   | `/api/bug-report`  | Admin lấy unresolved; `?all=true` lấy tất cả                   |
| `PATCH` | `/api/bug-report`  | Admin cập nhật status                                          |

`POST /api/bug-report` upload ảnh lên Cloudinary, lưu `imageUrl` và `imageUrls`, rồi publish `bug-report.changed`.

## Streaming APIs

| Route                                      | Content type / format   | Event chính                                             |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------- |
| `POST /api/portfolio/import`               | `application/x-ndjson`  | JSON line `progress`, `complete`, `error`               |
| `POST /api/portfolio/import-inventory`     | `text/plain`, JSON line | `progress`, `done`, `error`                             |
| `POST /api/portfolio/accounts/sync`        | `text/event-stream`     | SSE `data:` chứa sync progress object                   |
| `POST /api/portfolio/accounts/sync/single` | `text/event-stream`     | SSE `data:` chứa sync progress object                   |
| `GET /api/realtime/portfolio`              | `text/event-stream`     | `portfolio-changed`, `heartbeat`, `connected`           |
| `GET /api/realtime/user-recent-imports`    | `text/event-stream`     | `user-recent-imports-changed`, `heartbeat`, `connected` |

NDJSON client cần dùng `response.body.getReader()`, giữ buffer giữa các chunk và parse theo newline. SSE client dùng `EventSource` cho `GET`, hoặc tự parse `data:` khi route là `POST`.

## Rate Limits

Rate limit dùng collection MongoDB `rate_limits`, scope theo `<limiter-name>:<ip>`. Production fail-closed khi DB limiter lỗi.

| Limiter                 | Cửa sổ  | Tối đa     |
| ----------------------- | ------- | ---------- |
| Gemini/Post Analyzer    | 60 giây | 10 request |
| Steam scan              | 1 giây  | 15 request |
| CS2Cap validate         | 60 giây | 5 request  |
| Portfolio price refresh | 2 phút  | 5 request  |
| Bug report              | 5 phút  | 3 request  |
| Retry price             | 60 giây | 5 request  |
| BUFF price              | 60 giây | 15 request |

## Client API Modules

Browser wrappers nằm trong `src/lib/api-client`.

### Portfolio và Steam account

| Module                  | Export chính                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `portfolio-api.ts`      | `fetchPortfolioReport`, `fetchFreshPortfolioReport`, CRUD, refresh, streaming import |
| `steam-accounts-api.ts` | account CRUD/check/sync trigger và `fetchAccountStorageUnits`                        |
| `buff-api.ts`           | `refreshBuffPrice`                                                                   |

### User data

| Module                       | Export chính                                 |
| ---------------------------- | -------------------------------------------- |
| `user-buff-prices-api.ts`    | fetch/merge/replace/update BUFF prices       |
| `user-preferences-api.ts`    | fetch/update preferences                     |
| `user-recent-imports-api.ts` | fetch/save/merge/delete/clear recent imports |

### Realtime subscribers

| Module                              | Kênh                        |
| ----------------------------------- | --------------------------- |
| `user-buff-prices-realtime.ts`      | User BUFF prices            |
| `user-preferences-realtime.ts`      | User preferences            |
| `user-recent-imports-realtime.ts`   | Recent imports; Ably + SSE  |
| `user-settings-realtime.ts`         | CS2Cap settings             |
| `post-analysis-history-realtime.ts` | Admin post-analysis history |

Portfolio dùng hook `src/hooks/use-portfolio-realtime.ts`; scan dùng `scan-progress-client.ts` trong feature scanner.

## External Services

| Service                | Dùng cho                                          | Env                                                       |
| ---------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| Google OAuth           | Login/admin identity                              | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` |
| Ably                   | Pub/sub realtime                                  | `ABLY_API_KEY`                                            |
| Gemini                 | Post Analyzer                                     | `GEMINI_API_KEY`, `GEMINI_MODEL`                          |
| Steam Community/Market | Inventory, profile, listing, wallet, price, image | Cookie user tùy luồng                                     |
| CSGOTrader             | Price fallback                                    | Không bắt buộc                                            |
| CS2Cap                 | BUFF price/key validation                         | User key hoặc `CS2CAP_API_KEY`                            |
| CSFloat                | Pattern inspect                                   | `CSFLOAT_API_KEY` tùy chọn                                |
| Cloudinary             | Analyzer/bug-report images                        | `CLOUDINARY_*`                                            |
| Exchange-rate API      | USD/VND fallback                                  | Không bắt buộc                                            |
