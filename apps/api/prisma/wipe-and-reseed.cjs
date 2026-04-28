/**
 * NGUY HIỂM: Xóa toàn bộ dữ liệu trong các bảng nghiệp vụ (không xóa lịch sử migration).
 * Sau đó nạp lại: ban, vai trò, quy tắc điểm, 10 tài khoản demo.
 *
 * Chạy từ apps/api: npm run db:wipe-demo
 * Cần DATABASE_URL trỏ đúng MySQL.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient, Prisma } = require('@prisma/client');
const { runSeedDemoAccounts } = require('./seed-accounts.lib.cjs');

const prisma = new PrismaClient();

/** Thứ tự không quan trọng khi FOREIGN_KEY_CHECKS=0; liệt kê đủ bảng có dữ liệu. */
const TABLES_TO_TRUNCATE = [
  'user_notifications',
  'refresh_tokens',
  'meeting_attendances',
  'event_checkins',
  'penalty_events',
  'event_registrations',
  'event_managers',
  'event_meetings',
  'event_subcommittee_members',
  'event_subcommittees',
  'absence_requests',
  'participation_cancellations',
  'member_warnings',
  'events',
  'club_meeting_invitees',
  'club_meeting_absence_requests',
  'club_meetings',
  'user_club_roles',
  'members',
  'users',
  'penalty_rules',
  'roles',
  'departments',
];

async function truncateAllData() {
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of TABLES_TO_TRUNCATE) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``);
  }
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
  // eslint-disable-next-line no-console
  console.log('Đã TRUNCATE', TABLES_TO_TRUNCATE.length, 'bảng.\n');
}

async function seedReferenceRows() {
  await prisma.departments.createMany({
    data: [
      { code: 'BAN_DIEU_HANH', name: 'Ban Điều hành', parent_id: null, sort_order: 1 },
      { code: 'BAN_CHU_NHIEM', name: 'Ban Chủ nhiệm', parent_id: null, sort_order: 2 },
      { code: 'BP_HANH_CHINH', name: 'Bộ phận Hành chính', parent_id: null, sort_order: 3 },
      { code: 'BP_QL_DU_AN', name: 'Bộ phận Quản lý dự án', parent_id: null, sort_order: 4 },
      { code: 'BP_TUYEN_SINH', name: 'Bộ phận Tuyển sinh', parent_id: null, sort_order: 5 },
      { code: 'BAN_QH_DNN', name: 'Ban Quan hệ đối ngoại', parent_id: null, sort_order: 6 },
      {
        code: 'BAN_TT_THUONG_HIEU',
        name: 'Ban Truyền thông và phát triển thương hiệu',
        parent_id: null,
        sort_order: 7,
      },
      { code: 'BAN_SU_KIEN', name: 'Ban Sự kiện', parent_id: null, sort_order: 8 },
      { code: 'TT_DOI_MOI', name: 'Trung tâm Đổi mới sáng tạo', parent_id: null, sort_order: 9 },
    ],
  });

  await prisma.roles.createMany({
    data: [
      { code: 'EXEC_BOARD', name: 'Thành viên Ban Điều hành', hierarchy_level: 5, description: null },
      { code: 'PRESIDENT', name: 'Chủ nhiệm', hierarchy_level: 10, description: null },
      { code: 'VICE_PRES_OP', name: 'Phó Chủ nhiệm Điều hành', hierarchy_level: 20, description: null },
      { code: 'VICE_PRES_PRO', name: 'Phó Chủ nhiệm Chuyên môn', hierarchy_level: 20, description: null },
      { code: 'SECRETARY', name: 'Thư ký', hierarchy_level: 25, description: null },
      { code: 'TREASURER', name: 'Quỹ / Thủ quỹ', hierarchy_level: 25, description: null },
      { code: 'DEPT_HEAD', name: 'Trưởng ban / Trưởng bộ phận', hierarchy_level: 30, description: null },
      { code: 'CENTER_HEAD', name: 'Trưởng trung tâm', hierarchy_level: 30, description: null },
      { code: 'MEMBER', name: 'Thành viên', hierarchy_level: 100, description: null },
    ],
  });

  const dec = (v) => new Prisma.Decimal(String(v));
  await prisma.penalty_rules.createMany({
    data: [
      { code: 'ABSENCE_EVENT', label: 'Vắng sự kiện', default_points: dec('1.00') },
      { code: 'LATE_EVENT', label: 'Trễ sự kiện (sau 30p)', default_points: dec('0.50') },
      { code: 'LATE_MEETING', label: 'Trễ họp (sau 30p từ giờ bắt đầu buổi)', default_points: dec('0.50') },
      { code: 'ABSENCE_MEETING', label: 'Vắng họp (ngoài thời gian quét)', default_points: dec('1.00') },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('Đã tạo lại: departments, roles, penalty_rules.\n');
}

async function main() {
  // eslint-disable-next-line no-console
  console.log(
    '>>> CẢNH BÁO: Sẽ xóa sạch dữ liệu (users, events, đăng ký, …) và tạo lại dữ liệu tham chiếu + 10 tài khoản demo.\n',
  );
  await truncateAllData();
  await seedReferenceRows();
  await runSeedDemoAccounts(prisma);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
