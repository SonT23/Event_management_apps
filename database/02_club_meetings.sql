-- -----------------------------------------------------------------------------
-- Bổ sung họp nội bộ CLB — đồng bộ với apps/api/prisma/schema.prisma (club_meetings*)
-- Chạy sau 01_schema.sql nếu DB chưa có các bảng này (Aiven / staging / local).
-- -----------------------------------------------------------------------------
USE `media_club`;

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- club_meetings, club_meeting_invitees, club_meeting_absence_requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `club_meetings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `detail` TEXT NULL,
  `kind` ENUM('quarterly','year_end','board','general','other','emergency') NOT NULL DEFAULT 'general',
  `mandatory_scope` ENUM('all_members','club_leadership','dept_heads_only','selected_members') NOT NULL DEFAULT 'all_members',
  `start_at` DATETIME(6) NOT NULL,
  `end_at` DATETIME(6) NOT NULL,
  `status` ENUM('scheduled','cancelled') NOT NULL DEFAULT 'scheduled',
  `cancelled_at` DATETIME(6) NULL,
  `created_by` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `fk_club_meet_by` (`created_by`),
  KEY `ix_club_meet_start` (`start_at`),
  KEY `ix_club_meet_status` (`status`),
  CONSTRAINT `fk_club_meet_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `club_meeting_invitees` (
  `club_meeting_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`club_meeting_id`, `user_id`),
  KEY `ix_cmi_user` (`user_id`),
  CONSTRAINT `fk_cmi_meet` FOREIGN KEY (`club_meeting_id`) REFERENCES `club_meetings` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_cmi_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `club_meeting_absence_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `club_meeting_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `decided_by` BIGINT UNSIGNED NULL,
  `decided_at` DATETIME(6) NULL,
  `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_cmar_meet_user` (`club_meeting_id`, `user_id`),
  KEY `ix_cmar_user` (`user_id`),
  KEY `fk_cmar_dec` (`decided_by`),
  CONSTRAINT `fk_cmar_meet` FOREIGN KEY (`club_meeting_id`) REFERENCES `club_meetings` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_cmar_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_cmar_dec` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
