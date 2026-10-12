# Sổ theo dõi nợ kỹ thuật (Tech Debt Register)

Sinh bằng skill `tech-debt-tracker` (scan → filter → prioritize → dashboard).
Snapshot mới nhất 2026-10-12: **1,872 item** sau lọc, mật độ **9.31%**
(so với 1,901 @ 10.22% ngày 09-28: dù bổ sung Dark Mode toàn diện, phản hồi
cảm xúc phòng/tin nhắn, tối ưu cuộn chat, chuyển đổi SVG art và audit bảo mật,
mật độ nợ kỹ thuật liên tục giảm qua các đợt refactor module hóa `Profile.tsx`,
tách `ListingFilterService` và `illustrations.tsx`, xóa toàn bộ `large_file` và
chuẩn hóa định dạng dòng dài ở cả backend và frontend).
Bước lọc app-only dùng `scripts/filter-debt-app-only.py` giữ `backend/` +
`frontend/` + `ai-service/`, loại tests và noise regex.

## Cách tái tạo snapshot

```bash
# 1. Scan (sử dụng cấu hình chuẩn hóa scripts/debt-scanner-config.json)
python3 .agents/skills/tech-debt-tracker/scripts/debt_scanner.py . \
  --config scripts/debt-scanner-config.json --format json \
  --output ~/tech-debt-tracker/trosv/debt_$(date +%F).json

# 2. Loc app-only (script commit trong repo - quy tắc cố định)
python3 scripts/filter-debt-app-only.py \
  ~/tech-debt-tracker/trosv/debt_<ngay>.json \
  --output ~/tech-debt-tracker/trosv/debt_<ngay>.app-only.json

# 3. Prioritize (framework wsjf)
python3 .agents/skills/tech-debt-tracker/scripts/debt_prioritizer.py \
  ~/tech-debt-tracker/trosv/debt_<ngay>.app-only.json \
  --framework wsjf --team-size 6 --sprint-capacity 20 \
  --format json --output ~/tech-debt-tracker/trosv/debt_priorities_<ngay>.json

# 4. Sau mỗi sprint dọn: quét lại + so trend bằng dashboard
python3 .agents/skills/tech-debt-tracker/scripts/debt_dashboard.py \
  --input-dir ~/tech-debt-tracker/trosv/ --period monthly --format both
```

## Debt thật sự cần xử lý (tinh chỉnh từ output máy)

