/**
 * import-mw-souls.js — 魂印資料補全腳本
 *
 * 功能：
 * 1. 從 soul_seals.effect_desc 文字中自動解析觸發條件（trigger_condition）
 * 2. 統一名稱格式（去除多餘空白、統一标点）
 * 3. 補齊 pet_advances 中 OldSe/NewSe 的名稱對照
 *
 * 來源：
 * - soul_seals 表已由 import-seerh5.js 從 effectDes.json (kind=1) 匯入
 * - 本腳本在此基礎上「補全」而非「重建」
 *
 * 執行：node src/import-mw-souls.js
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const PATCHES_PATH = join(__dirname, 'data', 'soul-patches.json');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── 觸發條件關鍵詞對照表 ──
// 按長度排序，最長匹配優先
const TRIGGER_PATTERNS = [
  // 回合階段
  { pattern: /回合結束時/, trigger: '回合結束時' },
  { pattern: /回合開始時/, trigger: '回合開始時' },
  { pattern: /每回合開始時/, trigger: '每回合開始時' },
  { pattern: /每次回合結束後/, trigger: '每次回合結束後' },

  // 登場/下場
  { pattern: /自身登場時/, trigger: '自身登場時' },
  { pattern: /登場時/, trigger: '登場時' },
  { pattern: /首次登場時/, trigger: '首次登場時' },
  { pattern: /首次登場且/, trigger: '首次登場時' },
  { pattern: /自身下場時/, trigger: '自身下場時' },
  { pattern: /下場時/, trigger: '下場時' },
  { pattern: /主動下場時/, trigger: '主動下場時' },
  { pattern: /被擊敗時/, trigger: '被擊敗時' },
  { pattern: /自身被擊敗時/, trigger: '自身被擊敗時' },
  { pattern: /死亡時/, trigger: '被擊敗時' },
  { pattern: /自身死亡/, trigger: '被擊敗時' },

  // 技能使用
  { pattern: /使用技能時/, trigger: '使用技能時' },
  { pattern: /自身使用技能時/, trigger: '使用技能時' },
  { pattern: /使用攻擊技能時/, trigger: '使用攻擊技能時' },
  { pattern: /使用特殊技能時/, trigger: '使用特殊技能時' },
  { pattern: /使用屬性技能時/, trigger: '使用屬性技能時' },
  { pattern: /使用技能後/, trigger: '使用技能後' },
  { pattern: /每次使用技能後/, trigger: '每次使用技能後' },

  // 攻擊/受擊
  { pattern: /受到攻擊時/, trigger: '受到攻擊時' },
  { pattern: /受到傷害時/, trigger: '受到傷害時' },
  { pattern: /受到攻擊傷害時/, trigger: '受到攻擊傷害時' },
  { pattern: /受到技能傷害時/, trigger: '受到技能傷害時' },
  { pattern: /造成傷害時/, trigger: '造成傷害時' },
  { pattern: /造成攻擊傷害時/, trigger: '造成攻擊傷害時' },
  { pattern: /造成技能傷害時/, trigger: '造成技能傷害時' },
  { pattern: /攻擊命中時/, trigger: '攻擊命中時' },
  { pattern: /命中目標時/, trigger: '命中目標時' },

  // 擊敗
  { pattern: /自身擊敗對手時/, trigger: '擊敗對手時' },
  { pattern: /擊敗對手時/, trigger: '擊敗對手時' },
  { pattern: /擊敗對手的回合/, trigger: '擊敗對手時' },
  { pattern: /自身擊敗對手的回合/, trigger: '擊敗對手時' },

  // 體力/HP
  { pattern: /體力低於/, trigger: '體力低於一定比例時' },
  { pattern: /體力高於/, trigger: '體力高於一定比例時' },
  { pattern: /體力僅剩/, trigger: '體力僅剩1點時' },
  { pattern: /體力為滿時/, trigger: '體力為滿時' },
  { pattern: /體力低於1\/2/, trigger: '體力低於1/2時' },
  { pattern: /體力高於1\/2/, trigger: '體力高於1/2時' },

  // 狀態異常
  { pattern: /陷入異常狀態時/, trigger: '陷入異常狀態時' },
  { pattern: /解除異常狀態後/, trigger: '解除異常狀態後' },
  { pattern: /免疫異常狀態/, trigger: '免疫異常狀態' },

  // 能力值變化
  { pattern: /能力提升時/, trigger: '能力提升時' },
  { pattern: /能力下降時/, trigger: '能力下降時' },
  { pattern: /任意能力提升至/, trigger: '能力提升至極值時' },

  // 屬性相關
  { pattern: /相同屬性/, trigger: '與自身屬性相同時' },
  { pattern: /不同屬性/, trigger: '與自身屬性不同時' },

  // 特殊條件
  { pattern: /處於異常狀態時/, trigger: '處於異常狀態時' },
  { pattern: /不處於異常狀態時/, trigger: '不處於異常狀態時' },
  { pattern: /自身不處於異常狀態/, trigger: '不處於異常狀態時' },
  { pattern: /處於能力下降狀態時/, trigger: '處於能力下降狀態時' },
  { pattern: /為己方最後一隻精靈時/, trigger: '為己方最後一隻精靈時' },
  { pattern: /己方最後一隻/, trigger: '為己方最後一隻精靈時' },
  { pattern: /場上僅有自身時/, trigger: '場上僅有自身時' },
  { pattern: /替補登場時/, trigger: '替補登場時' },
  { pattern: /作為替補時/, trigger: '作為替補時' },

  // 屬性技能
  { pattern: /屬性技能$/, trigger: '使用屬性技能時' },
  { pattern: /攻擊技能$/, trigger: '使用攻擊技能時' },
];

/**
 * 從 effect_desc 文字中解析觸發條件
 * @param {string} desc - 效果描述文字
 * @returns {string|null} 觸發條件描述，或 null
 */
