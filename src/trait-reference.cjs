#!/usr/bin/env node
/**
 * 魂印增傷對照表
 *
 * 輸出所有影響傷害的通用特性（魂印），按類別分組，
 * 顯示 0★~5★ 的增傷/減傷數值。
 *
 * 用法：node src/trait-reference.cjs
 */
const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync('db/seer.db');

const DAMAGE_TRAITS = db.prepare(`
  SELECT id, name, category, element_type, custom_values, description_template
  FROM generic_traits
  WHERE category IN ('屬性增傷', '攻擊增傷', '固傷複合')
     OR name = '坚硬'
  ORDER BY
    CASE category
      WHEN '屬性增傷' THEN 1
      WHEN '攻擊增傷' THEN 2
      WHEN '固傷複合' THEN 3
      WHEN '面板機率' THEN 4
      ELSE 5
    END,
    id
`).all();

const GROUPS = {
  '屬性增傷': { label: '屬性增傷（按屬性匹配）', desc: '技能屬性與 element_type 一致時觸發' },
  '攻擊增傷': { label: '攻擊增傷（按物攻/特攻匹配）', desc: '強襲=物攻技能, 精神=特攻技能' },
  '固傷複合': { label: '固傷複合（追加固定傷害）', desc: '攻擊時額外附加固定傷害' },
  '面板機率': { label: '面板機率（堅硬減傷）', desc: '受到攻擊時觸發減傷' },
};

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║              魂印增傷對照表（通用特性）                      ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let currentGroup = null;
for (const trait of DAMAGE_TRAITS) {
  if (trait.category !== currentGroup) {
    currentGroup = trait.category;
    const g = GROUPS[currentGroup] || { label: currentGroup, desc: '' };
    console.log(`── ${g.label} ──`);
    if (g.desc) console.log(`   ${g.desc}`);
    console.log('');
  }

  const values = JSON.parse(trait.custom_values || '[]');
  const stars = values.map((v, i) => v !== null ? `${v}%` : '—').join('  ');
  const element = trait.element_type ? ` [${trait.element_type}]` : '';
  console.log(`  ${trait.name}${element.padEnd(6)}  ${stars}`);
}

console.log('\n── 說明 ──');
console.log('  星等：0★   1★   2★   3★   4★   5★');
console.log('  屬性增傷：魂印精靈屬性 = 技能屬性時，技能威力 +X%');
console.log('  攻擊增傷：強襲 = 物攻技能威力 +X%, 精神 = 特攻技能威力 +X%');
console.log('  固傷複合：攻擊時追加 X 點固定傷害');
console.log('  堅硬：受到攻擊時傷害 -X%\n');

db.close();
