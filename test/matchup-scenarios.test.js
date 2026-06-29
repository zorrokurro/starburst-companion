import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMatchup, calculateFullMatchup, calculateThreatScore } from '../src/matchupCalculator.js';
import { analyzeThreats, suggestBans, suggestPick } from '../src/banPick.js';
import { resolveTurnOrder, getEffectiveSpeed } from '../src/speedCalculator.js';

function mockSkill(name, power, type, category, priority, effect_desc) {
  return { id: Math.random(), name, power, type, category: category || '特殊', priority: priority || 0, effect_desc: effect_desc || '' };
}

function mockSprite(name, types, stats, skills) {
  return {
    name_zh: name, types: JSON.stringify(types),
    base_hp: stats.hp, base_atk: stats.atk, base_def: stats.def,
    base_spatk: stats.spatk, base_spdef: stats.spdef, base_speed: stats.speed,
    skills: skills || [], selectedSkills: skills || [],
  };
}

// ─── 精靈定義 ───
const FIRE = mockSprite('FIRE', ['火'], { hp: 160, atk: 130, def: 100, spatk: 90, spdef: 100, speed: 80 },
  [mockSkill('blaze', 120, '火', '物攻'), mockSkill('big_fire', 150, '火', '特殊')]);
const GRASS = mockSprite('GRASS', ['草'], { hp: 170, atk: 80, def: 100, spatk: 130, spdef: 100, speed: 110 },
  [mockSkill('leaf', 100, '草', '特殊'), mockSkill('tackle', 40, '普通', '物攻')]);
const WATER = mockSprite('WATER', ['水'], { hp: 165, atk: 70, def: 110, spatk: 145, spdef: 110, speed: 130 },
  [mockSkill('hydro', 120, '水', '特殊'), mockSkill('surf', 150, '水', '特殊')]);
const FAST = mockSprite('FAST', ['電'], { hp: 150, atk: 90, def: 80, spatk: 140, spdef: 90, speed: 200 },
  [mockSkill('thunder', 100, '電', '特殊')]);
const SLOW = mockSprite('SLOW', ['普通'], { hp: 200, atk: 100, def: 120, spatk: 80, spdef: 120, speed: 50 },
  [mockSkill('quake', 100, '普通', '物攻')]);
const SHIKABU = mockSprite('SHIKABU', ['機械'], { hp: 300, atk: 60, def: 200, spatk: 60, spdef: 200, speed: 70 },
  [mockSkill('iron_wall', 0, '機械', '變化'), mockSkill('counter', 80, '機械', '物攻', 0, '致死時保留1點體力')]);
const BURST = mockSprite('BURST', ['龍'], { hp: 155, atk: 80, def: 90, spatk: 160, spdef: 90, speed: 140 },
  [mockSkill('dragon_power', 150, '龍', '特殊'), mockSkill('outrage', 120, '龍', '物攻')]);

const LVL100 = { attackerLevel: 100, defenderLevel: 100 };

// ═══════════════════════════════════════════════════════════
//  案例 1：屬性單純克制（火 vs 草）
// ═══════════════════════════════════════════════════════════

describe('案例 1：屬性單純克制（火 vs 草）', () => {
  const result = calculateMatchup(FIRE, GRASS, FIRE.skills, GRASS.skills, LVL100);

  it('我方威脅分 > 30（火克草）', () => {
    assert.ok(result.atkThreat >= 30, `atkThreat=${result.atkThreat}, 預期 >= 30`);
  });

  it('我方傷害 > 對方傷害', () => {
    assert.ok(result.atkThreat > result.defThreat,
      `atkThreat=${result.atkThreat} > defThreat=${result.defThreat}`);
  });

  it('火系技能克制草系（傷害倍率 > 1.5x）', () => {
    const blaze = result.atkToDef.find(x => x.skill.name === 'blaze');
    const bigFire = result.atkToDef.find(x => x.skill.name === 'big_fire');
    assert.ok(blaze.damage.avg > bigFire.damage.avg * 0.8,
      `火物攻 ${blaze.damage.avg} 應接近火特殊 ${bigFire.damage.avg}`);
  });

  it('最佳技能是火系（克制）', () => {
    assert.equal(result.bestAtkSkill.skill.name, 'blaze');
  });

  it('最佳技能造成 > 50% HP', () => {
    assert.ok(parseFloat(result.bestAtkSkill.hpPercentage.avg) > 50,
      `hpPct=${result.bestAtkSkill.hpPercentage.avg}, 預期 > 50`);
  });
});

// ═══════════════════════════════════════════════════════════
//  案例 2：屬性被克（火 vs 水）
// ═══════════════════════════════════════════════════════════

