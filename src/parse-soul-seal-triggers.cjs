const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync('db/seer.db');

// Keyword mapping: ordered longest-first to avoid partial matches
const TRIGGER_RULES = [
  // Turn start
  { pattern: /回合開始時/g, condition: 'turn_start' },
  { pattern: /每回合開始/g, condition: 'turn_start' },
  { pattern: /每回合有/g, condition: 'turn_start' },
  { pattern: /每回合攻擊/g, condition: 'turn_start' },
  { pattern: /每回合/g, condition: 'turn_start' },

  // Turn end
  { pattern: /戰鬥階段結束時/g, condition: 'turn_end' },
  { pattern: /回合結束後/g, condition: 'turn_end' },
  { pattern: /回合結束時/g, condition: 'turn_end' },
  { pattern: /每個戰鬥階段結束時/g, condition: 'turn_end' },
  { pattern: /每次戰鬥階段結束時/g, condition: 'turn_end' },

  // On switch in
  { pattern: /登場時/g, condition: 'on_switch_in' },
  { pattern: /上場時/g, condition: 'on_switch_in' },
  { pattern: /替換出場時/g, condition: 'on_switch_in' },
  { pattern: /首次登場/g, condition: 'on_switch_in' },
  { pattern: /首次上場/g, condition: 'on_switch_in' },
  { pattern: /每次登場/g, condition: 'on_switch_in' },

  // After attack
  { pattern: /使用攻擊技能後/g, condition: 'after_attack' },
  { pattern: /攻擊命中後/g, condition: 'after_attack' },
  { pattern: /攻擊技能命中後/g, condition: 'after_attack' },
  { pattern: /使用攻擊技能則/g, condition: 'after_attack' },
  { pattern: /使用攻擊技能時/g, condition: 'after_attack' },
  { pattern: /每次使用攻擊技能/g, condition: 'after_attack' },
  { pattern: /連續使用攻擊技能/g, condition: 'after_attack' },
  { pattern: /攻擊時/g, condition: 'after_attack' },
  { pattern: /自身使用攻擊技能/g, condition: 'after_attack' },
  { pattern: /若我方使用攻擊技能/g, condition: 'after_attack' },
  { pattern: /本場戰鬥中首次使用攻擊技能/g, condition: 'after_attack' },
  { pattern: /使用攻擊技能/g, condition: 'after_attack' },
  { pattern: /每次造成傷害/g, condition: 'after_attack' },
  { pattern: /攻擊技能命中/g, condition: 'after_attack' },

  // After skill (属性技能)
  { pattern: /使用技能後/g, condition: 'after_skill' },
  { pattern: /使用屬性技能後/g, condition: 'after_skill' },
  { pattern: /使用屬性技能則/g, condition: 'after_skill' },
  { pattern: /使用屬性技能時/g, condition: 'after_skill' },
  { pattern: /使用技能則/g, condition: 'after_skill' },
  { pattern: /使用技能時/g, condition: 'after_skill' },
  { pattern: /自身使用技能時/g, condition: 'after_skill' },
  { pattern: /自身使用屬性技能時/g, condition: 'after_skill' },
  { pattern: /若我方使用屬性技能/g, condition: 'after_skill' },
  { pattern: /屬性技能命中/g, condition: 'after_skill' },

  // On hit (受到攻擊)
  { pattern: /受到攻擊時/g, condition: 'on_hit' },
  { pattern: /受到攻擊後/g, condition: 'on_hit' },
  { pattern: /受到攻擊傷害時/g, condition: 'on_hit' },
  { pattern: /對手使用攻擊技能時/g, condition: 'on_hit' },
  { pattern: /當回合受到的攻擊傷害/g, condition: 'on_hit' },
  { pattern: /滿體力時受到攻擊/g, condition: 'on_hit' },
  { pattern: /先出手時/g, condition: 'on_hit' },
  { pattern: /後出手時/g, condition: 'on_hit' },

  // On damage (造成傷害)
  { pattern: /造成傷害時/g, condition: 'on_damage' },
  { pattern: /造成攻擊傷害後/g, condition: 'on_damage' },
  { pattern: /造成的攻擊傷害/g, condition: 'on_damage' },
  { pattern: /自身造成的攻擊傷害/g, condition: 'on_damage' },

  // On defeat
  { pattern: /被擊敗時/g, condition: 'on_defeat' },
  { pattern: /擊敗對手時/g, condition: 'on_defeat' },
  { pattern: /當回合未擊敗對手時/g, condition: 'on_defeat' },
  { pattern: /死亡時/g, condition: 'on_defeat' },

  // On heal
  { pattern: /恢復體力時/g, condition: 'on_heal' },

  // On status
  { pattern: /處於異常狀態時/g, condition: 'on_status' },
  { pattern: /處於異常狀態下/g, condition: 'on_status' },

  // Additional patterns
  { pattern: /技能命中後/g, condition: 'after_attack' },
  { pattern: /先出手/g, condition: 'after_attack' },
  { pattern: /先手時/g, condition: 'after_attack' },
  { pattern: /每次受到攻擊/g, condition: 'on_hit' },
  { pattern: /受到攻擊的/g, condition: 'on_hit' },
  { pattern: /對手技能命中後/g, condition: 'on_hit' },
  { pattern: /使對手攻擊落空/g, condition: 'on_hit' },
  { pattern: /使對手攻擊miss/g, condition: 'on_hit' },
  { pattern: /攻擊未擊敗/g, condition: 'after_attack' },
  { pattern: /登場.*回合內/g, condition: 'on_switch_in' },
  { pattern: /秒殺對手/g, condition: 'after_attack' },
];

function parseTriggerConditions(effectDesc) {
  if (!effectDesc) return [];
  const found = new Set();
  for (const rule of TRIGGER_RULES) {
    if (rule.pattern.test(effectDesc)) {
      found.add(rule.condition);
    }
    rule.pattern.lastIndex = 0; // reset regex state
  }
  return [...found];
}

// Main execution
const rows = db.prepare("SELECT id, effect_desc FROM soul_seals WHERE effect_desc IS NOT NULL AND effect_desc != ''").all();
let updated = 0;
let noMatch = 0;
const examples = {};

for (const row of rows) {
  const triggers = parseTriggerConditions(row.effect_desc);
  if (triggers.length > 0) {
    const triggerStr = JSON.stringify(triggers);
    db.prepare("UPDATE soul_seals SET trigger_condition = ? WHERE id = ?").run(triggerStr, row.id);
    updated++;
    // Store one example per unique trigger combo
    const key = triggerStr;
    if (!examples[key]) {
      examples[key] = { id: row.id, desc: row.effect_desc.substring(0, 120), triggers };
    }
  } else {
    // Mark remaining as passive (always-on or conditional effects)
    db.prepare("UPDATE soul_seals SET trigger_condition = ? WHERE id = ?").run(JSON.stringify(['passive']), row.id);
    noMatch++;
  }
}

console.log(`Updated: ${updated}/${rows.length} soul seals`);
console.log(`No match: ${noMatch}`);

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
