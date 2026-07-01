import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { s2t } from './s2t.js';
import { parseSoulSeal } from './soul-seal-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const DATA_PATH = join(__dirname, '..', 'bwiki_data', 'soul_seals_raw.json');
const EFFECT_DES_PATH = join(__dirname, '..', 'seerh5_data', 'effectDes.json');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Build lookup maps ──

// 1. sprite cn_id → sprites.id
const spriteMap = new Map();
db.prepare('SELECT id, cn_id FROM sprites').all().forEach(r => {
  spriteMap.set(String(r.cn_id), r.id);
});
console.log(`Sprite lookup: ${spriteMap.size} entries`);

// 2. effectDes: effect_id → soul seal name (kind=1 entries only)
//    Key fix: map by EFFECT ID, not monster ID
const effectDesNameMap = new Map(); // effectId → name
const effectDesDescMap = new Map(); // effectId → desc (for fallback)
if (existsSync(EFFECT_DES_PATH)) {
  const effectDesRaw = JSON.parse(readFileSync(EFFECT_DES_PATH, 'utf-8'));
  const effectDes = effectDesRaw.root?.item || [];
  for (const ed of effectDes) {
    if (ed.kind == 1 && ed.id != null) {
      const name = s2t(ed.kinddes || '');
      const desc = s2t(ed.desc || '');
      if (name) effectDesNameMap.set(String(ed.id), name);
      if (desc) effectDesDescMap.set(String(ed.id), desc);
    }
  }
  console.log(`effectDes name lookup: ${effectDesNameMap.size} entries (by effect ID)`);
} else {
  console.log('Warning: effectDes.json not found, soul seal names will be null');
}

// ── Read BWIKI data ──
const raw = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
const parsed = raw.filter(r => r.fields);
console.log(`BWIKI soul seals: ${parsed.length} parsed entries`);

// ── Clear and re-import in transaction ──
db.exec('DELETE FROM soul_seals');
console.log('Cleared existing soul_seals');

