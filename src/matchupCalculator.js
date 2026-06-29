/**
 * 全對位計算引擎
 *
 * 功能：
 * 1. NxM 雙向傷害計算（我方 N 個精靈 vs 敵方 M 個精靈）
 * 2. 速度/先制判定
 * 3. 最佳對位推薦
 * 4. 風險評估
 */

import { calculateAllSkillsDamage, resolveStats } from './damageCalculator.js';
import { resolveTurnOrder, getEffectiveSpeed } from './speedCalculator.js';
import { getAllGenericTraits } from './db.js';

/**
 * 計算單一對位的雙向傷害
 *
 * @param {Object} attacker - 攻擊方精靈 DB row
 * @param {Object} defender - 防禦方精靈 DB row
 * @param {Array} attackerSkills - 攻擊方技能
 * @param {Array} defenderSkills - 防禦方技能
 * @param {Object} params - 全部戰鬥參數
 * @returns {Object} 雙向傷害結果
 */
export function calculateMatchup(attacker, defender, attackerSkills, defenderSkills, params = {}) {
  const {
    attackerLevel = 100,
    defenderLevel = 100,
    attackerIVs = {},
    defenderIVs = {},
    attackerEVs = {},
    defenderEVs = {},
    attackerNature = null,
    defenderNature = null,
    attackerExtraStats = {},
    defenderExtraStats = {},
    attackerRanks = {},
    defenderRanks = {},
    attackerTraits = null,
    defenderTraits = null,
    traitCache = null,
    options = {},
  } = params;

  // 雙向傷害
  const atkToDef = calculateAllSkillsDamage(attacker, defender, attackerSkills, {
    attackerLevel, defenderLevel,
    attackerIVs, defenderIVs,
    attackerEVs, defenderEVs,
    attackerNature, defenderNature,
    attackerExtraStats, defenderExtraStats,
    attackerRanks, defenderRanks,
    attackerTraits, defenderTraits,
    traitCache, options,
  });

  const defToAtk = calculateAllSkillsDamage(defender, attacker, defenderSkills, {
    attackerLevel: defenderLevel,
    defenderLevel: attackerLevel,
    attackerIVs: defenderIVs,
    defenderIVs: attackerIVs,
    attackerEVs: defenderEVs,
    defenderEVs: attackerEVs,
    attackerNature: defenderNature,
    defenderNature: attackerNature,
    attackerExtraStats: defenderExtraStats,
    defenderExtraStats: attackerExtraStats,
    attackerRanks: defenderRanks,
    defenderRanks: attackerRanks,
    attackerTraits: defenderTraits,
    defenderTraits: attackerTraits,
    traitCache, options,
  });

  // 速度分析
  const aStats = resolveStats(attacker, {
    level: attackerLevel, ivs: attackerIVs, evs: attackerEVs,
    nature: attackerNature, extraStats: attackerExtraStats, ranks: attackerRanks,
  });
  const dStats = resolveStats(defender, {
    level: defenderLevel, ivs: defenderIVs, evs: defenderEVs,
    nature: defenderNature, extraStats: defenderExtraStats, ranks: defenderRanks,
  });

  // 最佳技能（按推薦排序）
  const bestAtkSkill = atkToDef.sort((a, b) => {
    if (a.ohko.status === 'guaranteed' && b.ohko.status !== 'guaranteed') return -1;
    if (b.ohko.status === 'guaranteed' && a.ohko.status !== 'guaranteed') return 1;
    return b.damage.avg - a.damage.avg;
  })[0] || null;

  const bestDefSkill = defToAtk.sort((a, b) => {
    if (a.ohko.status === 'guaranteed' && b.ohko.status !== 'guaranteed') return -1;
    if (b.ohko.status === 'guaranteed' && a.ohko.status !== 'guaranteed') return 1;
    return b.damage.avg - a.damage.avg;
  })[0] || null;

  // 攻擊方對防禦方的威脅評分
  const atkThreat = calculateThreatScore(atkToDef, aStats.hp);
  // 防禦方對攻擊方的威脅評分
  const defThreat = calculateThreatScore(defToAtk, dStats.hp);

  return {
    attacker: { sprite: attacker, stats: aStats },
    defender: { sprite: defender, stats: dStats },
    atkToDef,
    defToAtk,
    bestAtkSkill,
    bestDefSkill,
    atkThreat,
    defThreat,
  };
}

/**
 * 計算威脅評分（0-100）
 *
 * 基於：確殺數量 + 平均傷害比例 + 狀態控制
 *
 * @param {Array} damageResults - calculateAllSkillsDamage 的結果
 * @param {number} attackerMaxHP - 評分對象的最大 HP
 * @returns {number} 0-100 的威脅分數
 */
export function calculateThreatScore(damageResults, attackerMaxHP) {
  if (!damageResults || damageResults.length === 0) return 0;

  let score = 0;

  for (const r of damageResults) {
    // 確殺 = 40 分
    if (r.ohko.status === 'guaranteed') {
      score += 40;
    }
    // 可能秒殺 = 20 分 × 機率
    else if (r.ohko.status === 'chance') {
      score += 20 * (r.ohko.probability / 100);
    }

    // 傷害比例（最高 30 分）
    const dmgPct = r.damage.avg / attackerMaxHP;
    score += Math.min(30, dmgPct * 50);

    // 狀態控制（最多 10 分）
    if (r.skill.effect_desc) {
      const statusMatches = r.skill.effect_desc.match(/害怕|麻害怕|麻痺|凍傷|睡眠|石化|混亂|冰封|癱瘓/g);
      if (statusMatches) {
        score += Math.min(10, statusMatches.length * 3);
      }
    }
  }

  return Math.min(100, Math.round(score));
}

