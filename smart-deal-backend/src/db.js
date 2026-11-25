// ==========================================================
// Smart Deal - MySQL connection pool (Dual-Environment)
// ตั้งค่าใน .env:  DB_PROFILE=local | remote  (ดู .env.example)
// ก่อนรับ query แรก ระบบจะรัน auto-migration ให้ schema ครบเสมอ
// ==========================================================
const mysql = require('mysql2');
const { resolveDbConfig } = require('../db/config');
const { runMigrations } = require('../db/migrate');

const cfg = resolveDbConfig();

const dbConfig = {
  host: cfg.host,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  port: cfg.port,
  ssl: cfg.ssl,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // Fix Date serialization to return strings instead of {}
};

const pool = mysql.createPool(dbConfig).promise();

// Auto-migration: ทุก query จะรอจนกว่า schema พร้อม (ป้องกัน ALTER/SELECT บนตารางที่ยังไม่ถูกสร้าง)
const ready = (cfg.autoMigrate ? runMigrations() : Promise.resolve())
  .catch(err => {
    console.error('❌ [Migration] ล้มเหลว:', err.message);
  });

ready.then(async () => {
  try {
    const conn = await pool.getConnection();
    console.log(`✅ เชื่อมต่อ MySQL สำเร็จ! [${cfg.profile}] (${dbConfig.host}:${dbConfig.port} / Database: ${dbConfig.database})`);
    conn.release();
  } catch (err) {
    console.error(`❌ ไม่สามารถเชื่อมต่อ MySQL ได้ [${cfg.profile}] (${dbConfig.host}:${dbConfig.port} / ${dbConfig.database}):`, err.message);
  }
});

module.exports = {
  ready,
  config: { profile: cfg.profile, host: cfg.host, port: cfg.port, database: cfg.database },
  query: async (...args) => { await ready; return pool.query(...args); },
  execute: async (...args) => { await ready; return pool.execute(...args); },
  getConnection: async () => { await ready; return pool.getConnection(); },
  end: () => pool.end(),
  pool,
};
