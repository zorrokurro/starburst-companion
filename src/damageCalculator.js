import { calculateTypeMultiplier, calculateSTAB } from './typeCalculator.js';
import { calculateStatsFromSprite } from './statCalculator.js';

/**
 * 賽爾號傷害計算器
 *
 * 傷害公式：
 *   damage = floor(floor(floor(2 * level / 5 + 2) * power * attack / defense) / 50 + 2)
 *            * STAB (1 or 1.5)
 *            * 屬性倍率 (0, 0.5, 1, 2, 4, ...)
 *            * 隨機 (217/255 ~ 1.0)
 *            * 暴擊 (可選, 1.5 或 2)
 *            * 其他修正 (可選)
 *
 * @param {Object} params
 * @param {number} params.level - 攻擊方等級
 * @param {number} params.power - 技能威力
 * @param {number} params.attack - 攻擊方實際能力值 (已含IV/EV/性格/刻印)
 * @param {number} params.defense - 防禦方實際能力值
 * @param {string[]} params.attackTypes - 攻擊方屬性
 * @param {string[]} params.defendTypes - 防禦方屬性
 * @param {string} params.skillType - 技能屬性
 * @param {Object} [params.options={}] - 修正選項
 * @param {boolean} [params.options.critical=false] - 是否暴擊
 * @param {number} [params.options.criticalMultiplier=1.5] - 暴擊倍率 (1.5 或 2)
 * @param {number} [params.options.fixedDamage=0] - 固定傷害 (無視防御直接造成)
 * @param {number} [params.options.percentDamage=0] - 百分比斬殺 (0-1, 例: 0.3 = 30% 最大體力)
 * @param {number} [params.options.damageMultiplier=1.0] - 通用增傷倍率 (魂印/技能等外部增傷)
 * @param {number} [params.options.damageReduction=1.0] - 通用減傷倍率 (0-1, 例: 0.8 = 減免20%)
 * @param {number} [params.options.minDamage=0] - 最低傷害保底
 * @param {number} [params.options.randomMin] - 隨機下限 (預設 RANDOM_MIN)
 * @param {number} [params.options.randomMax] - 隨機上限 (預設 1.0)
 * @returns {{ min: number, max: number, avg: number, details: Object }}
 */

// 隨機浮動下限：217/255 ≈ 0.851
// 來源：BWIKI賽爾號PVE概論(2026-05-26)、BWIKI賽爾號手遊wiki(2022-08-01)、
// 4399攻略實測驗算(2012)、7k7k(2011)、PVE百科全書(2023)、起點中文網問答(2024)，
// 6個獨立來源交叉確認。範圍為 217~255 的整數除以 255。
const RANDOM_MIN = 217 / 255;
export function calculateDamage({
  level,
  power,
  attack,
  defense,
  attackTypes,
  defendTypes,
  skillType,
  options = {},
}) {
  const {
    critical = false,
    criticalMultiplier = 1.5,
    fixedDamage = 0,
    percentDamage = 0,
    damageMultiplier = 1.0,
    damageReduction = 1.0,
    minDamage: minDamageFloor = 0,
    randomMin = RANDOM_MIN,
    randomMax = 1.0,
  } = options;

  // 固定傷害：無視防御直接造成
  if (fixedDamage > 0) {
    return {
      min: fixedDamage,
      max: fixedDamage,
      avg: fixedDamage,
      details: {
        fixedDamage,
        critical: false,
        typeMultiplier: 1,
        stab: 1,
        randomRange: [1, 1],
      },
    };
  }

  // 基礎傷害（三層 floor 為賽爾號常見寫法）
  const baseDamage = Math.floor(
    Math.floor(Math.floor(2 * level / 5 + 2) * power * attack / defense) / 50 + 2
  );

  // STAB
  const stab = calculateSTAB(attackTypes, skillType);

  // 屬性倍率
  const typeMultiplier = calculateTypeMultiplier(
    skillType ? [skillType] : attackTypes,
    defendTypes
  );

  // 計算隨機範圍傷害
  const calcDamage = (rand) => {
    let dmg = Math.floor(baseDamage * stab * typeMultiplier * rand);
    if (critical) dmg = Math.floor(dmg * criticalMultiplier);
    // 通用增傷（魂印/技能等外部增傷）
    if (damageMultiplier !== 1.0) dmg = Math.floor(dmg * damageMultiplier);
    // 通用減傷（防禦方受到的傷害減免）
    if (damageReduction !== 1.0) dmg = Math.floor(dmg * damageReduction);
    if (percentDamage > 0) dmg = dmg; // 百分比傷害在外部處理
    if (dmg < minDamageFloor) dmg = minDamageFloor;
    return dmg;
  };

  const minDmg = calcDamage(randomMin);
  const maxDmg = calcDamage(randomMax);
  const avgDmg = calcDamage((randomMin + randomMax) / 2);

  return {
    min: minDmg,
    max: maxDmg,
    avg: avgDmg,
    details: {
      baseDamage: Math.floor(baseDamage),
      stab,
      typeMultiplier,
      critical,
      criticalMultiplier,
      damageMultiplier,
      damageReduction,
      fixedDamage,
      percentDamage,
      randomRange: [randomMin, randomMax],
    },
  };
}

