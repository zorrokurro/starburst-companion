/**
 * Meta Engine — Winrate Inference, Trend Analysis, Matchup Learning
 *
 * Core module for Phase 2: Meta System.
 * Processes battle_logs into actionable meta intelligence.
 *
 * Phase 2: Meta System
 */
import { getDb } from './db.js';
import { classifyArchetype, getArchetypeLabel } from './archetype-classifier.js';

// ── Winrate Inference ──

/**
 * Calculate winrate for a sprite with Wilson score confidence interval.
 *
 * @param {number} wins
 * @param {number} games
 * @param {number} [z=1.96] - Z-score for 95% confidence
 * @returns {{ winrate: number, ci_lower: number, ci_upper: number, confidence: number }}
 */
export function calculateWinrate(wins, games, z = 1.96) {
  if (games === 0) return { winrate: 0, ci_lower: 0, ci_upper: 1, confidence: 0 };

  const p = wins / games;
  const n = games;

  // Wilson score interval
  const denominator = 1 + z * z / n;
  const centre = p + z * z / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n);

  const ci_lower = Math.max(0, (centre - spread) / denominator);
  const ci_upper = Math.min(1, (centre + spread) / denominator);

  // Confidence: narrower interval = higher confidence
  const interval = ci_upper - ci_lower;
  const confidence = Math.max(0, 1 - interval);

  return { winrate: p, ci_lower, ci_upper, confidence };
}

// ── Trend Detection ──

/**
 * Detect trend direction from recent data.
 *
 * @param {Array} recentWinrates - Array of { period, winrate }
 * @returns {{ direction: string, magnitude: number, confidence: number }}
 */
export function detectTrend(recentWinrates) {
  if (recentWinrates.length < 2) {
    return { direction: 'stable', magnitude: 0, confidence: 0 };
  }

  // Simple linear regression
  const n = recentWinrates.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += recentWinrates[i].winrate;
    sumXY += i * recentWinrates[i].winrate;
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const magnitude = Math.abs(slope);

  let direction = 'stable';
  if (slope > 0.02) direction = 'rising';
  else if (slope < -0.02) direction = 'falling';

  const confidence = Math.min(magnitude * 10, 1.0);

  return { direction, magnitude, confidence };
}

// ── Matchup Learning ──

/**
 * Update matchup stats from a battle result.
 *
 * @param {Object} battle - { my_team: number[], enemy_team: number[], result: 'win'|'lose' }
 */
export function updateMatchupStats(battle) {
  const db = getDb();
  const isWin = battle.result === 'win';

  // For each pair of (our sprite, enemy sprite), update matchup stats
  const myTeam = JSON.parse(battle.my_team || '[]');
  const enemyTeam = JSON.parse(battle.enemy_team || '[]');

  const upsert = db.prepare(`
    INSERT INTO matchup_stats (attacker_sprite_id, defender_sprite_id, games, wins, updated_at)
    VALUES (?, ?, 1, ?, datetime('now'))
    ON CONFLICT(attacker_sprite_id, defender_sprite_id)
    DO UPDATE SET
      games = games + 1,
      wins = wins + ?,
      updated_at = datetime('now')
  `);

  const updateMany = db.transaction(() => {
    for (const myId of myTeam) {
      for (const enemyId of enemyTeam) {
        const winIncrement = isWin ? 1 : 0;
        upsert.run(myId, enemyId, winIncrement, winIncrement);
      }
    }
  });

  updateMany();
}

// ── Aggregate Meta ──

/**
 * Full meta aggregation: winrates, trends, matchup matrix.
 *
 * @param {string} season
 * @returns {{ sprites: Array, trends: Object, matchupMatrix: Object }}
 */
