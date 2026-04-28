-- AlterTable
ALTER TABLE `members` ADD COLUMN `student_id` VARCHAR(32) NULL COMMENT 'MSSV';

-- CreateIndex
CREATE UNIQUE INDEX `members_student_id_key` ON `members`(`student_id`);
