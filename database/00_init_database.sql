-- =============================================================================
-- Media Club / Event management — tạo database và user ứng dụng
-- Chạy file này với tài khoản có quyền CREATE USER (thường là root)
-- Mật khẩu user ứng dụng: 123456  (đổi trên môi trường production)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `media_club`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Tạo user ứng dụng (localhost). Điều chỉnh host nếu kết nối từ container/máy khác
CREATE USER IF NOT EXISTS 'media_club'@'localhost' IDENTIFIED BY '123456';
CREATE USER IF NOT EXISTS 'media_club'@'127.0.0.1' IDENTIFIED BY '123456';

GRANT ALL PRIVILEGES ON `media_club`.* TO 'media_club'@'localhost';
GRANT ALL PRIVILEGES ON `media_club`.* TO 'media_club'@'127.0.0.1';

FLUSH PRIVILEGES;
