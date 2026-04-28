/**
 * Seed tài khoản demo — không xóa dữ liệu cũ (idempotent).
 * Xóa toàn bộ DB rồi tạo lại: `npm run db:wipe-demo` (apps/api).
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require('@prisma/client');
const { runSeedDemoAccounts } = require('./seed-accounts.lib.cjs');

const prisma = new PrismaClient();

runSeedDemoAccounts(prisma)
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
