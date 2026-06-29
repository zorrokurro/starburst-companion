const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync('db/seer.db');

// Add playstyle column if not exists
try {
  db.exec("ALTER TABLE sprites ADD COLUMN playstyle TEXT");
  console.log('Added playstyle column');
} catch (e) {
  console.log('playstyle column already exists');
}

// Classification thresholds
const THRESHOLDS = {
  atk_high: 120,      // Physical attacker
  spatk_high: 120,    // Special attacker
  def_spdef_sum: 240, // Tank
  speed_high: 110,    // Speedster
  skill_min: 2,       // Minimum skills of category needed
  tag_min: 3,         // Minimum tag count for support/disruptive
  tag_min2: 2,        // Minimum tag count for disruptive
};

function parseTags(tagsStr) {
  if (!tagsStr || tagsStr === '[]') return [];
  try {
    const arr = JSON.parse(tagsStr);
    return arr.map(t => t.tag || t);
  } catch { return []; }
}

function classifyPlaystyle(sprite, skillTags) {
  const atk = sprite.base_atk || 0;
  const def = sprite.base_def || 0;
  const spatk = sprite.base_spatk || 0;
  const spdef = sprite.base_spdef || 0;
  const spd = sprite.base_speed || 0;

  // Count tag categories
  const tagCounts = {};
  skillTags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });

  const hasControl = (tagCounts['控場'] || 0) >= 1;
  const hasDebuff = (tagCounts['對手弱化'] || 0) >= 1;
  const hasCleanse = (tagCounts['消強'] || 0) >= 1;
  const hasHeal = (tagCounts['回血'] || 0) >= 1;
  const hasShield = (tagCounts['護盾'] || 0) >= 1;
  const hasPriority = (tagCounts['先制'] || 0) >= 1;
  const hasPP = (tagCounts['PP干擾'] || 0) >= 1;
  const hasLion = (tagCounts['獅盔'] || 0) >= 1;
  const hasFixedDmg = (tagCounts['固傷'] || 0) >= 1;

  // Classify (priority order: most specific first)
  const styles = [];

  // Tank: high def+spdef + healing/shield
  if ((def + spdef) >= THRESHOLDS.def_spdef_sum && (hasHeal || hasShield || hasLion)) {
    styles.push('tank');
  }

  // Speedster: high speed + priority skills
  if (spd >= THRESHOLDS.speed_high && hasPriority) {
    styles.push('speedster');
  }

  // Support: control + cleanse + debuff tags >= 3
  const supportScore = (hasControl ? 1 : 0) + (hasCleanse ? 1 : 0) + (hasDebuff ? 1 : 0);
  if (supportScore >= 3) {
    styles.push('support');
  }

  // Disruptive: PP + cleanse + debuff tags >= 2
  const disruptiveScore = (hasPP ? 1 : 0) + (hasCleanse ? 1 : 0) + (hasDebuff ? 1 : 0);
  if (disruptiveScore >= 2) {
    styles.push('disruptive');
  }

  // Attacker physical: high ATK + physical skills
  if (atk >= THRESHOLDS.atk_high) {
    const physSkills = skillTags.filter((t, i) => {
      // We don't have category here, so check if they have offensive tags
      return t === '固傷' || t === '對手弱化' || t === '控場';
    }).length;
    if (physSkills >= THRESHOLDS.skill_min || atk >= 140) {
      styles.push('attacker_phys');
    }
  }

  // Attacker special: high SpATK
  if (spatk >= THRESHOLDS.spatk_high) {
    const specSkills = skillTags.filter(t =>
      t === '固傷' || t === '對手弱化' || t === '控場'
    ).length;
    if (specSkills >= THRESHOLDS.skill_min || spatk >= 140) {
      styles.push('attacker_spec');
    }
  }

  // Fallback: if nothing matched, use stat dominance
  if (styles.length === 0) {
    if (atk >= 110 && atk > spatk) styles.push('attacker_phys');
    else if (spatk >= 110 && spatk > atk) styles.push('attacker_spec');
    else if ((def + spdef) >= 200) styles.push('tank');
    else if (spd >= 110) styles.push('speedster');
    else styles.push('balanced');
  }

  return styles;
}

// Get all sprites with their skills
const sprites = db.prepare("SELECT id, name_zh, base_atk, base_def, base_spatk, base_spdef, base_speed FROM sprites WHERE base_atk IS NOT NULL AND base_speed IS NOT NULL").all();
console.log(`Classifying ${sprites.length} sprites...`);

const update = db.prepare("UPDATE sprites SET playstyle = ? WHERE id = ?");
const getSkills = db.prepare(`
  SELECT s.tags FROM sprite_skills ss
  JOIN skills s ON ss.skill_id = s.id
  WHERE ss.sprite_id = ?
`);

const stats = {};
let updated = 0;

for (const sprite of sprites) {
  const skillRows = getSkills.all(sprite.id);
  const allTags = skillRows.flatMap(r => parseTags(r.tags));
  const playstyles = classifyPlaystyle(sprite, allTags);
  const playstyleStr = JSON.stringify(playstyles);

  update.run(playstyleStr, sprite.id);
  updated++;

  playstyles.forEach(p => { stats[p] = (stats[p] || 0) + 1; });
}

console.log(`\nUpdated: ${updated} sprites`);
console.log('\nPlaystyle distribution:');
Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} (${(v/updated*100).toFixed(1)}%)`);
});

// Show Top 10 by playstyle
console.log('\n=== Top 10 per playstyle ===');
const playstyles = ['attacker_phys', 'attacker_spec', 'tank', 'speedster', 'support', 'disruptive'];
for (const ps of playstyles) {
  const rows = db.prepare(`SELECT name_zh, types, base_atk, base_spatk, base_speed, playstyle FROM sprites WHERE playstyle LIKE ? ORDER BY (base_atk + base_spatk + base_speed) DESC LIMIT 5`).all(`%${ps}%`);
  console.log(`\n  ${ps}:`);
  rows.forEach(r => console.log(`    ${r.name_zh} (${r.types}): ATK=${r.base_atk} SpATK=${r.base_spatk} SPD=${r.base_speed}`));
}

db.close();