/**
 * 全對位計算（NxM）
 *
 * 計算我方 N 個精靈 vs 敵方 M 個精靈的所有對位
 *
 * @param {Array} myTeam - 我方精靈陣列
 * @param {Array} enemyTeam - 敵方精靈陣列
 * @param {Object} configs - 我方/敵方配置 { my: [...], enemy: [...] }
 * @returns {Object} 全對位結果
 */
export function calculateFullMatchup(myTeam, enemyTeam, configs = {}) {
  const myConfigs = configs.my || [];
  const enemyConfigs = configs.enemy || [];
  const traitCache = getAllGenericTraits();

  const matrix = [];

  for (let i = 0; i < myTeam.length; i++) {
    const row = [];
    const mySprite = myTeam[i];
    const myConfig = myConfigs[i] || { level: 100 };
    const mySkills = mySprite.selectedSkills || mySprite.skills || [];

    for (let j = 0; j < enemyTeam.length; j++) {
      const enemySprite = enemyTeam[j];
      const enemyConfig = enemyConfigs[j] || { level: 100 };
      const enemySkills = enemySprite.selectedSkills || enemySprite.skills || [];

      const matchup = calculateMatchup(mySprite, enemySprite, mySkills, enemySkills, {
        attackerLevel: myConfig.level || 100,
        defenderLevel: enemyConfig.level || 100,
        attackerIVs: myConfig.ivs || {},
        defenderIVs: enemyConfig.ivs || {},
        attackerEVs: myConfig.evs || {},
        defenderEVs: enemyConfig.evs || {},
        attackerNature: myConfig.nature || null,
        defenderNature: enemyConfig.nature || null,
        attackerExtraStats: myConfig.extraStats || {},
        defenderExtraStats: enemyConfig.extraStats || {},
        attackerRanks: myConfig.abilityRanks || {},
        defenderRanks: enemyConfig.abilityRanks || {},
        attackerTraits: myConfig.trait || null,
        defenderTraits: enemyConfig.trait || null,
        traitCache,
      });

      row.push(matchup);
    }
    matrix.push(row);
  }

  // 為每個敵方精靈找最佳對位
  const bestCounters = [];
  for (let j = 0; j < enemyTeam.length; j++) {
    let bestScore = -1;
    let bestI = 0;
    for (let i = 0; i < myTeam.length; i++) {
      const m = matrix[i][j];
      const score = m.atkThreat - m.defThreat;
      if (score > bestScore) {
        bestScore = score;
        bestI = i;
      }
    }
    bestCounters.push({
      enemyIndex: j,
      myIndex: bestI,
      score: bestScore,
    });
  }

  // 為每個我方精靈找最佳對位
  const bestTargets = [];
  for (let i = 0; i < myTeam.length; i++) {
    let bestScore = -1;
    let bestJ = 0;
    for (let j = 0; j < enemyTeam.length; j++) {
      const m = matrix[i][j];
      const score = m.atkThreat - m.defThreat;
      if (score > bestScore) {
        bestScore = score;
        bestJ = j;
      }
    }
    bestTargets.push({
      myIndex: i,
      enemyIndex: bestJ,
      score: bestScore,
    });
  }

  return {
    matrix,
    bestCounters,
    bestTargets,
    myTeam,
    enemyTeam,
  };
}

/**
 * 生成對位建議文字報告
 *
 * @param {Object} fullMatchup - calculateFullMatchup 的結果
 * @returns {string} 格式化的文字報告
 */
export function generateMatchupReport(fullMatchup) {
  const { matrix, bestCounters, myTeam, enemyTeam } = fullMatchup;
  const lines = [];

  lines.push('═══ 對位建議報告 ═══');
  lines.push('');

  // 最佳派出建議
  lines.push('── 最佳派出建議 ──');
  for (const counter of bestCounters) {
    const myName = myTeam[counter.myIndex]?.name_zh || `精靈${counter.myIndex + 1}`;
    const enemyName = enemyTeam[counter.enemyIndex]?.name_zh || `敵方${counter.enemyIndex + 1}`;
    const m = matrix[counter.myIndex][counter.enemyIndex];
    const atkDmg = m.bestAtkSkill ? `${m.bestAtkSkill.damage.avg} (${m.bestAtkSkill.hpPercentage.avg}%)` : '無技能';
    const defDmg = m.bestDefSkill ? `${m.bestDefSkill.damage.avg} (${m.bestDefSkill.hpPercentage.avg}%)` : '無技能';

    lines.push(`  對 ${enemyName}：派 ${myName}`);
    lines.push(`    我方最佳：${m.bestAtkSkill?.skill.name || '—'} → ${atkDmg}`);
    lines.push(`    敵方最佳：${m.bestDefSkill?.skill.name || '—'} → ${defDmg}`);
    lines.push(`    威脅差：+${counter.score}`);
    lines.push('');
  }

  return lines.join('\n');
}
