-- Thông báo nội bộ (đăng ký từ chối, …); chạy sau khi áp dụng schema Prisma tương ứng.
CREATE TABLE IF NOT EXISTS user_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(32) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  read_at DATETIME(6) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY ix_un_user_read (user_id, read_at),
  CONSTRAINT fk_un_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