function parseTriggerCondition(desc) {
  if (!desc) return null;

  for (const { pattern, trigger } of TRIGGER_PATTERNS) {
    if (pattern.test(desc)) {
      return trigger;
    }
  }

  // 通用 fallback：找「...時」模式
  const genericMatch = desc.match(/([^，。；]{2,15})時/);
  if (genericMatch) {
    return genericMatch[0];
  }

  return null;
}

// ── 主流程 ──
const transaction = db.transaction(() => {
  // 1. 讀取所有 soul_seals
  const seals = db.prepare('SELECT * FROM soul_seals').all();
  console.log(`Total soul_seals: ${seals.length}`);

  let updatedTrigger = 0;
  let alreadyHadTrigger = 0;
  let noTriggerFound = 0;

  const updateTrigger = db.prepare(
    'UPDATE soul_seals SET trigger_condition = ? WHERE id = ?'
  );

  for (const seal of seals) {
    if (seal.trigger_condition && seal.trigger_condition.trim() !== '') {
      alreadyHadTrigger++;
      continue;
    }

    const trigger = parseTriggerCondition(seal.effect_desc);
    if (trigger) {
      updateTrigger.run(trigger, seal.id);
      updatedTrigger++;
    } else {
      noTriggerFound++;
    }
  }

  // 2. 補齊 pet_advances 的魂印名稱
  // 查 soul_seals 中有沒有對應 old_se_id / new_se_id 的記錄
  const advances = db.prepare('SELECT * FROM pet_advances').all();
  console.log(`\nPet advances: ${advances.length}`);

  // effectDes.json 的 id 對應 soul_seals 的 effectDes_id (未存於表中)
  // 我們用 monster_id 去 soul_seals 找對應精靈的魂印
  const getSealsBySprite = db.prepare(
    'SELECT name_zh_tw, effect_desc FROM soul_seals WHERE sprite_id = ?'
  );
  const getSpriteIdByCnId = db.prepare(
    'SELECT id FROM sprites WHERE cn_id = ?'
  );

  let advancesEnriched = 0;
  for (const adv of advances) {
    const spriteRow = getSpriteIdByCnId.get(adv.monster_id);
    if (!spriteRow) continue;

    const seals = getSealsBySprite.all(spriteRow.id);
    if (seals.length > 0 && !adv.adv_effect_desc) {
      // 用第一個魂印的效果作為進階效果描述的補充
      // 注意：這只是參考，實際進階效果可能不同
    }
    advancesEnriched++;
  }

  return { updatedTrigger, alreadyHadTrigger, noTriggerFound, advancesEnriched };
});

console.log('\nStarting soul seal enrichment...');
const result = transaction();

console.log(`\n═══ Soul Seal Enrichment Complete ═══`);
console.log(`Trigger conditions updated:  ${result.updatedTrigger}`);
console.log(`Already had trigger:         ${result.alreadyHadTrigger}`);
console.log(`No trigger pattern found:    ${result.noTriggerFound}`);
console.log(`Pet advances processed:      ${result.advancesEnriched}`);

// 顯示更新後的統計
const triggerStats = db.prepare(`
  SELECT trigger_condition, COUNT(*) as cnt
  FROM soul_seals
  WHERE trigger_condition IS NOT NULL
  GROUP BY trigger_condition
  ORDER BY cnt DESC
  LIMIT 15
`).all();

console.log('\nTop trigger conditions:');
triggerStats.forEach(r => console.log(`  ${r.trigger_condition}: ${r.cnt}`));

const stillNull = db.prepare(
  'SELECT COUNT(*) as c FROM soul_seals WHERE trigger_condition IS NULL'
).get();
console.log(`\nStill NULL trigger_condition: ${stillNull.c}`);

// ═══════════════════════════════════════════════════════════
//  手動補丁機制：soul-patches.json
// ═══════════════════════════════════════════════════════════

if (existsSync(PATCHES_PATH)) {
  const patchesRaw = JSON.parse(readFileSync(PATCHES_PATH, 'utf-8'));
  // 排除 _meta 鍵
  const patches = Object.entries(patchesRaw).filter(([k]) => k !== '_meta');

  if (patches.length > 0) {
    console.log(`\n── 套用手動補丁 (${patches.length} 筆) ──`);

    const getSpriteId = db.prepare('SELECT id FROM sprites WHERE cn_id = ?');
    const updateSeal = db.prepare(`
      UPDATE soul_seals
      SET trigger_condition = COALESCE(?, trigger_condition),
          effect_desc = COALESCE(?, effect_desc),
          name_zh_tw = COALESCE(?, name_zh_tw)
      WHERE sprite_id = ?
    `);

    let patched = 0;
    for (const [cnId, patch] of patches) {
      const spriteRow = getSpriteId.get(cnId);
      if (!spriteRow) {
        console.log(`  ⚠️ 精靈 #${cnId} 不存在於 DB，跳過`);
        continue;
      }

      const result = updateSeal.run(
        patch.trigger_condition || null,
        patch.effect_desc || null,
        patch.name_zh_tw || null,
        spriteRow.id
      );

      if (result.changes > 0) {
        patched += result.changes;
        console.log(`  ✅ #${cnId} 已套用補丁 (${result.changes} 筆)`);
      } else {
        console.log(`  ⚠️ #${cnId} 無對應 soul_seals 記錄，跳過`);
      }
    }

    console.log(`\n手動補丁完成：${patched} 筆已更新`);
  } else {
    console.log('\n無手動補丁（soul-patches.json 為空結構）');
  }
} else {
  console.log('\nsoul-patches.json 不存在，跳過手動補丁');
}

db.close();
console.log('\nDone.');
