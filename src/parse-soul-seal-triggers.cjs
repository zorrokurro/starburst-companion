/**
 * Soul Seal Trigger Rebuilder
 * Now delegates to soul-seal-parser.js for consistent parsing.
 */
const sqlite = require('node:sqlite');
const { extractTriggers } = require('./soul-seal-parser.js');
const db = new sqlite.DatabaseSync('db/seer.db');

const rows = db.prepare("SELECT id, effect_desc FROM soul_seals WHERE effect_desc IS NOT NULL AND effect_desc != ''").all();
let updated = 0;
let noMatch = 0;
const examples = {};

for (const row of rows) {
  const triggers = extractTriggers(row.effect_desc);
  if (triggers.length > 0) {
    const triggerStr = JSON.stringify(triggers);
    db.prepare("UPDATE soul_seals SET trigger_condition = ? WHERE id = ?").run(triggerStr, row.id);
    updated++;
    const key = triggerStr;
    if (!examples[key]) {
      examples[key] = { id: row.id, desc: row.effect_desc.substring(0, 120), triggers };
    }
  } else {
    db.prepare("UPDATE soul_seals SET trigger_condition = ? WHERE id = ?").run(JSON.stringify(['passive']), row.id);
    noMatch++;
  }
}

console.log(`Updated: ${updated}/${rows.length} soul seals`);
console.log(`No match (passive): ${noMatch}`);

// Show unique trigger combinations
const combos = db.prepare("SELECT trigger_condition, COUNT(*) as cnt FROM soul_seals WHERE trigger_condition IS NOT NULL GROUP BY trigger_condition ORDER BY cnt DESC").all();
console.log(`\nUnique trigger combinations (${combos.length}):`);
combos.forEach(c => {
  const ex = examples[c.trigger_condition];
  console.log(`  ${c.cnt}x ${c.trigger_condition}`);
  if (ex) console.log(`    ex: [${ex.id}] ${ex.desc}...`);
});

// Verify
const verified = db.prepare("SELECT id, name_zh_tw, trigger_condition, effect_desc FROM soul_seals WHERE trigger_condition IS NOT NULL ORDER BY RANDOM() LIMIT 20").all();
console.log(`\n=== Random 20 verification ===`);
verified.forEach(v => {
  const desc = (v.effect_desc || '').substring(0, 100);
  console.log(`  [${v.id}] ${v.name_zh_tw || 'null'}`);
  console.log(`    triggers: ${v.trigger_condition}`);
  console.log(`    desc: ${desc}...`);
});

db.close();
