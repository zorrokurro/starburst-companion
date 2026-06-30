const Database = require('better-sqlite3');
const path = require('path');
const dbPath = process.argv[2];
console.log('DB path:', dbPath);
const db = new Database(dbPath, { readonly: true });
db.pragma('journal_mode = WAL');

// Simulate buildSpriteQuery({page:1, limit:1}) with no filters
const conditions = [];
const params = {};
const where = '';
const countSql = 'SELECT COUNT(*) as total FROM sprites s';
const dataSql = `SELECT s.*, (COALESCE(s.base_atk,0)+COALESCE(s.base_def,0)+COALESCE(s.base_spatk,0)+COALESCE(s.base_spdef,0)+COALESCE(s.base_speed,0)+COALESCE(s.base_hp,0)) as base_total FROM sprites s ${where} ORDER BY s.cn_id ASC LIMIT 1 OFFSET 0`;

console.log('countSql:', countSql);
console.log('dataSql:', dataSql);
console.log('params:', JSON.stringify(params));

try {
  const totalRow = db.prepare(countSql).get(params);
  console.log('COUNT result:', totalRow);
  const rows = db.prepare(dataSql).all(params);
  console.log('DATA result count:', rows.length);
  if (rows.length > 0) console.log('First row:', JSON.stringify(rows[0]));
} catch (e) {
  console.error('QUERY ERROR:', e.message);
}

// Also check: does the table exist and has data?
try {
  const r = db.prepare('SELECT COUNT(*) as c FROM sprites').get();
  console.log('Direct COUNT:', r.c);
} catch (e) {
  console.error('Direct COUNT failed:', e.message);
}

// Check WAL mode and if there are WAL files
const fs = require('fs');
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';
console.log('WAL file exists:', fs.existsSync(walPath), fs.existsSync(walPath) ? fs.statSync(walPath).size : 0);
console.log('SHM file exists:', fs.existsSync(shmPath), fs.existsSync(shmPath) ? fs.statSync(shmPath).size : 0);

db.close();
