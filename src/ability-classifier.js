/**
 * Ability Classifier — Generic Traits Semantic Layer
 *
 * Classifies generic traits into structured semantic categories.
 * Pure logic module, no DB dependency.
 *
 * TASK 2: Ability Taxonomy
 */

// ── Trigger Type Detection ──

const TRIGGER_PATTERNS = [
  { type: 'on_hit_received', patterns: [/受到攻擊傷害時/, /受到攻擊後/] },
  { type: 'on_attack',       patterns: [/使用攻擊技能時/, /使用攻擊技能後/, /使用攻擊技能/] },
  { type: 'on_deal_damage',  patterns: [/造成傷害後/, /造成攻擊傷害後/] },
  { type: 'on_crit',         patterns: [/受到暴擊傷害時/] },
  { type: 'passive',         patterns: [/所有技能.*增加/, /每次造成傷害/] },
];

function detectTriggerType(desc) {
  if (!desc) return 'passive';
  for (const rule of TRIGGER_PATTERNS) {
    for (const pat of rule.patterns) {
      if (pat.test(desc)) return rule.type;
    }
  }
  return 'passive';
}

// ── Effect Type Detection ──

const EFFECT_PATTERNS = [
  { type: 'damage_boost',    patterns: [/威力增加/, /伤害增加/] },
  { type: 'stat_buff',       patterns: [/攻擊\+/, /特攻\+/, /防禦\+/, /特防\+/, /速度\+/, /全屬性\+/, /能力.*上升/] },
  { type: 'stat_debuff',     patterns: [/攻擊-/, /特攻-/, /防禦-/, /特防-/, /速度-/, /能力.*下降/] },
  { type: 'status_inflict',  patterns: [/冰凍/, /灼傷/, /中毒/, /害怕/, /麻痺/, /入睡/, /冰封/, /睡眠/] },
  { type: 'heal',            patterns: [/回復.*體力/, /回復.*生命/, /回復.*HP/] },
  { type: 'damage_reduce',   patterns: [/傷害減少/, /受到.*傷害減少/] },
  { type: 'damage免疫',      patterns: [/免疫.*傷害/, /擋傷/] },
  { type: 'crit_boost',      patterns: [/致命一擊率增加/, /暴擊率增加/] },
  { type: 'accuracy_boost',  patterns: [/命中率增加/] },
  { type: 'dodge_boost',     patterns: [/迴避率增加/] },
  { type: 'drain',           patterns: [/吸血/, /回復.*傷害值/] },
  { type: 'ohko',            patterns: [/秒殺/] },
  { type: 'reflect',         patterns: [/反彈/] },
  { type: 'fixed_damage',    patterns: [/附加.*固定傷害/, /附加.*固傷/] },
];

function detectEffectType(desc) {
  if (!desc) return 'unknown';
  const matches = [];
  for (const rule of EFFECT_PATTERNS) {
    for (const pat of rule.patterns) {
      if (pat.test(desc)) { matches.push(rule.type); break; }
    }
  }
  return matches.length > 0 ? matches[0] : 'unknown';
}

// ── Target Detection ──

function detectTarget(desc) {
  if (!desc) return 'self';
  if (/使對手/.test(desc) || /對手/.test(desc)) return 'enemy';
  if (/自身/.test(desc) || /己方/.test(desc)) return 'self';
  if (/雙方/.test(desc)) return 'global';
  return 'self';
}

// ── Stat Modified Detection ──

const STAT_MAP = [
  { stat: 'atk',     patterns: [/攻擊\+/, /攻擊-/, /攻擊值/] },
  { stat: 'def',     patterns: [/防禦\+/, /防禦-/] },
  { stat: 'spatk',   patterns: [/特攻\+/, /特攻-/] },
  { stat: 'spdef',   patterns: [/特防\+/, /特防-/] },
  { stat: 'speed',   patterns: [/速度\+/, /速度-/] },
  { stat: 'hp',      patterns: [/體力/, /HP/, /生命/] },
  { stat: 'all',     patterns: [/全屬性\+/, /全屬性-/, /所有能力/] },
];

function detectStatModified(desc) {
  if (!desc) return null;
  const stats = [];
  for (const rule of STAT_MAP) {
    for (const pat of rule.patterns) {
      if (pat.test(desc)) { stats.push(rule.stat); break; }
    }
  }
  return stats.length > 0 ? [...new Set(stats)] : null;
}

// ── Element Type Detection ──

const ELEMENT_MAP = [
  { element: '水', patterns: [/水系/] },
  { element: '火', patterns: [/火系/] },
  { element: '飛行', patterns: [/飛行系/] },
  { element: '電', patterns: [/電系/] },
  { element: '地面', patterns: [/地面系/] },
  { element: '冰', patterns: [/冰系/] },
  { element: '機械', patterns: [/機械系/] },
  { element: '超能', patterns: [/超能系/] },
  { element: '戰鬥', patterns: [/戰鬥系/] },
  { element: '普通', patterns: [/普通系/] },
  { element: '暗影', patterns: [/暗影系/] },
  { element: '光', patterns: [/光系/] },
  { element: '神秘', patterns: [/神秘系/] },
  { element: '龍', patterns: [/龍系/] },
  { element: '聖靈', patterns: [/聖靈系/] },
  { element: '草', patterns: [/草系/] },
];

function detectElementType(desc, existingType) {
  if (existingType) return existingType;
  if (!desc) return null;
  for (const rule of ELEMENT_MAP) {
    for (const pat of rule.patterns) {
      if (pat.test(desc)) return rule.element;
    }
  }
  return null;
}

// ── Confidence Scoring ──

function classifyConfidence(desc, triggerType, effectType) {
  let conf = 0.5;
  if (triggerType !== 'passive') conf += 0.2;
  if (effectType !== 'unknown') conf += 0.2;
  if (desc && desc.length > 15) conf += 0.1;
  return Math.min(conf, 1.0);
}

// ── Main Classifier ──

function classifyTrait(trait) {
  const desc = trait.description_template || '';

  const triggerType = detectTriggerType(desc);
  const effectType = detectEffectType(desc);
  const target = detectTarget(desc);
  const statModified = detectStatModified(desc);
  const elementType = detectElementType(desc, trait.element_type);
  const confidence = classifyConfidence(desc, triggerType, effectType);

  return {
    trigger_type: triggerType,
    effect_type: effectType,
    target,
    stat_modified: statModified ? JSON.stringify(statModified) : null,
    element_type: elementType,
    confidence,
  };
}

export {
  classifyTrait,
  detectTriggerType,
  detectEffectType,
  detectTarget,
  detectStatModified,
  detectElementType,
  TRIGGER_PATTERNS,
  EFFECT_PATTERNS,
};
