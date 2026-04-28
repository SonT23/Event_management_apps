-- =============================================================================
-- Bổ sung ràng buộc thời gian + index (MySQL 8.0.16+)
-- Chạy MỘT LẦN trên database đã tạo từ bản 01_schema CŨ (chưa có CHECK + chưa có ix_pen_created).
-- Bản 01_schema.sql mới (sau 2026-04) đã gồm các ràng buộc này: KHÔNG chạy file này nữa.
-- Nếu chạy lần 2, MySQL báo lỗi trùng constraint/tên index — bỏ qua.
-- =============================================================================

USE `media_club`;

-- Đảm bảo không có dòng phá ràng buộc (nên 0)
SELECT 'rows_violating_expected_end' AS chk, COUNT(*) AS n
FROM `events` WHERE `expected_end_at` IS NOT NULL AND `expected_end_at` <= `start_at`
UNION ALL
SELECT 'rows_violating_actual_end', COUNT(*)
FROM `events` WHERE `actual_end_at` IS NOT NULL AND `actual_end_at` <= `start_at`
UNION ALL
SELECT 'rows_violating_meeting_end', COUNT(*)
FROM `event_meetings` WHERE `end_at` <= `start_at`
UNION ALL
SELECT 'rows_violating_scan_order', COUNT(*)
FROM `event_meetings`
WHERE `scan_open_at` IS NOT NULL AND `scan_close_at` IS NOT NULL AND `scan_close_at` < `scan_open_at`;

ALTER TABLE `events`
  ADD CONSTRAINT `ck_events_expected_end` CHECK (`expected_end_at` IS NULL OR `expected_end_at` > `start_at`),
  ADD CONSTRAINT `ck_events_actual_end` CHECK (`actual_end_at` IS NULL OR `actual_end_at` > `start_at`);

ALTER TABLE `event_meetings`
  ADD CONSTRAINT `ck_meetings_end_after_start` CHECK (`end_at` > `start_at`),
  ADD CONSTRAINT `ck_meetings_scan_order` CHECK (
    `scan_open_at` IS NULL OR `scan_close_at` IS NULL OR `scan_close_at` >= `scan_open_at`
  );

ALTER TABLE `penalty_events`
  ADD KEY `ix_pen_created` (`created_at`);
