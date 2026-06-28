#!/usr/bin/env node
// export-dist-data.js — 從 seer.db 匯出 JSON 到 dist-data/ 供 jsDelivr 分發

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.SEER_DB_PATH || path.join(__dirname, '..', 'db', 'seer.db');
const OUT_DIR = path.join(__dirname, '..', 'dist-data');

const TABLES = [
  { name: 'sprites',        sql: 'SELECT * FROM sprites ORDER BY id' },
  { name: 'skills',         sql: 'SELECT * FROM skills ORDER BY id' },
  { name: 'sprite_skills',  sql: 'SELECT * FROM sprite_skills ORDER BY sprite_id, skill_id' },
  { name: 'soul_seals',     sql: 'SELECT * FROM soul_seals ORDER BY id' },
  { name: 'engravings',     sql: 'SELECT * FROM engravings ORDER BY id' },
  { name: 'generic_traits', sql: 'SELECT * FROM generic_traits ORDER BY id' },
  { name: 'type_chart',     sql: 'SELECT * FROM type_chart ORDER BY attack_type, defend_type' },
];

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const db = new Database(DB_PATH, { readonly: true });
  let totalBytes = 0;

  for (const { name, sql } of TABLES) {
    const rows = db.prepare(sql).all();
    const json = JSON.stringify(rows, null, 2);
    const filePath = path.join(OUT_DIR, `${name}.json`);
    fs.writeFileSync(filePath, json, 'utf-8');
    const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(1);
    console.log(`  ${name}.json — ${rows.length} rows, ${sizeKB} KB`);
    totalBytes += Buffer.byteLength(json);
  }

  const version = new Date().toISOString().replace(/[:.]/g, '-');
  const versionInfo = {
    version,
    updatedAt: new Date().toISOString(),
    tables: TABLES.map(t => t.name),
  };
  const versionJson = JSON.stringify(versionInfo, null, 2);
  fs.writeFileSync(path.join(OUT_DIR, 'version.json'), versionJson, 'utf-8');
  console.log(`  version.json — ${versionInfo.version}`);
  totalBytes += Buffer.byteLength(versionJson);

  db.close();

  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n  Total: ${totalMB} MB (${TABLES.length + 1} files)`);
  console.log(`  Output: ${OUT_DIR}`);
}

main();
