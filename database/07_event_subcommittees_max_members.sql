-- Chạy thủ công nếu tạo sự kiện báo lỗi: column max_members does not exist
-- (database cũ trước khi đồng bộ 01_schema.sql / prisma db push)

USE `media_club`;

ALTER TABLE `event_subcommittees` ADD COLUMN `max_members` SMALLINT UNSIGNED NULL AFTER `code`;
