/**
 * Soul Seal Semantic Parser
 *
 * Extracts structured semantics from soul seal effect descriptions.
 * Output: { triggers, tags, effectType, confidence }
 *
 * Phase 1 Truth Layer — independent module, no DB dependency.
 */

// ── Trigger Extraction ──
// Ordered longest-first to avoid partial matches.

const TRIGGER_RULES = [
  // Turn start
  { pattern: /回合開始時/, condition: 'turn_start' },
  { pattern: /每回合開始/, condition: 'turn_start' },
  { pattern: /每回合有/, condition: 'turn_start' },
  { pattern: /每回合攻擊/, condition: 'turn_start' },
  { pattern: /每回合/, condition: 'turn_start' },

  // Turn end
  { pattern: /戰鬥階段結束時/, condition: 'turn_end' },
  { pattern: /回合結束後/, condition: 'turn_end' },
  { pattern: /回合結束時/, condition: 'turn_end' },
  { pattern: /每個戰鬥階段結束時/, condition: 'turn_end' },
  { pattern: /每次戰鬥階段結束時/, condition: 'turn_end' },

  // On switch in
  { pattern: /登場時/, condition: 'on_switch_in' },
  { pattern: /上場時/, condition: 'on_switch_in' },
  { pattern: /替換出場時/, condition: 'on_switch_in' },
  { pattern: /首次登場/, condition: 'on_switch_in' },
  { pattern: /首次上場/, condition: 'on_switch_in' },
  { pattern: /每次登場/, condition: 'on_switch_in' },
  { pattern: /登場.*回合內/, condition: 'on_switch_in' },

  // After attack
  { pattern: /使用攻擊技能後/, condition: 'after_attack' },
  { pattern: /攻擊命中後/, condition: 'after_attack' },
  { pattern: /攻擊技能命中後/, condition: 'after_attack' },
  { pattern: /使用攻擊技能則/, condition: 'after_attack' },
  { pattern: /使用攻擊技能時/, condition: 'after_attack' },
  { pattern: /每次使用攻擊技能/, condition: 'after_attack' },
  { pattern: /連續使用攻擊技能/, condition: 'after_attack' },
  { pattern: /攻擊時/, condition: 'after_attack' },
  { pattern: /自身使用攻擊技能/, condition: 'after_attack' },
  { pattern: /若我方使用攻擊技能/, condition: 'after_attack' },
  { pattern: /本場戰鬥中首次使用攻擊技能/, condition: 'after_attack' },
  { pattern: /使用攻擊技能/, condition: 'after_attack' },
  { pattern: /每次造成傷害/, condition: 'after_attack' },
  { pattern: /攻擊技能命中/, condition: 'after_attack' },
  { pattern: /技能命中後/, condition: 'after_attack' },
  { pattern: /先出手時/, condition: 'after_attack' },
  { pattern: /先手時/, condition: 'after_attack' },
  { pattern: /先出手/, condition: 'after_attack' },
  { pattern: /攻擊未擊敗/, condition: 'after_attack' },
  { pattern: /秒殺對手/, condition: 'after_attack' },

  // After skill (属性技能)
  { pattern: /使用技能後/, condition: 'after_skill' },
  { pattern: /使用屬性技能後/, condition: 'after_skill' },
  { pattern: /使用屬性技能則/, condition: 'after_skill' },
  { pattern: /使用屬性技能時/, condition: 'after_skill' },
  { pattern: /使用技能則/, condition: 'after_skill' },
  { pattern: /使用技能時/, condition: 'after_skill' },
  { pattern: /自身使用技能時/, condition: 'after_skill' },
  { pattern: /自身使用屬性技能時/, condition: 'after_skill' },
  { pattern: /若我方使用屬性技能/, condition: 'after_skill' },
  { pattern: /屬性技能命中/, condition: 'after_skill' },

  // On hit (受到攻擊)
  { pattern: /受到攻擊時/, condition: 'on_hit' },
  { pattern: /受到攻擊後/, condition: 'on_hit' },
  { pattern: /受到攻擊傷害時/, condition: 'on_hit' },
  { pattern: /對手使用攻擊技能時/, condition: 'on_hit' },
  { pattern: /當回合受到的攻擊傷害/, condition: 'on_hit' },
  { pattern: /滿體力時受到攻擊/, condition: 'on_hit' },
  { pattern: /每次受到攻擊/, condition: 'on_hit' },
  { pattern: /受到攻擊的/, condition: 'on_hit' },
  { pattern: /對手技能命中後/, condition: 'on_hit' },
  { pattern: /使對手攻擊落空/, condition: 'on_hit' },
  { pattern: /使對手攻擊miss/, condition: 'on_hit' },
  { pattern: /後出手時/, condition: 'on_hit' },

  // On damage (造成傷害)
  { pattern: /造成傷害時/, condition: 'on_damage' },
  { pattern: /造成攻擊傷害後/, condition: 'on_damage' },
  { pattern: /造成的攻擊傷害/, condition: 'on_damage' },
  { pattern: /自身造成的攻擊傷害/, condition: 'on_damage' },

  // On defeat
  { pattern: /被擊敗時/, condition: 'on_defeat' },
  { pattern: /擊敗對手時/, condition: 'on_defeat' },
  { pattern: /當回合未擊敗對手時/, condition: 'on_defeat' },
  { pattern: /死亡時/, condition: 'on_defeat' },

  // On heal
  { pattern: /恢復體力時/, condition: 'on_heal' },

  // On status
  { pattern: /處於異常狀態時/, condition: 'on_status' },
  { pattern: /處於異常狀態下/, condition: 'on_status' },
];

