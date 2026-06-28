import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage, calculateAllSkillsDamage } from '../src/damageCalculator.js';

/**
 * 傷害公式校準測試
 *
 * 公式（damageCalculator.js）：
 *   baseDamage = floor(floor(floor(2*lv/5+2) * power * atk / def) / 50 + 2)
 *   dmg = floor(baseDamage * STAB * typeMult * random)
 *   if crit:     dmg = floor(dmg * critMult)
 *   if dmgMul:   dmg = floor(dmg * dmgMul)
 *   if dmgRed:   dmg = floor(dmg * dmgRed)
 *
 * STAB：skillType ∈ attackTypes → 1.5，否則 1
 * random：預設 217/255 (~0.851) ~ 1.0
 *
 * 測試策略：
 * - 以 Bilibili / 實測影片截取的真實傷害值作為 ground truth
 * - 斷言真實值必須落在 [minDamage, maxDamage] 區間內
 */

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
//  測試組 1：基礎傷害公式
// ═══════════════════════════════════════════════════════════

describe('calculateDamage — 基礎公式', () => {
  it('Lv100 水 vs 普通（無 STAB、無克制）', () => {
    // attackTypes=['水'], skillType='水', defendTypes=['普通']
    // STAB = 1.5 (水 matches 水), typeMult = 1
    // baseDamage = floor(floor(floor(42)*100*200/100)/50+2) = 170
    // min = floor(170 * 1.5 * 1 * 217/255) = floor(217) = 217
    // max = floor(170 * 1.5 * 1 * 1.0) = floor(255) = 255
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['水'], defendTypes: ['普通'], skillType: '水',
    });
    assert.equal(result.min, 217);
    assert.equal(result.max, 255);
    assert.ok(result.avg >= result.min && result.avg <= result.max);
  });

  it('Lv100 火 vs 普通（不同屬性 = 無 STAB）', () => {
    // attackTypes=['火'], skillType='草', defendTypes=['普通']
    // STAB = 1 (火 ≠ 草), typeMult = 1
    // baseDamage = 170
    // min = floor(170 * 1 * 1 * 217/255) = floor(144.67) = 144
    // max = floor(170 * 1 * 1 * 1.0) = floor(170) = 170
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['火'], defendTypes: ['普通'], skillType: '草',
    });
    assert.equal(result.min, 144);
    assert.equal(result.max, 170);
  });

  it('power=0 時 baseDamage 仍為正數（calculateDamage 不攔截）', () => {
    // baseDamage = floor(floor(floor(42)*0*200/100)/50+2) = floor(2) = 2
    // STAB=1.5, typeMult=1: min=floor(2*1.5*217/255)=2, max=floor(2*1.5*1.0)=3
    const result = calculateDamage({
      level: 100, power: 0, attack: 200, defense: 100,
      attackTypes: ['普通'], defendTypes: ['普通'], skillType: '普通',
    });
    assert.equal(result.min, 2);
    assert.equal(result.max, 3);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 2：STAB 加成
// ═══════════════════════════════════════════════════════════

describe('calculateDamage — STAB 加成', () => {
  it('水系精靈使用水系技能 → STAB 1.5x', () => {
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['水'], defendTypes: ['普通'], skillType: '水',
    });
    assert.equal(result.min, 217);
    assert.equal(result.max, 255);
  });

  it('水系精靈使用火系技能 → 無 STAB', () => {
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['水'], defendTypes: ['普通'], skillType: '火',
    });
    assert.equal(result.min, 144);
    assert.equal(result.max, 170);
  });

  it('雙屬性精靈任一屬性匹配 → STAB 1.5x', () => {
    // attackTypes=['水','冰'], skillType='冰'
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['水', '冰'], defendTypes: ['普通'], skillType: '冰',
    });
    assert.equal(result.min, 217);
    assert.equal(result.max, 255);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 3：屬性克制
// ═══════════════════════════════════════════════════════════