describe('案例 2：屬性被克（火 vs 水）', () => {
  const result = calculateMatchup(FIRE, WATER, FIRE.skills, WATER.skills, LVL100);

  it('我方威脅分 < 30（火被水克）', () => {
    assert.ok(result.atkThreat < 30, `atkThreat=${result.atkThreat}, 預期 < 30`);
  });

  it('對方威脅分 > 50（水克火）', () => {
    assert.ok(result.defThreat > 50, `defThreat=${result.defThreat}, 預期 > 50`);
  });

  it('對方水系技能傷害 > 我方火系技能傷害', () => {
    const myBest = result.atkToDef.reduce((a, b) => a.damage.avg > b.damage.avg ? a : b);
    const defBest = result.defToAtk.reduce((a, b) => a.damage.avg > b.damage.avg ? a : b);
    assert.ok(defBest.damage.avg > myBest.damage.avg,
      `對方 ${defBest.damage.avg} 應 > 我方 ${myBest.damage.avg}`);
  });

  it('不建議 pick（威脅分太低）', () => {
    assert.ok(result.atkThreat < 30, '威脅分 < 30 不建議 pick');
  });
});

// ═══════════════════════════════════════════════════════════
//  案例 3：速度超車（高速 vs 低速）
// ═══════════════════════════════════════════════════════════

describe('案例 3：速度超車（高速 vs 低速）', () => {
  it('高速精靈速度 > 低速精靈速度', () => {
    const fastSpd = getEffectiveSpeed(FAST, { level: 100 });
    const slowSpd = getEffectiveSpeed(SLOW, { level: 100 });
    assert.ok(fastSpd > slowSpd, `fast=${fastSpd} > slow=${slowSpd}`);
  });

  it('同先制時，高速方先出手', () => {
    const turn = resolveTurnOrder(
      { sprite: FAST, config: { level: 100 }, skill: FAST.skills[0] },
      { sprite: SLOW, config: { level: 100 }, skill: SLOW.skills[0] }
    );
    assert.equal(turn.first, 'attacker', '高速方應先出手');
    assert.ok(turn.reason.includes('速度'), '理由應提及速度');
  });

  it('高速方先手造成傷害', () => {
    const result = calculateMatchup(FAST, SLOW, FAST.skills, SLOW.skills, LVL100);
    assert.ok(result.atkThreat > 0, '高速方應有威脅');
    assert.ok(result.bestAtkSkill.damage.avg > 0, '應造成傷害');
  });

  it('速度差 > 200', () => {
    const fastSpd = getEffectiveSpeed(FAST, { level: 100 });
    const slowSpd = getEffectiveSpeed(SLOW, { level: 100 });
    assert.ok(fastSpd - slowSpd > 200, `speedDiff=${fastSpd - slowSpd}, 預期 > 200`);
  });
});

// ═══════════════════════════════════════════════════════════
//  案例 4：獅盔 vs 高爆發
// ═══════════════════════════════════════════════════════════

describe('案例 4：獅盔 vs 高爆發', () => {
  const result = calculateMatchup(BURST, SHIKABU, BURST.skills, SHIKABU.skills, LVL100);

  it('高爆發打獅盔 → 威脅分 < 30（打不死）', () => {
    assert.ok(result.atkThreat < 30, `atkThreat=${result.atkThreat}, 預期 < 30`);
  });

  it('獅盔防禦方 maxHP > 500（高血高防）', () => {
    assert.ok(result.defender.stats.hp > 500, `maxHP=${result.defender.stats.hp}, 預期 > 500`);
  });

  it('所有技能都無法確一（OHKO impossible）', () => {
    for (const r of result.atkToDef) {
      assert.equal(r.ohko.status, 'impossible',
        `${r.skill.name} OHKO=${r.ohko.status}, 預期 impossible`);
    }
  });

  it('最佳技能造成 < 25% HP（刮痧）', () => {
    assert.ok(parseFloat(result.bestAtkSkill.hpPercentage.avg) < 25,
      `hpPct=${result.bestAtkSkill.hpPercentage.avg}, 預期 < 25`);
  });

  it('獅盔對我方威脅低（攻擊力弱）', () => {
    assert.ok(result.defThreat < 20, `defThreat=${result.defThreat}, 預期 < 20`);
  });
});

// ═══════════════════════════════════════════════════════════
//  案例 5：Ban 建議合理性
// ═══════════════════════════════════════════════════════════

describe('案例 5：Ban 建議合理性', () => {
  const pool = [FIRE, GRASS, WATER, FAST, SLOW, SHIKABU, BURST];
  const myTeam = [FIRE, WATER, FAST];
  const threats = analyzeThreats(pool, myTeam);

  it('威脅排序：水系最高（克我方火系）', () => {
    assert.equal(threats[0].sprite.name_zh, 'WATER');
  });

  it('威脅排序：獅盔最低（攻擊力弱）', () => {
    assert.equal(threats[threats.length - 1].sprite.name_zh, 'SHIKABU');
  });

  it('Ban 建議數量正確', () => {
    const { bans } = suggestBans(threats, 3);
    assert.equal(bans.length, 3);
  });

  it('Ban 建議包含最高威脅', () => {
    const { bans } = suggestBans(threats, 3);
    const names = bans.map(b => b.sprite.name_zh);
    assert.ok(names.includes('WATER'), '應 ban 水系（最高威脅）');
  });

  it('Ban 理由包含威脅分和最克制目標', () => {
    const { reasoning } = suggestBans(threats, 1);
    assert.ok(reasoning[0].includes('171') || reasoning[0].includes('WATER'),
      `理由應提及威脅: ${reasoning[0]}`);
  });
});