export function aggregateFullMeta(season) {
  const db = getDb();

  // 1. Per-sprite winrate
  const spriteStats = db.prepare(`
    SELECT sprite_id, games, wins, bans
    FROM battle_stats
    WHERE games > 0
    ORDER BY games DESC
  `).all();

  const spriteWinrates = spriteStats.map(s => {
    const wr = calculateWinrate(s.wins, s.games);
    return { spriteId: s.sprite_id, ...s, ...wr };
  });

  // 2. Per-matchup winrate
  const matchupData = db.prepare(`
    SELECT attacker_sprite_id, defender_sprite_id, games, wins
    FROM matchup_stats
    WHERE games >= 3
  `).all();

  const matchupMatrix = {};
  for (const m of matchupData) {
    if (!matchupMatrix[m.attacker_sprite_id]) matchupMatrix[m.attacker_sprite_id] = {};
    const wr = calculateWinrate(m.wins, m.games);
    matchupMatrix[m.attacker_sprite_id][m.defender_sprite_id] = {
      winrate: wr.winrate,
      games: m.games,
      confidence: wr.confidence,
    };
  }

  // 3. Trends (compare current season vs previous)
  const currentSeason = season || new Date().toISOString().slice(0, 7);
  const trends = {};

  const recentLogs = db.prepare(`
    SELECT my_team, result, timestamp
    FROM battle_logs
    WHERE timestamp >= date('now', '-30 days')
    ORDER BY timestamp
  `).all();

  // Group by week for trend detection
  const weeklyWinrates = {};
  for (const log of recentLogs) {
    const week = log.timestamp.slice(0, 10); // simplified to day granularity
    const team = JSON.parse(log.my_team || '[]');
    const isWin = log.result === 'win';
    for (const sid of team) {
      if (!weeklyWinrates[sid]) weeklyWinrates[sid] = {};
      if (!weeklyWinrates[sid][week]) weeklyWinrates[sid][week] = { games: 0, wins: 0 };
      weeklyWinrates[sid][week].games++;
      if (isWin) weeklyWinrates[sid][week].wins++;
    }
  }

  // Compute per-sprite trend from weekly winrates
  for (const [sid, weeks] of Object.entries(weeklyWinrates)) {
    const sortedWeeks = Object.keys(weeks).sort();
    const recentWinrates = sortedWeeks.map(w => ({
      period: w,
      winrate: weeks[w].games > 0 ? weeks[w].wins / weeks[w].games : 0,
    }));
    const trend = detectTrend(recentWinrates);
    trends[sid] = trend;
  }

  return { sprites: spriteWinrates, trends, matchupMatrix };
}

// ── Archetype Aggregation ──

/**
 * Classify all sprites and store archetypes in DB.
 */
export function classifyAllArchetypes() {
  const db = getDb();

  const sprites = db.prepare(`
    SELECT s.id, s.cn_id, s.name_zh, s.base_hp, s.base_atk, s.base_def,
           s.base_spatk, s.base_spdef, s.base_speed, s.playstyle
    FROM sprites s
    WHERE s.base_hp IS NOT NULL AND s.base_hp > 0
  `).all();

  // Get skill tags per sprite
  const tagStmt = db.prepare(`
    SELECT sk.tags FROM skills sk
    JOIN sprite_skills ss ON ss.skill_id = sk.id
    WHERE ss.sprite_id = ?
  `);

  const insert = db.prepare(`
    INSERT INTO sprite_archetypes (sprite_id, primary_archetype, secondary_archetype, confidence, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(sprite_id)
    DO UPDATE SET
      primary_archetype = ?,
      secondary_archetype = ?,
      confidence = ?,
      updated_at = datetime('now')
  `);

  let count = 0;
  const classifyMany = db.transaction(() => {
    for (const sprite of sprites) {
      // Collect all tags
      const tagRows = tagStmt.all(sprite.id);
      const allTags = [];
      for (const row of tagRows) {
        try { allTags.push(...JSON.parse(row.tags || '[]')); } catch {}
      }

      const result = classifyArchetype(sprite, allTags);
      insert.run(
        sprite.id, result.primary, result.secondary, result.confidence,
        result.primary, result.secondary, result.confidence
      );
      count++;
    }
  });

  classifyMany();
  return { classified: count };
}

/**
 * Get archetype distribution summary.
 */
export function getArchetypeDistribution() {
  const db = getDb();
  return db.prepare(`
    SELECT primary_archetype, COUNT(*) as count
    FROM sprite_archetypes
    GROUP BY primary_archetype
    ORDER BY count DESC
  `).all().map(r => ({
    archetype: r.primary_archetype,
    label: getArchetypeLabel(r.primary_archetype),
    count: r.count,
  }));
}
