import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { s2t } from './s2t.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const DATA_PATH = join(__dirname, '..', 'bwiki_data', 'soul_seals_raw.json');
const EFFECT_DES_PATH = join(__dirname, '..', 'seerh5_data', 'effectDes.json');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Build cn_id → sprites.id lookup
const spriteMap = new Map();
db.prepare('SELECT id, cn_id FROM sprites').all().forEach(r => {
  spriteMap.set(String(r.cn_id), r.id);
});
console.log(`Sprite lookup: ${spriteMap.size} entries`);

// Build soul seal name lookup from seerh5 effectDes (kind=1 entries have kinddes = soul seal name)
const soulSealNameMap = new Map(); // effectId → name
if (existsSync(EFFECT_DES_PATH)) {
  const effectDesRaw = JSON.parse(readFileSync(EFFECT_DES_PATH, 'utf-8'));
  const effectDes = effectDesRaw.root?.item || [];
  for (const ed of effectDes) {
    if (ed.kind == 1 && ed.monster && ed.kinddes) {
      const monsterIds = typeof ed.monster === 'string'
        ? ed.monster.split(',').map(s => s.trim())
        : [String(ed.monster)];
      for (const cnId of monsterIds) {
        soulSealNameMap.set(cnId, s2t(ed.kinddes));
      }
    }
  }
  console.log(`Soul seal name lookup: ${soulSealNameMap.size} entries`);
} else {
  console.log('Warning: effectDes.json not found, soul seal names will be null');
}

// Read BWIKI data
const raw = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
const parsed = raw.filter(r => r.fields);
console.log(`BWIKI soul seals: ${parsed.length} parsed entries`);

// Clear existing
db.exec('DELETE FROM soul_seals');
console.log('Cleared existing soul_seals');

// Insert
const insert = db.prepare(`
  INSERT INTO soul_seals (sprite_id, effect_desc, name_zh_tw, kind)
  VALUES (?, ?, ?, ?)
`);

let ok = 0, noSprite = 0, empty = 0;
const insertMany = db.transaction((entries) => {
  for (const entry of entries) {
    const f = entry.fields;
    const cnId = String(f['相关精灵'] || '').trim();
    const spriteId = spriteMap.get(cnId) || null;
    const effectDesc = s2t(f['魂印效果'] || '');
    const nameZhTw = soulSealNameMap.get(cnId) || null;
    const kind = (f['kind'] || '').trim();

    if (!spriteId) {
      noSprite++;
      continue;
    }
    if (!effectDesc) {
      empty++;
      continue;
    }

    insert.run(spriteId, effectDesc, nameZhTw, kind);
    ok++;
  }
});

insertMany(parsed);

console.log(`\nImported: ${ok} soul_seals`);
console.log(`No sprite match: ${noSprite}`);
console.log(`Empty effect: ${empty}`);

// Verify
const count = db.prepare('SELECT COUNT(*) as c FROM soul_seals').get().c;
console.log(`\nFinal soul_seals count: ${count}`);

// Field fill rates
const withKind = db.prepare("SELECT COUNT(*) as c FROM soul_seals WHERE kind IS NOT NULL AND kind != ''").get().c;
const withEffect = db.prepare("SELECT COUNT(*) as c FROM soul_seals WHERE effect_desc IS NOT NULL AND effect_desc != ''").get().c;
const withName = db.prepare("SELECT COUNT(*) as c FROM soul_seals WHERE name_zh_tw IS NOT NULL AND name_zh_tw != ''").get().c;
console.log(`effect_desc filled: ${withEffect}/${count}`);
console.log(`name_zh_tw filled: ${withName}/${count}`);
console.log(`kind filled: ${withKind}/${count}`);

// Sample
console.log('\n--- 3 samples ---');
db.prepare('SELECT ss.*, s.cn_id FROM soul_seals ss JOIN sprites s ON s.id = ss.sprite_id LIMIT 3').all()
  .forEach(r => console.log(`  sprite_id=${r.sprite_id} cn_id=${r.cn_id} kind="${r.kind}" effect=${r.effect_desc.substring(0, 80)}`));

db.close();
