/**
 * Áp dụng các file SQL vào MySQL từ xa (vd. Aiven — database media_club).
 * Đọc DATABASE_URL từ apps/api/.env (không commit).
 * Xử lý DELIMITER trong 01_schema.sql như mysql CLI.
 *
 * Chạy từ repo root:  node database/apply-schema-remote.cjs
 *
 * Đặt lại DB rỗng rồi chạy lại toàn bộ (xóa schema cũ trong media_club):
 *   set APPLY_SCHEMA_FRESH=1   (PowerShell: $env:APPLY_SCHEMA_FRESH='1')
 */

'use strict';

const fs = require('fs');
const path = require('path');

function loadEnvFile(envPath) {
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

/** Bỏ DELIMITER (chỉ dùng trên mysql CLI); END;; -> END; cho trigger. */
function preprocessSchema01(content) {
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*DELIMITER\s/i.test(line))
    .join('\n')
    .replace(/END;;/g, 'END;');
}

/** mysql://...@host:p/db?q → đổi tên schema (vd. sang defaultdb để DROP/CREATE). */
function mysqlUrlReplaceDatabase(uri, dbName) {
  const q = uri.indexOf('?');
  const slash = uri.lastIndexOf('/', q === -1 ? uri.length : q);
  if (slash <= 'mysql://'.length) throw new Error('Invalid DATABASE_URL: missing database path');
  const prefix = uri.slice(0, slash);
  const rest = q === -1 ? '' : uri.slice(q);
  return `${prefix}/${dbName}${rest}`;
}

async function recreateEmptyMediaClub(mysql, targetUrl, dbName) {
  const adminUrl = mysqlUrlReplaceDatabase(targetUrl, 'defaultdb');
  const adminConn = await mysql.createConnection({
    uri: adminUrl,
    multipleStatements: true,
  });
  try {
    await adminConn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await adminConn.query(
      `CREATE DATABASE \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`Recreated empty database: ${dbName}`);
  } finally {
    await adminConn.end();
  }
}

async function main() {
  const root = path.join(__dirname, '..');
  const envPath = path.join(root, 'apps', 'api', '.env');
  loadEnvFile(envPath);
  const url = process.env.DATABASE_URL?.trim();
  if (!url || !url.startsWith('mysql://')) {
    throw new Error('DATABASE_URL (mysql://) is required in apps/api/.env');
  }

  const mysql = require('mysql2/promise');

  const dbMatch = url.match(/\/([^/?]+)(\?|$)/);
  const dbName = dbMatch?.[1];
  if (!dbName) throw new Error('DATABASE_URL must include database name');

  const fresh = process.env.APPLY_SCHEMA_FRESH === '1' || process.env.APPLY_SCHEMA_FRESH === 'true';
  if (fresh) {
    await recreateEmptyMediaClub(mysql, url, dbName);
  }

  const conn = await mysql.createConnection({
    uri: url,
    multipleStatements: true,
  });

  const files = [
    ['01_schema.sql', true],
    ['02_views.sql', false],
    ['04_refresh_tokens.sql', false],
    ['05_member_status.sql', false],
    ['06_user_notifications.sql', false],
  ];

  try {
    for (const [name, preprocess] of files) {
      const fp = path.join(__dirname, name);
      if (!fs.existsSync(fp)) throw new Error(`Missing file: ${fp}`);
      let sql = fs.readFileSync(fp, 'utf8');
      if (preprocess) sql = preprocessSchema01(sql);
      console.log(`Running ${name} ...`);
      await conn.query(sql);
      console.log(`OK ${name}`);
    }
  } finally {
    await conn.end();
  }

  console.log('\nDone. Next (from apps/api):');
  console.log('  npx prisma migrate resolve --applied 20260226120000_add_user_notifications');
  console.log('  npx prisma migrate resolve --applied 20260226121000_add_event_subcommittees_max_members');
  console.log('  npx prisma migrate status && npx prisma generate');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
