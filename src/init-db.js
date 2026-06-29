import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');

mkdirSync(join(__dirname, '..', 'db'), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sprites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tw_id TEXT,
    cn_id TEXT UNIQUE,
    name_zh TEXT NOT NULL,
    name_en TEXT,
    types TEXT,
    base_atk INTEGER,
    base_def INTEGER,
    base_spatk INTEGER,
    base_spdef INTEGER,
    base_speed INTEGER,
    base_hp INTEGER,
    height REAL,
    weight REAL,
    gender TEXT,
    region_status TEXT DEFAULT 'pending_verify',
    source_url TEXT,
    scraped_at TEXT,
    evolves_from TEXT,
    evolves_to TEXT,
    evolve_level INTEGER
  );

  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    power INTEGER,
    accuracy INTEGER,
    pp INTEGER,
    category TEXT,
    type TEXT,
    effect_desc TEXT,
    tags TEXT DEFAULT '[]',
    priority INTEGER DEFAULT 0,
    UNIQUE(name, type)
  );

  CREATE TABLE IF NOT EXISTS sprite_skills (
    sprite_id INTEGER REFERENCES sprites(id),
    skill_id INTEGER REFERENCES skills(id),
    is_signature INTEGER DEFAULT 0,
    PRIMARY KEY (sprite_id, skill_id)
  );

  CREATE TABLE IF NOT EXISTS soul_seals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sprite_id INTEGER REFERENCES sprites(id),
    effect_desc TEXT,
    name_zh_tw TEXT,
    kind TEXT
  );

  CREATE TABLE IF NOT EXISTS engravings (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    description TEXT,
    series_name TEXT,
    rarity TEXT,
    max_equip_level INTEGER,
    max_hold_count INTEGER,
    base_atk INTEGER,
    base_def INTEGER,
    base_spatk INTEGER,
    base_spdef INTEGER,
    base_speed INTEGER,
    base_hp INTEGER,
    hidden_atk INTEGER,
    hidden_def INTEGER,
    hidden_spatk INTEGER,
    hidden_spdef INTEGER,
    hidden_speed INTEGER,
    hidden_hp INTEGER,
    has_hidden_attr INTEGER,
    exclusive_sprite_id INTEGER REFERENCES sprites(id),
    exclusive_skill TEXT,
    angle_count INTEGER
  );

  CREATE TABLE IF NOT EXISTS type_chart (
    attack_type TEXT,
    defend_type TEXT,
    multiplier REAL,
    PRIMARY KEY (attack_type, defend_type)
  );

  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS collection_items (
    collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
    sprite_id INTEGER REFERENCES sprites(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    added_at TEXT,
    PRIMARY KEY (collection_id, sprite_id)
  );

  CREATE TABLE IF NOT EXISTS pet_advances (
    id INTEGER PRIMARY KEY,
    monster_id TEXT,
    monster_name TEXT,
    old_race_hp INTEGER,
    old_race_atk INTEGER,
    old_race_def INTEGER,
    old_race_spatk INTEGER,
    old_race_spdef INTEGER,
    old_race_speed INTEGER,
    new_race_hp INTEGER,
    new_race_atk INTEGER,
    new_race_def INTEGER,
    new_race_spatk INTEGER,
    new_race_spdef INTEGER,
    new_race_speed INTEGER,
    old_se_id INTEGER,
    new_se_id INTEGER,
    sp_moves TEXT,
    extra_moves TEXT,
    adv_effect_id INTEGER,
    adv_effect_desc TEXT,
    desc TEXT
  );

  CREATE TABLE IF NOT EXISTS gacha_pools (
    id INTEGER PRIMARY KEY,
    pool_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    monster_cn_id TEXT,
    monster_name TEXT,
    kind INTEGER,
    is_unique INTEGER DEFAULT 0
  );

  -- 3. Multi-Profile Teams
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    side TEXT NOT NULL CHECK(side IN ('my','enemy')),
    slot_index INTEGER NOT NULL,
    sprite_id INTEGER,
    config_json TEXT DEFAULT '{}',
    UNIQUE(profile_id, side, slot_index)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS generic_traits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    element_type TEXT DEFAULT NULL,
    formula_type TEXT NOT NULL,
    description_template TEXT NOT NULL,
    custom_values TEXT DEFAULT NULL,
    note TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS pvp_ban_list (
    id INTEGER PRIMARY KEY,
    sprite_id INTEGER REFERENCES sprites(id),
    pool_type TEXT NOT NULL,
    season TEXT NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(sprite_id, pool_type, season)
  );
`);

// ── 7. Composite Indexes ──
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sprites_types ON sprites(types);
  CREATE INDEX IF NOT EXISTS idx_sprites_cn_id ON sprites(cn_id);
  CREATE INDEX IF NOT EXISTS idx_sprites_name_zh ON sprites(name_zh);
  CREATE INDEX IF NOT EXISTS idx_sprite_skills_sprite ON sprite_skills(sprite_id);
  CREATE INDEX IF NOT EXISTS idx_sprite_skills_skill ON sprite_skills(skill_id);
  CREATE INDEX IF NOT EXISTS idx_soul_seals_sprite ON soul_seals(sprite_id);
  CREATE INDEX IF NOT EXISTS idx_engravings_sprite ON engravings(exclusive_sprite_id);
  CREATE INDEX IF NOT EXISTS idx_engravings_type ON engravings(type);
  CREATE INDEX IF NOT EXISTS idx_engravings_rarity ON engravings(rarity);
  CREATE INDEX IF NOT EXISTS idx_collection_items_col ON collection_items(collection_id);
  CREATE INDEX IF NOT EXISTS idx_collection_items_sprite ON collection_items(sprite_id);
  CREATE INDEX IF NOT EXISTS idx_teams_profile ON teams(profile_id);
  CREATE INDEX IF NOT EXISTS idx_gacha_pools_cn ON gacha_pools(monster_cn_id);
  CREATE INDEX IF NOT EXISTS idx_pet_advances_monster ON pet_advances(monster_id);
  CREATE INDEX IF NOT EXISTS idx_type_chart_attack ON type_chart(attack_type);
  CREATE INDEX IF NOT EXISTS idx_sprites_evolves_from ON sprites(evolves_from);
  CREATE INDEX IF NOT EXISTS idx_sprites_evolves_to ON sprites(evolves_to);
`);

