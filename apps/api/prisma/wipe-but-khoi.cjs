/**
 * NGUY HIỂM: Xóa toàn bộ dữ liệu nghiệp vụ (sự kiện, họp, đăng ký, thông báo, …).
 * Giữ một tài khoản: email định sẵn hoặc hồ sơ trùng tên Khôi.
 * GIỮ departments, roles, penalty_rules (dữ liệu tham chiếu CLB).
 *
 * Chạy: cd apps/api && npm run db:wipe-but-khoi
 * Cần DATABASE_URL trỏ đúng MySQL (Aiven, v.v.).
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** Theo seed-khoi.cjs — tài khoản Hồ Vũ Đăng Khôi */
const KEEP_EMAIL_PRIMARY = 'hovudangkhoi.22042004@gmail.com';

/** Fallback nếu chưa đổi email: khớp `members.full_name` (db cũ có thể ghi sai chữ “Vủ”). */
const KEEP_NAME_VARIANTS = ['Hồ Vũ Đăng Khôi', 'Hồ Vủ Đăng Khôi'];

const TRUNC_TABLES_FIRST = [
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
];

async function findKeeperUserId() {
  const byEmail = await prisma.users.findUnique({
    where: { email: KEEP_EMAIL_PRIMARY },
    select: { id: true },
  });
  if (byEmail) {
    return { id: byEmail.id, match: KEEP_EMAIL_PRIMARY };
  }
  for (const fn of KEEP_NAME_VARIANTS) {
    const row = await prisma.members.findFirst({
      where: { full_name: fn },
      select: { user_id: true, full_name: true },
    });
    if (row) {
      return { id: row.user_id, match: `members.full_name=${row.full_name}` };
    }
  }
  throw new Error(
    `Không tìm được tài khoản để GIỮ. Chạy trước: npm run seed:khoi\n(email: ${KEEP_EMAIL_PRIMARY}).`,
  );
}

async function main() {
  const keep = await findKeeperUserId();
  const keeperId = keep.id;
  // eslint-disable-next-line no-console
  console.log('>>> GIỮ user id', keeperId.toString(), '(' + keep.match + ')\n');

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of TRUNC_TABLES_FIRST) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``);
  }

  await prisma.user_club_roles.deleteMany({
    where: { user_id: { not: keeperId } },
  });
  await prisma.members.deleteMany({
    where: { user_id: { not: keeperId } },
  });
  await prisma.users.deleteMany({
    where: { id: { not: keeperId } },
  });
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

  const left = await prisma.users.count({});
  const m = await prisma.members.findUnique({ where: { user_id: keeperId }, select: { full_name: true } });
  // eslint-disable-next-line no-console
  console.log('Hoàn tất. Users còn lại:', left, '| Hồ sơ:', m?.full_name ?? '(thiếu members?)');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
