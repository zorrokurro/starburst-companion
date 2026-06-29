/**
 * 陣容分析器
 *
 * 功能：
 * 1. 屬性覆蓋評分（進攻/防禦）
 * 2. 弱點文字報告
 * 3. 節奏判定（速度分布）
 * 4. 技能標籤覆蓋分析
 * 5. 替換建議
 */

import { calculateTypeMultiplier, getTypeEffectivenessAgainst } from './typeCalculator.js';
import { calculateStatsFromSprite } from './statCalculator.js';
import { getEffectiveSpeed, getSpeedTier } from './speedCalculator.js';

const ALL_TYPES = [
  '普通', '火', '水', '草', '電', '冰', '地面', '飛行',
  '超能', '戰鬥', '暗影', '機械', '龍', '聖靈', '光', '神秘',
  '次元', '遠古', '虛空', '混沌', '王', '輪迴', '邪靈', '蟲', '自然', '神靈',
];

/**
 * 分析陣容的屬性覆蓋
 *
 * @param {Array} team - 精靈陣列，每個元素需有 types 欄位
 * @returns {{ offense: Object, defense: Object, coverageScore: number, warnings: Array }}
 */
export function analyzeTypeCoverage(team) {
  const offense = {};  // 每個屬性有幾個己方精靈能克制
  const defense = {};  // 每個屬性有幾個己方精靈被克制

  for (const type of ALL_TYPES) {
    offense[type] = 0;
    defense[type] = 0;
  }

  for (const sprite of team) {
    const spriteTypes = typeof sprite.types === 'string'
      ? JSON.parse(sprite.types)
      : (sprite.types || []);

    // 進攻：這個精靈的屬性克制哪些防守屬性
    for (const atkType of spriteTypes) {
      for (const defType of ALL_TYPES) {
        const mult = calculateTypeMultiplier([atkType], [defType]);
        if (mult >= 2) {
          offense[defType]++;
        }
      }
    }

    // 防禦：這個精靈的屬性被哪些攻擊屬性克制
    for (const defType of spriteTypes) {
      for (const atkType of ALL_TYPES) {
        const mult = calculateTypeMultiplier([atkType], [defType]);
        if (mult >= 2) {
          defense[atkType]++;
        }
      }
    }
  }

  // 覆蓋評分：18 種屬性中，能克制多少種
  const coveredTypes = Object.values(offense).filter(v => v > 0).length;
  const coverageScore = Math.round((coveredTypes / ALL_TYPES.length) * 100);

  // 弱點警告
  const warnings = [];
  for (const type of ALL_TYPES) {
    if (defense[type] >= 3) {
      warnings.push({ type, count: defense[type], severity: 'critical' });
    } else if (defense[type] >= 2) {
      warnings.push({ type, count: defense[type], severity: 'warning' });
    }
  }

  return { offense, defense, coverageScore, warnings };
}

/**
 * 弱點文字報告
 *
 * @param {Array} team - 精靈陣列
 * @returns {string} 格式化的文字報告
 */
