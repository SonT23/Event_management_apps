-- Bổ sung cột theo schema Prisma; DB tạo trước khi thêm trường này sẽ thiếu cột.
ALTER TABLE `event_subcommittees` ADD COLUMN `max_members` SMALLINT UNSIGNED NULL AFTER `code`;
