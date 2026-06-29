import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeTypeCoverage,
  generateWeaknessReport,
  analyzeTempo,
  analyzeTagCoverage,
  suggestReplacements,
} from '../src/teamAnalyzer.js';

// ─── 輔助：模擬 DB row ───
function mockSprite(types, skills = []) {
  return {
    name_zh: 'test',
    types: JSON.stringify(types),
    base_hp: 100,
    base_atk: 100,
    base_def: 100,
    base_spatk: 100,
    base_spdef: 100,
    base_speed: 100,
    skills,
  };
}

// ═══════════════════════════════════════════════════════════
//  測試組 1：屬性覆蓋分析
// ═══════════════════════════════════════════════════════════

describe('analyzeTypeCoverage', () => {
  it('空陣容 → 覆蓋率 0%', () => {
    const r = analyzeTypeCoverage([]);
    assert.equal(r.coverageScore, 0);
    assert.equal(r.warnings.length, 0);
  });

  it('水系精靈 → 能克制火/地面/岩石', () => {
    const team = [mockSprite(['水'])];
    const r = analyzeTypeCoverage(team);
    assert.ok(r.offense['火'] > 0, '水應克制火');
    assert.ok(r.offense['地面'] > 0, '水應克制地面');
  });

  it('水系精靈 → 被電/草克制', () => {
    const team = [mockSprite(['水'])];
    const r = analyzeTypeCoverage(team);
    assert.ok(r.defense['電'] > 0, '水應被電克制');
    assert.ok(r.defense['草'] > 0, '水應被草克制');
  });

  it('雙屬性精靈（水/火）→ 覆蓋更多屬性', () => {
    const single = [mockSprite(['水'])];
    const dual = [mockSprite(['水', '火'])];
    const rSingle = analyzeTypeCoverage(single);
    const rDual = analyzeTypeCoverage(dual);
    assert.ok(rDual.coverageScore >= rSingle.coverageScore,
      '雙屬性覆蓋應 >= 單屬性');
  });

  it('3 個精靈都被同一屬性克制 → critical warning', () => {
    const team = [
      mockSprite(['水']),
      mockSprite(['水']),
      mockSprite(['水']),
    ];
    const r = analyzeTypeCoverage(team);
    const critWarnings = r.warnings.filter(w => w.severity === 'critical');
    assert.ok(critWarnings.length > 0, '應有 critical warning');
    assert.ok(critWarnings.some(w => w.type === '電' || w.type === '草'));
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 2：弱點文字報告
// ═══════════════════════════════════════════════════════════

describe('generateWeaknessReport', () => {
  it('回傳非空字串', () => {
    const report = generateWeaknessReport([mockSprite(['水'])]);
    assert.ok(typeof report === 'string');
    assert.ok(report.length > 0);
  });

  it('報告包含覆蓋率', () => {
    const report = generateWeaknessReport([mockSprite(['水'])]);
    assert.ok(report.includes('覆蓋率'));
  });

  it('報告包含進攻覆蓋', () => {
    const report = generateWeaknessReport([mockSprite(['水'])]);
    assert.ok(report.includes('進攻覆蓋'));
  });

  it('報告包含防禦弱點', () => {
    const report = generateWeaknessReport([mockSprite(['水'])]);
    assert.ok(report.includes('防禦弱點'));
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 3：節奏分析
// ═══════════════════════════════════════════════════════════

describe('analyzeTempo', () => {
  const FAST = { base_speed: 150, base_hp: 100, base_atk: 100, base_def: 100, base_spatk: 100, base_spdef: 100, name_zh: 'fast', types: '["普通"]' };
  const SLOW = { base_speed: 50, base_hp: 100, base_atk: 100, base_def: 100, base_spatk: 100, base_spdef: 100, name_zh: 'slow', types: '["普通"]' };

  it('回傳速度分布', () => {
    const r = analyzeTempo([FAST, SLOW]);
    assert.ok(r.tiers, '應有 tiers');
    assert.ok(r.avgSpeed > 0, 'avgSpeed 應 > 0');
  });

  it('最快精靈速度 > 最慢精靈速度', () => {
    const r = analyzeTempo([FAST, SLOW]);
    assert.ok(r.fastest.speed > r.slowest.speed);
  });

  it('膽小性格 → 速度增加', () => {
    const base = analyzeTempo([FAST]);
    const modest = analyzeTempo([FAST], [{ level: 100, nature: '膽小' }]);
    assert.ok(modest.avgSpeed > base.avgSpeed);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 4：技能標籤覆蓋
// ═══════════════════════════════════════════════════════════

describe('analyzeTagCoverage', () => {
  it('無技能 → 覆蓋率 0%', () => {
    const r = analyzeTagCoverage([mockSprite(['普通'])]);
    assert.equal(r.coverage, 0);
    assert.equal(r.missing.length, 14);
  });

  it('有回血+控場標籤 → 覆蓋 2/14', () => {
    const skills = [
      { tags: ['tag-回血'] },
      { tags: ['tag-控場'] },
    ];
    const r = analyzeTagCoverage([mockSprite(['普通'], skills)]);
    assert.equal(r.coverage, Math.round((2 / 14) * 100));
  });

  it('所有標籤都有 → 覆蓋率 100%', () => {
    const allTags = [
      'tag-固傷', 'tag-吸血', 'tag-多段', 'tag-穿透',
      'tag-回血', 'tag-護盾', 'tag-獅盔',
      'tag-控場', 'tag-PP干擾', 'tag-先制',
      'tag-消強', 'tag-消弱', 'tag-自我強化', 'tag-對手弱化',
    ];
    const skills = allTags.map(t => ({ tags: [t] }));
    const r = analyzeTagCoverage([mockSprite(['普通'], skills)]);
    assert.equal(r.coverage, 100);
    assert.equal(r.missing.length, 0);
  });

  it('missing 列表不包含已有的標籤', () => {
    const skills = [{ tags: ['tag-回血'] }];
    const r = analyzeTagCoverage([mockSprite(['普通'], skills)]);
    assert.ok(!r.missing.includes('回血'));
    assert.ok(r.missing.includes('控場'));
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 5：替換建議
// ═══════════════════════════════════════════════════════════

describe('suggestReplacements', () => {
  it('無弱點 → 無建議', () => {
    const r = suggestReplacements([]);
    assert.equal(r.suggestions.length, 0);
  });

  it('有弱點精靈 → 建議列表', () => {
    const team = [
      mockSprite(['水']),
      mockSprite(['火']),
      mockSprite(['草']),
    ];
    const r = suggestReplacements(team);
    assert.ok(Array.isArray(r.suggestions));
  });

  it('建議最多 3 個', () => {
    const team = [
      mockSprite(['水']),
      mockSprite(['火']),
      mockSprite(['草']),
      mockSprite(['電']),
      mockSprite(['冰']),
    ];
    const r = suggestReplacements(team);
    assert.ok(r.suggestions.length <= 3);
  });
});