function extractTriggers(effectDesc) {
  if (!effectDesc) return [];
  const found = new Set();
  for (const rule of TRIGGER_RULES) {
    if (rule.pattern.test(effectDesc)) {
      found.add(rule.condition);
    }
    rule.pattern.lastIndex = 0;
  }
  return [...found];
}

// ── Tag Extraction ──

const TAG_RULES = [
  { tag: 'heal',        patterns: [/體力/, /回復/, /恢復/, /治療/, /回血/, /回HP/] },
  { tag: 'damage',      patterns: [/傷害/, /攻擊傷害/, /附加傷害/, /真實傷害/, /固[定傷]/] },
  { tag: 'shield',      patterns: [/護盾/, /抵擋/, /免疫.*傷害/, /吸收.*傷害/] },
  { tag: 'buff',        patterns: [/屬性\+[1-5]/, /全屬性\+/, /提升/, /強化/, /攻擊力提升/, /防禦力提升/] },
  { tag: 'debuff',      patterns: [/屬性-[1-5]/, /全屬性-/, /削弱/, /降低/, /下降/] },
  { tag: 'control',     patterns: [/異常狀態/, /中毒/, /麻痺/, /冰封/, /燒傷/, /睡眠/, /失明/, /混亂/, /恐懼/, /封印/] },
  { tag: 'revive',      patterns: [/重生/, /復活/, /存活/] },
  { tag: 'priority',    patterns: [/先制/, /先手/, /優先出手/] },
  { tag: 'pierce',      patterns: [/穿透/, /無視防禦/, /無視.*防禦/, /無視特防/] },
  { tag: 'drain',       patterns: [/吸取/, /吸收.*體力/, /吸血/] },
  { tag: 'pp_drain',    patterns: [/PP/, /技能PP/, /消耗PP/] },
  { tag: 'cleansing',   patterns: [/清除.*狀態/, /消除.*效果/, /解除.*異常/] },
  { tag: 'multi_hit',   patterns: [/連擊/, /多次攻擊/, /附加.*次/] },
  { tag: 'weather',     patterns: [/天氣/, /場地/, /環境/] },
];

function extractTags(effectDesc) {
  if (!effectDesc) return [];
  const tags = [];
  for (const rule of TAG_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(effectDesc)) {
        tags.push(rule.tag);
        break;
      }
    }
  }
  return [...new Set(tags)];
}

// ── Effect Type Classification ──

function classifyEffect(effectDesc) {
  if (!effectDesc) return 'unknown';

  const has = (pattern) => pattern.test(effectDesc);

  // Priority order: more specific first
  if (has(/重生|復活/))                    return 'revive';
  if (has(/免疫/) && has(/異常狀態/))       return 'status_immunity';
  if (has(/免疫/) && has(/傷害/))           return 'damage_immunity';
  if (has(/護盾/))                          return 'shield';
  if (has(/吸取|吸血/))                     return 'drain';
  if (has(/回復|恢復|治療|回血/))            return 'heal';
  if (has(/造成.*傷害|附加.*傷害|真實傷害/))  return 'damage';
  if (has(/降低.*屬性|削弱|屬性-/))          return 'debuff';
  if (has(/提升.*屬性|強化|屬性\+/))         return 'buff';
  if (has(/異常狀態|中毒|麻痺|冰封|燒傷|睡眠|失明|混亂|恐懼|封印/)) return 'control';
  if (has(/先制|先手|優先出手/))             return 'priority';
  if (has(/穿透|無視防禦/))                 return 'pierce';
  if (has(/清除|消除|解除/))                return 'cleansing';
  if (has(/每回合|回合開始|回合結束/))       return 'passive';

  return 'passive';
}

// ── Confidence Scoring ──

function calculateConfidence(effectDesc, triggerCount, tagCount) {
  if (!effectDesc) return 0;

  let confidence = 0.5; // base

  // Longer descriptions tend to be more precisely parseable
  if (effectDesc.length > 30) confidence += 0.1;
  if (effectDesc.length > 60) confidence += 0.1;

  // More trigger matches = higher confidence in parsing
  if (triggerCount >= 1) confidence += 0.1;
  if (triggerCount >= 2) confidence += 0.05;

  // More tags extracted = more semantic info captured
  if (tagCount >= 1) confidence += 0.05;
  if (tagCount >= 2) confidence += 0.05;

  // Has numeric values (more structured = more reliable)
  if (/\d+%/.test(effectDesc)) confidence += 0.05;
  if (/\d+回合/.test(effectDesc)) confidence += 0.05;

  return Math.min(confidence, 1.0);
}

// ── Main Parser ──

function parseSoulSeal(effectDesc) {
  const triggers = extractTriggers(effectDesc);
  const tags = extractTags(effectDesc);
  const effectType = classifyEffect(effectDesc);
  const confidence = calculateConfidence(effectDesc, triggers.length, tags.length);

  return {
    triggers,
    tags,
    effectType,
    confidence,
  };
}

export {
  extractTriggers,
  extractTags,
  classifyEffect,
  calculateConfidence,
  parseSoulSeal,
  TRIGGER_RULES,
  TAG_RULES,
};
