/**
 * Tạo / cập nhật 10 tài khoản demo (dùng chung cho `db seed` và `wipe-and-reseed`).
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 10;
const DEMO_PASSWORD = 'Test123!@#';

const SEED_ACCOUNTS = [
  {
    email: 'demo.chu-nhiem@example.com',
    fullName: 'Lê Anh Chủ nhiệm',
    roleCode: 'PRESIDENT',
    deptCode: 'BAN_CHU_NHIEM',
    positionTitle: 'Chủ nhiệm CLB',
  },
  {
    email: 'demo.pho-dieu-hanh@example.com',
    fullName: 'Trần Thị Phó ĐH',
    roleCode: 'VICE_PRES_OP',
    deptCode: 'BAN_DIEU_HANH',
    positionTitle: 'Phó Chủ nhiệm phụ trách điều hành',
  },
  {
    email: 'demo.pho-chuyen-mon@example.com',
    fullName: 'Phạm Văn Phó CM',
    roleCode: 'VICE_PRES_PRO',
    deptCode: 'BAN_CHU_NHIEM',
    positionTitle: 'Phó Chủ nhiệm phụ trách chuyên môn',
  },
  {
    email: 'demo.bdh@example.com',
    fullName: 'Hoàng Văn BĐH',
    roleCode: 'EXEC_BOARD',
    deptCode: 'BAN_DIEU_HANH',
    positionTitle: 'Thành viên Ban Điều hành',
  },
  {
    email: 'demo.thu-ky@example.com',
    fullName: 'Nguyễn Thị Thư ký',
    roleCode: 'SECRETARY',
    deptCode: 'BP_HANH_CHINH',
    positionTitle: 'Thư ký',
  },
  {
    email: 'demo.thu-quy@example.com',
    fullName: 'Võ Thị Thủ quỹ',
    roleCode: 'TREASURER',
    deptCode: 'BP_HANH_CHINH',
    positionTitle: 'Thủ quỹ',
  },
  {
    email: 'demo.truong-ban-sk@example.com',
    fullName: 'Đặng Văn Trưởng ban SK',
    roleCode: 'DEPT_HEAD',
    deptCode: 'BAN_SU_KIEN',
    positionTitle: 'Trưởng ban Sự kiện',
  },
  {
    email: 'demo.truong-trung-tam@example.com',
    fullName: 'Bùi Thị Trưởng TT',
    roleCode: 'CENTER_HEAD',
    deptCode: 'TT_DOI_MOI',
    positionTitle: 'Trưởng Trung tâm ĐMST',
  },
  {
    email: 'demo.hoi-vien@example.com',
    fullName: 'Ngô Văn Hội viên',
    roleCode: 'MEMBER',
    deptCode: 'BAN_TT_THUONG_HIEU',
    positionTitle: 'Thành viên — Truyền thông',
  },
  {
    email: 'demo.hoi-vien-sk@example.com',
    fullName: 'Dương Thị Sự kiện',
    roleCode: 'MEMBER',
    deptCode: 'BAN_SU_KIEN',
    positionTitle: 'Thành viên — Ban Sự kiện',
  },
];

function pad(s, n) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function runSeedDemoAccounts(prisma) {
  const hash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  const roleByCode = new Map();
  for (const code of new Set(SEED_ACCOUNTS.map((a) => a.roleCode))) {
    const r = await prisma.roles.findFirst({ where: { code } });
    if (!r) {
      throw new Error(`Thiếu role trong DB: ${code} (seed tham chiếu trước).`);
    }
    roleByCode.set(code, r);
  }

  const deptByCode = new Map();
  for (const code of new Set(SEED_ACCOUNTS.map((a) => a.deptCode))) {
    const d = await prisma.departments.findFirst({ where: { code } });
    if (!d) {
      throw new Error(`Thiếu ban/trung tâm: ${code}`);
    }
    deptByCode.set(code, d);
  }

  for (const a of SEED_ACCOUNTS) {
    const role = roleByCode.get(a.roleCode);
    const dept = deptByCode.get(a.deptCode);
    const existing = await prisma.users.findUnique({ where: { email: a.email } });
    if (existing) {
      await prisma.users.update({
        where: { id: existing.id },
        data: { password_hash: hash, is_active: true },
      });
      await prisma.members.update({
        where: { user_id: existing.id },
        data: {
          full_name: a.fullName,
          primary_department_id: dept.id,
          position_title: a.positionTitle,
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
          data: {
            role_id: role.id,
            department_id: dept.id,
          },
        });
      }
      // eslint-disable-next-line no-console
      console.log('Cập nhật mật khẩu + hồ sơ:', a.email);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: { email: a.email, password_hash: hash },
      });
      await tx.members.create({
        data: {
          user_id: user.id,
          full_name: a.fullName,
          gender: 'unspecified',
          primary_department_id: dept.id,
          position_title: a.positionTitle,
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
    console.log('Tạo mới:', a.email, `(${a.roleCode})`);
  }

  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('========== Tài khoản demo (cùng mật khẩu) ==========');
  // eslint-disable-next-line no-console
  console.log('Mật khẩu:', DEMO_PASSWORD);
  // eslint-disable-next-line no-console
  console.log(pad('Email', 40), pad('Vai trò (code)', 18), 'Ban / trung tâm');
  for (const a of SEED_ACCOUNTS) {
    // eslint-disable-next-line no-console
    console.log(
      pad(a.email, 40),
      pad(a.roleCode, 18),
      `${a.deptCode} — ${a.positionTitle}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log('====================================================');
  // eslint-disable-next-line no-console
  console.log('Gợi ý: đăng nhập bằng Chủ nhiệm để tạo sự kiện; dùng Hội viên để thử đăng ký.');
}

module.exports = {
  BCRYPT_ROUNDS,
  DEMO_PASSWORD,
  SEED_ACCOUNTS,
  runSeedDemoAccounts,
};
