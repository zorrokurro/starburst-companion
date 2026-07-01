/**
 * Archetype Classifier — Sprite Tactical Role Classification
 *
 * Classifies sprites into archetypes based on stats and skill tags.
 * Pure logic module, no DB dependency.
 *
 * Phase 2: Meta System
 */

// ── Archetype Definitions ──

const ARCHETYPES = {
  burst_attacker: {
    name: 'burst_attacker',
    label: '爆發攻擊',
    description: '高攻擊/特攻，追求一擊必殺',
    statWeights: { atk: 0.35, spatk: 0.35, speed: 0.2, hp: 0.05, def: 0.025, spdef: 0.025 },
    tagBonus: ['damage', 'pierce', 'crit_boost'],
    tagPenalty: ['heal', 'shield'],
  },
  sustained_attacker: {
    name: 'sustained_attacker',
    label: '持續攻擊',
    description: '穩定輸出，有續航能力',
    statWeights: { atk: 0.25, spatk: 0.25, hp: 0.2, speed: 0.15, def: 0.075, spdef: 0.075 },
    tagBonus: ['drain', 'heal', 'damage'],
    tagPenalty: [],
  },
  tank: {
    name: 'tank',
    label: '坦克',
    description: '高防禦/特防/體力，承受傷害',
    statWeights: { hp: 0.35, def: 0.25, spdef: 0.25, atk: 0.05, spatk: 0.05, speed: 0.05 },
    tagBonus: ['shield', 'heal', 'damage_reduce'],
    tagPenalty: ['pierce', 'priority'],
  },
  speedster: {
    name: 'speedster',
    label: '速度型',
    description: '高速度，搶先手',
    statWeights: { speed: 0.45, atk: 0.2, spatk: 0.2, hp: 0.05, def: 0.05, spdef: 0.05 },
    tagBonus: ['priority', 'control'],
    tagPenalty: ['shield', 'heal'],
  },
  support: {
    name: 'support',
    label: '輔助',
    description: '回血/護盾/增益，支援隊友',
    statWeights: { hp: 0.25, spdef: 0.2, def: 0.2, speed: 0.15, atk: 0.1, spatk: 0.1 },
    tagBonus: ['heal', 'shield', 'buff', 'cleansing'],
    tagPenalty: ['damage', 'pierce'],
  },
  disruptive: {
    name: 'disruptive',
    label: '控場',
    description: '異常狀態/削弱，干擾對手',
    statWeights: { speed: 0.25, atk: 0.2, spatk: 0.2, hp: 0.15, def: 0.1, spdef: 0.1 },
    tagBonus: ['control', 'debuff', 'pp_drain'],
    tagPenalty: ['heal', 'shield'],
  },
  balanced: {
    name: 'balanced',
    label: '平衡',
    description: '能力均衡，無明顯傾向',
    statWeights: { atk: 0.167, spatk: 0.167, hp: 0.167, speed: 0.167, def: 0.167, spdef: 0.165 },
    tagBonus: [],
    tagPenalty: [],
  },
};

// ── Classification Logic ──

/**
 * Normalize stats to 0-1 range based on typical distributions.
 */
function normalizeStats(baseStats) {
  const maxStat = { hp: 500, atk: 300, def: 300, spatk: 300, spdef: 300, speed: 300 };
  // Support both base_hp and hp naming conventions
  const get = (stat) => Number(baseStats[stat] || baseStats[`base_${stat}`] || 0);
  return {
    hp: Math.min(get('hp') / maxStat.hp, 1),
    atk: Math.min(get('atk') / maxStat.atk, 1),
    def: Math.min(get('def') / maxStat.def, 1),
    spatk: Math.min(get('spatk') / maxStat.spatk, 1),
    spdef: Math.min(get('spdef') / maxStat.spdef, 1),
    speed: Math.min(get('speed') / maxStat.speed, 1),
  };
}

/**
 * Calculate archetype score based on stats.
 */
function calculateStatScore(normalizedStats, archetype) {
  const weights = ARCHETYPES[archetype].statWeights;
  let score = 0;
  for (const [stat, weight] of Object.entries(weights)) {
    score += (normalizedStats[stat] || 0) * weight;
  }
  return score;
}

/**
 * Calculate tag bonus/penalty.
 */
function calculateTagModifier(tags, archetype) {
  const def = ARCHETYPES[archetype];
  let modifier = 0;
  for (const tag of tags) {
    if (def.tagBonus.includes(tag)) modifier += 0.1;
    if (def.tagPenalty.includes(tag)) modifier -= 0.05;
  }
  return modifier;
}

/**
 * Classify a sprite into archetypes with confidence scores.
 *
 * @param {Object} sprite - { base_hp, base_atk, base_def, base_spatk, base_spdef, base_speed }
 * @param {string[]} tags - Skill tags from sprite_skills
 * @returns {{ primary: string, secondary: string|null, scores: Object, confidence: number }}
 */
export function classifyArchetype(sprite, tags = []) {
  const normalized = normalizeStats(sprite);
  const scores = {};

  for (const archetype of Object.keys(ARCHETYPES)) {
    const statScore = calculateStatScore(normalized, archetype);
    const tagMod = calculateTagModifier(tags, archetype);
    scores[archetype] = Math.max(0, statScore + tagMod);
  }

  // Sort by score
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0];
  const secondary = sorted[1][1] > sorted[0][1] * 0.8 ? sorted[1][0] : null;

  // Confidence: gap between first and second
  const gap = sorted[0][1] - (sorted[1]?.[1] || 0);
  const confidence = Math.min(0.5 + gap * 2, 1.0);

  return { primary, secondary, scores, confidence };
}

/**
 * Get archetype label (Chinese).
 */
export function getArchetypeLabel(archetype) {
  return ARCHETYPES[archetype]?.label || archetype;
}

/**
 * Get all archetype definitions.
 */
export function getArchetypeDefinitions() {
  return Object.values(ARCHETYPES).map(a => ({
    name: a.name,
    label: a.label,
    description: a.description,
  }));
}

export { ARCHETYPES };
