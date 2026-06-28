import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { s2t, convertType } from './s2t.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const DATA_DIR = join(__dirname, '..', 'seerh5_data');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Load data files ──
console.log('Loading seerh5 data files...');
const monstersRaw = JSON.parse(readFileSync(join(DATA_DIR, 'monsters.json'), 'utf-8'));
const movesRaw = JSON.parse(readFileSync(join(DATA_DIR, 'moves.json'), 'utf-8'));
const skillTypesRaw = JSON.parse(readFileSync(join(DATA_DIR, 'skillTypes.json'), 'utf-8'));
const effectDesRaw = JSON.parse(readFileSync(join(DATA_DIR, 'effectDes.json'), 'utf-8'));

const monsters = monstersRaw.Monsters.Monster;
const moves = movesRaw.MovesTbl.Moves.Move;
const sideEffects = movesRaw.MovesTbl.SideEffects.SideEffect;
const skillTypes = skillTypesRaw.root.item;
const effectDes = effectDesRaw.root.item;

console.log(`  Monsters: ${monsters.length}`);
console.log(`  Moves: ${moves.length}`);
console.log(`  SkillTypes: ${skillTypes.length}`);
console.log(`  EffectDes: ${effectDes.length}`);
console.log(`  SideEffects: ${sideEffects.length}`);

// ── Build type lookup ──
// type ID → { cn, en, type1, type2 }
const typeLookup = {};
for (const st of skillTypes) {
  const parts = st.cn.split(' ');
  typeLookup[st.id] = {
    cn: st.cn,
    en: st.en,
    type1: parts[0] || null,
    type2: parts[1] || null,
  };
}

// ── Build skill lookup (by ID) ──
const moveLookup = {};
for (const m of moves) {
  moveLookup[m.ID] = m;
}

// ── Build side effect lookup ──
const sideEffectLookup = {};
for (const se of sideEffects) {
  sideEffectLookup[se.ID] = se;
}

// ── Build effect description lookup (by monster ID) ──
const effectDesByMonster = {};
for (const ed of effectDes) {
  if (ed.monster) {
    if (!effectDesByMonster[ed.monster]) effectDesByMonster[ed.monster] = [];
    effectDesByMonster[ed.monster].push(ed);
  }
}

// ── Category mapping ──
// seerh5: 1=物攻, 2=特攻, 3=屬攻 (attribute-enhancing)
const CATEGORY_MAP = { '1': '物理', '2': '特殊', '3': '属性' };

// ── Prepare statements ──
const insertSprite = db.prepare(`
  INSERT OR REPLACE INTO sprites (cn_id, name_zh, types, base_hp, base_atk, base_def, base_spatk, base_spdef, base_speed,
    gender, evolves_from, evolves_to, evolve_level)
  VALUES (@cn_id, @name_zh, @types, @base_hp, @base_atk, @base_def, @base_spatk, @base_spdef, @base_speed,
    @gender, @evolves_from, @evolves_to, @evolve_level)
`);

const insertSkill = db.prepare(`
  INSERT OR IGNORE INTO skills (name, power, accuracy, pp, category, type, effect_desc)
  VALUES (@name, @power, @accuracy, @pp, @category, @type, @effect_desc)
`);

const insertSpriteSkill = db.prepare(`
  INSERT OR IGNORE INTO sprite_skills (sprite_id, skill_id, is_signature)
  VALUES (@sprite_id, @skill_id, @is_signature)
`);

const insertSoulSeal = db.prepare(`
  INSERT INTO soul_seals (sprite_id, effect_desc, name_zh_tw)
  VALUES (@sprite_id, @effect_desc, @name_zh_tw)
`);

const getSpriteId = db.prepare('SELECT id FROM sprites WHERE cn_id = ?');
const getSkillIdByName = db.prepare('SELECT id FROM skills WHERE name = ? AND type = ?');
const getSkillIdByPower = db.prepare('SELECT id FROM skills WHERE name = ? AND power = ? AND type = ?');

// ── Gender mapping ──
const GENDER_MAP = { '0': null, '1': '♂', '2': '♀', '3': '♂♀' };

