-- Dự kiêng giao dịch: câu lệnh thứ 2 gây lỗi trigger → kết nối đóng sẽ rollback (autocommit off trong transaction)
USE `media_club`;
SET @dept := (SELECT `id` FROM `departments` WHERE `code` = 'BAN_TT_THUONG_HIEU' LIMIT 1);
SET @role_member := (SELECT `id` FROM `roles` WHERE `code` = 'MEMBER' LIMIT 1);
START TRANSACTION;
INSERT INTO `users` (`email`, `password_hash`) VALUES
  ('__trg1@test.local', '$2y$10$0000000000000000000000000000000000000000000000000000000'),
  ('__trg2@test.local', '$2y$10$0000000000000000000000000000000000000000000000000000000');
SET @a := (SELECT `id` FROM `users` WHERE `email` = '__trg1@test.local' LIMIT 1);
SET @b := (SELECT `id` FROM `users` WHERE `email` = '__trg2@test.local' LIMIT 1);
INSERT INTO `members` (`user_id`, `full_name`, `primary_department_id`, `position_title`) VALUES
  (@a, N'TR-A', @dept, N''),
  (@b, N'TR-B', @dept, N'');
INSERT INTO `user_club_roles` (`user_id`, `role_id`, `department_id`, `is_primary`) VALUES
  (@a, @role_member, @dept, 1), (@b, @role_member, @dept, 1);
INSERT INTO `events` (`title`, `start_at`, `status`, `created_by`, `requires_approval`) VALUES
  (N'[TRG] t', '2030-02-01 10:00:00.000000', 'draft', @a, 0);
SET @eid := LAST_INSERT_ID();
INSERT INTO `event_subcommittees` (`event_id`, `name`, `created_by`) VALUES (@eid, N'trg-S1', @a), (@eid, N'trg-S2', @a);
SET @sc1 := (SELECT `id` FROM `event_subcommittees` WHERE `event_id` = @eid AND `name` = N'trg-S1' LIMIT 1);
SET @sc2 := (SELECT `id` FROM `event_subcommittees` WHERE `event_id` = @eid AND `name` = N'trg-S2' LIMIT 1);
INSERT INTO `event_subcommittee_members` (`subcommittee_id`, `user_id`, `assigned_by`) VALUES (@sc1, @b, @a);
INSERT INTO `event_subcommittee_members` (`subcommittee_id`, `user_id`, `assigned_by`) VALUES (@sc2, @b, @a);
