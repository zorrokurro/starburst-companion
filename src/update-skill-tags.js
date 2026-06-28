import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

/**
 * 技能特效（Effect）正則標籤化過濾
 *
 * 規則：
 *   消強：含有 "消除" + "提升"（或簡體 "消除" + "提升"）
 *   控場：含有 "害怕" / "癱瘓" / "疲憊"（含簡體）
 *   回血：含有 "恢復" + "體力"（含簡體）
 */
const TAG_RULES = [
  {
    tag: '消強',
    label: '消除能力提升',
    test: (text) => /消除/.test(text) && /提升/.test(text),
  },
  {
    tag: '控場',
    label: '控制效果',
    test: (text) => /害怕|癱瘓|疲憊|瘫痪|疲惫/.test(text),
  },
  {
    tag: '回血',
    label: '體力恢復',
    test: (text) => /(?:恢復|恢复)/.test(text) && /(?:體力|体力)/.test(text),
  },
];

// 確保 tags 欄位存在（向後相容舊 DB）
try {
  db.prepare("SELECT tags FROM skills LIMIT 1").get();
} catch {
  console.log('新增 tags 欄位至 skills 資料表...');
  db.exec(`ALTER TABLE skills ADD COLUMN tags TEXT DEFAULT '[]'`);
}

const skills = db.prepare(
  `SELECT id, name, effect_desc FROM skills
   WHERE effect_desc IS NOT NULL AND effect_desc != ''`
).all();

console.log('=== 技能特效標籤化腳本 ===');
console.log(`掃描 ${skills.length} 筆有效技能...\n`);

const updateStmt = db.prepare('UPDATE skills SET tags = ? WHERE id = ?');
let taggedCount = 0;
const tagCounts = { 消強: 0, 控場: 0, 回血: 0 };

const runBatch = db.transaction(() => {
  for (const skill of skills) {
    const text = skill.effect_desc;
    const tags = TAG_RULES.filter(rule => rule.test(text)).map(rule => ({ tag: rule.tag }));

    if (tags.length > 0) {
      updateStmt.run(JSON.stringify(tags), skill.id);
      taggedCount++;
      for (const t of tags) tagCounts[t.tag]++;
      console.log(`  [${skill.id}] ${skill.name} → ${tags.map(t => t.tag).join(', ')}`);
    }
  }
});

runBatch();

console.log(`\n=== 完成 ===`);
console.log(`  已標籤：${taggedCount} / ${skills.length}`);
console.log(`  消強：${tagCounts['消強']} 筆`);
console.log(`  控場：${tagCounts['控場']} 筆`);
console.log(`  回血：${tagCounts['回血']} 筆`);

db.close();
