const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync('db/seer.db');

// Ensure movesets table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS movesets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sprite_id INTEGER REFERENCES sprites(id),
    name TEXT NOT NULL,
    role TEXT,
    skill_ids TEXT NOT NULL,
    notes TEXT,
    source TEXT DEFAULT 'community',
    upvotes INTEGER DEFAULT 0
  );
`);

// Import movesets from JSON file
// Format: [{ sprite_name, name, role, skill_names, notes, source }]
function importMovesets(filePath) {
  const data = JSON.parse(require('fs').readFileSync(filePath, 'utf-8'));
  const insert = db.prepare(
    'INSERT INTO movesets (sprite_id, name, role, skill_ids, notes, source) VALUES (?, ?, ?, ?, ?, ?)'
  );

  let imported = 0;
  let skipped = 0;

  for (const entry of data) {
    // Find sprite by name
    const sprite = db.prepare('SELECT id FROM sprites WHERE name_zh = ?').get(entry.sprite_name);
    if (!sprite) {
      console.log(`  SKIP: sprite "${entry.sprite_name}" not found`);
      skipped++;
      continue;
    }

    // Find skill IDs by name
    const skillIds = [];
    for (const skillName of (entry.skill_names || [])) {
      const skill = db.prepare('SELECT id FROM skills WHERE name = ?').get(skillName);
      if (skill) {
        skillIds.push(skill.id);
      } else {
        console.log(`  WARN: skill "${skillName}" not found for ${entry.sprite_name}`);
      }
    }

    if (skillIds.length === 0) {
      console.log(`  SKIP: no valid skills for ${entry.sprite_name}`);
      skipped++;
      continue;
    }

    insert.run(
      sprite.id,
      entry.name || '預設配招',
      entry.role || null,
      JSON.stringify(skillIds),
      entry.notes || null,
      entry.source || 'community'
    );
    imported++;
  }

  console.log(`Imported: ${imported}, Skipped: ${skipped}`);
  return { imported, skipped };
}

// CLI entry point
if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: node src/import-movesets.cjs <path-to-movesets.json>');
    console.log('\nJSON format:');
    console.log('[{ "sprite_name": "精靈名", "name": "配招名", "role": "attack/defense/balance",');
    console.log('  "skill_names": ["技能1", "技能2", "技能3", "技能4"],');
    console.log('  "notes": "備註", "source": "bwiki" }]');
    process.exit(1);
  }

  try {
    importMovesets(filePath);
    console.log('Done!');
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exit(1);
  }
}

module.exports = { importMovesets };
