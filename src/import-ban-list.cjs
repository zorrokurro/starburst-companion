const sqlite = require('node:sqlite');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const DATA_DIR = join(__dirname, '..', 'data');

// Parse CLI args: node import-ban-list.cjs [filename]
const filename = process.argv[2] || 'ban-list-2026-07.json';
const filePath = join(DATA_DIR, filename);

if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const db = new sqlite.DatabaseSync(DB_PATH);

// Read JSON
const data = JSON.parse(readFileSync(filePath, 'utf-8'));
const season = data.season;
if (!season) {
  console.error('Missing "season" field in JSON');
  process.exit(1);
}
console.log(`Season: ${season}`);
console.log(`Note: ${data.note || '(none)'}`);

// Build cn_id → sprites.id lookup
const spriteMap = new Map();
db.prepare('SELECT id, cn_id, name_zh FROM sprites').all().forEach(r => {
  spriteMap.set(String(r.cn_id), { id: r.id, name: r.name_zh });
});
console.log(`Sprite lookup: ${spriteMap.size} entries`);

// Import each pool type
const poolTypes = [
  { key: 'ban', label: '禁止池' },
  { key: 'restricted', label: '限制池' },
  { key: 'semi_restricted', label: '准限制池' },
];

let total = 0, notFound = 0, duplicates = 0;

db.exec('BEGIN');
const insert = db.prepare(`
  INSERT OR IGNORE INTO pvp_ban_list (sprite_id, pool_type, season, note)
  VALUES (?, ?, ?, ?)
`);

for (const pool of poolTypes) {
  const entries = data[pool.key] || [];
  console.log(`\n${pool.label}: ${entries.length} entries`);

  for (const entry of entries) {
    const cnId = String(entry.cn_id);
    const sprite = spriteMap.get(cnId);

    if (!sprite) {
      console.log(`  ⚠️ cn_id=${cnId} not found in sprites`);
      notFound++;
      continue;
    }

    const result = insert.run(sprite.id, pool.key, season, entry.note || null);
    if (result.changes > 0) {
      console.log(`  ✅ ${cnId} ${sprite.name || '(no name)'} → ${pool.key}`);
      total++;
    } else {
      console.log(`  ⏭️ ${cnId} ${sprite.name} already exists (duplicate)`);
      duplicates++;
    }
  }
}
db.exec('COMMIT');

// Summary
console.log(`\n=== Summary ===`);
console.log(`Imported: ${total}`);
console.log(`Not found: ${notFound}`);
console.log(`Duplicates skipped: ${duplicates}`);

// Verify
const counts = db.prepare(`
  SELECT pool_type, count(*) as c FROM pvp_ban_list WHERE season = ? GROUP BY pool_type
`).all(season);
console.log(`\nDB state for season ${season}:`);
counts.forEach(r => console.log(`  ${r.pool_type}: ${r.c}`));

db.close();
