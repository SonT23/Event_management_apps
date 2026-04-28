-- Trạng thái hội viên: đang hoạt động / ngưng (ra trường, v.v.); hồ sơ có thể xóa bằng xóa user (cascade)
USE `media_club`;

ALTER TABLE `members`
  ADD COLUMN `membership_status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active'
    COMMENT 'active=đang hội; inactive=ngưng (vd sau khi tốt nghiệp/ra hội)'
    AFTER `phone`,
  ADD COLUMN `inactive_at` DATETIME(6) NULL
    COMMENT 'Ghi mốc khi chuyển sang inactive' AFTER `membership_status`,
  ADD COLUMN `inactive_reason` VARCHAR(500) NULL
    COMMENT 'Ghi chú: ra trường, tự rút, quy chế…' AFTER `inactive_at`,
  ADD KEY `ix_members_status` (`membership_status`);
