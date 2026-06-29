import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMatchup,
  calculateThreatScore,
  calculateFullMatchup,
  generateMatchupReport,
} from '../src/matchupCalculator.js';

// ─── 輔助：模擬 DB row ───
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

function mockSkill(name, power, type, category = '特殊', priority = 0) {
  return { id: Math.random(), name, power, type, category, priority, effect_desc: '' };
}

// ═══════════════════════════════════════════════════════════
//  測試組 1：威脅評分
// ═══════════════════════════════════════════════════════════

describe('calculateThreatScore', () => {
  it('空結果 → 0 分', () => {
    assert.equal(calculateThreatScore([], 100), 0);
    assert.equal(calculateThreatScore(null, 100), 0);
  });

  it('確殺技能 → 高分', () => {
    const results = [{
      skill: { name: '大招', effect_desc: '' },
      damage: { avg: 500 },
      ohko: { status: 'guaranteed', probability: 100 },
    }];
    const score = calculateThreatScore(results, 200);
    assert.ok(score >= 40, `確殺應 >= 40, got ${score}`);
  });

  it('低傷害 → 低分', () => {
    const results = [{
      skill: { name: '弱招', effect_desc: '' },
      damage: { avg: 10 },
      ohko: { status: 'impossible', probability: 0 },
    }];
    const score = calculateThreatScore(results, 500);
    assert.ok(score < 20, `低傷害應 < 20, got ${score}`);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 2：單一對位計算
// ═══════════════════════════════════════════════════════════

describe('calculateMatchup', () => {
  const WATER = mockSprite('水精靈', ['水'],
    { hp: 165, atk: 70, def: 110, spatk: 145, spdef: 110, speed: 130 },
    [mockSkill('水槍', 100, '水', '特殊'), mockSkill('鐵頭', 80, '普通', '物攻')]
  );
  const FIRE = mockSprite('火精靈', ['火'],
    { hp: 160, atk: 130, def: 100, spatk: 90, spdef: 100, speed: 80 },
    [mockSkill('火焰', 100, '火', '特殊'), mockSkill('撞擊', 80, '普通', '物攻')]
  );

  it('回傳雙向結果', () => {
    const r = calculateMatchup(WATER, FIRE, WATER.skills, FIRE.skills, {
      attackerLevel: 100, defenderLevel: 100,
    });
    assert.ok(r.atkToDef.length > 0, '攻擊方應有技能結果');
    assert.ok(r.defToAtk.length > 0, '防禦方應有技能結果');
    assert.ok(r.bestAtkSkill, '應有最佳攻擊技能');
    assert.ok(r.bestDefSkill, '應有最佳防禦技能');
  });

  it('水精靈對火精靈 → 水槍傷害更高（克制）', () => {
    const r = calculateMatchup(WATER, FIRE, WATER.skills, FIRE.skills, {
      attackerLevel: 100, defenderLevel: 100,
    });
    const waterSkill = r.atkToDef.find(x => x.skill.name === '水槍');
    const normalSkill = r.atkToDef.find(x => x.skill.name === '鐵頭');
    assert.ok(waterSkill.damage.avg > normalSkill.damage.avg,
      `水槍 ${waterSkill.damage.avg} 應 > 鐵頭 ${normalSkill.damage.avg}`);
  });

  it('威脅評分存在', () => {
    const r = calculateMatchup(WATER, FIRE, WATER.skills, FIRE.skills, {
      attackerLevel: 100, defenderLevel: 100,
    });
    assert.ok(typeof r.atkThreat === 'number');
    assert.ok(typeof r.defThreat === 'number');
    assert.ok(r.atkThreat >= 0 && r.atkThreat <= 100);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 3：全對位計算
// ═══════════════════════════════════════════════════════════

describe('calculateFullMatchup', () => {
  const myTeam = [
    mockSprite('水精靈', ['水'],
      { hp: 165, atk: 70, def: 110, spatk: 145, spdef: 110, speed: 130 },
      [mockSkill('水槍', 100, '水')]
    ),
    mockSprite('草精靈', ['草'],
      { hp: 170, atk: 80, def: 100, spatk: 130, spdef: 100, speed: 110 },
      [mockSkill('飛葉', 100, '草')]
    ),
  ];
  const enemyTeam = [
    mockSprite('火精靈', ['火'],
      { hp: 160, atk: 130, def: 100, spatk: 90, spdef: 100, speed: 80 },
      [mockSkill('火焰', 100, '火')]
    ),
    mockSprite('電精靈', ['電'],
      { hp: 150, atk: 90, def: 80, spatk: 140, spdef: 90, speed: 150 },
      [mockSkill('雷擊', 100, '電')]
    ),
  ];

  it('矩陣大小正確', () => {
    const r = calculateFullMatchup(myTeam, enemyTeam);
    assert.equal(r.matrix.length, 2);
    assert.equal(r.matrix[0].length, 2);
    assert.equal(r.matrix[1].length, 2);
  });

  it('每個格子有雙向結果', () => {
    const r = calculateFullMatchup(myTeam, enemyTeam);
    for (const row of r.matrix) {
      for (const cell of row) {
        assert.ok(cell.atkToDef, '應有 atkToDef');
        assert.ok(cell.defToAtk, '應有 defToAtk');
        assert.ok(typeof cell.atkThreat === 'number');
      }
    }
  });

  it('bestCounters 長度 = 敵方數量', () => {
    const r = calculateFullMatchup(myTeam, enemyTeam);
    assert.equal(r.bestCounters.length, enemyTeam.length);
  });

  it('bestTargets 長度 = 我方數量', () => {
    const r = calculateFullMatchup(myTeam, enemyTeam);
    assert.equal(r.bestTargets.length, myTeam.length);
  });

  it('水精靈對火精靈 → 高威脅', () => {
    const r = calculateFullMatchup(myTeam, enemyTeam);
    const waterVsFire = r.matrix[0][0];
    assert.ok(waterVsFire.atkThreat >= 30, `水對火威脅應 >= 30, got ${waterVsFire.atkThreat}`);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 4：對位報告
// ═══════════════════════════════════════════════════════════

describe('generateMatchupReport', () => {
  it('回傳非空字串', () => {
    const myTeam = [mockSprite('水', ['水'], { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, [mockSkill('水槍', 100, '水')])];
    const enemyTeam = [mockSprite('火', ['火'], { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, [mockSkill('火焰', 100, '火')])];
    const r = calculateFullMatchup(myTeam, enemyTeam);
    const report = generateMatchupReport(r);
    assert.ok(report.length > 0);
    assert.ok(report.includes('對位建議'));
  });
});
