/**
 * Meta Repository — Pure SQL queries for meta tables
 *
 * Data access layer only. No business logic.
 * Separated from db.js to keep db.js as generic data access.
 *
 * Phase 2: Meta System
 */
import { getDb } from './db.js';

// ── Archetypes ──

export function getArchetypeBySpriteId(spriteId) {
  return getDb().prepare(`
    SELECT sa.*, s.name_zh, s.types
    FROM sprite_archetypes sa
    JOIN sprites s ON sa.sprite_id = s.id
    WHERE sa.sprite_id = ?
  `).get(spriteId) || null;
}

export function getArchetypesBySpriteIds(spriteIds) {
  if (!spriteIds.length) return [];
  const placeholders = spriteIds.map(() => '?').join(',');
  return getDb().prepare(`
    SELECT sa.*, s.name_zh, s.types
    FROM sprite_archetypes sa
    JOIN sprites s ON sa.sprite_id = s.id
    WHERE sa.sprite_id IN (${placeholders})
  `).all(...spriteIds);
}

export function getAllArchetypes() {
  return getDb().prepare(`
    SELECT sa.*, s.name_zh, s.types
    FROM sprite_archetypes sa
    JOIN sprites s ON sa.sprite_id = s.id
    ORDER BY sa.primary_archetype, s.name_zh
  `).all();
}

export function getArchetypeDistribution() {
  return getDb().prepare(`
    SELECT primary_archetype, COUNT(*) as count
    FROM sprite_archetypes
    GROUP BY primary_archetype
    ORDER BY count DESC
  `).all();
}

// ── Matchup Stats ──

export function getMatchupByPair(attackerId, defenderId) {
  return getDb().prepare(`
    SELECT * FROM matchup_stats
    WHERE attacker_sprite_id = ? AND defender_sprite_id = ?
  `).get(attackerId, defenderId) || null;
}

export function getMatchupsByAttacker(attackerId) {
  return getDb().prepare(`
    SELECT ms.*, s.name_zh
    FROM matchup_stats ms
    JOIN sprites s ON ms.defender_sprite_id = s.id
    WHERE ms.attacker_sprite_id = ?
    ORDER BY ms.games DESC
  `).all(attackerId);
}

export function getMatchupsByDefender(defenderId) {
  return getDb().prepare(`
    SELECT ms.*, s.name_zh
    FROM matchup_stats ms
    JOIN sprites s ON ms.attacker_sprite_id = s.id
    WHERE ms.defender_sprite_id = ?
    ORDER BY ms.games DESC
  `).all(defenderId);
}

export function getMatchupBatch(attackerIds, defenderIds) {
  if (!attackerIds.length || !defenderIds.length) return [];
  const aPlaceholders = attackerIds.map(() => '?').join(',');
  const dPlaceholders = defenderIds.map(() => '?').join(',');
  return getDb().prepare(`
    SELECT * FROM matchup_stats
    WHERE attacker_sprite_id IN (${aPlaceholders})
      AND defender_sprite_id IN (${dPlaceholders})
  `).all(...attackerIds, ...defenderIds);
}

export function getSignificantMatchups(minGames = 3) {
  return getDb().prepare(`
    SELECT ms.*, sa1.primary_archetype as attacker_archetype,
           sa2.primary_archetype as defender_archetype
    FROM matchup_stats ms
    LEFT JOIN sprite_archetypes sa1 ON ms.attacker_sprite_id = sa1.sprite_id
    LEFT JOIN sprite_archetypes sa2 ON ms.defender_sprite_id = sa2.sprite_id
    WHERE ms.games >= ?
    ORDER BY ms.games DESC
  `).all(minGames);
}

// ── Battle Stats ──

export function getTopSpritesByWinrate(limit = 20, season = null) {
  const d = getDb();
  if (season) {
    return d.prepare(`
      SELECT bs.*, s.name_zh, s.types,
             CAST(bs.wins AS REAL) / MAX(bs.games, 1) as winrate,
             sa.primary_archetype
      FROM battle_stats bs
      JOIN sprites s ON bs.sprite_id = s.id
      LEFT JOIN sprite_archetypes sa ON bs.sprite_id = sa.sprite_id
      WHERE bs.games > 0
      ORDER BY winrate DESC
      LIMIT ?
    `).all(limit);
  }
  return d.prepare(`
    SELECT bs.*, s.name_zh, s.types,
           CAST(bs.wins AS REAL) / MAX(bs.games, 1) as winrate,
           sa.primary_archetype
    FROM battle_stats bs
    JOIN sprites s ON bs.sprite_id = s.id
    LEFT JOIN sprite_archetypes sa ON bs.sprite_id = sa.sprite_id
    WHERE bs.games > 0
    ORDER BY winrate DESC
    LIMIT ?
  `).all(limit);
}

// ── Trends ──

export function getTrendsBySprite(spriteId, season = null) {
  const d = getDb();
  if (season) {
    return d.prepare(`
      SELECT * FROM meta_trends
      WHERE sprite_id = ? AND season = ?
      ORDER BY calculated_at DESC
    `).all(spriteId, season);
  }
  return d.prepare(`
    SELECT * FROM meta_trends
    WHERE sprite_id = ?
    ORDER BY calculated_at DESC
    LIMIT 10
  `).all(spriteId);
}

export function insertTrend(trend) {
  const d = getDb();
  return d.prepare(`
    INSERT INTO meta_trends (sprite_id, season, pick_rate, win_rate, ban_rate, trend_direction, sample_size, calculated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    trend.sprite_id, trend.season, trend.pick_rate, trend.win_rate,
    trend.ban_rate, trend.trend_direction, trend.sample_size
  );
}

// ── Recent Battle Logs ──

export function getRecentBattleLogs(days = 30) {
  return getDb().prepare(`
    SELECT * FROM battle_logs
    WHERE timestamp >= date('now', '-' || ? || ' days')
    ORDER BY timestamp
  `).all(days);
}
