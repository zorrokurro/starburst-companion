import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { s2t } from './s2t.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const DATA_PATH = join(__dirname, '..', 'bwiki_data', 'engravings_raw.json');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Build cn_id → sprites.id lookup
const spriteMap = new Map();
db.prepare('SELECT id, cn_id FROM sprites').all().forEach(r => {
  spriteMap.set(String(r.cn_id), r.id);
});
console.log(`Sprite lookup: ${spriteMap.size} entries`);

// Read BWIKI data
const raw = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
const parsed = raw.filter(r => r.fields);
console.log(`BWIKI engravings: ${parsed.length} parsed entries`);

// Clear existing
db.exec('DELETE FROM engravings');
console.log('Cleared existing engravings');

const int = (v) => {
  const n = parseInt(v);
  return isNaN(n) ? null : n;
};

const insert = db.prepare(`
  INSERT INTO engravings (
    id, name, type, description, series_name, rarity,
    max_equip_level, max_hold_count,
    base_atk, base_def, base_spatk, base_spdef, base_speed, base_hp,
    hidden_atk, hidden_def, hidden_spatk, hidden_spdef, hidden_speed, hidden_hp,
    has_hidden_attr, exclusive_sprite_id, exclusive_skill, angle_count
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?
  )
`);

let ok = 0, noSprite = 0;
const insertMany = db.transaction((entries) => {
  for (const entry of entries) {
    const f = entry.fields;
    const id = int(f['ID']);
    if (!id) continue;

    const name = s2t(f['名称'] || '');
    const type = s2t(f['类型'] || '');
    const description = s2t(f['描述'] || '');
    const seriesName = s2t(f['系列名称'] || '') || null;
    const rarity = s2t(f['稀有度'] || '') || null;
    const maxEquipLevel = int(f['最大装备等级']);
    const maxHoldCount = int(f['最大持有数量']);

    const baseAtk = int(f['初始攻击']);
    const baseDef = int(f['初始防御']);
    const baseSpatk = int(f['初始特攻']);
    const baseSpdef = int(f['初始特防']);
    const baseSpeed = int(f['初始速度']);
    const baseHp = int(f['初始体力']);

    const hiddenAtk = int(f['隐藏攻击']);
    const hiddenDef = int(f['隐藏防御']);
    const hiddenSpatk = int(f['隐藏特攻']);
    const hiddenSpdef = int(f['隐藏特防']);
    const hiddenSpeed = int(f['隐藏速度']);
    const hiddenHp = int(f['隐藏体力']);

    const hasHiddenAttr = f['是否有隐藏属性'] === '1' ? 1 : 0;

    // exclusive精灵: map cn_id → sprites.id
    let exclusiveSpriteId = null;
    if (f['是否有专属精灵'] === '1' && f['专属精灵']) {
      const cnId = String(f['专属精灵']).trim();
      exclusiveSpriteId = spriteMap.get(cnId) || null;
      if (!exclusiveSpriteId && cnId) noSprite++;
    }

    const exclusiveSkill = f['专属技能'] || null;
    const angleCount = int(f['角数']);

    insert.run(
      id, name, type, description, seriesName, rarity,
      maxEquipLevel, maxHoldCount,
      baseAtk, baseDef, baseSpatk, baseSpdef, baseSpeed, baseHp,
      hiddenAtk, hiddenDef, hiddenSpatk, hiddenSpdef, hiddenSpeed, hiddenHp,
      hasHiddenAttr, exclusiveSpriteId, exclusiveSkill, angleCount
    );
    ok++;
  }
});

insertMany(parsed);

console.log(`\nImported: ${ok} engravings`);
console.log(`No sprite match (exclusive): ${noSprite}`);

// Verify
const count = db.prepare('SELECT COUNT(*) as c FROM engravings').get().c;
console.log(`\nFinal engravings count: ${count}`);

// Field fill rates
const fields = [
  'name', 'type', 'description', 'series_name', 'rarity',
  'max_equip_level', 'max_hold_count',
  'base_atk', 'base_def', 'base_spatk', 'base_spdef', 'base_speed', 'base_hp',
  'hidden_atk', 'hidden_def', 'hidden_spatk', 'hidden_spdef', 'hidden_speed', 'hidden_hp',
  'has_hidden_attr', 'exclusive_sprite_id', 'exclusive_skill', 'angle_count'
];
console.log('\nField fill rates:');
for (const field of fields) {
  const filled = db.prepare(`SELECT COUNT(*) as c FROM engravings WHERE ${field} IS NOT NULL AND ${field} != '' AND ${field} != 0`).get().c;
  const pct = ((filled / count) * 100).toFixed(1);
  console.log(`  ${field}: ${filled}/${count} (${pct}%)`);
}

// Type distribution
console.log('\nType distribution:');
db.prepare('SELECT type, COUNT(*) as c FROM engravings GROUP BY type ORDER BY c DESC').all()
  .forEach(r => console.log(`  ${r.type}: ${r.c}`));

// Sample
console.log('\n--- 3 samples ---');
db.prepare('SELECT * FROM engravings LIMIT 3').all()
  .forEach(r => console.log(`  id=${r.id} name="${r.name}" type="${r.type}" base_hp=${r.base_hp} exclusive_sprite_id=${r.exclusive_sprite_id}`));

db.close();
