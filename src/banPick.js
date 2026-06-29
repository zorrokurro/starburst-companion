/**
 * Ban/Pick 系統
 *
 * 功能：
 * 1. 威脅排序（根據對方陣容分析最危险的精靈）
 * 2. 安全名單（對方不太可能 ban 的精靈）
 * 3. Pick 建議（根據當前 ban/pick 狀態推薦下一個 pick）
 */

import { calculateThreatScore, calculateMatchup } from './matchupCalculator.js';
import { resolveStats } from './damageCalculator.js';
import { getEffectiveSpeed } from './speedCalculator.js';
import { getAllGenericTraits } from './db.js';

/**
 * 分析威脅排序
 *
 * 根據我方陣容，計算每個精靈對我方的威脅程度
 *
 * @param {Array} enemyPool - 候選精靈池（所有可能的敵方精靈）
 * @param {Array} myTeam - 我方陣容
 * @param {Object} myConfigs - 我方配置
 * @returns {Array} 按威脅分數排序的精靈列表
 */
export function analyzeThreats(enemyPool, myTeam, myConfigs = {}) {
  const traitCache = getAllGenericTraits();
  const threats = [];

  for (const enemy of enemyPool) {
    let totalThreat = 0;
    let worstMatchup = null;
    let worstScore = -Infinity;

    for (let i = 0; i < myTeam.length; i++) {
      const mySprite = myTeam[i];
      if (!mySprite) continue;
      const myConfig = myConfigs[i] || { level: 100 };
      const mySkills = mySprite.selectedSkills || mySprite.skills || [];
      const enemySkills = enemy.skills || [];

      try {
        const matchup = calculateMatchup(enemy, mySprite, enemySkills, mySkills, {
          attackerLevel: 100, defenderLevel: myConfig.level || 100,
          attackerIVs: {}, defenderIVs: myConfig.ivs || {},
          attackerEVs: {}, defenderEVs: myConfig.evs || {},
          attackerNature: null, defenderNature: myConfig.nature || null,
          attackerExtraStats: {}, defenderExtraStats: myConfig.extraStats || {},
          attackerRanks: {}, defenderRanks: myConfig.abilityRanks || {},
          attackerTraits: null, defenderTraits: myConfig.trait || null,
          traitCache,
        });

        totalThreat += matchup.atkThreat;
        if (matchup.atkThreat > worstScore) {
          worstScore = matchup.atkThreat;
          worstMatchup = mySprite.name_zh;
        }
      } catch {
        // skip invalid matchups
      }
    }

    threats.push({
      sprite: enemy,
      totalThreat,
      worstMatchup,
      worstScore,
    });
  }

  threats.sort((a, b) => b.totalThreat - a.totalThreat);
  return threats;
}

/**
 * 生成 Ban 建議
 *
 * @param {Array} threats - analyzeThreats 的結果
 * @param {number} banCount - 需要 ban 的數量（預設 3）
 * @returns {{ bans: Array, reasoning: Array }}
 */
export function suggestBans(threats, banCount = 3) {
  const bans = threats.slice(0, banCount);
  const reasoning = bans.map((t, i) =>
    `${i + 1}. ${t.sprite.name_zh}（威脅分 ${t.totalThreat}，最克制我方 ${t.worstMatchup}）`
  );

  return { bans, reasoning };
}

/**
 * 生成 Pick 建議
 *
 * 根據當前已 pick 的精靈和對方已 pick 的精靈，建議下一個 pick
 *
 * @param {Array} myPicks - 我方已 pick 的精靈
 * @param {Array} enemyPicks - 敵方已 pick 的精靈
 * @param {Array} myPool - 我方可用精靈池
 * @param {Array} enemyPool - 敵方可能的精靈池
 * @returns {{ recommended: Array, reasoning: string }}
 */
export function suggestPick(myPicks, enemyPicks, myPool, enemyPool) {
  // 計算每個候選精靈對敵方已 pick 精靈的總威脅
  const candidates = myPool.filter(p =>
    !myPicks.some(mp => mp?.name_zh === p.name_zh)
  );

  const scored = candidates.map(sprite => {
    let score = 0;

    // 對敵方已 pick 的威脅
    for (const enemy of enemyPicks) {
      if (!enemy) continue;
      const enemySkills = enemy.skills || [];
      const spriteSkills = sprite.selectedSkills || sprite.skills || [];
      try {
        const matchup = calculateMatchup(sprite, enemy, spriteSkills, enemySkills, {
          attackerLevel: 100, defenderLevel: 100,
        });
        score += matchup.atkThreat;
      } catch {
        // skip
      }
    }

    // 被敵方已 pick 克制的風險（扣分）
    for (const enemy of enemyPicks) {
      if (!enemy) continue;
      const enemySkills = enemy.skills || [];
      const spriteSkills = sprite.selectedSkills || sprite.skills || [];
      try {
        const matchup = calculateMatchup(enemy, sprite, enemySkills, spriteSkills, {
          attackerLevel: 100, defenderLevel: 100,
        });
        score -= matchup.atkThreat * 0.5;
      } catch {
        // skip
      }
    }

    return { sprite, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const recommended = scored.slice(0, 3);
  const reasoning = recommended.length > 0
    ? `推薦 ${recommended[0].sprite.name_zh}（對位分 ${Math.round(recommended[0].score)}）`
    : '無可用精靈';

  return { recommended, reasoning };
}

/**
 * 分析 Pick/Ban 安全名單
 *
 * 哪些精靈不太可能被 ban，可以放心留到後面 pick
 *
 * @param {Array} myPool - 我方精靈池
 * @param {Array} enemyPool - 敵方精靈池
 * @returns {{ safe: Array, risky: Array }}
 */
export function analyzePickSafety(myPool, enemyPool) {
  const threats = analyzeThreats(enemyPool, myPool);

  // 高威脅的精靈容易被 ban
  const avgThreat = threats.reduce((s, t) => s + t.totalThreat, 0) / (threats.length || 1);
  const threshold = avgThreat * 0.8;

  const risky = threats.filter(t => t.totalThreat >= threshold).map(t => t.sprite);
  const safe = threats.filter(t => t.totalThreat < threshold).map(t => t.sprite);

  return { safe, risky };
}