describe('calculateDamage — 屬性克制', () => {
  it('水 vs 火 → 2x 克制', () => {
    // STAB=1.5, typeMult=2
    // min = floor(170*1.5*2*217/255) = floor(434) = 434
    // max = floor(170*1.5*2*1.0) = floor(510) = 510
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['水'], defendTypes: ['火'], skillType: '水',
    });
    assert.equal(result.min, 434);
    assert.equal(result.max, 510);
  });

  it('水 vs 草 → 0.5x 微弱', () => {
    // STAB=1.5, typeMult=0.5
    // min = floor(170*1.5*0.5*217/255) = floor(108.5) = 108
    // max = floor(170*1.5*0.5*1.0) = floor(127.5) = 127
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['水'], defendTypes: ['草'], skillType: '水',
    });
    assert.equal(result.min, 108);
    assert.equal(result.max, 127);
  });

  it('電 vs 地面 → 0x 免疫', () => {
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['電'], defendTypes: ['地面'], skillType: '電',
    });
    assert.equal(result.min, 0);
    assert.equal(result.max, 0);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 4：暴擊
// ═══════════════════════════════════════════════════════════

describe('calculateDamage — 暴擊', () => {
  it('暴擊 1.5x（在 random 之後套用）', () => {
    // STAB=1.5, typeMult=1
    // baseDmg*stab*type = 170*1.5 = 255
    // floor(255 * 217/255) = 217, then floor(217 * 1.5) = 325
    // floor(255 * 1.0) = 255, then floor(255 * 1.5) = 382
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['普通'], defendTypes: ['普通'], skillType: '普通',
      options: { critical: true, criticalMultiplier: 1.5 },
    });
    assert.equal(result.min, 325);
    assert.equal(result.max, 382);
  });

  it('暴擊 2x', () => {
    // floor(217 * 2) = 434, floor(255 * 2) = 510
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['普通'], defendTypes: ['普通'], skillType: '普通',
      options: { critical: true, criticalMultiplier: 2 },
    });
    assert.equal(result.min, 434);
    assert.equal(result.max, 510);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 5：增傷/減傷修正
// ═══════════════════════════════════════════════════════════

describe('calculateDamage — 增傷/減傷', () => {
  it('damageMultiplier=1.5（增傷 50%）', () => {
    // floor(217 * 1.5) = 325, floor(255 * 1.5) = 382
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['普通'], defendTypes: ['普通'], skillType: '普通',
      options: { damageMultiplier: 1.5 },
    });
    assert.equal(result.min, 325);
    assert.equal(result.max, 382);
  });

  it('damageReduction=0.5（減傷 50%）', () => {
    // floor(217 * 0.5) = 108, floor(255 * 0.5) = 127
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['普通'], defendTypes: ['普通'], skillType: '普通',
      options: { damageReduction: 0.5 },
    });
    assert.equal(result.min, 108);
    assert.equal(result.max, 127);
  });

  it('暴擊 + 增傷 疊加', () => {
    // base*stab = 255, floor(255*217/255)=217, floor(217*1.5)=325, floor(325*1.5)=487
    // base*stab = 255, floor(255*1.0)=255, floor(255*1.5)=382, floor(382*1.5)=573
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 100,
      attackTypes: ['普通'], defendTypes: ['普通'], skillType: '普通',
      options: { critical: true, criticalMultiplier: 1.5, damageMultiplier: 1.5 },
    });
    assert.equal(result.min, 487);
    assert.equal(result.max, 573);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 6：固定傷害 / 百分比
// ═══════════════════════════════════════════════════════════

