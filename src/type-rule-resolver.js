/**
 * Type Rule Resolver — Rule Engine for Type Effectiveness
 *
 * Layers: base chart → modifiers → exceptions
 * Returns final multiplier with full breakdown for debugging.
 *
 * TASK 3: Type System Rule Engine
 */

/**
 * Resolve type effectiveness with rule layering and breakdown.
 *
 * @param {string} attackType - Single attack type
 * @param {string} defendType - Single defense type
 * @param {Array} rules - Array of type_chart rows, sorted by rule_type priority
 * @param {Object} [context] - Optional context for future modifiers
 * @returns {{ finalMultiplier: number, breakdown: Array, confidence: number }}
 */
export function resolveTypeEffectiveness(attackType, defendType, rules, context = {}) {
  const breakdown = [];
  let finalMultiplier = 1.0;
  let minConfidence = 1.0;

  // Filter rules matching this attack-defend pair
  const matchingRules = rules.filter(
    r => r.attack_type === attackType && r.defend_type === defendType
  );

  // Sort by rule_type priority: base < modifier < exception
  const priority = { base: 0, modifier: 1, exception: 2 };
  matchingRules.sort((a, b) => (priority[a.rule_type] || 0) - (priority[b.rule_type] || 0));

  for (const rule of matchingRules) {
    const prevMultiplier = finalMultiplier;
    finalMultiplier = rule.multiplier;
    minConfidence = Math.min(minConfidence, rule.confidence || 1.0);

    breakdown.push({
      ruleType: rule.rule_type,
      multiplier: rule.multiplier,
      source: rule.source,
      confidence: rule.confidence,
      note: rule.note,
      previousMultiplier: prevMultiplier,
    });
  }

  // If no rules matched, multiplier is 1.0 (normal effectiveness)
  if (matchingRules.length === 0) {
    breakdown.push({
      ruleType: 'default',
      multiplier: 1.0,
      source: 'implicit',
      confidence: 1.0,
      note: 'No explicit rule — normal effectiveness',
      previousMultiplier: 1.0,
    });
  }

  return {
    finalMultiplier,
    breakdown,
    confidence: minConfidence,
  };
}

/**
 * Resolve dual-type defense (single attack vs dual defense).
 *
 * @param {string} attackType
 * @param {string[]} defendTypes - 1 or 2 defense types
 * @param {Array} rules
 * @param {Object} [context]
 * @returns {{ finalMultiplier: number, breakdown: Array, confidence: number }}
 */
export function resolveDualDefense(attackType, defendTypes, rules, context = {}) {
  if (defendTypes.length === 1) {
    return resolveTypeEffectiveness(attackType, defendTypes[0], rules, context);
  }

  const r1 = resolveTypeEffectiveness(attackType, defendTypes[0], rules, context);
  const r2 = resolveTypeEffectiveness(attackType, defendTypes[1], rules, context);

  const m1 = r1.finalMultiplier;
  const m2 = r2.finalMultiplier;

  let final;
  if (m1 === 2 && m2 === 2) final = 4;
  else if (m1 === 0 || m2 === 0) final = (m1 + m2) / 4;
  else final = (m1 + m2) / 2;

  return {
    finalMultiplier: final,
    breakdown: [
      { against: defendTypes[0], ...r1 },
      { against: defendTypes[1], ...r2 },
    ],
    confidence: Math.min(r1.confidence, r2.confidence),
  };
}

/**
 * Resolve dual-type attack (dual attack vs single/dual defense).
 *
 * @param {string[]} attackTypes - 1 or 2 attack types
 * @param {string[]} defendTypes - 1 or 2 defense types
 * @param {Array} rules
 * @param {Object} [context]
 * @returns {{ finalMultiplier: number, breakdown: Array, confidence: number }}
 */
export function resolveFullTypeEffectiveness(attackTypes, defendTypes, rules, context = {}) {
  if (attackTypes.length === 1 && defendTypes.length === 1) {
    return resolveTypeEffectiveness(attackTypes[0], defendTypes[0], rules, context);
  }

  if (attackTypes.length === 1) {
    return resolveDualDefense(attackTypes[0], defendTypes, rules, context);
  }

  // Dual-type attack: resolve each attack type against defense, then average
  const r1 = resolveDualDefense(attackTypes[0], defendTypes, rules, context);
  const r2 = resolveDualDefense(attackTypes[1], defendTypes, rules, context);

  const m1 = r1.finalMultiplier;
  const m2 = r2.finalMultiplier;

  let final;
  if (m1 === 2 && m2 === 2) final = 4;
  else if (m1 === 0 || m2 === 0) final = (m1 + m2) / 4;
  else final = (m1 + m2) / 2;

  return {
    finalMultiplier: final,
    breakdown: [
      { attackType: attackTypes[0], ...r1 },
      { attackType: attackTypes[1], ...r2 },
    ],
    confidence: Math.min(r1.confidence, r2.confidence),
  };
}

/**
 * Get all type effectiveness relationships for a given defense type(s).
 * Returns structured list with breakdown for each attack type.
 *
 * @param {string[]} defendTypes
 * @param {Array} rules
 * @returns {{ superEffective: Array, notEffective: Array, immune: Array, normal: Array }}
 */
export function resolveTypeEffectivenessAgainst(defendTypes, rules) {
  // Collect all unique attack types from rules
  const attackTypes = [...new Set(rules.map(r => r.attack_type))];

  const superEffective = [];
  const notEffective = [];
  const immune = [];
  const normal = [];

  for (const attackType of attackTypes) {
    const result = resolveDualDefense(attackType, defendTypes, rules);
    const m = result.finalMultiplier;

    const entry = { type: attackType, multiplier: m, confidence: result.confidence };

    if (m >= 2) superEffective.push(entry);
    else if (m > 0 && m < 1) notEffective.push(entry);
    else if (m === 0) immune.push(entry);
    else normal.push(entry);
  }

  return { superEffective, notEffective, immune, normal };
}
