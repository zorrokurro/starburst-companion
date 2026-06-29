const sqlite = require('node:sqlite');
const { join } = require('path');

const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const db = new sqlite.DatabaseSync(DB_PATH);

/**
 * 技能標籤化腳本 (v2 — 14 個標籤)
 *
 * 使用 node:sqlite，按色系分組：
 * 🔴 攻擊：固傷、吸血、多段、穿透
 * 🔵 防禦：回血、護盾、獅盔
 * 🟣 控制：控場、PP干擾、先制
 * ⚪ 消除：消強、消弱、自我強化、對手弱化
 */
const TAG_RULES = [
  // ── 🔴 攻擊色系 ──
  {
    tag: '固傷',
    test: (text) => /附加.*固定傷害|增加.*固定傷害/.test(text),
  },
  {
    tag: '吸血',
    test: (text) => /吸取.*體力|吸取.*HP/.test(text),
  },
  {
    tag: '多段',
    test: (text) => /x\d|\d連擊|連續\d次|做n次攻擊/.test(text),
  },
  {
    tag: '穿透',
    test: (text) => /無視.*防禦|無視.*特防|穿透/.test(text),
  },

  // ── 🔵 防禦色系 ──
  {
    tag: '回血',
    test: (text) => /(?:恢復|恢复).*(?:體力|体力)|(?:體力|体力).*(?:恢復|恢复)/.test(text),
  },
  {
    tag: '護盾',
    test: (text) => /護盾|護罩/.test(text),
  },
  {
    tag: '獅盔',
    test: (text) => /致死.*保留|致死.*餘下1點體力|受到的傷害不會超過.*最大體力|受到致死攻擊時則餘下/.test(text),
  },

  // ── 🟣 控制色系 ──
  {
    tag: '控場',
    test: (text) => /害怕|癱瘓|疲憊|麻痺|中毒|凍傷|灼傷|石化|混亂|冰封|瘫痪|疲惫/.test(text),
  },
  {
    tag: 'PP干擾',
    test: (text) => /損失.*PP|減少.*PP|PP值.*降低|降低.*PP值|PP值.*0.*無法/.test(text),
  },
  // 先制由 DB 欄位決定，此處不處理

  // ── ⚪ 消除/變化色系 ──
  {
    tag: '消強',
    test: (text) => /消除.*能力.*提升|提升.*消除/.test(text),
  },
  {
    tag: '消弱',
    test: (text) => /消除.*能力.*下降|下降.*消除/.test(text),
  },
  {
    tag: '自我強化',
    test: (text) => /令自身.*[+-]\d.*級|令自身.*等級.*[+-]|提升自身.*(能力|等級)/.test(text),
  },
  {
    tag: '對手弱化',
    test: (text) => /降低能力|令對手全屬性.*[+-]|使對手.*能力等級.*[+-]|令對手.*能力.*[+-]\d.*級/.test(text),
  },
];

// 確保 tags 欄位存在
try {
  db.prepare('SELECT tags FROM skills LIMIT 1').get();
} catch {
  console.log('新增 tags 欄位至 skills 資料表...');
  db.exec("ALTER TABLE skills ADD COLUMN tags TEXT DEFAULT '[]'");
}

// 掃描所有有 effect_desc 的技能
const skills = db.prepare(
  `SELECT id, name, effect_desc, priority FROM skills
   WHERE effect_desc IS NOT NULL AND effect_desc != ''`
).all();

console.log('=== 技能標籤化腳本 (v2: 14 tags) ===');
console.log(`掃描 ${skills.length} 筆有效技能...\n`);

const updateStmt = db.prepare('UPDATE skills SET tags = ? WHERE id = ?');
let taggedCount = 0;
const tagCounts = {};

db.exec('BEGIN');
for (const skill of skills) {
  const text = skill.effect_desc;
  const tags = TAG_RULES.filter(rule => rule.test(text)).map(rule => ({ tag: rule.tag }));

  // 先制標籤：走 DB 欄位
  if (skill.priority > 0) {
    tags.push({ tag: '先制' });
  }

  if (tags.length > 0) {
    updateStmt.run(JSON.stringify(tags), skill.id);
    taggedCount++;
    for (const t of tags) {
      tagCounts[t.tag] = (tagCounts[t.tag] || 0) + 1;
    }
  }
}
db.exec('COMMIT');

console.log(`\n=== 完成 ===`);
console.log(`已標籤：${taggedCount} / ${skills.length}`);

// 按色系分組顯示
const groups = {
  '🔴 攻擊': ['固傷', '吸血', '多段', '穿透'],
  '🔵 防禦': ['回血', '護盾', '獅盔'],
  '🟣 控制': ['控場', 'PP干擾', '先制'],
  '⚪ 消除': ['消強', '消弱', '自我強化', '對手弱化'],
};
for (const [group, tags] of Object.entries(groups)) {
  const items = tags.map(t => `${t}: ${tagCounts[t] || 0}`).join(' / ');
  console.log(`  ${group} — ${items}`);
}

db.close();
