/**
 * Meta Service — Orchestration Layer
 *
 * Sits between IPC handlers and metaEngine/metaRepository.
 * Cache logic is delegated to metaCache.js.
 *
 * Architecture: IPC → metaService → metaEngine / metaRepository → db.js
 *
 * Phase 2: Meta System
 */
import {
  getArchetypeBySpriteId,
  getAllArchetypes,
  getArchetypeDistribution,
  getMatchupsByAttacker,
  getMatchupsByDefender,
  getMatchupBatch,
  getTopSpritesByWinrate,
  getTrendsBySprite,
} from './metaRepository.js';
import {
  calculateWinrate,
  classifyAllArchetypes,
  aggregateFullMeta,
} from './metaEngine.js';
import { getArchetypeLabel, getArchetypeDefinitions } from './archetype-classifier.js';
import { get, set, invalidate, clear, TTL } from './metaCache.js';

// ── Archetype API ──

export function getArchetype(spriteId) {
  const key = `arch:${spriteId}`;
  const cached = get(key);
  if (cached !== undefined) return cached;

  const row = getArchetypeBySpriteId(spriteId);
  if (!row) return null;

  const result = {
    spriteId: row.sprite_id,
    name: row.name_zh,
    primary: row.primary_archetype,
    primaryLabel: getArchetypeLabel(row.primary_archetype),
    secondary: row.secondary_archetype,
    secondaryLabel: row.secondary_archetype ? getArchetypeLabel(row.secondary_archetype) : null,
    confidence: row.confidence,
  };

  set(key, result, TTL.ARCHETYPE);
  return result;
}

export function getAllArchetypesCached() {
  const key = 'arch:all';
  const cached = get(key);
  if (cached !== undefined) return cached;

  const rows = getAllArchetypes();
  const result = rows.map(r => ({
    spriteId: r.sprite_id,
    name: r.name_zh,
    primary: r.primary_archetype,
    primaryLabel: getArchetypeLabel(r.primary_archetype),
    secondary: r.secondary_archetype,
    secondaryLabel: r.secondary_archetype ? getArchetypeLabel(r.secondary_archetype) : null,
    confidence: r.confidence,
  }));

  set(key, result, TTL.ARCHETYPE);
  return result;
}

export function getArchetypeDistributionCached() {
  const key = 'arch:dist';
  const cached = get(key);
  if (cached !== undefined) return cached;

  const rows = getArchetypeDistribution();
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const result = rows.map(r => ({
    archetype: r.primary_archetype,
    label: getArchetypeLabel(r.primary_archetype),
    count: r.count,
    percentage: total > 0 ? (r.count / total * 100).toFixed(1) : '0.0',
  }));

  set(key, result, TTL.ARCHETYPE_DIST);
  return result;
}

export function getArchetypeDefinitionsCached() {
  return getArchetypeDefinitions();
}

// ── Matchup API ──

export function getMatchupMatrix(myIds, enemyIds) {
  if (!myIds?.length || !enemyIds?.length) return { matrix: [], myCount: 0, enemyCount: 0 };

  const key = `matchup:${myIds.sort().join(',')}:${enemyIds.sort().join(',')}`;
  const cached = get(key);
  if (cached !== undefined) return cached;

  const rows = getMatchupBatch(myIds, enemyIds);

  const matrix = {};
  for (const myId of myIds) {
    matrix[myId] = {};
    for (const enemyId of enemyIds) {
      matrix[myId][enemyId] = { winrate: null, games: 0 };
    }
  }

  for (const row of rows) {
    if (matrix[row.attacker_sprite_id]?.[row.defender_sprite_id]) {
      const wr = calculateWinrate(row.wins, row.games);
      matrix[row.attacker_sprite_id][row.defender_sprite_id] = {
        winrate: wr.winrate,
        ci_lower: wr.ci_lower,
        ci_upper: wr.ci_upper,
        games: row.games,
        confidence: wr.confidence,
      };
    }
  }

  const result = { matrix, myCount: myIds.length, enemyCount: enemyIds.length };
  set(key, result, TTL.MATCHUP);
  return result;
}

export function getMatchupsForSprite(spriteId) {
  const key = `matchup:sprite:${spriteId}`;
  const cached = get(key);
  if (cached !== undefined) return cached;

  const asAttacker = getMatchupsByAttacker(spriteId);
  const asDefender = getMatchupsByDefender(spriteId);

  const result = {
    asAttacker: asAttacker.map(r => ({
      defenderId: r.defender_sprite_id,
      defenderName: r.name_zh,
      games: r.games,
      wins: r.wins,
      winrate: r.games > 0 ? r.wins / r.games : 0,
    })),
    asDefender: asDefender.map(r => ({
      attackerId: r.attacker_sprite_id,
      attackerName: r.name_zh,
      games: r.games,
      wins: r.wins,
      winrate: r.games > 0 ? r.wins / r.games : 0,
    })),
  };

  set(key, result, TTL.MATCHUP);
  return result;
}

// ── Top Meta API ──

export function getTopMeta(limit = 20, season = null) {
  const key = `top:${limit}:${season || 'all'}`;
  const cached = get(key);
  if (cached !== undefined) return cached;

  const rows = getTopSpritesByWinrate(limit, season);
  const result = rows.map(r => {
    const wr = calculateWinrate(r.wins, r.games);
    return {
      spriteId: r.sprite_id,
      name: r.name_zh,
      games: r.games,
      wins: r.wins,
      bans: r.bans,
      winrate: wr.winrate,
      ci_lower: wr.ci_lower,
      ci_upper: wr.ci_upper,
      confidence: wr.confidence,
      archetype: r.primary_archetype || 'unknown',
      archetypeLabel: r.primary_archetype ? getArchetypeLabel(r.primary_archetype) : '未知',
    };
  });

  set(key, result, TTL.TOP_META);
  return result;
}

// ── Trend API ──

export function getTrends(spriteId, season = null) {
  const key = `trend:${spriteId}:${season || 'all'}`;
  const cached = get(key);
  if (cached !== undefined) return cached;

  const rows = getTrendsBySprite(spriteId, season);
  const result = rows.map(r => ({
    spriteId: r.sprite_id,
    season: r.season,
    pickRate: r.pick_rate,
    winRate: r.win_rate,
    banRate: r.ban_rate,
    direction: r.trend_direction,
    sampleSize: r.sample_size,
    calculatedAt: r.calculated_at,
  }));

  set(key, result, TTL.TREND);
  return result;
}

// ── Full Meta Aggregation ──

export function getFullMeta(season = null) {
  const key = `full:${season || 'all'}`;
  const cached = get(key);
  if (cached !== undefined) return cached;

  const result = aggregateFullMeta(season);
  set(key, result, TTL.FULL_META);
  return result;
}

// ── Refresh / Reclassify ──

export function refreshAll() {
  clear();
  return { cleared: true };
}

export function classifyAll() {
  const result = classifyAllArchetypes();
  invalidate('arch:');
  return result;
}

export default {
  getArchetype,
  getAllArchetypes: getAllArchetypesCached,
  getArchetypeDistribution: getArchetypeDistributionCached,
  getArchetypeDefinitions: getArchetypeDefinitionsCached,
  getMatchupMatrix,
  getMatchupsForSprite,
  getTopMeta,
  getTrends,
  getFullMeta,
  refreshAll,
  classifyAll,
};