export function generateWeaknessReport(team) {
  const { offense, defense, coverageScore, warnings } = analyzeTypeCoverage(team);

  const lines = [];
  lines.push(`═══ 陣容分析報告 ═══`);
  lines.push(`屬性覆蓋率：${coverageScore}%（${Object.values(offense).filter(v => v > 0).length}/${ALL_TYPES.length} 種）`);
  lines.push('');

  // 進攻覆蓋
  lines.push('── 進攻覆蓋 ──');
  const offSorted = ALL_TYPES
    .map(t => ({ type: t, count: offense[t] }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);
  for (const { type, count } of offSorted) {
    lines.push(`  ${type}：${count} 個精靈能克制`);
  }

  // 防禦弱點
  lines.push('');
  lines.push('── 防禦弱點 ──');
  const defSorted = ALL_TYPES
    .map(t => ({ type: t, count: defense[t] }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);
  for (const { type, count } of defSorted) {
    const tag = count >= 3 ? ' ⚠️' : count >= 2 ? ' ⚡' : '';
    lines.push(`  ${type}：${count} 個精靈被克制${tag}`);
  }

  // 警告
  if (warnings.length > 0) {
    lines.push('');
    lines.push('── 警告 ──');
    for (const w of warnings) {
      if (w.severity === 'critical') {
        lines.push(`  ⚠️ 嚴重：${w.count} 個精靈被【${w.type}】克制，缺乏聯防！`);
      } else {
        lines.push(`  ⚡ 注意：${w.count} 個精靈被【${w.type}】克制`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * 節奏分析（速度分布）
 *
 * @param {Array} team - 精靈陣列
 * @param {Object} configs - 每個精靈的配置 { level, ivs, evs, nature, extraStats, ranks }
 * @returns {{ tiers: Object, avgSpeed: number, fastest: Object, slowest: Object }}
 */
export function analyzeTempo(team, configs = {}) {
  const speedData = team.map((sprite, i) => {
    const config = configs[i] || { level: 100 };
    const speed = getEffectiveSpeed(sprite, config);
    const tier = getSpeedTier(speed);
    return { sprite, speed, tier, index: i };
  });

  // 速度分布
  const tiers = { extreme: 0, fast: 0, mid: 0, slow: 0, very_slow: 0 };
  for (const d of speedData) {
    tiers[d.tier.tier]++;
  }

  const avgSpeed = Math.round(speedData.reduce((s, d) => s + d.speed, 0) / speedData.length);
  const fastest = speedData.reduce((a, b) => a.speed > b.speed ? a : b);
  const slowest = speedData.reduce((a, b) => a.speed < b.speed ? a : b);

  return { tiers, avgSpeed, fastest, slowest, speedData };
}

/**
 * 技能標籤覆蓋分析
 *
 * @param {Array} team - 精靈陣列，每個元素需有 skills 欄位
 * @returns {{ tagCounts: Object, missing: Array, coverage: number }}
 */
export function analyzeTagCoverage(team) {
  const tagCounts = {
    '固傷': 0, '吸血': 0, '多段': 0, '穿透': 0,
    '回血': 0, '護盾': 0, '獅盔': 0,
    '控場': 0, 'PP干擾': 0, '先制': 0,
    '消強': 0, '消弱': 0, '自我強化': 0, '對手弱化': 0,
  };

  const teamTags = new Set();

  for (const sprite of team) {
    const skills = sprite.skills || [];
    for (const skill of skills) {
      const tags = typeof skill.tags === 'string' ? JSON.parse(skill.tags) : (skill.tags || []);
      for (const tag of tags) {
        const tagName = tag.replace('tag-', '');
        if (tagCounts.hasOwnProperty(tagName)) {
          tagCounts[tagName]++;
          teamTags.add(tagName);
        }
      }
    }
  }

  const totalTags = Object.keys(tagCounts).length;
  const coveredTags = teamTags.size;
  const coverage = Math.round((coveredTags / totalTags) * 100);

  const missing = Object.keys(tagCounts).filter(t => !teamTags.has(t));

  return { tagCounts, missing, coverage };
}

/**
 * 替換建議
 *
 * 基於屬性覆蓋和弱點分析，建議哪些精靈應該替換
 *
 * @param {Array} team - 精靈陣列
 * @returns {{ suggestions: Array }}
 */
export function suggestReplacements(team) {
  const { defense, warnings } = analyzeTypeCoverage(team);
  const suggestions = [];

  // 找出對隊伍弱點貢獻最大的精靈
  for (let i = 0; i < team.length; i++) {
    const sprite = team[i];
    const spriteTypes = typeof sprite.types === 'string'
      ? JSON.parse(sprite.types)
      : (sprite.types || []);

    let weaknessContribution = 0;
    for (const defType of spriteTypes) {
      for (const atkType of ALL_TYPES) {
        const mult = calculateTypeMultiplier([atkType], [defType]);
        if (mult >= 2) {
          weaknessContribution += defense[atkType];
        }
      }
    }

    if (weaknessContribution > 0) {
      suggestions.push({
        sprite: sprite.name_zh || sprite.name,
        index: i,
        types: spriteTypes,
        weaknessScore: weaknessContribution,
        reason: `${spriteTypes.join('/')}屬性被多種攻擊屬性克制`,
      });
    }
  }

  // 按弱點分數排序
  suggestions.sort((a, b) => b.weaknessScore - a.weaknessScore);

  return { suggestions: suggestions.slice(0, 3) };
}