/**
 * 從 DB sprite 資料 + 配置 計算實際能力值
 *
 * @param {Object} sprite - DB row
 * @param {Object} config - { level, ivs, evs, nature, extraStats }
 * @returns {{ hp, atk, def, spatk, spdef, speed }}
 */
export function resolveStats(sprite, config = {}) {
  return calculateStatsFromSprite(sprite, config);
}

/**
 * 解析特性效果，返回增傷/減傷倍率 + 語意元資料
 *
 * 支援的特性類型（直接影響傷害）：
 * - 屬性增傷 (16): 技能威力 +X%（按屬性匹配）
 * - 攻擊增傷 (2): 技能威力 +X%（按物攻/特攻匹配）
 * - 坚硬: 受到傷害 -X%
 *
 * 附帶返回 trigger_type, effect_type, target 等語意欄位，
 * 供 teamAnalyzer / matchupCalculator 做更深層推理。
 *
 * @param {Object|null} traitInfo - { traitId, starLevel }
 * @param {Array|null} traitCache - 通用特性資料表
 * @returns {{ typeBonus: number, elementType: string|null, atkTypeBonus: number, atkType: string|null, damageReduction: number, semantic: Object|null }}
 */
export function resolveTraitEffect(traitInfo, traitCache) {
  const result = { typeBonus: 0, elementType: null, atkTypeBonus: 0, atkType: null, damageReduction: 0, semantic: null };
  if (!traitInfo || !traitCache) return result;

  const trait = traitCache.find(t => t.id === traitInfo.traitId);
  if (!trait) return result;

  const vals = JSON.parse(trait.custom_values || '[]');
  const val = vals[traitInfo.starLevel];
  if (val === null || val === undefined) return result;

  const pct = val / 100;

  // 屬性增傷: category 包含 "增傷" 且有 element_type
  if (trait.category?.includes('增傷') && trait.element_type) {
    result.typeBonus = pct;
    result.elementType = trait.element_type;
  }

  // 攻擊增傷: name 為 强袭(物理) 或 精神(特殊)
  if (trait.name === '强袭') {
    result.atkTypeBonus = pct;
    result.atkType = 'physical';
  } else if (trait.name === '精神') {
    result.atkTypeBonus = pct;
    result.atkType = 'special';
  }

  // 坚硬: 受到攻擊傷害減少 X%
  if (trait.name === '坚硬') {
    result.damageReduction = pct;
  }

  // Attach semantic metadata for downstream reasoning
  if (trait.trigger_type || trait.effect_type) {
    result.semantic = {
      triggerType: trait.trigger_type,
      effectType: trait.effect_type,
      target: trait.target,
      statModified: trait.stat_modified ? JSON.parse(trait.stat_modified) : null,
      confidence: trait.confidence,
    };
  }

  return result;
}

/**
 * 計算所有技能的傷害
 *
 * @param {Object} attacker - 攻擊方精靈 DB row
 * @param {Object} defender - 防禦方精靈 DB row
 * @param {Array} skills - 技能陣列
 * @param {Object} params
 * @param {number} [params.attackerLevel=100]
 * @param {number} [params.defenderLevel=100]
 * @param {Object} [params.attackerIVs={}] - 攻擊方個體值
 * @param {Object} [params.defenderIVs={}] - 防禦方個體值
 * @param {Object} [params.attackerEVs={}] - 攻擊方學習力
 * @param {Object} [params.defenderEVs={}] - 防禦方學習力
 * @param {string|null} [params.attackerNature=null] - 攻擊方性格
 * @param {string|null} [params.defenderNature=null] - 防禦方性格
 * @param {Object} [params.attackerExtraStats={}] - 攻擊方刻印加成
 * @param {Object} [params.defenderExtraStats={}] - 防禦方刻印加成
 * @param {Object} [params.attackerRanks={}] - 攻擊方能力等級 { atk, def, spatk, spdef, speed } (-6~+6)
 * @param {Object} [params.defenderRanks={}] - 防禦方能力等級 (-6~+6)
 * @param {Object|null} [params.attackerTraits=null] - 攻擊方特性 { traitId, starLevel }
 * @param {Object|null} [params.defenderTraits=null] - 防禦方特性 { traitId, starLevel }
 * @param {Array|null} [params.traitCache=null] - 通用特性資料表 (從 DB 載入)
 * @param {Object} [params.options={}] - 傷害修正選項 (crit, fixedDamage, percentDamage, damageMultiplier, damageReduction, etc.)
 * @returns {Array} 每個技能的傷害結果
 */
