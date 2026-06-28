import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = join(__dirname, '..', 'db', 'seer.db');

let db = null;

function getDb() {
  if (!db) {
    const dbPath = process.env.SEER_DB_PATH || DEFAULT_DB_PATH;
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // 3.8 性能參數調優
    db.pragma('cache_size = -2000');       // 2MB 記憶體快取
    db.pragma('synchronous = NORMAL');     // 平衡安全與速度
    db.pragma('temp_store = MEMORY');      // 臨時資料存記憶體
    db.pragma('mmap_size = 268435456');    // 256MB mmap
    // 3. Multi-profile teams tables
    db.exec(`
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
    `);
    // 7. Composite indexes for query optimization
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
  }
  return db;
}

function parseTypes(typesText) {
  if (!typesText) return [];
  try {
    return JSON.parse(typesText);
  } catch {
    return [];
  }
}

function buildSpriteQuery({ sort = 'cn_id', order = 'ASC', types, finalOnly, minTotal, maxTotal, search, page = 1, limit = 30, offset }) {
  const conditions = [];
  const params = {};

  if (search) {
    conditions.push(`(s.name_zh LIKE @search OR s.cn_id LIKE @search OR s.tw_id LIKE @search)`);
    params.search = `%${search}%`;
  }

  if (finalOnly) {
    conditions.push(`(s.evolves_to IS NULL OR s.evolves_to = '')`);
  }

  if (types && types.length > 0) {
    const typeConditions = types.map((t, i) => `s.types LIKE @type${i}`);
    conditions.push(`(${typeConditions.join(' AND ')})`);
    types.forEach((t, i) => { params[`type${i}`] = `%${t}%`; });
  }

  if (minTotal != null && Number.isFinite(minTotal)) {
    conditions.push(`((COALESCE(s.base_atk,0)+COALESCE(s.base_def,0)+COALESCE(s.base_spatk,0)+COALESCE(s.base_spdef,0)+COALESCE(s.base_speed,0)+COALESCE(s.base_hp,0)) >= @minTotal)`);
    params.minTotal = minTotal;
  }
  if (maxTotal != null && Number.isFinite(maxTotal)) {
    conditions.push(`((COALESCE(s.base_atk,0)+COALESCE(s.base_def,0)+COALESCE(s.base_spatk,0)+COALESCE(s.base_spdef,0)+COALESCE(s.base_speed,0)+COALESCE(s.base_hp,0)) <= @maxTotal)`);
    params.maxTotal = maxTotal;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortMap = {
    cn_id: 's.cn_id',
    total: '(COALESCE(s.base_atk,0)+COALESCE(s.base_def,0)+COALESCE(s.base_spatk,0)+COALESCE(s.base_spdef,0)+COALESCE(s.base_speed,0)+COALESCE(s.base_hp,0))',
    atk: 's.base_atk',
    def: 's.base_def',
    spatk: 's.base_spatk',
    spdef: 's.base_spdef',
    speed: 's.base_speed',
    hp: 's.base_hp',
    name: 's.name_zh',
  };
  const sortCol = sortMap[sort] || 's.cn_id';
  const sortOrder = order === 'DESC' ? 'DESC' : 'ASC';

  const effectiveLimit = Math.min(Math.max(parseInt(limit) || 30, 1), 200);
  const effectiveOffset = offset !== undefined ? parseInt(offset) : ((Math.max(parseInt(page) || 1, 1) - 1) * effectiveLimit);

  const countSql = `SELECT COUNT(*) as total FROM sprites s ${where}`;
  const dataSql = `
    SELECT s.*,
      (COALESCE(s.base_atk,0)+COALESCE(s.base_def,0)+COALESCE(s.base_spatk,0)+COALESCE(s.base_spdef,0)+COALESCE(s.base_speed,0)+COALESCE(s.base_hp,0)) as base_total
    FROM sprites s
    ${where}
    ORDER BY ${sortCol} ${sortOrder}
    LIMIT @limit OFFSET @offset
  `;

  params.limit = effectiveLimit;
  params.offset = effectiveOffset;

  return { countSql, dataSql, params, limit: effectiveLimit, offset: effectiveOffset };
}

function querySprites(queryParams) {
  const { countSql, dataSql, params, limit, offset } = buildSpriteQuery(queryParams);
  const d = getDb();

  const totalRow = d.prepare(countSql).get(params);
  const total = totalRow ? totalRow.total : 0;
  const rows = d.prepare(dataSql).all(params);

  return {
    data: rows.map(r => ({
      ...r,
      types: parseTypes(r.types),
    })),
    total,
    page: Math.floor(offset / limit) + 1,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

function getSpriteById(id) {
  const d = getDb();
  const row = d.prepare(`
    SELECT s.*,
      (COALESCE(s.base_atk,0)+COALESCE(s.base_def,0)+COALESCE(s.base_spatk,0)+COALESCE(s.base_spdef,0)+COALESCE(s.base_speed,0)+COALESCE(s.base_hp,0)) as base_total
    FROM sprites s WHERE s.id = ?
  `).get(id);
  if (!row) return null;
  row.types = parseTypes(row.types);

  if (row.evolves_from) {
    const fromRow = d.prepare('SELECT name_zh FROM sprites WHERE cn_id = ?').get(row.evolves_from);
    row.evolves_from_name = fromRow ? fromRow.name_zh : null;
  }
  if (row.evolves_to) {
    const toRow = d.prepare('SELECT name_zh FROM sprites WHERE cn_id = ?').get(row.evolves_to);
    row.evolves_to_name = toRow ? toRow.name_zh : null;
  }

  row.skills = d.prepare(`
    SELECT sk.*, ss.is_signature
    FROM skills sk
    JOIN sprite_skills ss ON ss.skill_id = sk.id
    WHERE ss.sprite_id = ?
    ORDER BY ss.is_signature DESC, sk.power DESC
  `).all(id).map(sk => ({
    ...sk,
    tags: (() => { try { return JSON.parse(sk.tags || '[]'); } catch { return []; } })(),
  }));

  row.soul_seals = d.prepare(`SELECT * FROM soul_seals WHERE sprite_id = ?`).all(id);

  row.exclusiveEngraving = d.prepare(`SELECT * FROM engravings WHERE exclusive_sprite_id = ?`).get(id) || null;

  row.collections = d.prepare(`
    SELECT c.id, c.name FROM collections c
    JOIN collection_items ci ON ci.collection_id = c.id
    WHERE ci.sprite_id = ?
  `).all(id);

  row.pet_advance = d.prepare(`SELECT * FROM pet_advances WHERE monster_id = ?`).get(String(row.cn_id));

  if (row.pet_advance) {
    const resolveSkillNames = (moveStr) => {
      if (!moveStr) return [];
      const ids = moveStr.trim().split(/\s+/).map(Number).filter(n => n > 0);
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => '?').join(',');
      const found = d.prepare(`SELECT id, name, power, accuracy, category, type, effect_desc FROM skills WHERE id IN (${placeholders})`).all(...ids);
      const foundIds = new Set(found.map(s => s.id));
      for (const skillId of ids) {
        if (!foundIds.has(skillId)) {
          found.push({ id: skillId, name: `技能 #${skillId}`, power: null, accuracy: null, category: null, type: null, effect_desc: null });
        }
      }
      return found;
    };
    row.pet_advance.sp_skills = resolveSkillNames(row.pet_advance.sp_moves);
    row.pet_advance.extra_skills = resolveSkillNames(row.pet_advance.extra_moves);
  }

  return row;
}

function getDistinctTypes() {
  const d = getDb();
  const rows = d.prepare(`SELECT types FROM sprites WHERE types IS NOT NULL AND types != '[]'`).all();
  const typeSet = new Set();
  for (const row of rows) {
    const types = parseTypes(row.types);
    types.forEach(t => typeSet.add(t));
  }
  return [...typeSet].sort();
}

function getStatRange() {
  const d = getDb();
  const row = d.prepare(`
    SELECT
      MIN(COALESCE(s.base_atk,0)+COALESCE(s.base_def,0)+COALESCE(s.base_spatk,0)+COALESCE(s.base_spdef,0)+COALESCE(s.base_speed,0)+COALESCE(s.base_hp,0)) as min_total,
      MAX(COALESCE(s.base_atk,0)+COALESCE(s.base_def,0)+COALESCE(s.base_spatk,0)+COALESCE(s.base_spdef,0)+COALESCE(s.base_speed,0)+COALESCE(s.base_hp,0)) as max_total
    FROM sprites s
  `).get();
  return row || { min_total: 0, max_total: 800 };
}

function getAllCollections() {
  return getDb().prepare(`SELECT * FROM collections ORDER BY sort_order, id`).all();
}

function getCollectionById(id) {
  return getDb().prepare(`SELECT * FROM collections WHERE id = ?`).get(id);
}

function createCollection(name) {
  const d = getDb();
  const result = d.prepare(`INSERT INTO collections (name) VALUES (?)`).run(name);
  return getCollectionById(result.lastInsertRowid);
}

function updateCollection(id, name) {
  getDb().prepare(`UPDATE collections SET name = ? WHERE id = ?`).run(name, id);
  return getCollectionById(id);
}

function deleteCollection(id) {
  getDb().prepare(`DELETE FROM collections WHERE id = ?`).run(id);
}

function reorderCollection(id, sortOrder) {
  getDb().prepare(`UPDATE collections SET sort_order = ? WHERE id = ?`).run(sortOrder, id);
}

function getCollectionItems(collectionId) {
  return getDb().prepare(`
    SELECT s.*,
      ci.sort_order as item_sort,
      ci.added_at,
      (COALESCE(s.base_atk,0)+COALESCE(s.base_def,0)+COALESCE(s.base_spatk,0)+COALESCE(s.base_spdef,0)+COALESCE(s.base_speed,0)+COALESCE(s.base_hp,0)) as base_total
    FROM collection_items ci
    JOIN sprites s ON s.id = ci.sprite_id
    WHERE ci.collection_id = ?
    ORDER BY ci.sort_order, ci.added_at
  `).all(collectionId).map(r => ({ ...r, types: parseTypes(r.types) }));
}

function addToCollection(collectionId, spriteId) {
  const d = getDb();
  const maxOrder = d.prepare(`SELECT MAX(sort_order) as m FROM collection_items WHERE collection_id = ?`).get(collectionId);
  const nextOrder = (maxOrder?.m ?? -1) + 1;
  d.prepare(`
    INSERT OR IGNORE INTO collection_items (collection_id, sprite_id, sort_order, added_at)
    VALUES (?, ?, ?, ?)
  `).run(collectionId, spriteId, nextOrder, new Date().toISOString());
}

function removeFromCollection(collectionId, spriteId) {
  getDb().prepare(`DELETE FROM collection_items WHERE collection_id = ? AND sprite_id = ?`).run(collectionId, spriteId);
}

function reorderCollectionItem(collectionId, spriteId, newSortOrder) {
  getDb().prepare(`UPDATE collection_items SET sort_order = ? WHERE collection_id = ? AND sprite_id = ?`).run(newSortOrder, collectionId, spriteId);
}

function getSpriteCollections(spriteId) {
  return getDb().prepare(`
    SELECT c.* FROM collections c
    JOIN collection_items ci ON ci.collection_id = c.id
    WHERE ci.sprite_id = ?
  `).all(spriteId);
}

function searchEngravings({ search, type, series_name, rarity, page = 1, limit = 20 }) {
  const d = getDb();
  const conditions = [];
  const params = [];
  if (search) { conditions.push('name LIKE ?'); params.push(`%${search}%`); }
  if (type) { conditions.push('type = ?'); params.push(type); }
  if (series_name) { conditions.push('series_name = ?'); params.push(series_name); }
  if (rarity) { conditions.push('rarity = ?'); params.push(rarity); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const total = d.prepare(`SELECT COUNT(*) as c FROM engravings ${where}`).get(...params).c;
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
  const rows = d.prepare(`SELECT * FROM engravings ${where} ORDER BY id LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
  return { rows, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) };
}

function getEngravingsFilters() {
  const d = getDb();
  const types = d.prepare('SELECT DISTINCT type FROM engravings WHERE type IS NOT NULL ORDER BY type').all().map(r => r.type);
  const rarities = d.prepare('SELECT DISTINCT rarity FROM engravings WHERE rarity IS NOT NULL ORDER BY rarity').all().map(r => r.rarity);
  const series = d.prepare('SELECT DISTINCT series_name FROM engravings WHERE series_name IS NOT NULL ORDER BY series_name').all().map(r => r.series_name);
  return { types, rarities, series };
}

function getAllSpritesAll() {
  return getDb().prepare(`
    SELECT s.*,
      (COALESCE(s.base_atk,0)+COALESCE(s.base_def,0)+COALESCE(s.base_spatk,0)+COALESCE(s.base_spdef,0)+COALESCE(s.base_speed,0)+COALESCE(s.base_hp,0)) as base_total
    FROM sprites s ORDER BY s.cn_id
  `).all().map(r => ({ ...r, types: parseTypes(r.types) }));
}

function getTypeChartAttackTypes() {
  return getDb().prepare('SELECT DISTINCT attack_type FROM type_chart ORDER BY attack_type')
    .all().map(t => t.attack_type);
}

function getTypeChartList() {
  return getDb().prepare('SELECT * FROM type_chart').all();
}

function getAllGenericTraits() {
  return getDb().prepare('SELECT * FROM generic_traits ORDER BY id').all();
}

function closeDb() {
  if (db) { db.close(); db = null; }
}

export {
  getDb as db, closeDb, querySprites, getSpriteById, getDistinctTypes, getStatRange,
  getAllSpritesAll, getTypeChartAttackTypes, getTypeChartList,
  getAllCollections, getCollectionById, createCollection, updateCollection,
  deleteCollection, reorderCollection, getCollectionItems, addToCollection,
  removeFromCollection, reorderCollectionItem, getSpriteCollections,
  parseTypes, searchEngravings, getEngravingsFilters,
  getAllGenericTraits
};
