-- =============================================================================
-- Views hỗ trợ thống kê & dashboard (bổ sung; có thể chạy sau 01_schema.sql)
-- =============================================================================

USE `media_club`;

-- Tổng điểm trừ theo từng thành viên (kể từ khi dùng bảng penalty_events)
CREATE OR REPLACE VIEW `v_member_penalty_totals` AS
SELECT
  u.`id`            AS `user_id`,
  m.`full_name`     AS `full_name`,
  u.`email`         AS `email`,
  COALESCE(SUM(p.`points`), 0) AS `total_points`
FROM `users` u
LEFT JOIN `members` m ON m.`user_id` = u.`id`
LEFT JOIN `penalty_events` p ON p.`user_id` = u.`id`
GROUP BY u.`id`, m.`full_name`, u.`email`;

-- Số cảnh báo chưa ghi nhận (có thể dùng cho badge trên giao diện)
CREATE OR REPLACE VIEW `v_member_unacked_warnings` AS
SELECT
  w.`to_user_id`  AS `user_id`,
  COUNT(*)        AS `unacked_count`
FROM `member_warnings` w
WHERE w.`is_ack` = 0
GROUP BY w.`to_user_id`;

-- Điểm danh: số lần trễ / ngoài khung theo từng buổi (đã ghi bảng meeting_attendances)
CREATE OR REPLACE VIEW `v_meeting_attendance_summary` AS
SELECT
  m.`id`   AS `meeting_id`,
  m.`title`,
  m.`start_at`,
  m.`end_at`,
  COUNT(*) AS `total_scanned`,
  SUM(a.`result` = 'on_time')        AS `on_time_cnt`,
  SUM(a.`result` = 'late')          AS `late_cnt`,
  SUM(a.`result` = 'out_of_window') AS `absent_out_cnt`
FROM `event_meetings` m
LEFT JOIN `meeting_attendances` a ON a.`meeting_id` = m.`id`
GROUP BY m.`id`, m.`title`, m.`start_at`, m.`end_at`;
