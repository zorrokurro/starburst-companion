import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * 戰術建議模組測試
 *
 * parseStatusEffects() 從技能 effect_desc 解析異常狀態觸發機率。
 * 實際資料格式："n%令對方/令對手{狀態}"，不是 "機率使"。
 */

// ─── 從 team-sim.js 提取 parseStatusEffects 的純函數版本 ───
// 因為 team-sim.js 是 IIFE 模組，無法直接 import，
// 此處複製核心邏輯進行單元測試。

const STATUS_PATTERNS = [
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?害怕/, status: '害怕' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?麻痺/, status: '麻痺' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?中毒/, status: '中毒' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?凍傷/, status: '凍傷' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?睡眠/, status: '睡眠' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?(?:灼傷|燒傷)/, status: '灼傷' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?石化/, status: '石化' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?混亂/, status: '混亂' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?疲憊/, status: '疲憊' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?冰封/, status: '冰封' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?流血/, status: '流血' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?癱瘓/, status: '癱瘓' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?失明/, status: '失明' },
];

function parseStatusEffects(effectDesc) {
  if (!effectDesc) return [];
  const results = [];
  const seen = new Set();
  for (const p of STATUS_PATTERNS) {
    const m = effectDesc.match(p.regex);
    if (m && !seen.has(p.status)) {
      seen.add(p.status);
      results.push({ chance: parseFloat(m[1]), status: p.status });
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════
//  測試組 1：基本異常解析
// ═══════════════════════════════════════════════════════════

describe('parseStatusEffects — 基本解析', () => {
  it('n%令對方害怕', () => {
    const r = parseStatusEffects('30%令對方害怕');
    assert.deepEqual(r, [{ chance: 30, status: '害怕' }]);
  });

  it('n%令對手睡眠', () => {
    const r = parseStatusEffects('20%令對手睡眠');
    assert.deepEqual(r, [{ chance: 20, status: '睡眠' }]);
  });

  it('n%令對方中毒', () => {
    const r = parseStatusEffects('15%令對方中毒');
    assert.deepEqual(r, [{ chance: 15, status: '中毒' }]);
  });

  it('n%令對方凍傷', () => {
    const r = parseStatusEffects('10%令對方凍傷');
    assert.deepEqual(r, [{ chance: 10, status: '凍傷' }]);
  });

  it('n%令對方灼傷', () => {
    const r = parseStatusEffects('25%令對方灼傷');
    assert.deepEqual(r, [{ chance: 25, status: '灼傷' }]);
  });

  it('n%令對方麻痺', () => {
    const r = parseStatusEffects('40%令對方麻痺');
    assert.deepEqual(r, [{ chance: 40, status: '麻痺' }]);
  });

  it('n%令對方石化', () => {
    const r = parseStatusEffects('10%令對方石化');
    assert.deepEqual(r, [{ chance: 10, status: '石化' }]);
  });

  it('n%令對方混亂', () => {
    const r = parseStatusEffects('30%令對方混亂');
    assert.deepEqual(r, [{ chance: 30, status: '混亂' }]);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 2：小數機率 + 變體格式
// ═══════════════════════════════════════════════════════════

describe('parseStatusEffects — 小數與變體', () => {
  it('小數機率 12.5%', () => {
    const r = parseStatusEffects('12.5%令對方害怕');
    assert.deepEqual(r, [{ chance: 12.5, status: '害怕' }]);
  });

  it('帶「進入」二字', () => {
    const r = parseStatusEffects('30%令對方進入冰封');
    assert.deepEqual(r, [{ chance: 30, status: '冰封' }]);
  });

  it('令對手（非令對方）', () => {
    const r = parseStatusEffects('20%令對手疲憊');
    assert.deepEqual(r, [{ chance: 20, status: '疲憊' }]);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 3：多異常 + 無異常
// ═══════════════════════════════════════════════════════════

describe('parseStatusEffects — 多異常與邊界', () => {
  it('一個技能帶兩種異常', () => {
    const r = parseStatusEffects('20%令對方害怕，10%令對方中毒');
    assert.equal(r.length, 2);
    assert.ok(r.some(s => s.status === '害怕' && s.chance === 20));
    assert.ok(r.some(s => s.status === '中毒' && s.chance === 10));
  });

  it('無異常效果的技能', () => {
    const r = parseStatusEffects('解除能力下降狀態');
    assert.deepEqual(r, []);
  });

  it('null / undefined', () => {
    assert.deepEqual(parseStatusEffects(null), []);
    assert.deepEqual(parseStatusEffects(undefined), []);
  });

  it('空字串', () => {
    assert.deepEqual(parseStatusEffects(''), []);
  });
});

// ═══════════════════════════════════════════════════════════
//  測試組 4：不匹配舊版錯誤格式
// ═══════════════════════════════════════════════════════════

describe('parseStatusEffects — 不匹配錯誤格式', () => {
  it('舊版「機率使」格式不應匹配', () => {
    const r = parseStatusEffects('30%機率使對方灼傷');
    assert.deepEqual(r, []);
  });

  it('無數字的描述不應匹配', () => {
    const r = parseStatusEffects('令對方害怕');
    assert.deepEqual(r, []);
  });
});