// ── Import transaction �─
const importTransaction = db.transaction(() => {
  // Clear existing data
  db.exec('DELETE FROM sprite_skills');
  db.exec('DELETE FROM soul_seals');
  db.exec('DELETE FROM skills');
  db.exec('DELETE FROM sprites');

  let spriteCount = 0;
  let skillCount = 0;
  let spriteSkillCount = 0;
  let skippedNoStats = 0;

  // ── Import sprites ──
  console.log('\nImporting sprites...');
  for (const m of monsters) {
    const cnId = m.ID;
    const nameZh = s2t(m.DefName);

    // Decode type
    const typeInfo = typeLookup[m.Type];
    let types = [];
    if (typeInfo) {
      types = [convertType(typeInfo.type1)];
      if (typeInfo.type2) types.push(convertType(typeInfo.type2));
    }

    // Stats - skip if no HP (entry has no stats)
    const hp = parseInt(m.HP) || null;
    if (!hp) {
      skippedNoStats++;
      continue;
    }

    const gender = GENDER_MAP[m.Gender] || null;

    // Evolution chain
    const evolvesFrom = m.EvolvesFrom && m.EvolvesFrom !== '0' ? m.EvolvesFrom : null;
    const evolvesTo = m.EvolvesTo && m.EvolvesTo !== '0' ? m.EvolvesTo : null;
    const evolveLevel = m.EvolvingLv && m.EvolvingLv !== '0' ? parseInt(m.EvolvingLv) : null;

    insertSprite.run({
      cn_id: cnId,
      name_zh: nameZh,
      types: JSON.stringify(types),
      base_hp: hp,
      base_atk: parseInt(m.Atk) || null,
      base_def: parseInt(m.Def) || null,
      base_spatk: parseInt(m.SpAtk) || null,
      base_spdef: parseInt(m.SpDef) || null,
      base_speed: parseInt(m.Spd) || null,
      gender: gender,
      evolves_from: evolvesFrom,
      evolves_to: evolvesTo,
      evolve_level: evolveLevel,
    });

    spriteCount++;

    // Map learnable moves → sprite_skills
    if (m.LearnableMoves?.Move) {
      const movesList = Array.isArray(m.LearnableMoves.Move)
        ? m.LearnableMoves.Move
        : [m.LearnableMoves.Move];

      const spriteRow = getSpriteId.get(cnId);
      if (!spriteRow) continue;

      for (const lm of movesList) {
        const moveData = moveLookup[lm.ID];
        if (!moveData) continue;

        const skillName = s2t(moveData.Name);
        const skillType = convertType(typeLookup[moveData.Type]?.type1);
        const category = CATEGORY_MAP[moveData.Category] || null;
        const power = parseInt(moveData.Power) || null;
        const accuracy = parseInt(moveData.Accuracy) || null;
        const pp = parseInt(moveData.MaxPP) || null;

        // Build effect description from side effect
        let effectDesc = null;
        if (moveData.SideEffect && sideEffectLookup[moveData.SideEffect]) {
          effectDesc = s2t(sideEffectLookup[moveData.SideEffect].des);
        }

        insertSkill.run({
          name: skillName,
          power: power,
          accuracy: accuracy,
          pp: pp,
          category: category,
          type: skillType,
          effect_desc: effectDesc,
        });

        // Get skill ID - try by name+type first, then by name+power+type
        let skillRow = getSkillIdByName.get(skillName, skillType);
        if (!skillRow && power !== null) {
          skillRow = getSkillIdByPower.get(skillName, power, skillType);
        }
        if (!skillRow) continue;

        insertSpriteSkill.run({
          sprite_id: spriteRow.id,
          skill_id: skillRow.id,
          is_signature: 0,
        });
        spriteSkillCount++;
      }
    }

    if (spriteCount % 500 === 0) console.log(`  ...${spriteCount} sprites imported`);
  }

  // Count unique skills
  const skillRow = db.prepare('SELECT COUNT(*) as cnt FROM skills').get();
  skillCount = skillRow.cnt;

  // ── Import soul seals from effectDes (kind=1) ──
  let soulSealCount = 0;
  let soulSealSkipped = 0;
  for (const ed of effectDes) {
    if (ed.kind != 1) continue;
    if (!ed.monster) { soulSealSkipped++; continue; }

    const monsterIds = typeof ed.monster === 'string'
      ? ed.monster.split(',').map(s => s.trim())
      : [String(ed.monster)];

    for (const cnId of monsterIds) {
      const spriteRow = getSpriteId.get(cnId);
      if (!spriteRow) { soulSealSkipped++; continue; }

      insertSoulSeal.run({
        sprite_id: spriteRow.id,
        effect_desc: s2t(ed.desc),
        name_zh_tw: s2t(ed.kinddes),
      });
      soulSealCount++;
    }
  }

  return { spriteCount, skillCount, spriteSkillCount, skippedNoStats, soulSealCount, soulSealSkipped };
});

console.log('\nStarting import transaction...');
const result = importTransaction();

console.log(`\n═══ Import Complete ═══`);
console.log(`Sprites:        ${result.spriteCount}`);
console.log(`Skills:         ${result.skillCount}`);
console.log(`Sprite-Skills:  ${result.spriteSkillCount}`);
console.log(`Skipped (no stats): ${result.skippedNoStats}`);
console.log(`Soul Seals:     ${result.soulSealCount} (skipped: ${result.soulSealSkipped})`);

// Verify types are populated
const typeStats = db.prepare(`
  SELECT types, COUNT(*) as cnt FROM sprites WHERE types IS NOT NULL GROUP BY types ORDER BY cnt DESC LIMIT 10
`).all();
console.log('\nTop type combinations:');
typeStats.forEach(r => console.log(`  ${r.types}: ${r.cnt}`));

db.close();
console.log('\nDone.');
