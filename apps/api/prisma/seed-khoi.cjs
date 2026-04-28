/**
 * Tạo / cập nhật một tài khoản cụ thể (idempotent).
 * Chạy:  cd apps/api && node prisma/seed-khoi.cjs
 * Mật khẩu: biến môi trường NEW_USER_PASSWORD (khuyến nghị), mặc định Demo giống seed: Test123!@#
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const BCRYPT_ROUNDS = 10;

/** Nội dung không có trong DB (nhóm G1, ô ban/lĩnh vực trống) — bỏ qua */
const ACCOUNT = {
  email: 'hovudangkhoi.22042004@gmail.com',
  fullName: 'Hồ Vủ Đăng Khôi',
  studentId: '2302700389',
  roleCode: 'PRESIDENT',
  deptCode: 'BAN_CHU_NHIEM',
  positionTitle: 'Chủ nhiệm',
  gender: 'male',
  birthDate: new Date('2004-04-22'),
  phone: '344452739',
  major: 'Quản trị kinh doanh',
};

async function main() {
  const password =
    process.env.NEW_USER_PASSWORD?.trim() || 'Test123!@#';
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const prisma = new PrismaClient();
  try {
    const role = await prisma.roles.findFirst({ where: { code: ACCOUNT.roleCode } });
    if (!role) throw new Error(`Thiếu role: ${ACCOUNT.roleCode}`);
    const dept = await prisma.departments.findFirst({ where: { code: ACCOUNT.deptCode } });
    if (!dept) throw new Error(`Thiếu ban: ${ACCOUNT.deptCode}`);

    const existing = await prisma.users.findUnique({
      where: { email: ACCOUNT.email },
    });

    if (existing) {
      await prisma.users.update({
        where: { id: existing.id },
        data: { password_hash: hash, is_active: true },
      });
      await prisma.members.update({
        where: { user_id: existing.id },
        data: {
          full_name: ACCOUNT.fullName,
          student_id: ACCOUNT.studentId,
          gender: ACCOUNT.gender,
          birth_date: ACCOUNT.birthDate,
          major: ACCOUNT.major,
          phone: ACCOUNT.phone,
          primary_department_id: dept.id,
          position_title: ACCOUNT.positionTitle,
          membership_status: 'active',
          inactive_at: null,
          inactive_reason: null,
        },
      });
      const ucr = await prisma.user_club_roles.findFirst({
        where: { user_id: existing.id },
      });
      if (ucr) {
        await prisma.user_club_roles.update({
          where: { id: ucr.id },
          data: { role_id: role.id, department_id: dept.id, is_primary: true },
        });
      } else {
        await prisma.user_club_roles.create({
          data: {
            user_id: existing.id,
            role_id: role.id,
            department_id: dept.id,
            is_primary: true,
          },
        });
      }
      // eslint-disable-next-line no-console
      console.log('Đã cập nhật tài khoản:', ACCOUNT.email);
    } else {
      await prisma.$transaction(async (tx) => {
        const user = await tx.users.create({
          data: { email: ACCOUNT.email, password_hash: hash },
        });
        await tx.members.create({
          data: {
            user_id: user.id,
            full_name: ACCOUNT.fullName,
            student_id: ACCOUNT.studentId,
            gender: ACCOUNT.gender,
            birth_date: ACCOUNT.birthDate,
            major: ACCOUNT.major,
            phone: ACCOUNT.phone,
            primary_department_id: dept.id,
            position_title: ACCOUNT.positionTitle,
          },
        });
        await tx.user_club_roles.create({
          data: {
            user_id: user.id,
            role_id: role.id,
            department_id: dept.id,
            is_primary: true,
          },
        });
      });
      // eslint-disable-next-line no-console
      console.log('Đã tạo tài khoản:', ACCOUNT.email);
    }

    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('Đăng nhập:');
    // eslint-disable-next-line no-console
    console.log('  Email   :', ACCOUNT.email);
    // eslint-disable-next-line no-console
    console.log('  Mật khẩu:', password);
    // eslint-disable-next-line no-console
    console.log(
      '(Đổi bằng NEW_USER_PASSWORD trước khi chạy nếu không dùng mặc định Test123!@#)',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
