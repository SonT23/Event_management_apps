## Media Club (backend, NestJS)

- **Bắt buộc khi chạy API:** `DATABASE_URL` (MySQL) và `JWT_SECRET` (tối thiểu 16 ký tự). Ứng dụng kiểm tra lúc khởi động. Chạy test (`NODE_ENV=test`) hoặc set `SKIP_ENV_VALIDATION=1` để bỏ qua (không dùng production).
- **CSDL:** MySQL `media_club` — sao chép `apps/api/.env.example` → `apps/api/.env` rồi điền `DATABASE_URL`.
- **Prisma:** `npm run prisma:generate` (sau khi đổi `prisma/schema.prisma`); đồng bộ schema từ DB có sẵn: `npm run prisma:pull`. Migration (khi dùng `migrate`, không bắt buộc nếu bạn quản lý bằng SQL ngoài): `npm run prisma:migrate:dev` (dev) / `npm run prisma:migrate:deploy` (CI/prod). `npm run prisma:studio` — giao diện dữ liệu.
- **Chạy:** từ gốc monorepo: `npm run dev:api` (hoặc trong `apps/api`: `npm run start:dev`) — API prefix `/api`.
- **Health:** `GET /api/health` — tiến trình sống, có `version` nếu đọc được `package.json`. `GET /api/health/ready` — thử truy vấn DB, trả **503** nếu MySQL không phản hồi (dùng cho readiness probe). Ví dụ: `http://127.0.0.1:3000/api/health`.
- **Auth:** xem đầy đủ `JWT_*`, `REFRESH_DAYS`, `CORS_*`, `COOKIE_*` trong `.env.example`. Cấp cặp **access** (JWT, ngắn) + **refresh** (lưu hash SHA-256, cookie HttpOnly) — bảng `refresh_tokens` (xem `database/04_refresh_tokens.sql`). `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `POST /api/auth/change-password` (cần JWT), `GET /api/auth/me`. Có thể dùng `Authorization: Bearer` hoặc cookie `med_access` / `med_refresh`. Mật khẩu: **bcrypt** (rounds=10) trong cột `password_hash`. Gọi số: `npx prisma db seed` tạo các tài khoản `demo.*@example.com` (một email mỗi vai trò CLB), mật khẩu chung `Test123!@#` — không seed sự kiện; tạo sự kiện qua UI.
- **Gọi từ Vite/SPA:** `fetch(..., { credentials: 'include' })` cùng `CORS_ORIGIN` hợp lệ. Production: `COOKIE_SECURE=true` (HTTPS).
- **Bảo vệ route:** `AuthGuard('jwt')` + tùy chọn `RolesGuard` + `@Roles('PRESIDENT', ...)`. Rate limit: `ThrottlerModule` toàn ứng dụng; login/register/refresh/change-password bị `Throttle` riêng.
- **Thành viên (`/api/members`, JWT):** `GET /me` / `PATCH /me` hồ sơ; `GET` danh sách (lãnh đạo/điều hành theo `auth/constants/role-groups`); `GET :userId` mình hoặc lãnh đạo xem.
- **Sự kiện (`/api/events`, JWT):** `GET` danh sách, `POST` tạo (lãnh đạo), `GET/PATCH :id`, `POST :id/publish` | `end` | `managers` (body `{ userId }` ), `GET :id/managers`, `POST :id/registrations` (đăng ký tham gia + QR nếu không cần duyệt), `GET :id/registrations` (lãnh đạo + quản lý sự kiện). **Đăng ký:** `GET /registrations/me`, `GET /registrations/:id`, `POST .../approve` | `reject` (lãnh đạo + `event_managers` của sự kiện).

### Lệnh nhanh (trong thư mục `apps/api`)

| Lệnh | Mục đích |
|------|----------|
| `npm run start:dev` | Dev có watch |
| `npm run build` / `npm run start:prod` | Build và chạy từ `dist/` |
| `npm test` / `npm run test:e2e` | Unit / e2e (e2e chạy seed trước) |
| `npx prisma db seed` | Tạo/cập nhật 10 tài khoản demo (không xóa dữ liệu khác) |
| `npm run db:wipe-demo` | **Xóa sạch** dữ liệu nghiệp vụ trong DB, nạp lại ban/vai trò/quy tắc + 10 tài khoản demo (dùng khi cần reset) |

Tài liệu framework: [NestJS](https://docs.nestjs.com).
