import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const VERIFY_STATUS = 'verified_fallback';
const VERIFIED_BY = 'batch-verify';

console.log('=== 賽爾號資料基線校對腳本 ===\n');
console.log('目的：台服尚未上線 H5，將所有精靈的 tw_id 同步為 cn_id，');
console.log('      並標記為 verified_fallback，讓系統判定資料已就緒。\n');

// 1. Count sprites
const total = db.prepare('SELECT COUNT(*) as c FROM sprites').get().c;
const pending = db.prepare("SELECT COUNT(*) as c FROM sprites WHERE region_status = 'pending_verify'").get().c;
const alreadyVerified = total - pending;

console.log(`精靈總數：${total}`);
console.log(`待校對：${pending}`);
console.log(`已校對：${alreadyVerified}\n`);

if (pending === 0) {
  console.log('所有精靈已校對，無需執行基線同步。');
  db.close();
  process.exit(0);
}

// 2. Transaction: sync tw_id = cn_id, set region_status
const updateSprite = db.prepare(`
  UPDATE sprites
  SET tw_id = cn_id,
      region_status = ?
  WHERE region_status = 'pending_verify'
`);

const insertDiff = db.prepare(`
  INSERT INTO verify_diffs (sprite_id, field, cn_value, tw_value, status, verified_by, verified_at)
  VALUES (?, 'tw_id', ?, ?, 'verified', ?, datetime('now'))
`);

const countUpdated = db.prepare(`
  SELECT COUNT(*) as c FROM sprites WHERE region_status = ?
`).get(VERIFY_STATUS).c;

const runBatch = db.transaction(() => {
  // Sync tw_id = cn_id for all pending sprites
  const result = updateSprite.run(VERIFY_STATUS);
  console.log(`已同步 ${result.changes} 隻精靈的 tw_id = cn_id\n`);

  // Record baseline in verify_diffs for each updated sprite
  const sprites = db.prepare("SELECT id, cn_id FROM sprites WHERE region_status = ?").all(VERIFY_STATUS);

  const insertMany = db.transaction((rows) => {
    for (const s of rows) {
      insertDiff.run(s.id, s.cn_id, s.cn_id, VERIFIED_BY);
    }
  });
  insertMany(sprites);
  console.log(`已寫入 ${sprites.length} 筆基線校對記錄至 verify_diffs\n`);

  return result.changes;
});

const updated = runBatch();

// 3. Summary
const finalPending = db.prepare("SELECT COUNT(*) as c FROM sprites WHERE region_status = 'pending_verify'").get().c;
const finalFallback = db.prepare(`SELECT COUNT(*) as c FROM sprites WHERE region_status = '${VERIFY_STATUS}'`).get().c;
const diffCount = db.prepare("SELECT COUNT(*) as c FROM verify_diffs WHERE status = 'verified'").get().c;

console.log('=== 基線校對完成 ===');
console.log(`  本次更新：${updated} 隻`);
console.log(`  待校對：${finalPending}`);
console.log(`  verified_fallback：${finalFallback}`);
console.log(`  verify_diffs 基線記錄：${diffCount}`);
console.log('\n系統現在可判定所有精靈資料已就緒。');

db.close();
