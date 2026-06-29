/**
 * 賽爾號能力值計算器
 *
 * 公式（參考寶可夢/賽爾號通用架構）：
 *   HP   = floor((2 * 種族值 + IV + floor(EV / 4)) * level / 100) + level + 10
 *   其他 = (floor((2 * 種族值 + IV + floor(EV / 4)) * level / 100) + 5) * 性格修正
 *
 * 刻印系統（extraStats）：直接加在最終結果上。
 */

const STAT_KEYS = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'];

const STAT_LABELS = {
  hp: '體力',
  atk: '攻擊',
  def: '防禦',
  spatk: '特攻',
  spdef: '特防',
  speed: '速度',
};

/**
 * 性格修正值
 * @param {string|null} nature - 性格名稱 (e.g. '孤獨', '勤奮', '膽小')
 * @param {string} stat - 能力值 key (atk/def/spatk/spdef/speed)
 * @returns {number} 0.9 | 1.0 | 1.1
 */
export function getNatureMultiplier(nature, stat) {
  if (!nature || stat === 'hp') return 1.0;

  // 5 種中性性格：無修正
  const NEUTRAL_NATURES = new Set(['勤奮', '實幹', '坦率', '害羞', '浮躁']);
  if (NEUTRAL_NATURES.has(nature)) return 1.0;

  // 賽爾號 25 種性格（20 種有修正 + 5 種中性）
  const NATURE_MAP = {
    // +攻擊
    '孤獨': { up: 'atk', down: 'def' },
    '勇敢': { up: 'atk', down: 'speed' },
    '固執': { up: 'atk', down: 'spatk' },
    '調皮': { up: 'atk', down: 'spdef' },
    // +防禦
    '大膽': { up: 'def', down: 'atk' },
    '頑皮': { up: 'def', down: 'spatk' },
    '無慮': { up: 'def', down: 'spdef' },
    '悠閒': { up: 'def', down: 'speed' },
    // +特攻
    '保守': { up: 'spatk', down: 'atk' },
    '穩重': { up: 'spatk', down: 'def' },
    '馬虎': { up: 'spatk', down: 'spdef' },
    '冷靜': { up: 'spatk', down: 'speed' },
    // +特防
    '沉著': { up: 'spdef', down: 'atk' },
    '溫順': { up: 'spdef', down: 'def' },
    '慎重': { up: 'spdef', down: 'spatk' },
    '狂妄': { up: 'spdef', down: 'speed' },
    // +速度
    '膽小': { up: 'speed', down: 'atk' },
    '急躁': { up: 'speed', down: 'def' },
    '天真': { up: 'speed', down: 'spdef' },
    '開朗': { up: 'speed', down: 'spatk' },
  };

  const info = NATURE_MAP[nature];
  if (!info) return 1.0;
  if (info.up === stat) return 1.1;
  if (info.down === stat) return 0.9;
  return 1.0;
}

/**
 * 計算單項能力值
 *
 * @param {Object} params
 * @param {string} params.stat - 'hp' | 'atk' | 'def' | 'spatk' | 'spdef' | 'speed'
 * @param {number} params.base - 種族值
 * @param {number} [params.iv=31] - 個體值 (0-31)
 * @param {number} [params.ev=0] - 學習力 (0-255)
 * @param {number} params.level - 等級 (1-100)
 * @param {string|null} [params.nature=null] - 性格名稱
 * @param {Object} [params.extraStats={}] - 刻印等額外固定加成
 * @returns {number} 最終能力值
 */
export function calculateStat({ stat, base, iv = 31, ev = 0, level, nature = null, extraStats = {} }) {
  const safeBase = base || 0;
  const safeIv = Math.max(0, Math.min(31, iv || 0));
  const safeEv = Math.max(0, Math.min(255, ev || 0));
  const safeLevel = Math.max(1, Math.min(100, level || 100));

  let result;
  if (stat === 'hp') {
    result = Math.floor(
      ((2 * safeBase + safeIv + Math.floor(safeEv / 4)) * safeLevel) / 100
    ) + safeLevel + 10;
  } else {
    const natureMul = getNatureMultiplier(nature, stat);
    result = Math.floor(
      ((2 * safeBase + safeIv + Math.floor(safeEv / 4)) * safeLevel) / 100 + 5
    ) * natureMul;
  }

  // 加上刻印等額外固定加成
  const extra = extraStats[stat] || 0;
  return Math.floor(result + extra);
}

