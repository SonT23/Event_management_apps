/**
 * Gọi trước khi Nest bootstrap — lỗi sớm nếu thiếu cấu hình tối thiểu.
 * Bỏ qua khi chạy test (Jest set NODE_ENV=test thường không cần .env đầy đủ).
 */
export function validateEnvOrThrow(): void {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.SKIP_ENV_VALIDATION === '1'
  ) {
    return;
  }
  const db = process.env.DATABASE_URL?.trim();
  if (!db) {
    throw new Error(
      '[env] DATABASE_URL is required. Copy apps/api/.env.example to .env and set MySQL URL.',
    );
  }
  if (!db.startsWith('mysql://')) {
    throw new Error('[env] DATABASE_URL must be a mysql:// connection string.');
  }
  const jwt = process.env.JWT_SECRET?.trim();
  if (!jwt || jwt.length < 16) {
    throw new Error(
      '[env] JWT_SECRET is required and must be at least 16 characters (use a long random string).',
    );
  }

  /** Tránh lỗi “chỉ vài trang lỗi trên prod”: CORS mặc định chỉ localhost nên trình duyệt chặn gọi API từ web thật. */
  const cors = process.env.CORS_ORIGIN?.trim();
  if (process.env.NODE_ENV === 'production' && !cors) {
    throw new Error(
      '[env] CORS_ORIGIN is required in production (comma-separated frontend origins). ' +
        'Also set COOKIE_SAMESITE=none and COOKIE_SECURE=true when the web app and API are on different hosts.',
    );
  }
}
