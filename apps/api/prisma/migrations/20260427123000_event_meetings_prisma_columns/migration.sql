-- Đồng bộ `event_meetings` với schema Prisma (thêm so `database/01_schema.sql` cũ).
-- Bắt buộc cho filter `status = scheduled` trong analytics/xếp hạng.

ALTER TABLE `event_meetings`
  ADD COLUMN `reason` TEXT NULL COMMENT 'Lý do / nội dung trọng tâm buổi họp'
    AFTER `title`,
  ADD COLUMN `status` ENUM('scheduled', 'cancelled') NOT NULL DEFAULT 'scheduled'
    AFTER `reason`,
  ADD COLUMN `cancelled_at` DATETIME(6) NULL
    COMMENT 'Khi hủy buổi họp'
    AFTER `status`,
  ADD COLUMN `actual_end_at` DATETIME(6) NULL
    COMMENT 'Khi quản lý nhấn kết sớm; null = kết thúc theo end_at'
    AFTER `end_at`;

CREATE INDEX `ix_meet_event_status` ON `event_meetings` (`event_id`, `status`);
