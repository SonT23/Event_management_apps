-- Luồng hợp lệ toàn FK; ROLLBACK — không để lại dữ liệu
USE `media_club`;
SET @dept := (SELECT `id` FROM `departments` WHERE `code` = 'BAN_SU_KIEN' LIMIT 1);
SET @role_member := (SELECT `id` FROM `roles` WHERE `code` = 'MEMBER' LIMIT 1);
SET @rule_abs := (SELECT `id` FROM `penalty_rules` WHERE `code` = 'ABSENCE_MEETING' LIMIT 1);

START TRANSACTION;
INSERT INTO `users` (`email`, `password_hash`) VALUES
  ('__hp_a@test.local', '$2y$10$0000000000000000000000000000000000000000000000000000000'),
  ('__hp_b@test.local', '$2y$10$0000000000000000000000000000000000000000000000000000000');
SET @a := (SELECT `id` FROM `users` WHERE `email` = '__hp_a@test.local' LIMIT 1);
SET @b := (SELECT `id` FROM `users` WHERE `email` = '__hp_b@test.local' LIMIT 1);
INSERT INTO `members` (`user_id`, `full_name`, `primary_department_id`, `position_title`) VALUES
  (@a, N'HP-A', @dept, N''),
  (@b, N'HP-B', @dept, N'');
INSERT INTO `user_club_roles` (`user_id`, `role_id`, `department_id`, `is_primary`) VALUES
  (@a, @role_member, @dept, 1), (@b, @role_member, @dept, 1);
INSERT INTO `events` (`title`, `start_at`, `expected_end_at`, `status`, `created_by`, `requires_approval`) VALUES
  (N'[HP] E1', '2030-03-01 08:00:00.000000', '2030-03-01 18:00:00.000000', 'published', @a, 0);
SET @eid := LAST_INSERT_ID();
INSERT INTO `event_managers` (`event_id`, `user_id`, `assigned_by`) VALUES (@eid, @a, @a);
INSERT INTO `event_registrations` (`event_id`, `user_id`, `status`, `qr_token_hash`) VALUES
  (@eid, @b, 'approved', 'c0000000000000000000000000000000000000000000000000000000000000ab');
SET @reg := LAST_INSERT_ID();
INSERT INTO `event_subcommittees` (`event_id`, `name`, `created_by`) VALUES (@eid, N'HP-SC1', @a);
SET @sc := LAST_INSERT_ID();
INSERT INTO `event_subcommittee_members` (`subcommittee_id`, `user_id`, `assigned_by`) VALUES (@sc, @b, @a);
INSERT INTO `event_meetings` (`event_id`, `title`, `meeting_type`, `start_at`, `end_at`, `created_by`) VALUES
  (@eid, N'HP họp', 'pre_event', '2030-02-28 14:00:00.000000', '2030-02-28 15:30:00.000000', @a);
SET @mid := LAST_INSERT_ID();
INSERT INTO `meeting_attendances` (`meeting_id`, `registration_id`, `scanned_by`, `scanned_at`, `minutes_after_start`, `result`) VALUES
  (@mid, @reg, @a, '2030-02-28 14:10:00.000000', 10, 'on_time');
INSERT INTO `event_checkins` (`event_id`, `registration_id`, `scanned_by`, `scanned_at`) VALUES
  (@eid, @reg, @a, '2030-03-01 08:05:00.000000');
INSERT INTO `penalty_events` (`user_id`, `event_id`, `rule_id`, `points`, `recorded_by`) VALUES
  (@b, @eid, @rule_abs, 1.0, @a);
INSERT INTO `member_warnings` (`to_user_id`, `from_user_id`, `title`, `body`) VALUES
  (@b, @a, N'Test cảnh báo', N'Nội dung test');
INSERT INTO `absence_requests` (`event_id`, `user_id`, `reason`, `status`) VALUES
  (@eid, @b, N'Lý do test', 'pending');
INSERT INTO `participation_cancellations` (`event_id`, `user_id`, `status`) VALUES
  (@eid, @b, 'pending');
ROLLBACK;

SELECT 'happy_path_rollback_ok' AS result;
