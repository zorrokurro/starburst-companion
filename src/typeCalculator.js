/**
 * Type Calculator — Type Effectiveness Engine
 *
 * Uses type-rule-resolver for rule layering and breakdown.
 * Maintains backward compatibility with existing API.
 *
 * TASK 3: Type System Rule Engine
 */
import { getDb } from './db.js';
import {
  resolveTypeEffectiveness,
  resolveDualDefense,
  resolveFullTypeEffectiveness,
  resolveTypeEffectivenessAgainst,
} from './type-rule-resolver.js';

let typeChartCache = null;
let rulesCache = null;

function loadRules() {
  if (rulesCache) return rulesCache;
  const db = getDb();
  rulesCache = db.prepare(
    'SELECT attack_type, defend_type, multiplier, rule_type, source, confidence, note FROM type_chart'
  ).all();
  return rulesCache;
}

function getTypeChart() {
  if (typeChartCache) return typeChartCache;

  const rules = loadRules();
  typeChartCache = {};
  for (const row of rules) {
    if (!typeChartCache[row.attack_type]) {
      typeChartCache[row.attack_type] = {};
    }
    // Use base rules for the flat cache (backward compat)
    if (row.rule_type === 'base' || !typeChartCache[row.attack_type][row.defend_type]) {
      typeChartCache[row.attack_type][row.defend_type] = row.multiplier;
    }
  }

  return typeChartCache;
}

/**
 * Get single-type to single-type effectiveness multiplier (backward compat)
 * @param {string} attackType
 * @param {string} defendType
 * @returns {number}
 */
export function getSingleTypeMultiplier(attackType, defendType) {
  if (attackType === defendType) return 1;
  const chart = getTypeChart();
  return chart[attackType]?.[defendType] ?? 1;
}

/**
 * Resolve single-type attack vs single-type defense with full breakdown.
 * @returns {{ finalMultiplier: number, breakdown: Array, confidence: number }}
 */
export function resolveSingleType(attackType, defendType) {
  if (attackType === defendType) {
    return {
      finalMultiplier: 1,
      breakdown: [{ ruleType: 'self', multiplier: 1, source: 'implicit', confidence: 1.0 }],
      confidence: 1.0,
    };
  }
  return resolveTypeEffectiveness(attackType, defendType, loadRules());
}

/**
 * Calculate defense multiplier for single-type attack against dual-type defense (backward compat)
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
 * Calculate type multiplier for any attack/defense combo (backward compat)
 */
export function calculateTypeMultiplier(attackTypes, defendTypes) {
  if (attackTypes.length === 1 && defendTypes.length === 1) {
    return getSingleTypeMultiplier(attackTypes[0], defendTypes[0]);
  }

  if (attackTypes.length === 1) {
    return calculateDefenseMultiplier(attackTypes[0], defendTypes);
  }

  const m1 = calculateDefenseMultiplier(attackTypes[0], defendTypes);
  const m2 = calculateDefenseMultiplier(attackTypes[1], defendTypes);

  if (m1 === 2 && m2 === 2) return 4;
  if (m1 === 0 || m2 === 0) return (m1 + m2) / 4;
  return (m1 + m2) / 2;
}

/**
 * Resolve full type effectiveness with breakdown (new API).
 * @returns {{ finalMultiplier: number, breakdown: Array, confidence: number }}
 */
export function resolveTypeMatchup(attackTypes, defendTypes) {
  return resolveFullTypeEffectiveness(attackTypes, defendTypes, loadRules());
}

/**
 * Get all type effectiveness relationships (backward compat + breakdown)
 */
export function getTypeEffectivenessAgainst(defendTypes) {
  return resolveTypeEffectivenessAgainst(defendTypes, loadRules());
}

/**
 * Calculate STAB (backward compat)
 */
export function calculateSTAB(spriteTypes, skillType) {
  if (!skillType || !spriteTypes || spriteTypes.length === 0) return 1;
  return spriteTypes.includes(skillType) ? 1.5 : 1;
}

/**
 * Build complete type chart matrix (backward compat)
 */
export function getTypeChartMatrix() {
  return getTypeChart();
}

/**
 * Get raw rules (for debugging / display)
 */
export function getTypeRules() {
  return loadRules();
}
