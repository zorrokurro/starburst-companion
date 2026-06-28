#!/usr/bin/env node
// test-data-update.cjs — 端到端測試：jsDelivr 資料同步機制
// 流程：設定舊版本 → fetch version.json → 比對 → 下載 → 寫入DB → 驗證

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.SEER_DB_PATH || path.join(__dirname, '..', 'db', 'seer.db');
const DIST_DATA_BASE = 'https://cdn.jsdelivr.net/gh/zorrokurro/starburst-companion@main/dist-data';
const DIST_TABLES = ['sprites', 'skills', 'sprite_skills', 'soul_seals', 'engravings', 'generic_traits', 'type_chart'];

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
}

async function main() {
  console.log('\n═══ Phase 4: End-to-End Data Update Test ═══\n');

  // Step 0: Open DB, record current version
  const db = new Database(DB_PATH);
  const currentRow = db.prepare('SELECT value FROM meta WHERE key = ?').get('data_version');
  const realVersion = currentRow?.value || '0.0.0';
  console.log(`  Current DB version: ${realVersion}`);

  // Step 1: Set DB version to "0.0.0" (simulate old version)
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('data_version', '0.0.0');
  const oldRow = db.prepare('SELECT value FROM meta WHERE key = ?').get('data_version');
  assert('Step 1: DB version set to 0.0.0', oldRow?.value === '0.0.0');

  // Step 2: Fetch remote version.json
  console.log('\n  Fetching version.json from jsDelivr...');
  const versionRes = await fetch(`${DIST_DATA_BASE}/version.json`);
  assert('Step 2a: version.json HTTP 200', versionRes.ok, `status=${versionRes.status}`);
  const remote = await versionRes.json();
  assert('Step 2b: version.json has version field', !!remote.version, JSON.stringify(remote).substring(0, 100));
  assert('Step 2c: version.json has tables array', Array.isArray(remote.tables), JSON.stringify(remote.tables));

  // Step 3: Version comparison — remote should differ from "0.0.0"
  const versionsDiffer = remote.version !== '0.0.0';
  assert('Step 3: Remote version differs from local 0.0.0', versionsDiffer, `remote=${remote.version}`);

  // Step 4: Download and apply each table
  console.log('\n  Downloading and applying tables...');
  let totalRows = 0;

  const upsertFns = {
    sprites: (rows) => {
      const stmt = db.prepare(`INSERT OR REPLACE INTO sprites
        (id, cn_id, name_zh, name_en, types, base_hp, base_atk, base_def, base_spatk, base_spdef, base_speed,
         height, weight, gender, evolves_from, evolves_to, evolve_level)
        VALUES (@id, @cn_id, @name_zh, @name_en, @types, @base_hp, @base_atk, @base_def, @base_spatk, @base_spdef, @base_speed,
         @height, @weight, @gender, @evolves_from, @evolves_to, @evolve_level)`);
      const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
      tx(rows);
    },
    skills: (rows) => {
      const stmt = db.prepare(`INSERT OR REPLACE INTO skills (id, name, power, accuracy, pp, category, type, effect_desc, tags)
        VALUES (@id, @name, @power, @accuracy, @pp, @category, @type, @effect_desc, @tags)`);
      const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
      tx(rows);
    },
    sprite_skills: (rows) => {
      const stmt = db.prepare(`INSERT OR REPLACE INTO sprite_skills (sprite_id, skill_id, is_signature)
        VALUES (@sprite_id, @skill_id, @is_signature)`);
      const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
      tx(rows);
    },
    soul_seals: (rows) => {
      const stmt = db.prepare(`INSERT OR REPLACE INTO soul_seals (id, sprite_id, effect_desc, name_zh_tw, kind)
        VALUES (@id, @sprite_id, @effect_desc, @name_zh_tw, @kind)`);
      const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
      tx(rows);
    },
    engravings: (rows) => {
      const stmt = db.prepare(`INSERT OR REPLACE INTO engravings
        (id, name, type, description, series_name, rarity, max_equip_level, max_hold_count,
         base_hp, base_atk, base_def, base_spatk, base_spdef, base_speed,
         hidden_hp, hidden_atk, hidden_def, hidden_spatk, hidden_spdef, hidden_speed,
         has_hidden_attr, exclusive_sprite_id, exclusive_skill, angle_count)
        VALUES (@id, @name, @type, @description, @series_name, @rarity, @max_equip_level, @max_hold_count,
         @base_hp, @base_atk, @base_def, @base_spatk, @base_spdef, @base_speed,
         @hidden_hp, @hidden_atk, @hidden_def, @hidden_spatk, @hidden_spdef, @hidden_speed,
         @has_hidden_attr, @exclusive_sprite_id, @exclusive_skill, @angle_count)`);
      const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
      tx(rows);
    },
    generic_traits: (rows) => {
      const stmt = db.prepare(`INSERT OR REPLACE INTO generic_traits (id, name, category, element_type, formula_type, description_template, custom_values, note)
        VALUES (@id, @name, @category, @element_type, @formula_type, @description_template, @custom_values, @note)`);
      const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
      tx(rows);
    },
    type_chart: (rows) => {
      const stmt = db.prepare(`INSERT OR REPLACE INTO type_chart (attack_type, defend_type, multiplier)
        VALUES (@attack_type, @defend_type, @multiplier)`);
      const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
      tx(rows);
    },
  };

  for (const tableName of remote.tables) {
    if (!upsertFns[tableName]) {
      console.log(`  ⚠️  Skipping unknown table: ${tableName}`);
      continue;
    }
    const res = await fetch(`${DIST_DATA_BASE}/${tableName}.json`);
    assert(`Step 4a: ${tableName}.json HTTP 200`, res.ok, `status=${res.status}`);
    const rows = await res.json();
    assert(`Step 4b: ${tableName} has data`, rows.length > 0, `rows=${rows.length}`);
    upsertFns[tableName](rows);
    totalRows += rows.length;
    console.log(`    ${tableName}: ${rows.length} rows applied`);
  }
  assert('Step 4c: Total rows > 0', totalRows > 0, `total=${totalRows}`);

  // Step 5: Update meta version
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('data_version', remote.version);
  const newVersion = db.prepare('SELECT value FROM meta WHERE key = ?').get('data_version');
  assert('Step 5a: meta data_version updated', newVersion?.value === remote.version, `got=${newVersion?.value}`);

  // Step 6: Verify data integrity
  console.log('\n  Verifying data integrity...');
  const spriteCount = db.prepare('SELECT COUNT(*) as n FROM sprites').get().n;
  const skillCount = db.prepare('SELECT COUNT(*) as n FROM skills').get().n;
  const sealCount = db.prepare('SELECT COUNT(*) as n FROM soul_seals').get().n;
  const engCount = db.prepare('SELECT COUNT(*) as n FROM engravings').get().n;
  const traitCount = db.prepare('SELECT COUNT(*) as n FROM generic_traits').get().n;
  const typeCount = db.prepare('SELECT COUNT(*) as n FROM type_chart').get().n;
  const linkCount = db.prepare('SELECT COUNT(*) as n FROM sprite_skills').get().n;

  assert('Step 6a: sprites table populated', spriteCount > 4000, `count=${spriteCount}`);
  assert('Step 6b: skills table populated', skillCount > 10000, `count=${skillCount}`);
  assert('Step 6c: sprite_skills table populated', linkCount > 50000, `count=${linkCount}`);
  assert('Step 6d: soul_seals table populated', sealCount > 1000, `count=${sealCount}`);
  assert('Step 6e: engravings table populated', engCount > 1000, `count=${engCount}`);
  assert('Step 6f: generic_traits table populated', traitCount > 30, `count=${traitCount}`);
  assert('Step 6g: type_chart table populated', typeCount > 100, `count=${typeCount}`);

  // Step 7: Verify a specific sprite (e.g., 譜尼 cn_id=1)
  const puni = db.prepare('SELECT * FROM sprites WHERE cn_id = ?').get('1');
  assert('Step 7: Specific sprite (cn_id=1) exists', !!puni, puni ? `name=${puni.name_zh}` : 'not found');

  // Step 8: Version re-check — should be up to date now
  const finalVersion = db.prepare('SELECT value FROM meta WHERE key = ?').get('data_version');
  assert('Step 8: Final version matches remote', finalVersion?.value === remote.version, `local=${finalVersion?.value} remote=${remote.version}`);

  db.close();

  // Summary
  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Test error:', err); process.exit(1); });
