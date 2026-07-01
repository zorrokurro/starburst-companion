/**
 * Import Traits — Populate semantic fields on generic_traits
 *
 * Uses ability-classifier.js to classify existing traits.
 * Additive only: never deletes or modifies existing data.
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { classifyTrait } from './ability-classifier.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const traits = db.prepare('SELECT * FROM generic_traits ORDER BY id').all();
console.log(`Found ${traits.length} generic_traits`);

const update = db.prepare(`
  UPDATE generic_traits
  SET trigger_type = ?, effect_type = ?, target = ?, stat_modified = ?, confidence = ?
  WHERE id = ?
`);

let updated = 0;
const results = { byCategory: {}, byTrigger: {}, byEffect: {} };

const updateMany = db.transaction((list) => {
  for (const trait of list) {
    const semantic = classifyTrait(trait);

    update.run(
      semantic.trigger_type,
      semantic.effect_type,
      semantic.target,
      semantic.stat_modified,
      semantic.confidence,
      trait.id
    );

    updated++;

    // Stats
    const cat = trait.category;
    if (!results.byCategory[cat]) results.byCategory[cat] = 0;
    results.byCategory[cat]++;

    const trig = semantic.trigger_type;
    if (!results.byTrigger[trig]) results.byTrigger[trig] = 0;
    results.byTrigger[trig]++;

    const eff = semantic.effect_type;
    if (!results.byEffect[eff]) results.byEffect[eff] = 0;
    results.byEffect[eff]++;
  }
});

updateMany(traits);

console.log(`\nUpdated: ${updated}/${traits.length}`);

console.log('\n--- By Category ---');
Object.entries(results.byCategory).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

console.log('\n--- By Trigger Type ---');
Object.entries(results.byTrigger).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

console.log('\n--- By Effect Type ---');
Object.entries(results.byEffect).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// Verify
console.log('\n--- Verification (all traits) ---');
db.prepare('SELECT id, name, category, trigger_type, effect_type, target, stat_modified, confidence FROM generic_traits ORDER BY id').all()
  .forEach(t => {
    const stats = t.stat_modified ? JSON.parse(t.stat_modified) : null;
    console.log(`  [${t.id}] ${t.name} | cat=${t.category} | trig=${t.trigger_type} | eff=${t.effect_type} | tgt=${t.target} | stats=${stats} | conf=${t.confidence}`);
  });

db.close();
