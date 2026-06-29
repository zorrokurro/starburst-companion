/**
 * 速度/先判計算器
 *
 * 功能：
 * 1. 計算有效速度（含性格/IV/EV/刻印/能力等級）
 * 2. 比較雙方出手順序（priority > speed > tiebreaker）
 * 3. 超車計算（需要多少速度才能超車）
 */

import { calculateStatsFromSprite } from './statCalculator.js';

/**
 * 計算有效速度
 *
 * @param {Object} sprite - DB row (含 base_speed)
 * @param {Object} config - { level, ivs, evs, nature, extraStats, ranks }
 * @returns {number} 最終速度值
 */
export function getEffectiveSpeed(sprite, config = {}) {
  const stats = calculateStatsFromSprite(sprite, config);
  return stats.speed;
}

/**
 * 能力等級對速度的倍率
 *
 * 等級: -6  -5  -4  -3  -2  -1   0  +1  +2  +3  +4  +5  +6
 * 倍率: 0.25 0.33 0.4 0.5 0.67 0.8 1  1.5 2   2.5 3   3.5 4
 */
const RANK_MULTIPLIERS = [0.25, 0.33, 0.4, 0.5, 0.667, 0.8, 1, 1.5, 2, 2.5, 3, 3.5, 4];

export function getSpeedRankMultiplier(rank) {
  const clamped = Math.max(-6, Math.min(6, Math.round(rank)));
  return RANK_MULTIPLIERS[clamped + 6];
}

/**
 * 判定出手順序
 *
 * 規則（賽爾號）：
 * 1. 技能先制等級高的先出手
 * 2. 先制等級相同時，速度快的先出手
 * 3. 速度相同時，攻擊方先出手（同速機制）
 *
 * @param {Object} attacker - { sprite, config, skill }
 * @param {Object} defender - { sprite, config, skill }
 * @returns {{ first: 'attacker'|'attacker'|'tie', reason: string, attackerSpeed: number, defenderSpeed: number }}
 */
export function resolveTurnOrder(attacker, defender) {
  const aSpeed = getEffectiveSpeed(attacker.sprite, attacker.config);
  const dSpeed = getEffectiveSpeed(defender.sprite, defender.config);

  const aPriority = attacker.skill?.priority || 0;
  const dPriority = defender.skill?.priority || 0;

  // 1. 先制等級比較
  if (aPriority !== dPriority) {
    const first = aPriority > dPriority ? 'attacker' : 'defender';
    const winner = first === 'attacker' ? '攻擊方' : '防禦方';
    return {
      first,
      reason: `${winner}先制+${Math.max(aPriority, dPriority)} > 先制+${Math.min(aPriority, dPriority)}`,
      attackerSpeed: aSpeed,
      defenderSpeed: dSpeed,
    };
  }

  // 2. 速度比較
  if (aSpeed !== dSpeed) {
    const first = aSpeed > dSpeed ? 'attacker' : 'defender';
    const diff = Math.abs(aSpeed - dSpeed);
    const winner = first === 'attacker' ? '攻擊方' : '防禦方';
    return {
      first,
      reason: `${winner}速度 ${Math.max(aSpeed, dSpeed)} > ${Math.min(aSpeed, dSpeed)}（差 ${diff}）`,
      attackerSpeed: aSpeed,
      defenderSpeed: dSpeed,
    };
  }

  // 3. 同速 → 攻擊方先出手
  return {
    first: 'attacker',
    reason: `同速 ${aSpeed}，攻擊方先出手`,
    attackerSpeed: aSpeed,
    defenderSpeed: dSpeed,
  };
}

/**
 * 超車計算
 *
 * 計算防禦方需要多少額外速度才能超車攻擊方
 *
 * @param {Object} attacker - { sprite, config, skill }
 * @param {Object} defender - { sprite, config, skill }
 * @returns {{ canOutspeed: boolean, speedDiff: number, neededSpeed: number, currentDefSpeed: number }}
 */
export function calculateSpeedGap(attacker, defender) {
  const aSpeed = getEffectiveSpeed(attacker.sprite, attacker.config);
  const dSpeed = getEffectiveSpeed(defender.sprite, defender.config);
  const aPriority = attacker.skill?.priority || 0;
  const dPriority = defender.skill?.priority || 0;

  // 如果攻擊方先制更高，防禦方無法靠速度超車
  if (aPriority > dPriority) {
    return {
      canOutspeed: false,
      speedDiff: 0,
      neededSpeed: Infinity,
      currentDefSpeed: dSpeed,
      reason: `攻擊方先制+${aPriority}，速度無效`,
    };
  }

  // 如果防禦方先制更高，已經先出手
  if (dPriority > aPriority) {
    return {
      canOutspeed: true,
      speedDiff: 0,
      neededSpeed: dSpeed,
      currentDefSpeed: dSpeed,
      reason: `防禦方先制+${dPriority}，已先出手`,
    };
  }

  // 同先制，比較速度
  const speedDiff = dSpeed - aSpeed;
  if (speedDiff > 0) {
    return {
      canOutspeed: true,
      speedDiff,
      neededSpeed: dSpeed,
      currentDefSpeed: dSpeed,
      reason: `已超速（快 ${speedDiff}）`,
    };
  }

  // 需要比攻擊方快至少 1 才能超車
  const needed = aSpeed + 1;
  return {
    canOutspeed: false,
    speedDiff,
    neededSpeed: needed,
    currentDefSpeed: dSpeed,
    reason: `需速度 ${needed} 才能超車（目前 ${dSpeed}，差 ${needed - dSpeed}）`,
  };
}

/**
 * 速度線標記
 *
 * 標記常見的速度線（Top 精靈的速度），用於判斷是否能超車
 *
 * @param {number} speed - 當前速度
 * @returns {{ tier: string, label: string, color: string }}
 */
export function getSpeedTier(speed) {
  if (speed >= 400) return { tier: 'extreme', label: '極速', color: '#ff4444' };
  if (speed >= 350) return { tier: 'fast', label: '高速', color: '#ff8800' };
  if (speed >= 300) return { tier: 'mid', label: '中速', color: '#ffcc00' };
  if (speed >= 250) return { tier: 'slow', label: '低速', color: '#88cc00' };
  return { tier: 'very_slow', label: '極慢', color: '#888888' };
}