/**
 * 能力等級修正（-6 ~ +6）
 * HP 不受能力等級影響。
 *
 * 正向強化（+1 ~ +6）：實際 = 面板 × (2 + rank) / 2
 *   +1 → 1.5x, +2 → 2.0x, +3 → 2.5x, ... +6 → 4.0x
 *
 * 負向弱化（-1 ~ -6）：實際 = 面板 × 2 / (2 - rank)
 *   -1 → 0.667x, -2 → 0.5x, -3 → 0.4x, ... -6 → 0.25x
 *
 * @param {number} value - 面板能力值
 * @param {number} rank - 能力等級 (-6 ~ +6)
 * @returns {number} 修正後的能力值
 */
export function applyRankModifier(value, rank) {
  const r = Math.max(-6, Math.min(6, Math.floor(rank || 0)));
  if (r === 0) return value;
  if (r > 0) {
    return Math.floor(value * (2 + r) / 2);
  } else {
    return Math.floor(value * 2 / (2 - r));
  }
}

/**
 * 計算完整六項能力值
 *
 * @param {Object} params
 * @param {Object} params.baseStats - { hp, atk, def, spatk, spdef, speed } 種族值
 * @param {Object} [params.ivs={}] - { hp, atk, def, spatk, spdef, speed } 個體值 (0-31)
 * @param {Object} [params.evs={}] - { hp, atk, def, spatk, spdef, speed } 學習力 (0-255)
 * @param {number} params.level - 等級 (1-100)
 * @param {string|null} [params.nature=null] - 性格名稱
 * @param {Object} [params.extraStats={}] - 刻印等額外固定加成
 * @param {Object} [params.ranks={}] - 能力等級 { atk, def, spatk, spdef, speed } (-6~+6), HP 不適用
 * @returns {{ hp: number, atk: number, def: number, spatk: number, spdef: number, speed: number, total: number }}
 */
export function calculateAllStats({ baseStats, ivs = {}, evs = {}, level, nature = null, extraStats = {}, ranks = {} }) {
  const result = {};
  for (const key of STAT_KEYS) {
    let val = calculateStat({
      stat: key,
      base: baseStats[key] || 0,
      iv: ivs[key],
      ev: evs[key],
      level,
      nature,
      extraStats,
    });
    // HP 不受能力等級影響
    if (key !== 'hp' && ranks[key]) {
      val = applyRankModifier(val, ranks[key]);
    }
    result[key] = val;
  }
  result.total = STAT_KEYS.reduce((sum, k) => sum + result[k], 0);
  return result;
}

/**
 * 從資料庫 sprite row 快速計算能力值
 * 適用於 team-sim.html 從 /api/sprites/:id 取得的資料
 *
 * @param {Object} sprite - DB row (含 base_hp, base_atk, ..., types)
 * @param {Object} [config={}] - { level, ivs, evs, nature, extraStats, ranks }
 * @returns {{ hp, atk, def, spatk, spdef, speed, total }}
 */
export function calculateStatsFromSprite(sprite, config = {}) {
  const {
    level = 100,
    ivs = {},
    evs = {},
    nature = null,
    extraStats = {},
    ranks = {},
  } = config;

  return calculateAllStats({
    baseStats: {
      hp: sprite.base_hp,
      atk: sprite.base_atk,
      def: sprite.base_def,
      spatk: sprite.base_spatk,
      spdef: sprite.base_spdef,
      speed: sprite.base_speed,
    },
    ivs,
    evs,
    level,
    nature,
    extraStats,
    ranks,
  });
}

export { STAT_KEYS, STAT_LABELS };
