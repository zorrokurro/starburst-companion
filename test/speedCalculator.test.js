import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEffectiveSpeed,
  getSpeedRankMultiplier,
  resolveTurnOrder,
  calculateSpeedGap,
  getSpeedTier,
} from '../src/speedCalculator.js';

// ─── 輔助：模擬 DB row ───
function mockSprite(stats, types = ['普通']) {
  return {
    name_zh: 'test',
    types: JSON.stringify(types),
    base_hp: stats.hp,
    base_atk: stats.atk,
    base_def: stats.def,
    base_spatk: stats.spatk,
    base_spdef: stats.spdef,
    base_speed: stats.speed,
  };
}

// ═══════════════════════════════════════════════════════════
//  測試組 1：能力等級倍率
// ═══════════════════════════════════════════════════════════

describe('getSpeedRankMultiplier', () => {
  it('等級 0 → 倍率 1.0', () => {
    assert.equal(getSpeedRankMultiplier(0), 1);
  });

  it('等級 +1 → 倍率 1.5', () => {
    assert.equal(getSpeedRankMultiplier(1), 1.5);
  });

  it('等級 +6 → 倍率 4.0', () => {
    assert.equal(getSpeedRankMultiplier(6), 4);
  });

  it('等級 -1 → 倍率 0.8', () => {
    assert.equal(getSpeedRankMultiplier(-1), 0.8);
  });

  it('等級 -6 → 倍率 0.25', () => {
    assert.equal(getSpeedRankMultiplier(-6), 0.25);
  });

  it('超出範圍時 clamp', () => {
    assert.equal(getSpeedRankMultiplier(10), 4);
    assert.equal(getSpeedRankMultiplier(-10), 0.25);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 2：有效速度計算
// ═══════════════════════════════════════════════════════════

describe('getEffectiveSpeed', () => {
  const SPEED_SPRITE = mockSprite(
    { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }
  );

  it('基礎速度（無性格/無等級修正）', () => {
    const speed = getEffectiveSpeed(SPEED_SPRITE, { level: 100 });
    assert.ok(speed > 0, `速度應 > 0, got ${speed}`);
  });

  it('膽小性格（速度×1.1）→ 比無性格快', () => {
    const base = getEffectiveSpeed(SPEED_SPRITE, { level: 100 });
    const modest = getEffectiveSpeed(SPEED_SPRITE, { level: 100, nature: '膽小' });
    assert.ok(modest > base, `膽小 ${modest} 應 > 無性格 ${base}`);
  });

  it('勇敢性格（速度×0.9）→ 比無性格慢', () => {
    const base = getEffectiveSpeed(SPEED_SPRITE, { level: 100 });
    const brave = getEffectiveSpeed(SPEED_SPRITE, { level: 100, nature: '勇敢' });
    assert.ok(brave < base, `勇敢 ${brave} 應 < 無性格 ${base}`);
  });

  it('速度等級+2（2.0x）→ 比無等級快', () => {
    const base = getEffectiveSpeed(SPEED_SPRITE, { level: 100 });
    const ranked = getEffectiveSpeed(SPEED_SPRITE, { level: 100, ranks: { speed: 2 } });
    assert.ok(ranked > base, `+2等級 ${ranked} 應 > 無等級 ${base}`);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 3：出手順序判定
// ═══════════════════════════════════════════════════════════

describe('resolveTurnOrder', () => {
  const FAST_SPRITE = mockSprite(
    { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 200 }
  );
  const SLOW_SPRITE = mockSprite(
    { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }
  );
  const NORMAL_SKILL = { priority: 0 };
  const P1_SKILL = { priority: 1 };
  const P3_SKILL = { priority: 3 };

  it('先制+3 > 先制+0 → 先制方先出手', () => {
    const r = resolveTurnOrder(
      { sprite: SLOW_SPRITE, config: { level: 100 }, skill: P3_SKILL },
      { sprite: FAST_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL }
    );
    assert.equal(r.first, 'attacker');
    assert.ok(r.reason.includes('先制+3'));
  });

  it('先制+1 > 先制+0 → 先制方先出手', () => {
    const r = resolveTurnOrder(
      { sprite: SLOW_SPRITE, config: { level: 100 }, skill: P1_SKILL },
      { sprite: FAST_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL }
    );
    assert.equal(r.first, 'attacker');
  });

  it('同先制，速度快 → 快方先出手', () => {
    const r = resolveTurnOrder(
      { sprite: FAST_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL },
      { sprite: SLOW_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL }
    );
    assert.equal(r.first, 'attacker');
    assert.ok(r.reason.includes('速度'));
  });

  it('同先制，速度慢 → 慢方先出手', () => {
    const r = resolveTurnOrder(
      { sprite: SLOW_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL },
      { sprite: FAST_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL }
    );
    assert.equal(r.first, 'defender');
  });

  it('同速同先制 → 攻擊方先出手', () => {
    const SAME_SPRITE = mockSprite(
      { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 150 }
    );
    const r = resolveTurnOrder(
      { sprite: SAME_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL },
      { sprite: SAME_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL }
    );
    assert.equal(r.first, 'attacker');
    assert.ok(r.reason.includes('同速'));
  });

  it('防禦方先制+3 > 攻擊方先制+0', () => {
    const r = resolveTurnOrder(
      { sprite: FAST_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL },
      { sprite: SLOW_SPRITE, config: { level: 100 }, skill: P3_SKILL }
    );
    assert.equal(r.first, 'defender');
    assert.ok(r.reason.includes('先制+3'));
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 4：超車計算
// ═══════════════════════════════════════════════════════════

describe('calculateSpeedGap', () => {
  const FAST_SPRITE = mockSprite(
    { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 200 }
  );
  const SLOW_SPRITE = mockSprite(
    { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }
  );
  const NORMAL_SKILL = { priority: 0 };
  const P1_SKILL = { priority: 1 };

  it('已超速 → canOutspeed=true', () => {
    const r = calculateSpeedGap(
      { sprite: FAST_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL },
      { sprite: SLOW_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL }
    );
    // 防禦方慢，所以 canOutspeed=false（被超車）
    assert.equal(r.canOutspeed, false);
  });

  it('被超車 → 需要的速度', () => {
    const r = calculateSpeedGap(
      { sprite: FAST_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL },
      { sprite: SLOW_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL }
    );
    assert.equal(r.canOutspeed, false);
    assert.ok(r.neededSpeed > r.currentDefSpeed, '需要的速度應 > 目前速度');
  });

  it('攻擊方先制更高 → 防禦方無法靠速度超車', () => {
    const r = calculateSpeedGap(
      { sprite: SLOW_SPRITE, config: { level: 100 }, skill: P1_SKILL },
      { sprite: FAST_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL }
    );
    assert.equal(r.canOutspeed, false);
    assert.ok(r.reason.includes('先制'));
  });

  it('防禦方先制更高 → 已先出手', () => {
    const r = calculateSpeedGap(
      { sprite: FAST_SPRITE, config: { level: 100 }, skill: NORMAL_SKILL },
      { sprite: SLOW_SPRITE, config: { level: 100 }, skill: P1_SKILL }
    );
    assert.equal(r.canOutspeed, true);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 5：速度線標記
// ═══════════════════════════════════════════════════════════

describe('getSpeedTier', () => {
  it('400+ → 極速', () => {
    assert.equal(getSpeedTier(400).tier, 'extreme');
    assert.equal(getSpeedTier(500).tier, 'extreme');
  });

  it('350-399 → 高速', () => {
    assert.equal(getSpeedTier(350).tier, 'fast');
    assert.equal(getSpeedTier(399).tier, 'fast');
  });

  it('300-349 → 中速', () => {
    assert.equal(getSpeedTier(300).tier, 'mid');
  });

  it('250-299 → 低速', () => {
    assert.equal(getSpeedTier(250).tier, 'slow');
  });

  it('<250 → 極慢', () => {
    assert.equal(getSpeedTier(200).tier, 'very_slow');
    assert.equal(getSpeedTier(0).tier, 'very_slow');
  });
});
