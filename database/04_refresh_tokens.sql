-- Refresh token bảo mật: chỉ lưu SHA-256, token thật chỉ ở cookie/response một lần
USE `media_club`;

CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT UNSIGNED NOT NULL,
  `token_hash`   CHAR(64) NOT NULL COMMENT 'SHA-256 hex của token',
  `family_id`   CHAR(36) NULL,
  `expires_at`   DATETIME(3) NOT NULL,
  `revoked_at`  DATETIME(3) NULL,
  `replaced_by_id` BIGINT UNSIGNED NULL,
  `user_agent`   VARCHAR(500) NULL,
  `ip`          VARCHAR(45) NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_refresh_token_hash` (`token_hash`),
  KEY `ix_refresh_user` (`user_id`),
  KEY `ix_refresh_expires` (`expires_at`),
  CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_refresh_replaced` FOREIGN KEY (`replaced_by_id`) REFERENCES `refresh_tokens` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
