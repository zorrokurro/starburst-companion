import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { s2t } from './s2t.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const DATA_DIR = join(__dirname, '..', 'seerh5_data');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const advanceRaw = JSON.parse(readFileSync(join(DATA_DIR, 'pet_advance.json'), 'utf-8'));
const tasks = advanceRaw.root.Task;

const getSpriteName = db.prepare('SELECT name_zh FROM sprites WHERE cn_id = ?');

const insert = db.prepare(`
  INSERT OR REPLACE INTO pet_advances
  (id, monster_id, monster_name, old_race_hp, old_race_atk, old_race_def, old_race_spatk, old_race_spdef, old_race_speed,
   new_race_hp, new_race_atk, new_race_def, new_race_spatk, new_race_spdef, new_race_speed,
   old_se_id, new_se_id, sp_moves, extra_moves, adv_effect_id, adv_effect_desc, desc)
  VALUES (@id, @monster_id, @monster_name, @old_race_hp, @old_race_atk, @old_race_def, @old_race_spatk, @old_race_spdef, @old_race_speed,
   @new_race_hp, @new_race_atk, @new_race_def, @new_race_spatk, @new_race_spdef, @new_race_speed,
   @old_se_id, @new_se_id, @sp_moves, @extra_moves, @adv_effect_id, @adv_effect_desc, @desc)
`);

const insertTransaction = db.transaction(() => {
  db.exec('DELETE FROM pet_advances');
  let count = 0;

  for (const t of tasks) {
    const a = t.Advances;
    const monsterId = String(a.MonsterId);

    // Parse race stats (space-separated: HP Atk Def SpAtk SpDef Speed)
    const oldRace = (a.Race?.OldRace || '').split(' ').map(Number);
    const newRace = (a.Race?.NewRace || '').split(' ').map(Number);

    // Get monster name
    const row = getSpriteName.get(monsterId);
    const monsterName = row ? row.name_zh : null;

    // Clean effect description (remove HTML tags)
    let effectDesc = a.AdvEffect?.Des || null;
    if (effectDesc) {
      effectDesc = effectDesc.replace(/<[^>]+>/g, '');
      effectDesc = s2t(effectDesc);
    }

    insert.run({
      id: t.ID,
      monster_id: monsterId,
      monster_name: monsterName,
      old_race_hp: oldRace[0] || null, old_race_atk: oldRace[1] || null, old_race_def: oldRace[2] || null,
      old_race_spatk: oldRace[3] || null, old_race_spdef: oldRace[4] || null, old_race_speed: oldRace[5] || null,
      new_race_hp: newRace[0] || null, new_race_atk: newRace[1] || null, new_race_def: newRace[2] || null,
      new_race_spatk: newRace[3] || null, new_race_spdef: newRace[4] || null, new_race_speed: newRace[5] || null,
      old_se_id: a.NewSe?.OldSeId || null, new_se_id: a.NewSe?.NewSeId || null,
      sp_moves: a.spMove?.SpMoves || null,
      extra_moves: a.exMove?.ExtraMoves ? String(a.exMove.ExtraMoves) : null,
      adv_effect_id: a.AdvEffect?.Id || null,
      adv_effect_desc: effectDesc,
      desc: s2t(t.Desc || ''),
    });
    count++;
  }
  return count;
});

const count = insertTransaction();
console.log(`Imported ${count} pet advancement tasks`);

// Show summary
const rows = db.prepare('SELECT id, monster_id, monster_name, desc FROM pet_advances').all();
rows.forEach(r => console.log(`  #${r.id} ${r.monster_name || r.monster_id} - ${r.desc}`));

db.close();