export function calculateAllSkillsDamage(attacker, defender, skills, params = {}) {
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

  // 向後相容：支援舊版 evs 參數格式
  const legacyAttackerEVs = params.attackerEVs || {};
  const legacyDefenderEVs = params.defenderEVs || {};

  // 計算實際能力值（含能力等級修正）
  const attackerStats = resolveStats(attacker, {
    level: attackerLevel,
    ivs: attackerIVs,
    evs: { ...legacyAttackerEVs, ...attackerEVs },
    nature: attackerNature,
    extraStats: attackerExtraStats,
    ranks: attackerRanks,
  });

  const defenderStats = resolveStats(defender, {
    level: defenderLevel,
    ivs: defenderIVs,
    evs: { ...legacyDefenderEVs, ...defenderEVs },
    nature: defenderNature,
    extraStats: defenderExtraStats,
    ranks: defenderRanks,
  });

  // 解析屬性
  const attackTypes = typeof attacker.types === 'string'
    ? JSON.parse(attacker.types)
    : (attacker.types || []);
  const defendTypes = typeof defender.types === 'string'
    ? JSON.parse(defender.types)
    : (defender.types || []);

  // 解析特性效果
  const attackerTraitEffect = resolveTraitEffect(attackerTraits, traitCache);
  const defenderTraitEffect = resolveTraitEffect(defenderTraits, traitCache);

  const results = [];

  for (const skill of skills) {
    if (!skill.power || skill.power === 0) continue;

    // 判斷物理/特殊
    const isPhysical = skill.category?.includes('物攻') || skill.category?.includes('物理');

    const attackStat = isPhysical ? attackerStats.atk : attackerStats.spatk;
    const defenseStat = isPhysical ? defenderStats.def : defenderStats.spdef;

    // 按技能解析攻擊方特性增傷
    let skillDmgMul = 1.0;
    if (attackerTraitEffect.typeBonus > 0 && skill.type === attackerTraitEffect.elementType) {
      skillDmgMul += attackerTraitEffect.typeBonus;
    }
    if (attackerTraitEffect.atkTypeBonus > 0) {
      const isAtkSkill = skill.category?.includes('物攻') || skill.category?.includes('物理');
      const isSpcSkill = skill.category?.includes('特攻') || skill.category?.includes('特殊');
      if ((attackerTraitEffect.atkType === 'physical' && isAtkSkill) ||
          (attackerTraitEffect.atkType === 'special' && isSpcSkill)) {
        skillDmgMul += attackerTraitEffect.atkTypeBonus;
    }
    }

    // 合併所有增減傷
    const baseDmgMul = options.damageMultiplier || 1.0;
    const baseDmgRed = options.damageReduction || 1.0;
    const skillOptions = {
      ...options,
      damageMultiplier: baseDmgMul * skillDmgMul,
      damageReduction: baseDmgRed * (1 - defenderTraitEffect.damageReduction),
    };

    const damage = calculateDamage({
      level: attackerLevel,
      power: skill.power,
      attack: attackStat,
      defense: defenseStat,
      attackTypes,
      defendTypes,
      skillType: skill.type,
      options: skillOptions,
    });

    // 百分比傷害處理
    let percentDamageResult = null;
    if (options.percentDamage > 0) {
      const percentDmg = Math.floor(defenderStats.hp * options.percentDamage);
      percentDamageResult = {
        damage: percentDmg,
        percent: (options.percentDamage * 100).toFixed(1),
      };
    }

    // OHKO (一擊擊殺) 分析
    const maxHP = defenderStats.hp;
    let ohko;
    if (damage.min >= maxHP) {
      ohko = { status: 'guaranteed', probability: 100, label: '確定一擊擊殺 (確一)' };
    } else if (damage.max < maxHP) {
      const pct = (damage.max / maxHP * 100).toFixed(1);
      ohko = { status: 'impossible', probability: 0, label: `無法確一 (最高傷害造成 ${pct}% ダメージ)` };
    } else {
      const prob = damage.max === damage.min
        ? (damage.max >= maxHP ? 100 : 0)
        : Math.min(100, Math.max(0, ((damage.max - maxHP) / (damage.max - damage.min)) * 100));
      ohko = { status: 'chance', probability: parseFloat(prob.toFixed(1)), label: `有 ${prob.toFixed(1)}% 機率一擊擊殺` };
    }

    results.push({
      skill,
      damage,
      attackerStats,
      defenderStats,
      hpPercentage: {
        min: (damage.min / defenderStats.hp * 100).toFixed(1),
        max: (damage.max / defenderStats.hp * 100).toFixed(1),
        avg: (damage.avg / defenderStats.hp * 100).toFixed(1),
      },
      percentDamage: percentDamageResult,
      ohko,
    });
  }

  return results;
}
