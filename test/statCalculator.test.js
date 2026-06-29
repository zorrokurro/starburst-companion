import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getNatureMultiplier,
  calculateStat,
  applyRankModifier,
  calculateAllStats,
} from '../src/statCalculator.js';

// ═══════════════════════════════════════════════════════════
//  性格修正
// ═══════════════════════════════════════════════════════════

describe('getNatureMultiplier', () => {
  it('HP 不受性格影響', () => {
    assert.equal(getNatureMultiplier('膽小', 'hp'), 1.0);
  });

  it('null 性格 → 1.0', () => {
    assert.equal(getNatureMultiplier(null, 'atk'), 1.0);
  });

  it('中性性格（勤奮）→ 1.0', () => {
    assert.equal(getNatureMultiplier('勤奮', 'atk'), 1.0);
  });

  it('中性性格（實幹）→ 1.0', () => {
    assert.equal(getNatureMultiplier('實幹', 'atk'), 1.0);
  });

  it('中性性格（坦率）→ 1.0', () => {
    assert.equal(getNatureMultiplier('坦率', 'atk'), 1.0);
  });

  it('中性性格（害羞）→ 1.0', () => {
    assert.equal(getNatureMultiplier('害羞', 'atk'), 1.0);
  });

  it('中性性格（浮躁）→ 1.0', () => {
    assert.equal(getNatureMultiplier('浮躁', 'atk'), 1.0);
  });

  it('膽小: +速度 -攻擊', () => {
    assert.equal(getNatureMultiplier('膽小', 'speed'), 1.1);
    assert.equal(getNatureMultiplier('膽小', 'atk'), 0.9);
  });

  it('固執: +攻擊 -特攻', () => {
    assert.equal(getNatureMultiplier('固執', 'atk'), 1.1);
    assert.equal(getNatureMultiplier('固執', 'spatk'), 0.9);
  });

  it('保守: +特攻 -攻擊', () => {
    assert.equal(getNatureMultiplier('保守', 'spatk'), 1.1);
    assert.equal(getNatureMultiplier('保守', 'atk'), 0.9);
  });

  it('不影響的能力值 → 1.0', () => {
    assert.equal(getNatureMultiplier('膽小', 'def'), 1.0);
  });

  it('未知性格 → 1.0', () => {
    assert.equal(getNatureMultiplier('不存在的性格', 'atk'), 1.0);
  });
});

// ═══════════════════════════════════════════════════════════
//  HP 計算
// ═══════════════════════════════════════════════════════════

describe('calculateStat — HP', () => {
  it('Lv100 基本 HP', () => {
    // base=100, iv=31, ev=0, level=100
    // floor((200+31+0)*100/100) + 100 + 10 = 231 + 110 = 341
    const hp = calculateStat({ stat: 'hp', base: 100, iv: 31, ev: 0, level: 100 });
    assert.equal(hp, 341);
  });

  it('Lv100 滿 EV HP', () => {
    // base=100, iv=31, ev=255, level=100
    // floor((200+31+63)*100/100) + 100 + 10 = 294 + 110 = 404
    const hp = calculateStat({ stat: 'hp', base: 100, iv: 31, ev: 255, level: 100 });
    assert.equal(hp, 404);
  });

  it('Lv50 HP', () => {
    // base=100, iv=31, ev=0, level=50
    // floor((231)*50/100) + 50 + 10 = 115 + 60 = 175
    const hp = calculateStat({ stat: 'hp', base: 100, iv: 31, ev: 0, level: 50 });
    assert.equal(hp, 175);
  });
});

// ═══════════════════════════════════════════════════════════
//  其他能力值
// ═══════════════════════════════════════════════════════════

describe('calculateStat — 其他能力值', () => {
  it('Lv100 無性格修正', () => {
    // base=100, iv=31, ev=0, level=100
    // floor((231)*100/100 + 5) = 236
    const atk = calculateStat({ stat: 'atk', base: 100, iv: 31, ev: 0, level: 100 });
    assert.equal(atk, 236);
  });

  it('Lv100 膽小性格 +速度', () => {
    // floor(231*100/100 + 5) * 1.1 = 236 * 1.1 = 259.6 → floor = 259
    const speed = calculateStat({ stat: 'speed', base: 100, iv: 31, ev: 0, level: 100, nature: '膽小' });
    assert.equal(speed, 259);
  });

  it('Lv100 固執性格 -特攻', () => {
    // floor(231*100/100 + 5) * 0.9 = 236 * 0.9 = 212.4 → floor = 212
    const spatk = calculateStat({ stat: 'spatk', base: 100, iv: 31, ev: 0, level: 100, nature: '固執' });
    assert.equal(spatk, 212);
  });

  it('有刻印加成', () => {
    const atk = calculateStat({ stat: 'atk', base: 100, iv: 31, ev: 0, level: 100, extraStats: { atk: 20 } });
    assert.equal(atk, 256); // 236 + 20
  });
});

// ═══════════════════════════════════════════════════════════
//  能力等級修正
// ═══════════════════════════════════════════════════════════

describe('applyRankModifier', () => {
  it('rank 0 → 不變', () => {
    assert.equal(applyRankModifier(200, 0), 200);
  });

  it('rank +1 → 1.5x', () => {
    assert.equal(applyRankModifier(200, 1), 300);
  });

  it('rank +2 → 2.0x', () => {
    assert.equal(applyRankModifier(200, 2), 400);
  });

  it('rank +6 → 4.0x', () => {
    assert.equal(applyRankModifier(200, 6), 800);
  });

  it('rank -1 → 2/3', () => {
    assert.equal(applyRankModifier(200, -1), 133); // floor(200 * 2/3)
  });

  it('rank -2 → 1/2', () => {
    assert.equal(applyRankModifier(200, -2), 100);
  });

  it('rank -6 → 1/4', () => {
    assert.equal(applyRankModifier(200, -6), 50);
  });

  it('rank > 6 被限制在 6', () => {
    assert.equal(applyRankModifier(200, 10), 800);
  });

  it('rank < -6 被限制在 -6', () => {
    assert.equal(applyRankModifier(200, -10), 50);
  });
});

// ═══════════════════════════════════════════════════════════
//  calculateAllStats
// ═══════════════════════════════════════════════════════════

describe('calculateAllStats', () => {
  const baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 };

  it('基本計算含 total', () => {
    const result = calculateAllStats({ baseStats, level: 100 });
    assert.equal(typeof result.total, 'number');
    assert.ok(result.total > 0);
    assert.equal(result.hp, 341);
    assert.equal(result.atk, 236);
  });

  it('性格影響', () => {
    const result = calculateAllStats({ baseStats, level: 100, nature: '膽小' });
    assert.equal(result.speed, 259); // +10%
    assert.equal(result.atk, 212);  // -10%
  });

  it('能力等級影響', () => {
    const result = calculateAllStats({ baseStats, level: 100, ranks: { atk: 2 } });
    assert.equal(result.atk, 472); // 236 * 2.0
    assert.equal(result.hp, 341);  // HP 不受影響
  });
});