// ALTER TABLE for existing databases
try { db.exec('ALTER TABLE soul_seals ADD COLUMN kind TEXT'); } catch {}
try { db.exec('ALTER TABLE skills ADD COLUMN priority INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE sprites ADD COLUMN acquisition TEXT'); } catch {}
try { db.exec('ALTER TABLE sprites ADD COLUMN free_forbidden INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE sprites ADD COLUMN catch_rate INTEGER'); } catch {}
try { db.exec('ALTER TABLE sprites ADD COLUMN playstyle TEXT'); } catch {}
try { db.exec('ALTER TABLE soul_seals ADD COLUMN trigger_condition TEXT'); } catch {}

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
  CREATE INDEX IF NOT EXISTS idx_movesets_sprite ON movesets(sprite_id);

  CREATE TABLE IF NOT EXISTS battle_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    mode TEXT,
    my_team TEXT NOT NULL,
    enemy_team TEXT NOT NULL,
    result TEXT NOT NULL,
    duration_seconds INTEGER,
    key_moments TEXT,
    enemy_hash TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_battle_logs_result ON battle_logs(result);
  CREATE INDEX IF NOT EXISTS idx_battle_logs_timestamp ON battle_logs(timestamp);

  CREATE TABLE IF NOT EXISTS battle_stats (
    sprite_id INTEGER PRIMARY KEY,
    games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    bans INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS meta_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season TEXT NOT NULL,
    sprite_id INTEGER,
    pick_rate REAL,
    ban_rate REAL,
    win_rate REAL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_meta_season ON meta_reports(season);
`);

console.log('Database initialized at:', DB_PATH);
db.close();