| # | Debt | Bằng chứng từ scan | Ảnh hưởng | Hành động đề xuất | Effort |
|---|------|--------------------|-----------|-------------------|--------|
| 1 | `ListingStoreRequest` ≈ `ListingUpdateRequest` | 44 block trùng | Sửa rule validation phải sửa 2 nơi → lệch contract | ✅ **Xong** (`0aeba67`): base class `ListingFormRequest` (rules canonical + `asPartial()` biến đổi `required→sometimes`), dup blocks của cặp `44 → 0`, 22 test contract pass nguyên vẹn | done |
| 2 | `Login.tsx` ≈ `Register.tsx` | 45 block trùng | Sửa UX auth phải sửa 2 nơi | ✅ **Xong** (`3be7602`): hook `useAuthForm` (busy, chặn submit kép, navigate) + `AuthLayout`/`AuthVisual` (khung split, header, alert, footer); mọi chi tiết UI giữ nguyên. Logíc trùng tách hết - block còn lại chỉ là trùng dòng ngẫu nhiên | done |
| 3 | `Favorites.tsx` ≈ `MyListings.tsx` (và các page grid) | 34 block trùng | Pattern grid listing lặp ở nhiều page | ✅ **Xong** (`370c555`): hook `useListingPage` (fetch phân trang + skeleton-reset + refresh không nháy) + `ListingGrid` (dùng chung bởi Favorites **và Home**); MyListings giữ list-rows nhưng dùng chung hook. UX cải thiện: xóa tin không còn nháy skeleton | done |
| 4 | CSS trùng lặp | `page.css` 57 + `components.css` 39 block | Bundle phình, style lệch nhau | ✅ **Xong** (`4065631`): tách page.css theo họ selector thành `chrome/auth/messages/chat/widgets` (mọi file ≤ 500 dòng), gom toàn bộ `ai-widget-*` về một file, FAB shape chung `.corner-fab`, token `--focus-ring`. Selector parity kiểm chứng bằng script - không mất rule nào ngoài chuyển đổi có chủ ý | done |
| 5 | Đường dẫn hardcode ở frontend | `App.tsx` (6), Footer/Navbar/MyListings | Đổi route phải quét tay | ✅ **Xong** (`5f34b80`): `constants/routes.ts` là single source of truth, helper `route()` cho tham số động; `aiApi.ts` giữ nguyên vì đó là API endpoint (axios baseURL), không phải SPA route | done |
| 6 | Long lines ở backend | `ListingController` (4), `LandlordListingController` (2) | Khó review | Pint đã chuẩn hóa phần lớn; xử lý khi chạm file | ~trivial |
| 7 | Sai foreign key & thiếu fillable (`User`, `School`) | `User::messages()`, `User::reviews()`, `School::$fillable` | Gọi relation bị lỗi SQL vì Laravel đoán `user_id` thay vì `sender_id`/`student_id`; `School` mass-assignment nuốt `ward_id` | ✅ **Xong** (Backend Audit 2026-10-11): Sửa foreign key `sender_id`, `student_id`; thêm `ward_id` vào `School::$fillable`, bổ sung test `test_user_messages_and_reviews_relations_work` | done |
| 8 | Thiếu index trên khóa ngoại & query path | `listings.user_id`, `(ward_id, status)`, `reviews.student_id`, `schools.ward_id` | Full table scan khi chủ nhà xem tin hoặc lọc theo quận/trạng thái | ✅ **Xong** (Backend Audit 2026-10-11): Tạo migration `2026_10_11_000001_add_performance_and_foreign_key_indexes` bổ sung toàn bộ index | done |
| 9 | Upload ảnh thiếu transaction & dọn file disk | `LandlordListingController::uploadImages` | Lỗi DB ở file thứ 3 gây mồ côi file trên disk, dữ liệu không nhất quán | ✅ **Xong** (Backend Audit 2026-10-11): Bọc `DB::transaction` với rollback disk cleanup; `destroy` xóa disk sau khi xóa DB thành công | done |
| 10 | Trùng query & thiếu phòng thủ null | `ListingDetailResource`, `ListingController`, `AiService` | Re-query aggregate và conversation thừa; lỗi 500 khi tọa độ trường học null | ✅ **Xong** (Backend Audit 2026-10-11): Tái sử dụng `loadAvg` và conversation ID; kiểm tra null tọa độ trường học và quan hệ phòng tránh 500/TypeError; tối ưu `rating` sort với `NULLS LAST` | done |
| 11 | Rate limiting nghẽn theo IP người dùng đăng nhập | `ApiThrottle` dùng chung IP cho mọi user | Ký túc xá/Wi-Fi chung trường chia sẻ hạn mức 10 req/phút của AI | ✅ **Xong** (Backend Audit 2026-10-11): Phân vùng key rate-limit theo user ID cho request có đăng nhập, giữ IP cho khách | done |
| 12 | Tệp lớn Profile.tsx (548 dòng) | 1 `large_file` item | Khó bảo trì, re-render diện rộng khi người dùng tương tác | ✅ **Xong** (2026-10-12): Tách thành `ProfileBasicInfoCard`, `ProfileAcademicCard`, `ProfileHabitsCard`, `profileTypes`; tệp chính 548 → 245 dòng, toàn bộ sub-card ≤ 245 dòng, không còn `large_file` logic nào | done |
| 13 | Controller bloat ở `ListingController::index` | ~85 dòng query builder | Khó bảo trì, vi phạm SRP, khó unit test query | ✅ **Xong** (2026-10-12): Tách `ListingFilterService` chuyên trách search ILIKE, lọc giá, khu vực, khoảng cách Haversine và dynamic sort; `ListingController::index` rút gọn còn ~20 dòng | done |
| 14 | Tệp icon chứa minh họa lớn `icons.tsx` (530 dòng) | 1 `large_file` item | Pha trộn icon glyph và SVG minh họa cảnh lớn | ✅ **Xong** (2026-10-12): Tách 6 minh họa cảnh vào `illustrations.tsx` (454 dòng), `icons.tsx` còn 85 dòng re-export; `large_file` toàn app về **chính xác 0** | done |
| 15 | Smells đơn lẻ & hardcoded art assets | 1 missing docstring, 1 todo, hardcoded `/art/...` | Code smell, magic string rải rác | ✅ **Xong** (2026-10-12): Thêm docstring `health()` trong `ai-service`, ghi chú Radix trong `shell.tsx`, gom ảnh về `constants/assets.ts`, wrap dòng dài; `missing_docstring` về **0**, `long_line` 230 → 218 | done |

