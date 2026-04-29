-- Khớp `fk_club_meet_by` với Prisma: ON DELETE RESTRICT ON UPDATE NO ACTION (bản cũ chỉ khai báo ON UPDATE).

ALTER TABLE `club_meetings` DROP FOREIGN KEY `fk_club_meet_by`;

ALTER TABLE `club_meetings`
  ADD CONSTRAINT `fk_club_meet_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
