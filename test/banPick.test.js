import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeThreats, suggestBans, suggestPick, analyzePickSafety } from '../src/banPick.js';

function mockSprite(name, types, stats, skills = []) {
  return {
    name_zh: name,
    types: JSON.stringify(types),
    base_hp: stats.hp,
    base_atk: stats.atk,
    base_def: stats.def,
    base_spatk: stats.spatk,
    base_spdef: stats.spdef,
    base_speed: stats.speed,
    skills,
    selectedSkills: skills,
  };
}

function mockSkill(name, power, type, category = '特殊') {
  return { id: Math.random(), name, power, type, category, priority: 0, effect_desc: '' };
}

// ═══════════════════════════════════════════════════════════
//  測試組 1：威脅排序
// ═══════════════════════════════════════════════════════════

describe('analyzeThreats', () => {
  const myTeam = [
    mockSprite('水精靈', ['水'], { hp: 165, atk: 70, def: 110, spatk: 145, spdef: 110, speed: 130 },
      [mockSkill('水槍', 100, '水')]),
  ];
  const enemyPool = [
    mockSprite('電精靈', ['電'], { hp: 150, atk: 90, def: 80, spatk: 140, spdef: 90, speed: 150 },
      [mockSkill('雷擊', 100, '電')]),
    mockSprite('草精靈', ['草'], { hp: 170, atk: 80, def: 100, spatk: 130, spdef: 100, speed: 110 },
      [mockSkill('飛葉', 100, '草')]),
  ];

  it('回傳排序結果', () => {
    const r = analyzeThreats(enemyPool, myTeam);
    assert.ok(Array.isArray(r));
    assert.equal(r.length, 2);
  });

  it('電精靈對水精靈威脅更高', () => {
    const r = analyzeThreats(enemyPool, myTeam);
    assert.equal(r[0].sprite.name_zh, '電精靈');
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 2：Ban 建議
// ═══════════════════════════════════════════════════════════

describe('suggestBans', () => {
  it('建議數量正確', () => {
    const threats = [
      { sprite: { name_zh: 'A' }, totalThreat: 100, worstMatchup: 'X', worstScore: 50 },
      { sprite: { name_zh: 'B' }, totalThreat: 80, worstMatchup: 'Y', worstScore: 40 },
      { sprite: { name_zh: 'C' }, totalThreat: 60, worstMatchup: 'Z', worstScore: 30 },
    ];
    const { bans, reasoning } = suggestBans(threats, 2);
    assert.equal(bans.length, 2);
    assert.equal(reasoning.length, 2);
    assert.ok(reasoning[0].includes('A'));
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 3：Pick 建議
// ═══════════════════════════════════════════════════════════

describe('suggestPick', () => {
  const myPool = [
    mockSprite('水精靈', ['水'], { hp: 165, atk: 70, def: 110, spatk: 145, spdef: 110, speed: 130 },
      [mockSkill('水槍', 100, '水')]),
    mockSprite('草精靈', ['草'], { hp: 170, atk: 80, def: 100, spatk: 130, spdef: 100, speed: 110 },
      [mockSkill('飛葉', 100, '草')]),
  ];
  const enemyPicks = [
    mockSprite('火精靈', ['火'], { hp: 160, atk: 130, def: 100, spatk: 90, spdef: 100, speed: 80 },
      [mockSkill('火焰', 100, '火')]),
  ];

  it('推薦水精靈對火精靈', () => {
    const { recommended } = suggestPick([], enemyPicks, myPool, []);
    assert.ok(recommended.length > 0);
    assert.equal(recommended[0].sprite.name_zh, '水精靈');
  });

  it('已 pick 的精靈不重複推薦', () => {
    const { recommended } = suggestPick([myPool[0]], enemyPicks, myPool, []);
    assert.ok(!recommended.some(r => r.sprite.name_zh === '水精靈'));
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 4：安全名單
// ═══════════════════════════════════════════════════════════

describe('analyzePickSafety', () => {
  it('回傳 safe/risky 陣列', () => {
    const myPool = [
      mockSprite('水精靈', ['水'], { hp: 165, atk: 70, def: 110, spatk: 145, spdef: 110, speed: 130 }, []),
    ];
    const enemyPool = [
      mockSprite('電精靈', ['電'], { hp: 150, atk: 90, def: 80, spatk: 140, spdef: 90, speed: 150 }, []),
    ];
    const { safe, risky } = analyzePickSafety(myPool, enemyPool);
    assert.ok(Array.isArray(safe));
    assert.ok(Array.isArray(risky));
  });
});