const insert = db.prepare(`
  INSERT INTO soul_seals (
    sprite_id, effect_desc, name_zh_tw, kind,
    trigger_condition, effect_raw, effect_semantic,
    tags, confidence, source
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let ok = 0, noSprite = 0, empty = 0, noEffectId = 0;

const insertMany = db.transaction((entries) => {
  for (const entry of entries) {
    const f = entry.fields;

    // Sprite lookup
    const cnId = String(f['相关精灵'] || '').trim();
    const spriteId = spriteMap.get(cnId) || null;
    if (!spriteId) { noSprite++; continue; }

    // Effect text
    const effectRaw = s2t(f['魂印效果'] || '');
    if (!effectRaw) { empty++; continue; }

    // Name lookup: use 效果IDs to find effectDes kinddes
    const effectIdStr = String(f['效果IDs'] || '').trim();
    let nameZhTw = null;
    if (effectIdStr) {
      // 效果IDs can be comma-separated or space-separated
      const effectIds = effectIdStr.split(/[\s,]+/).filter(Boolean);
      for (const eid of effectIds) {
        const name = effectDesNameMap.get(eid);
        if (name) { nameZhTw = name; break; }
      }
    }
    if (!nameZhTw) noEffectId++;

    // Kind
    const kind = (f['kind'] || '').trim() || null;

    // Semantic parsing
    const semantic = parseSoulSeal(effectRaw);

    // Build effect_semantic JSON
    const effectSemantic = JSON.stringify({
      effectType: semantic.effectType,
    });

    // Trigger condition JSON (向下相容)
    const triggerCondition = JSON.stringify(semantic.triggers);

    // Tags JSON
    const tags = JSON.stringify(semantic.tags);

    insert.run(
      spriteId,
      effectRaw,         // effect_desc (向下相容)
      nameZhTw,          // name_zh_tw (fixed: now from effectDes by effect ID)
      kind,
      triggerCondition,  // trigger_condition
      effectRaw,         // effect_raw (原始文字)
      effectSemantic,    // effect_semantic (結構化)
      tags,              // tags
      semantic.confidence, // confidence
      'bwiki'            // source
    );
    ok++;
  }
});

insertMany(parsed);

console.log(`\nImported: ${ok} soul_seals`);
console.log(`No sprite match: ${noSprite}`);
console.log(`Empty effect: ${empty}`);
console.log(`No effectDes name found: ${noEffectId}`);

// ── Verify ──
const count = db.prepare('SELECT COUNT(*) as c FROM soul_seals').get().c;
console.log(`\nFinal soul_seals count: ${count}`);

const withEffect = db.prepare("SELECT COUNT(*) as c FROM soul_seals WHERE effect_desc IS NOT NULL AND effect_desc != ''").get().c;
const withName = db.prepare("SELECT COUNT(*) as c FROM soul_seals WHERE name_zh_tw IS NOT NULL AND name_zh_tw != ''").get().c;
const withKind = db.prepare("SELECT COUNT(*) as c FROM soul_seals WHERE kind IS NOT NULL AND kind != ''").get().c;
const withTags = db.prepare("SELECT COUNT(*) as c FROM soul_seals WHERE tags IS NOT NULL AND tags != '[]'").get().c;
const withTriggers = db.prepare("SELECT COUNT(*) as c FROM soul_seals WHERE trigger_condition IS NOT NULL AND trigger_condition != '[]'").get().c;
const withSemantic = db.prepare("SELECT COUNT(*) as c FROM soul_seals WHERE effect_semantic IS NOT NULL").get().c;
console.log(`effect_desc filled: ${withEffect}/${count}`);
console.log(`name_zh_tw filled: ${withName}/${count}`);
console.log(`kind filled: ${withKind}/${count}`);
console.log(`tags filled: ${withTags}/${count}`);
console.log(`trigger_condition filled: ${withTriggers}/${count}`);
console.log(`effect_semantic filled: ${withSemantic}/${count}`);

// ── Name correctness check ──
console.log('\n--- Name verification (should be short names, not long effects) ---');
db.prepare(`
  SELECT ss.name_zh_tw, ss.effect_desc, s.cn_id
  FROM soul_seals ss
  JOIN sprites s ON s.id = ss.sprite_id
  WHERE ss.name_zh_tw IS NOT NULL
  ORDER BY RANDOM() LIMIT 10
`).all().forEach(r => {
  const nameLen = r.name_zh_tw.length;
  const effectLen = (r.effect_desc || '').length;
  const tag = nameLen > 20 ? '⚠️ NAME TOO LONG (likely effect text)' : '✅';
  console.log(`  ${tag} cn_id=${r.cn_id} name="${r.name_zh_tw}" (${nameLen} chars) | effect=${(r.effect_desc || '').substring(0, 40)}...`);
});

// ── Sample ──
console.log('\n--- 5 samples with semantic data ---');
db.prepare(`
  SELECT ss.*, s.cn_id
  FROM soul_seals ss
  JOIN sprites s ON s.id = ss.sprite_id
  WHERE ss.effect_semantic IS NOT NULL
  ORDER BY RANDOM() LIMIT 5
`).all().forEach(r => {
  const sem = (() => { try { return JSON.parse(r.effect_semantic); } catch { return null; } })();
  const tags = (() => { try { return JSON.parse(r.tags); } catch { return []; } })();
  const triggers = (() => { try { return JSON.parse(r.trigger_condition); } catch { return []; } })();
  console.log(`  [${r.id}] cn_id=${r.cn_id} name="${r.name_zh_tw || 'null'}"`);
  console.log(`    type=${sem?.effectType || '?'} tags=[${tags.join(',')}] triggers=[${triggers.join(',')}] conf=${r.confidence}`);
  console.log(`    effect=${(r.effect_desc || '').substring(0, 80)}...`);
});

db.close();
