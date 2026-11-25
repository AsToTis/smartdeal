// ==========================================================
// Smart Deal - Migration runner
//   node smart-deal-backend/db/migrate.js          -> รัน migration ที่ยังไม่เคยรัน
//   node smart-deal-backend/db/migrate.js --status -> ดูสถานะ
// ไฟล์ใน ./migrations รันตามลำดับชื่อ (.sql หรือ .js) และจดไว้ในตาราง schema_migrations
// ==========================================================
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('./config');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const makeHelpers = (conn, database) => {
  const columnInfo = async (table, column) => {
    const [rows] = await conn.query(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [database, table, column]
    );
    return rows[0] || null;
  };
  return {
    columnExists: async (table, column) => !!(await columnInfo(table, column)),
    addColumn: async (table, column, definition) => {
      if (!(await columnInfo(table, column))) {
        await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      }
    },
    comment: async (table, column, definition) => {
      if (await columnInfo(table, column)) {
        await conn.query(`ALTER TABLE \`${table}\` MODIFY \`${column}\` ${definition}`);
      }
    },
    setForeignKey: async (table, column, refTable, refColumn, onDelete) => {
      const [fks] = await conn.query(
        `SELECT k.CONSTRAINT_NAME AS name, r.DELETE_RULE AS rule
         FROM information_schema.KEY_COLUMN_USAGE k
         JOIN information_schema.REFERENTIAL_CONSTRAINTS r
           ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
         WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = ? AND k.COLUMN_NAME = ? AND k.REFERENCED_TABLE_NAME = ?`,
        [database, table, column, refTable]
      );
      if (fks.length === 1 && fks[0].rule === onDelete) return;
      for (const fk of fks) {
        await conn.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fk.name}\``);
      }
      await conn.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`fk_${table}_${column}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${refTable}\` (\`${refColumn}\`) ON DELETE ${onDelete} ON UPDATE CASCADE`
      );
    },
  };
};

const runMigrations = async ({ log = console.log } = {}) => {
  const cfg = resolveDbConfig();
  const base = {
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password,
    ssl: cfg.ssl, charset: 'utf8mb4', multipleStatements: true, dateStrings: true,
  };

  if (cfg.createDatabase) {
    const server = await mysql.createConnection(base);
    try {
      await server.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } catch (e) {
      log(`⚠️ [Migration] สร้างฐานข้อมูลอัตโนมัติไม่ได้ (${e.message}) จะใช้ฐานที่มีอยู่แทน`);
    } finally {
      await server.end();
    }
  }

  const conn = await mysql.createConnection({ ...base, database: cfg.database });
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(191) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const [doneRows] = await conn.query('SELECT name FROM schema_migrations');
    const done = new Set(doneRows.map(r => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => /\.(sql|js)$/.test(f)).sort();
    const helpers = makeHelpers(conn, cfg.database);
    const applied = [];

    for (const file of files) {
      const name = file.replace(/\.(sql|js)$/, '');
      if (done.has(name)) continue;
      log(`🔄 [Migration] กำลังรัน ${file} ...`);
      if (file.endsWith('.sql')) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await conn.query(sql);
      } else {
        const mod = require(path.join(MIGRATIONS_DIR, file));
        await mod.up(conn, helpers);
      }
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
      applied.push(name);
      log(`✅ [Migration] ${file} สำเร็จ`);
    }
    if (applied.length === 0) log(`✅ [Migration] ฐานข้อมูล ${cfg.database} (${cfg.profile}) เป็นเวอร์ชันล่าสุดแล้ว`);
    return { database: cfg.database, profile: cfg.profile, applied };
  } finally {
    await conn.end();
  }
};

module.exports = { runMigrations };

if (require.main === module) {
  const cfg = resolveDbConfig();
  console.log(`🗄️  Profile: ${cfg.profile} -> ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
  if (process.argv.includes('--status')) {
    (async () => {
      const conn = await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database, ssl: cfg.ssl, dateStrings: true });
      const [rows] = await conn.query('SELECT name, applied_at FROM schema_migrations ORDER BY name').catch(() => [[]]);
      console.table(rows);
      await conn.end();
    })().catch(e => { console.error('❌', e.message); process.exit(1); });
  } else {
    runMigrations().then(() => process.exit(0)).catch(e => { console.error('❌ [Migration] ล้มเหลว:', e.message); process.exit(1); });
  }
}
