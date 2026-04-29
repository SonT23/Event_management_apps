-- Khớp Prisma `members.membership_status*` — sửa P2022 khi DB chỉ có `database/01_schema.sql` mà chưa chạy `database/05_member_status.sql`.
-- Khớp nội dung `database/05_member_status.sql` (MySQL không IF NOT EXISTS cho ADD COLUMN trên mọi phiên bản).

ALTER TABLE `members`
  ADD COLUMN `membership_status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active'
    COMMENT 'active=đang hội; inactive=ngưng (vd sau khi tốt nghiệp/ra hội)'
    AFTER `phone`,
  ADD COLUMN `inactive_at` DATETIME(6) NULL
    COMMENT 'Ghi mốc khi chuyển sang inactive' AFTER `membership_status`,
  ADD COLUMN `inactive_reason` VARCHAR(500) NULL
    COMMENT 'Ghi chú: ra trường, tự rút, quy chế…' AFTER `inactive_at`,
  ADD KEY `ix_members_status` (`membership_status`);
