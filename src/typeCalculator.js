import { getDb } from './db.js';

let typeChartCache = null;

function getTypeChart() {
  if (typeChartCache) return typeChartCache;
  
  const db = getDb();
  const rows = db.prepare('SELECT attack_type, defend_type, multiplier FROM type_chart').all();
  
  typeChartCache = {};
  for (const row of rows) {
    if (!typeChartCache[row.attack_type]) {
      typeChartCache[row.attack_type] = {};
    }
    typeChartCache[row.attack_type][row.defend_type] = row.multiplier;
  }
  
  return typeChartCache;
}

/**
 * Get single-type to single-type effectiveness multiplier
 * @param {string} attackType - Attack type
 * @param {string} defendType - Defend type
 * @returns {number} Multiplier (0, 0.5, 1, or 2)
 */
export function getSingleTypeMultiplier(attackType, defendType) {
  if (attackType === defendType) return 1;
  
  const chart = getTypeChart();
  return chart[attackType]?.[defendType] ?? 1;
}

/**
 * Calculate defense multiplier for single-type attack against dual-type defense
 * Rules:
 * - Split dual-type defense into two single types
 * - Calculate each single-type multiplier
 * - If both are 2: final = 4
 * - If one is 0: final = sum / 4
 * - Otherwise: final = sum / 2
 * @param {string} attackType - Single attack type
 * @param {string[]} defendTypes - Array of 1 or 2 defense types
 * @returns {number} Final multiplier
 */
export function calculateDefenseMultiplier(attackType, defendTypes) {
  if (defendTypes.length === 1) {
    return getSingleTypeMultiplier(attackType, defendTypes[0]);
  }
  
  const m1 = getSingleTypeMultiplier(attackType, defendTypes[0]);
  const m2 = getSingleTypeMultiplier(attackType, defendTypes[1]);
  
  if (m1 === 2 && m2 === 2) return 4;
  if (m1 === 0 || m2 === 0) return (m1 + m2) / 4;
  return (m1 + m2) / 2;
}

/**
 * Calculate defense multiplier for dual-type attack against single/dual-type defense
 * Rules:
 * - Split dual-type attack into two single types
 * - Calculate each single-type multiplier against defense
 * - If both are 2: final = 4
 * - If one is 0: final = sum / 4
 * - Otherwise: final = sum / 2
 * @param {string[]} attackTypes - Array of 1 or 2 attack types
 * @param {string[]} defendTypes - Array of 1 or 2 defense types
 * @returns {number} Final multiplier
 */
export function calculateTypeMultiplier(attackTypes, defendTypes) {
  if (attackTypes.length === 1 && defendTypes.length === 1) {
    return getSingleTypeMultiplier(attackTypes[0], defendTypes[0]);
  }
  
  if (attackTypes.length === 1) {
    return calculateDefenseMultiplier(attackTypes[0], defendTypes);
  }
  
  // Dual-type attack: calculate each attack type's multiplier against defense, then average
  const m1 = calculateDefenseMultiplier(attackTypes[0], defendTypes);
  const m2 = calculateDefenseMultiplier(attackTypes[1], defendTypes);
  
  if (m1 === 2 && m2 === 2) return 4;
  if (m1 === 0 || m2 === 0) return (m1 + m2) / 4;
  return (m1 + m2) / 2;
}

/**
 * Get all type effectiveness relationships for a given defense type(s)
 * @param {string[]} defendTypes - Defense type(s)
 * @returns {{ superEffective: Array, notEffective: Array, immune: Array }}
 */
export function getTypeEffectivenessAgainst(defendTypes) {
  const allTypes = Object.keys(getTypeChart());
  
  const superEffective = []; // multiplier > 1
  const notEffective = [];   // multiplier < 1 and > 0
  const immune = [];         // multiplier = 0
  const normal = [];         // multiplier = 1
  
  for (const attackType of allTypes) {
    const multiplier = calculateTypeMultiplier([attackType], defendTypes);
    
    if (multiplier >= 2) {
      superEffective.push({ type: attackType, multiplier });
    } else if (multiplier > 0 && multiplier < 1) {
      notEffective.push({ type: attackType, multiplier });
    } else if (multiplier === 0) {
      immune.push({ type: attackType, multiplier });
    } else {
      normal.push({ type: attackType, multiplier });
    }
  }
  
  return { superEffective, notEffective, immune, normal };
}

/**
 * Calculate STAB (Same Type Attack Bonus)
 * Single-type sprite using same-type skill: 1.5x
 * Dual-type sprite using either of its types' skills: 1.5x
 * @param {string[]} spriteTypes - Sprite's types
 * @param {string} skillType - Skill's type
 * @returns {number} STAB multiplier (1 or 1.5)
 */
export function calculateSTAB(spriteTypes, skillType) {
  if (!skillType || !spriteTypes || spriteTypes.length === 0) return 1;
  return spriteTypes.includes(skillType) ? 1.5 : 1;
}

/**
 * Build complete type chart matrix for display
 * @returns {Object} Matrix of multipliers [attackType][defendType]
 */
export function getTypeChartMatrix() {
  return getTypeChart();
}
