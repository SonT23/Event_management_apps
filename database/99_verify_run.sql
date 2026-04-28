-- Chạy: mysql -u media_club -p < 99_verify_run.sql (từ thư mục database)
USE `media_club`;
CHECK TABLE
  `absence_requests`, `departments`, `event_checkins`, `event_managers`, `event_meetings`,
  `event_registrations`, `event_subcommittee_members`, `event_subcommittees`, `events`,
  `meeting_attendances`, `member_warnings`, `members`, `participation_cancellations`,
  `penalty_events`, `penalty_rules`, `refresh_tokens`, `roles`, `user_club_roles`, `users`;

SELECT 'views' AS kind, TABLE_NAME AS name
FROM information_schema.VIEWS WHERE TABLE_SCHEMA = 'media_club'
UNION ALL
SELECT 'triggers', TRIGGER_NAME
FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = 'media_club'
UNION ALL
SELECT 'check_c', CONSTRAINT_NAME
FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = 'media_club'
ORDER BY kind, name;
