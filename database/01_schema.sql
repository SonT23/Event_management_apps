-- =============================================================================
-- Media Club (Khoa Kinh doanh) — MySQL 8+ schema
-- Nội dung: tổ chức theo ban, tài khoản thành viên, sự kiện, tiểu ban, cuộc họp,
--           đăng ký/duyệt, QR, điểm trừ, cảnh báo, thống kê (tính từ bảng sự kiện)
-- Charset: utf8mb4
-- =============================================================================

USE `media_club`;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------------
-- Tổ chức: ban bộ, vai trò hội
-- ---------------------------------------------------------------------------

CREATE TABLE `departments` (
  `id`            SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`          VARCHAR(64)  NOT NULL,
  `name`          VARCHAR(128) NOT NULL,
  `parent_id`     SMALLINT UNSIGNED NULL,
  `sort_order`    SMALLINT NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_departments_code` (`code`),
  KEY `ix_departments_parent` (`parent_id`),
  CONSTRAINT `fk_departments_parent` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `roles` (
  `id`            SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`          VARCHAR(64)  NOT NULL COMMENT 'Mã ổn định dùng trong ứng dụng (vd: PRESIDENT, MEMBER)',
  `name`          VARCHAR(128) NOT NULL,
  `description`   VARCHAR(255) NULL,
  `hierarchy_level` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số càng lớn càng “thấp” hơn trong CLB; quy ước tùy app',
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_roles_code` (`code`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Người dùng & hồ sơ thành viên
-- ---------------------------------------------------------------------------

CREATE TABLE `users` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`         VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Bcrypt/Argon2 do ứng dụng tạo',
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` DATETIME(6) NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_users_email` (`email`)
) ENGINE=InnoDB;

CREATE TABLE `members` (
  `user_id`       BIGINT UNSIGNED NOT NULL,
  `full_name`     VARCHAR(160) NOT NULL,
  `student_id`    VARCHAR(32) NULL COMMENT 'MSSV',
  `gender`        ENUM('male','female','other','unspecified') NOT NULL DEFAULT 'unspecified',
  `birth_date`    DATE NULL,
  `major`         VARCHAR(180) NULL COMMENT 'Ngành học',
  `primary_department_id` SMALLINT UNSIGNED NULL COMMENT 'Ban trực thuộc chính (hiển thị nhanh)',
  `position_title` VARCHAR(128) NULL COMMENT 'Chức vụ hiển thị (có thể trùng mô tả từ user_club_roles)',
  `phone`         VARCHAR(32) NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `ux_members_student_id` (`student_id`),
  KEY `ix_members_dept` (`primary_department_id`),
  KEY `ix_members_name` (`full_name`),
  CONSTRAINT `fk_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_members_dept` FOREIGN KEY (`primary_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Một tài khoản có thể gắn nhiều “chức vụ hội” (vd: thư ký + thành viên ban X)
CREATE TABLE `user_club_roles` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT UNSIGNED NOT NULL,
  `role_id`       SMALLINT UNSIGNED NOT NULL,
  `department_id` SMALLINT UNSIGNED NULL COMMENT 'Bắt buộc với trưởng ban/bộ; null với ban điều hành chung nếu app cho phép',
  `is_primary`    TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_user_club_role_dept` (`user_id`, `role_id`, `department_id`),
  KEY `ix_user_club_roles_user` (`user_id`),
  KEY `ix_user_club_roles_role` (`role_id`),
  KEY `ix_user_club_roles_dept` (`department_id`),
  CONSTRAINT `fk_user_club_roles_user`     FOREIGN KEY (`user_id`)       REFERENCES `users`       (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_club_roles_role`     FOREIGN KEY (`role_id`)       REFERENCES `roles`       (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_user_club_roles_dept`     FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Sự kiện
-- ---------------------------------------------------------------------------

CREATE TABLE `events` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`               VARCHAR(200) NOT NULL,
  `description`         TEXT NULL,
  `start_at`            DATETIME(6) NOT NULL,
  `expected_end_at`     DATETIME(6) NULL COMMENT 'Có thể NULL theo nghiệp vụ',
  `actual_end_at`       DATETIME(6) NULL COMMENT 'Bấm “kết thúc sự kiện” = vô hiệu mã QR toàn sự kiện',
  `status`              ENUM('draft','published','ongoing','ended','cancelled') NOT NULL DEFAULT 'draft',
  `requires_approval`   TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = cần duyệt khi đăng ký',
  `default_cancel_minutes` INT UNSIGNED NULL COMMENT 'Gợi ý hủy trước bao nhiêu phút; app có thể bỏ qua',
  `created_by`          BIGINT UNSIGNED NOT NULL,
  `created_at`          TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`          TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ix_events_time` (`start_at`, `expected_end_at`, `status`),
  KEY `ix_events_creator` (`created_by`),
  CONSTRAINT `fk_events_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_events_expected_end` CHECK (`expected_end_at` IS NULL OR `expected_end_at` > `start_at`),
  CONSTRAINT `ck_events_actual_end` CHECK (`actual_end_at` IS NULL OR `actual_end_at` > `start_at`)
) ENGINE=InnoDB;

-- Người được phân công quản lý sự kiện (có quyền tạo tiểu ban, họp, quét QR theo nghiệp vụ)
CREATE TABLE `event_managers` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id`   BIGINT UNSIGNED NOT NULL,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `assigned_by` BIGINT UNSIGNED NOT NULL,
  `assigned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_event_manager` (`event_id`, `user_id`),
  KEY `ix_event_managers_user` (`user_id`),
  CONSTRAINT `fk_event_managers_event`   FOREIGN KEY (`event_id`)   REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_managers_user`   FOREIGN KEY (`user_id`)    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_managers_assigned` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Đăng ký tham gia sự kiện + mã QR dùng 1 lần cho sự kiện
CREATE TABLE `event_registrations` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id`        BIGINT UNSIGNED NOT NULL,
  `user_id`         BIGINT UNSIGNED NOT NULL,
  `status`          ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `qr_token_hash`   CHAR(64) NOT NULL COMMENT 'SHA-256 (hex) của token gốc; token gốc không lưu',
  `qr_issued_at`    TIMESTAMP(6) NULL,
  `decided_by`      BIGINT UNSIGNED NULL,
  `decided_at`      DATETIME(6) NULL,
  `cancel_not_before` DATETIME(6) NULL COMMENT 'Hạn chót được hủy; app enforce',
  `created_at`      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_reg_event_user` (`event_id`, `user_id`),
  KEY `ix_reg_event` (`event_id`),
  KEY `ix_reg_user` (`user_id`),
  KEY `ix_reg_qr` (`qr_token_hash`),
  CONSTRAINT `fk_reg_event`  FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_user`   FOREIGN KEY (`user_id`)  REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_decider` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Điểm danh tổng sự kiện (khi quét mã “khai mạc sự kiện”)
CREATE TABLE `event_checkins` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id`        BIGINT UNSIGNED NOT NULL,
  `registration_id` BIGINT UNSIGNED NOT NULL,
  `scanned_by`      BIGINT UNSIGNED NOT NULL,
  `scanned_at`      DATETIME(6) NOT NULL,
  `note`            VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_checkin_reg` (`registration_id`),
  KEY `ix_checkin_event` (`event_id`),
  CONSTRAINT `fk_checkin_event` FOREIGN KEY (`event_id`)        REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_checkin_reg`   FOREIGN KEY (`registration_id`) REFERENCES `event_registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_checkin_by`   FOREIGN KEY (`scanned_by`)   REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Đơn: xin vắng, hủy tham gia (tách với cập nhật trạng thái registration nếu cần lịch sử)
-- ---------------------------------------------------------------------------

CREATE TABLE `absence_requests` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id`     BIGINT UNSIGNED NOT NULL,
  `user_id`      BIGINT UNSIGNED NOT NULL,
  `reason`       TEXT NOT NULL,
  `status`       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `decided_by`   BIGINT UNSIGNED NULL,
  `decided_at`   DATETIME(6) NULL,
  `created_at`   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ix_absence_event` (`event_id`, `user_id`),
  CONSTRAINT `fk_absence_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_absence_user`  FOREIGN KEY (`user_id`)  REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_absence_dec`   FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `participation_cancellations` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id`     BIGINT UNSIGNED NOT NULL,
  `user_id`      BIGINT UNSIGNED NOT NULL,
  `reason`       TEXT NULL,
  `status`       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `decided_by`   BIGINT UNSIGNED NULL,
  `decided_at`   DATETIME(6) NULL,
  `created_at`   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ix_pcancel_event` (`event_id`, `user_id`),
  CONSTRAINT `fk_pcancel_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pcancel_user`  FOREIGN KEY (`user_id`)  REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pcancel_dec`   FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Tiểu ban trong sự kiện: mỗi người tối đa 1 tiểu ban / 1 sự kiện
-- ---------------------------------------------------------------------------

CREATE TABLE `event_subcommittees` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id`    BIGINT UNSIGNED NOT NULL,
  `name`        VARCHAR(160) NOT NULL,
  `code`        VARCHAR(64) NULL,
  `max_members` SMALLINT UNSIGNED NULL,
  `created_by`  BIGINT UNSIGNED NOT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_subc_event` (`event_id`),
  CONSTRAINT `fk_subc_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_subc_by`   FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `event_subcommittee_members` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `subcommittee_id` BIGINT UNSIGNED NOT NULL,
  `user_id`         BIGINT UNSIGNED NOT NULL,
  `assigned_by`     BIGINT UNSIGNED NOT NULL,
  `assigned_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_subc_user` (`subcommittee_id`, `user_id`),
  KEY `ix_subc_mem_user` (`user_id`),
  CONSTRAINT `fk_subc_mem_sub`  FOREIGN KEY (`subcommittee_id`) REFERENCES `event_subcommittees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_subc_mem_user` FOREIGN KEY (`user_id`)         REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_subc_mem_by`  FOREIGN KEY (`assigned_by`)     REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Tối đa 1 tiểu ban / 1 sự kiện / 1 thành viên
DELIMITER ;;
CREATE TRIGGER `trg_subc_one_per_event_bi` BEFORE INSERT ON `event_subcommittee_members` FOR EACH ROW
BEGIN
  IF EXISTS (
    SELECT 1
    FROM `event_subcommittees` t
    JOIN `event_subcommittees` o ON o.`event_id` = t.`event_id` AND o.`id` <> t.`id`
    JOIN `event_subcommittee_members` m ON m.`subcommittee_id` = o.`id` AND m.`user_id` = NEW.`user_id`
    WHERE t.`id` = NEW.`subcommittee_id`
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member already in another subcommittee of this event';
  END IF;
END;;

CREATE TRIGGER `trg_subc_one_per_event_bu` BEFORE UPDATE ON `event_subcommittee_members` FOR EACH ROW
BEGIN
  IF NEW.`user_id` <> OLD.`user_id` OR NEW.`subcommittee_id` <> OLD.`subcommittee_id` THEN
    IF EXISTS (
      SELECT 1
      FROM `event_subcommittees` t
      JOIN `event_subcommittees` o ON o.`event_id` = t.`event_id` AND o.`id` <> t.`id`
      JOIN `event_subcommittee_members` m ON m.`subcommittee_id` = o.`id` AND m.`user_id` = NEW.`user_id` AND m.`id` <> NEW.`id`
      WHERE t.`id` = NEW.`subcommittee_id`
    ) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member already in another subcommittee of this event';
    END IF;
  END IF;
END;;
DELIMITER ;

-- ---------------------------------------------------------------------------
-- Cuộc họp thuộc sự kiện (trước khi & trong sự kiện). Quy tắc 30p: xử lý ở app
-- ---------------------------------------------------------------------------

CREATE TABLE `event_meetings` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id`      BIGINT UNSIGNED NOT NULL,
  `title`         VARCHAR(200) NOT NULL,
  `meeting_type`  ENUM('pre_event','in_event') NOT NULL DEFAULT 'pre_event',
  `start_at`      DATETIME(6) NOT NULL,
  `end_at`        DATETIME(6) NOT NULL,
  `scan_open_at`  DATETIME(6) NULL,
  `scan_close_at` DATETIME(6) NULL COMMENT 'Sau mốc này không quét, auto vắng ở app',
  `created_by`    BIGINT UNSIGNED NOT NULL,
  `created_at`    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ix_meet_event` (`event_id`, `start_at`),
  CONSTRAINT `fk_meet_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_meet_by`   FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_meetings_end_after_start` CHECK (`end_at` > `start_at`),
  CONSTRAINT `ck_meetings_scan_order` CHECK (
    `scan_open_at` IS NULL OR `scan_close_at` IS NULL OR `scan_close_at` >= `scan_open_at`
  )
) ENGINE=InnoDB;

-- Điểm danh theo từng buổi họp: phân loại on_time / late / out_of_window (app set)
CREATE TABLE `meeting_attendances` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `meeting_id`        BIGINT UNSIGNED NOT NULL,
  `registration_id`   BIGINT UNSIGNED NOT NULL,
  `scanned_by`        BIGINT UNSIGNED NOT NULL,
  `scanned_at`        DATETIME(6) NOT NULL,
  `minutes_after_start` SMALLINT NULL,
  `result`            ENUM('on_time','late','out_of_window') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_meetatt_reg` (`meeting_id`, `registration_id`),
  KEY `ix_meetatt_meet` (`meeting_id`),
  CONSTRAINT `fk_meetatt_meet` FOREIGN KEY (`meeting_id`)        REFERENCES `event_meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_meetatt_reg`  FOREIGN KEY (`registration_id`) REFERENCES `event_registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_meetatt_by`  FOREIGN KEY (`scanned_by`)   REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Điểm trừ, vi phạm, cảnh báo
-- ---------------------------------------------------------------------------

CREATE TABLE `penalty_rules` (
  `id`            SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`          VARCHAR(64) NOT NULL,
  `label`         VARCHAR(128) NOT NULL,
  `default_points` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_penrule_code` (`code`)
) ENGINE=InnoDB;

CREATE TABLE `penalty_events` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT UNSIGNED NOT NULL,
  `event_id`      BIGINT UNSIGNED NULL,
  `meeting_id`    BIGINT UNSIGNED NULL,
  `rule_id`       SMALLINT UNSIGNED NULL,
  `points`        DECIMAL(5,2) NOT NULL,
  `reason`        VARCHAR(500) NULL,
  `recorded_by`   BIGINT UNSIGNED NOT NULL,
  `created_at`    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ix_pen_user` (`user_id`, `created_at`),
  KEY `ix_pen_created` (`created_at`),
  KEY `ix_pen_event` (`event_id`),
  CONSTRAINT `fk_pen_user`   FOREIGN KEY (`user_id`)     REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pen_evn`   FOREIGN KEY (`event_id`)    REFERENCES `events` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pen_meet`  FOREIGN KEY (`meeting_id`)  REFERENCES `event_meetings` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pen_rule`  FOREIGN KEY (`rule_id`)     REFERENCES `penalty_rules` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pen_by`    FOREIGN KEY (`recorded_by`)  REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `member_warnings` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `to_user_id`    BIGINT UNSIGNED NOT NULL,
  `from_user_id`  BIGINT UNSIGNED NOT NULL,
  `title`         VARCHAR(200) NOT NULL,
  `body`          TEXT NULL,
  `is_ack`        TINYINT(1) NOT NULL DEFAULT 0,
  `email_sent_at` DATETIME(6) NULL,
  `created_at`    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ix_warn_to` (`to_user_id`, `created_at`),
  KEY `ix_warn_from` (`from_user_id`),
  CONSTRAINT `fk_warn_to`   FOREIGN KEY (`to_user_id`)   REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_warn_from` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Seed tối thiểu: ban, vai trò, quy tắc điểm
-- ---------------------------------------------------------------------------

INSERT INTO `departments` (`code`, `name`, `parent_id`, `sort_order`) VALUES
  ('BAN_DIEU_HANH',      'Ban Điều hành', NULL, 1),
  ('BAN_CHU_NHIEM',      'Ban Chủ nhiệm', NULL, 2),
  ('BP_HANH_CHINH',      'Bộ phận Hành chính', NULL, 3),
  ('BP_QL_DU_AN',        'Bộ phận Quản lý dự án', NULL, 4),
  ('BP_TUYEN_SINH',      'Bộ phận Tuyển sinh', NULL, 5),
  ('BAN_QH_DNN',         'Ban Quan hệ đối ngoại', NULL, 6),
  ('BAN_TT_THUONG_HIEU', 'Ban Truyền thông và phát triển thương hiệu', NULL, 7),
  ('BAN_SU_KIEN',        'Ban Sự kiện', NULL, 8),
  ('TT_DOI_MOI',         'Trung tâm Đổi mới sáng tạo', NULL, 9);

INSERT INTO `roles` (`code`, `name`, `hierarchy_level`, `description`) VALUES
  ('EXEC_BOARD',     'Thành viên Ban Điều hành', 5,  NULL),
  ('PRESIDENT',      'Chủ nhiệm', 10,  NULL),
  ('VICE_PRES_OP',   'Phó Chủ nhiệm Điều hành', 20,  NULL),
  ('VICE_PRES_PRO',  'Phó Chủ nhiệm Chuyên môn', 20,  NULL),
  ('SECRETARY',      'Thư ký', 25,  NULL),
  ('TREASURER',      'Quỹ / Thủ quỹ', 25,  NULL),
  ('DEPT_HEAD',      'Trưởng ban / Trưởng bộ phận', 30,  NULL),
  ('CENTER_HEAD',    'Trưởng trung tâm', 30,  NULL),
  ('MEMBER',         'Thành viên', 100,  NULL);

INSERT INTO `penalty_rules` (`code`, `label`, `default_points`) VALUES
  ('ABSENCE_EVENT',  'Vắng sự kiện', 1.00),
  ('LATE_EVENT',     'Trễ sự kiện (sau 30p)', 0.50),
  ('LATE_MEETING',   'Trễ họp (sau 30p từ giờ bắt đầu buổi)', 0.50),
  ('ABSENCE_MEETING','Vắng họp (ngoài thời gian quét)', 1.00);