**Không phải debt (giữ nguyên):** test file dài (`ConversationTest` 564 dòng - test feature dài là bình thường),
boilerplate FormRequest/config/migration (khung framework), `docker-compose*.yml` (override cố ý, có comment giải thích),
`drop_debugger: true` trong `vite.config.ts` (cấu hình minify terser).

## Cảnh báo về con số tự động

`debt_prioritizer.py` ước tính tổng effort **25,741 giờ / 1,734 sprint** - đây là
heuristic gán mặc định cho từng item thô (phần lớn là boilerplate), **không dùng để
lập kế hoạch**. Con số đáng tin là bảng tinh chỉnh ở trên (~2.75 ngày công).

## Trend

| Ngày | Items (sau lọc) | Ghi chú |
|------|-----------------|---------|
| 2026-09-27 | 1,760 | Baseline đầu tiên sau Phase 4 |
| 2026-09-27 (run 2) | 1,762 | Sau refactor #5: hardcode trong 5 file mục tiêu **13 → 0**; tổng +2 là noise đo được (19 import `ROUTES` mới tạo block-trùng, 1 comment dài) |
| 2026-09-27 (final) | **1,635 (−125)** | Sau refactor #1-#4: **large_file = 0** (page.css 982 → 5 file ≤ 500 dòng), density 7.0 → **6.5%**, dashboard báo **"Good progress on debt reduction"**, density trend ↑ improving (−0.335/period, forecast 5.2) |
| 2026-09-28 | 1,901 (+266) | Mã mới (ai-service stub FAKE_MODE, spec e2e, script parity + filter, compose mới) làm tổng tăng nhưng **density 10.48 → 10.22** (tính lại trên scope app-only nhất quán). Chốt pipeline tái tạo được; hai large_file còn lại là test feature (đã ghi ở trên - không phải debt) |
| 2026-10-12 | 1,903 (+2) | Thêm Dark mode, reactions badge + preview card reactions, autoscroll, SVG art tối ưu, sửa lỗi bảo mật backend, indexes. Tổng dòng app tăng lên 20.2k dòng, **density giảm mạnh 10.22% → 9.42%**, Health Score 60/100, Technical Risk Score cải thiện (−25.15/period) |
| 2026-10-12 (post-refactor) | 1,898 (−5) | Sau refactor #12 Profile.tsx: `large_file` logic = 0, density giảm tiếp 9.42% → 9.39% |
| 2026-10-12 (format-cleanup) | 1,877 (−21) | Chuẩn hóa toàn diện các dòng dài > 120 ký tự ở backend (controllers, resources, services, queries) và frontend (UI components, modals, preview cards); density giảm còn 9.35% |
| 2026-10-12 (arch-refactor) | **1,872 (−5)** | Tách `ListingFilterService`, module hóa `illustrations.tsx` (`large_file` = 0), thêm docstring `ai-service` (`missing_docstring` = 0), chuẩn hóa `constants/assets.ts` và wrap dòng dài; **density giảm kỷ lục còn 9.31%**, toàn bộ 13/13 E2E test pass |

**Kết quả 5 mục targeted (baseline → final):** #1 FormRequests 44→0 block rules thật (10 còn lại là boilerplate `}`/docblock khớp chéo) · #2 auth 45→30 (30 = coincidental line-match sau khi tách hết hook/layout) · #3 Fv↔ML 34→6 (6 = khung import/div) · #4 large_file CSS 2→0 · #5 hardcode 13→0. Mọi refactor giữ hành vi: 209 test backend + e2e + CI xanh xuyên suốt |