describe('calculateDamage — 固定傷害 / 百分比', () => {
  it('固定傷害無視防御', () => {
    const result = calculateDamage({
      level: 100, power: 100, attack: 200, defense: 999,
      attackTypes: ['普通'], defendTypes: ['普通'], skillType: '普通',
      options: { fixedDamage: 200 },
    });
    assert.equal(result.min, 200);
    assert.equal(result.max, 200);
    assert.equal(result.avg, 200);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 7：Bilibili 實測傷害校準（可擴充模板）
// ═══════════════════════════════════════════════════════════

describe('calculateAllSkillsDamage — Bilibili 實測校準', () => {
  /**
   * 校準測試模板
   *
   * 參數來源：Bilibili 對戰影片截圖或實測數據
   * 每筆案例需提供：
   *   - attacker / defender: 精靈面板（種族值）
   *   - skills: 技能清單（含威力/屬性/分類）
   *   - params: 等級/IV/EV/性格/能力階級/增減傷
   *   - expectedDamage: 實測傷害值（必須落在 min~max 之間）
   *
   * 擴充方式：
   *   在 BILIBILI_CASES 陣列中新增一筆即可自動納入測試。
   */

  const BILIBILI_CASES = [
    // ── 案例模板 ──
    // 取消下方註解並填入實際數據：
    //
    // {
    //   name: '譜尼 vs 魔靈王 — Bilibili 影片截圖',
    //   attacker: mockSprite(
    //     { hp: 165, atk: 70, def: 110, spatk: 145, spdef: 110, speed: 130 },
    //     ['聖靈']
    //   ),
    //   defender: mockSprite(
    //     { hp: 170, atk: 130, def: 100, spatk: 90, spdef: 100, speed: 80 },
    //     ['暗影', '超能']
    //   ),
    //   skills: [
    //     { id: 1, name: '聖靈之力', power: 150, category: '特殊', type: '聖靈', accuracy: 95 },
    //   ],
    //   params: {
    //     attackerLevel: 100,
    //     defenderLevel: 100,
    //     attackerNature: '保守',
    //     defenderNature: '大膽',
    //     attackerEVs: { spatk: 252 },
    //     defenderEVs: { def: 252 },
    //     attackerIVs: { spatk: 31 },
    //     defenderIVs: { def: 31 },
    //     attackerRanks: {},
    //     defenderRanks: {},
    //   },
    //   options: {},
    //   expectedDamage: 380,
    // },
  ];

  for (const tc of BILIBILI_CASES) {
    it(tc.name, () => {
      const results = calculateAllSkillsDamage(
        tc.attacker, tc.defender, tc.skills, tc.params
      );
      assert.ok(results.length > 0, '應至少有一個技能結果');
      const { min, max } = results[0].damage;
      assert.ok(
        tc.expectedDamage >= min && tc.expectedDamage <= max,
        `實測傷害 ${tc.expectedDamage} 不在計算區間 [${min}, ${max}] 內`
      );
    });
  }
});

// ═══════════════════════════════════════════════════════════
//  測試組 8：邊界值
// ═══════════════════════════════════════════════════════════

describe('calculateDamage — 邊界值', () => {
  it('等級 1 vs 高防禦', () => {
    // 2*1/5+2 = 2.4, floor=2
    // floor(2*40*10/999) = floor(0.8) = 0
    // floor(0/50+2) = 2
    // STAB=1.5, type=1: floor(2*1.5*217/255)=2, floor(2*1.5*1.0)=3
    const result = calculateDamage({
      level: 1, power: 40, attack: 10, defense: 999,
      attackTypes: ['普通'], defendTypes: ['普通'], skillType: '普通',
    });
    assert.ok(result.min >= 0);
    assert.ok(result.max >= result.min);
  });

  it('等級 100 滿強化 vs 無防禦', () => {
    // baseDamage = floor(floor(floor(42)*150*500/1)/50+2) = floor(63000+2) = 63002
    // STAB=1.5, type=0.5(龍vs龍), crit=2, dmgMul=2
    // min = floor(floor(floor(63002*1.5*0.5*0.9)*2)*2) = 超高
    const result = calculateDamage({
      level: 100, power: 150, attack: 500, defense: 1,
      attackTypes: ['龍'], defendTypes: ['龍'], skillType: '龍',
      options: { critical: true, criticalMultiplier: 2, damageMultiplier: 2 },
    });
    assert.ok(result.max > 10000, `預期超高傷害，實際 max=${result.max}`);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 9：通用特性效果
// ═══════════════════════════════════════════════════════════

describe('calculateAllSkillsDamage — 通用特性效果', () => {
  const WATER_SPRITE = mockSprite(
    { hp: 165, atk: 70, def: 110, spatk: 145, spdef: 110, speed: 130 },
    ['水']
  );
  const NORMAL_SPRITE = mockSprite(
    { hp: 160, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
    ['普通']
  );
  const WATER_SKILL = [{ id: 1, name: '水槍', power: 100, category: '特殊', type: '水' }];
  const FIRE_SKILL = [{ id: 2, name: '火球', power: 100, category: '特殊', type: '火' }];
  const PHYS_SKILL = [{ id: 3, name: '鐵頭', power: 100, category: '物攻', type: '普通' }];

  // 模擬 traitCache（與 seed-generic-traits.js 格式一致）
  const TRAIT_CACHE = [
    { id: 1, name: '流水', category: '屬性增傷', element_type: '水', formula_type: 'CUSTOM', description_template: '水系技能威力增加{value}%', custom_values: '[5,6,7,8,12,14]', note: null },
    { id: 17, name: '强袭', category: '攻擊增傷', element_type: null, formula_type: 'CUSTOM', description_template: '攻擊技能威力增加{value}%', custom_values: '[3,4,5,6,7,8]', note: null },
    { id: 18, name: '精神', category: '攻擊增傷', element_type: null, formula_type: 'CUSTOM', description_template: '特攻技能威力增加{value}%', custom_values: '[3,4,5,6,7,8]', note: null },
    { id: 48, name: '坚硬', category: '面板機率', element_type: null, formula_type: 'CUSTOM', description_template: '受到攻擊傷害減少{value}%', custom_values: '[5,6,8,10,9,10]', note: null },
  ];

  it('水系特性 + 水系技能 → 威力增加 5%（0★）', () => {
    const withoutTrait = calculateAllSkillsDamage(WATER_SPRITE, NORMAL_SPRITE, WATER_SKILL, {
      attackerLevel: 100, defenderLevel: 100,
    });
    const withTrait = calculateAllSkillsDamage(WATER_SPRITE, NORMAL_SPRITE, WATER_SKILL, {
      attackerLevel: 100, defenderLevel: 100,
      attackerTraits: { traitId: 1, starLevel: 0 },
      traitCache: TRAIT_CACHE,
    });
    assert.ok(withTrait[0].damage.avg > withoutTrait[0].damage.avg,
      `有特性應造成更多傷害: ${withTrait[0].damage.avg} > ${withoutTrait[0].damage.avg}`);
  });

  it('水系特性 + 火系技能 → 威力不變（屬性不匹配）', () => {
    const withoutTrait = calculateAllSkillsDamage(WATER_SPRITE, NORMAL_SPRITE, FIRE_SKILL, {
      attackerLevel: 100, defenderLevel: 100,
    });
    const withTrait = calculateAllSkillsDamage(WATER_SPRITE, NORMAL_SPRITE, FIRE_SKILL, {
      attackerLevel: 100, defenderLevel: 100,
      attackerTraits: { traitId: 1, starLevel: 0 },
      traitCache: TRAIT_CACHE,
    });
    assert.equal(withTrait[0].damage.avg, withoutTrait[0].damage.avg);
  });

  it('强袭特性 + 物攻技能 → 威力增加 3%（0★）', () => {
    const withoutTrait = calculateAllSkillsDamage(NORMAL_SPRITE, WATER_SPRITE, PHYS_SKILL, {
      attackerLevel: 100, defenderLevel: 100,
    });
    const withTrait = calculateAllSkillsDamage(NORMAL_SPRITE, WATER_SPRITE, PHYS_SKILL, {
      attackerLevel: 100, defenderLevel: 100,
      attackerTraits: { traitId: 17, starLevel: 0 },
      traitCache: TRAIT_CACHE,
    });
    assert.ok(withTrait[0].damage.avg > withoutTrait[0].damage.avg,
      `有強襲特性應增加物攻傷害: ${withTrait[0].damage.avg} > ${withoutTrait[0].damage.avg}`);
  });

  it('坚硬特性 → 防禦方受到傷害減少 5%（0★）', () => {
    const withoutTrait = calculateAllSkillsDamage(WATER_SPRITE, NORMAL_SPRITE, WATER_SKILL, {
      attackerLevel: 100, defenderLevel: 100,
    });
    const withTrait = calculateAllSkillsDamage(WATER_SPRITE, NORMAL_SPRITE, WATER_SKILL, {
      attackerLevel: 100, defenderLevel: 100,
      defenderTraits: { traitId: 48, starLevel: 0 },
      traitCache: TRAIT_CACHE,
    });
    assert.ok(withTrait[0].damage.avg < withoutTrait[0].damage.avg,
      `堅硬特性應減少受到傷害: ${withTrait[0].damage.avg} < ${withoutTrait[0].damage.avg}`);
  });

  it('無 traitCache 時特性不影響傷害（向後相容）', () => {
    const baseline = calculateAllSkillsDamage(WATER_SPRITE, NORMAL_SPRITE, WATER_SKILL, {
      attackerLevel: 100, defenderLevel: 100,
    });
    const withTraitNoCache = calculateAllSkillsDamage(WATER_SPRITE, NORMAL_SPRITE, WATER_SKILL, {
      attackerLevel: 100, defenderLevel: 100,
      attackerTraits: { traitId: 1, starLevel: 0 },
      // no traitCache
    });
    assert.equal(baseline[0].damage.avg, withTraitNoCache[0].damage.avg);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 10：能力等級
// ═══════════════════════════════════════════════════════════

describe('calculateAllSkillsDamage — 能力等級', () => {
  const SPRITE_A = mockSprite(
    { hp: 165, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
    ['水']
  );
  const SPRITE_B = mockSprite(
    { hp: 160, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
    ['普通']
  );
  const SKILL = [{ id: 1, name: '水槍', power: 100, category: '特殊', type: '水' }];

  it('特攻+2（2.0x）→ 傷害增加', () => {
    const base = calculateAllSkillsDamage(SPRITE_A, SPRITE_B, SKILL, {
      attackerLevel: 100, defenderLevel: 100,
    });
    const ranked = calculateAllSkillsDamage(SPRITE_A, SPRITE_B, SKILL, {
      attackerLevel: 100, defenderLevel: 100,
      attackerRanks: { spatk: 2 },
    });
    assert.ok(ranked[0].damage.avg > base[0].damage.avg,
      `特攻+2 應造成更多傷害: ${ranked[0].damage.avg} > ${base[0].damage.avg}`);
  });

  it('特防+3（2.5x）→ 受到傷害減少', () => {
    const base = calculateAllSkillsDamage(SPRITE_A, SPRITE_B, SKILL, {
      attackerLevel: 100, defenderLevel: 100,
    });
    const ranked = calculateAllSkillsDamage(SPRITE_A, SPRITE_B, SKILL, {
      attackerLevel: 100, defenderLevel: 100,
      defenderRanks: { spdef: 3 },
    });
    assert.ok(ranked[0].damage.avg < base[0].damage.avg,
      `特防+3 應減少受到傷害: ${ranked[0].damage.avg} < ${base[0].damage.avg}`);
  });

  it('物攻-2（0.5x）→ 傷害減半（不影響特攻技能）', () => {
    const base = calculateAllSkillsDamage(SPRITE_A, SPRITE_B, SKILL, {
      attackerLevel: 100, defenderLevel: 100,
    });
    const ranked = calculateAllSkillsDamage(SPRITE_A, SPRITE_B, SKILL, {
      attackerLevel: 100, defenderLevel: 100,
      attackerRanks: { atk: -2 },
    });
    // 物攻等級不影響特攻技能
    assert.equal(ranked[0].damage.avg, base[0].damage.avg);
  });
});
