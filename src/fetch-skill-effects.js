/**
 * fetch-skill-effects.js
 *
 * 從淘米官方 H5 moves.json（本地或遠端）中提取技能效果描述，
 * 批次更新 SQLite skills.effect_desc 欄位，然後自動觸發標籤清洗。
 *
 * 用法：
 *   node src/fetch-skill-effects.js            # 本地 seerh5_data/moves.json
 *   node src/fetch-skill-effects.js --remote   # 嘗試遠端抓取後回退本地
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { s2t, convertType } from './s2t.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const LOCAL_MOVES = join(__dirname, '..', 'seerh5_data', 'moves.json');

const REMOTE_URLS = [
  'https://seerh5.61.com/resource/config/xml/moves.xml',
  'https://seerh5.61.com/resource/config/json/moves.json',
];

const useRemote = process.argv.includes('--remote');

// ── 1. 載入技能設定檔 ──────────────────────────────────────────

function loadLocalMoves() {
  if (!existsSync(LOCAL_MOVES)) {
    throw new Error(`本地資料檔不存在：${LOCAL_MOVES}`);
  }
  console.log(`讀取本地檔案：${LOCAL_MOVES}`);
  const raw = JSON.parse(readFileSync(LOCAL_MOVES, 'utf-8'));
  return parseMovesJson(raw);
}

async function fetchRemoteMoves() {
  for (const url of REMOTE_URLS) {
    try {
      console.log(`嘗試遠端抓取：${url}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        console.log(`  ✗ HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();

      // JSON 格式
      if (text.trimStart().startsWith('{')) {
        const raw = JSON.parse(text);
        if (raw.MovesTbl) {
          console.log(`  ✓ 成功解析 JSON（${raw.MovesTbl.Moves?.Move?.length ?? 0} 筆技能）`);
          return parseMovesJson(raw);
        }
      }

      // XML 格式
      if (text.includes('<Move') || text.includes('<Moves')) {
        console.log(`  ✓ 取得 XML，進行解析...`);
        return await parseMovesXml(text);
      }

      console.log(`  ✗ 無法識別格式`);
    } catch (e) {
      console.log(`  ✗ ${e.message}`);
    }
  }
  return null;
}

// ── 2. 解析器 ──────────────────────────────────────────────────

function parseMovesJson(raw) {
  const moves = raw.MovesTbl.Moves.Move;
  const sideEffects = raw.MovesTbl.SideEffects.SideEffect;

  // SideEffects 按 ID 數值排序後，move.SideEffect（字串數字）對應排序後的索引
  const sortedSE = [...sideEffects].sort((a, b) => parseInt(a.ID) - parseInt(b.ID));

  // 為每個技能建立效果描述快取
  const effectMap = new Map();

  for (const move of moves) {
    if (!move.SideEffect) continue;
    const idx = parseInt(move.SideEffect) - 1;
    if (idx < 0 || idx >= sortedSE.length) continue;

    const se = sortedSE[idx];
    const des = pickBestEffect(se);
    if (!des) continue;

    const key = `${s2t(move.Name)}|${convertType(move.Type ?? '')}`;
    // 同名技能只取第一個（或多個效果可合併）
    if (!effectMap.has(key)) {
      effectMap.set(key, des);
    }
  }

  console.log(`  技能效果快取：${effectMap.size} 筆`);
  return effectMap;
}

async function parseMovesXml(xmlText) {
  let XMLParser;
  try {
    const mod = await import('fast-xml-parser');
    XMLParser = mod.XMLParser;
  } catch {
    console.log('  ✗ 未安裝 fast-xml-parser，嘗試安裝中...');
    const { execSync } = await import('child_process');
    execSync('npm install fast-xml-parser', { cwd: join(__dirname, '..'), stdio: 'inherit' });
    const mod = await import('fast-xml-parser');
    XMLParser = mod.XMLParser;
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xmlText);

  // 結構可能是 <Moves><Move>...</Move></Moves> 或 <root><Moves>...
  const moveContainer = doc.Moves ?? doc.root?.Moves ?? doc;
  const movesRaw = moveContainer.Move ?? [];
  const moves = Array.isArray(movesRaw) ? movesRaw : [movesRaw];

  // XML 中若無 SideEffects，嘗試提取內聯效果文字
  const effectMap = new Map();
  for (const move of moves) {
    const name = move.Name ?? move.name;
    const type = move.Type ?? move.type ?? '';
    const des = move.EffectDesc ?? move.effectDesc ?? move.Des ?? move.des;
    if (name && des) {
      effectMap.set(`${name}|${type}`, String(des));
    }
  }

  console.log(`  XML 解析：${effectMap.size} 筆有效果描述`);
  return effectMap;
}

/** 從 SideEffect 物件中挑選最佳描述文字 */
function pickBestEffect(se) {
  const des = se.des;
  const help = se.help;
  // 過濾模板字串（如 "m%對方XX等級+/-n"）
  const isTemplate = (t) => !t || /m%|XX|\+\/-|^\d+%/.test(t);
  if (des && !isTemplate(des)) return des;
  if (help && !isTemplate(help)) return help;
  return null;
}

// ── 3. 資料庫批量更新 ──────────────────────────────────────────

function updateEffectDesc(effectMap) {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 確保 tags 欄位存在
  try {
    db.prepare('SELECT tags FROM skills LIMIT 1').get();
  } catch {
    console.log('新增 tags 欄位至 skills 資料表...');
    db.exec(`ALTER TABLE skills ADD COLUMN tags TEXT DEFAULT '[]'`);
  }

  const skills = db.prepare(
    `SELECT id, name, type, effect_desc FROM skills WHERE effect_desc IS NULL OR effect_desc = ''`
  ).all();

  console.log(`\n待補全 effect_desc 的技能：${skills.length} 筆`);

  let updated = 0;
  let skipped = 0;
  const misses = [];

  const updateStmt = db.prepare(
    'UPDATE skills SET effect_desc = ? WHERE id = ?'
  );

  const batch = db.transaction(() => {
    for (const skill of skills) {
      const key = `${skill.name}|${skill.type ?? ''}`;
      const des = effectMap.get(key);

      if (des) {
        updateStmt.run(s2t(des), skill.id);
        updated++;
      } else {
        // 嘗試不帶類型匹配（某些技能名唯一）
        let found = false;
        for (const [k, v] of effectMap) {
          if (k.startsWith(skill.name + '|')) {
            updateStmt.run(s2t(v), skill.id);
            updated++;
            found = true;
            break;
          }
        }
        if (!found) {
          skipped++;
          if (misses.length < 20) misses.push(`${skill.name} (${skill.type})`);
        }
      }
    }
  });

  batch();

  console.log(`\n═══ effect_desc 更新完成 ═══`);
  console.log(`  已更新：${updated} 筆`);
  console.log(`  無對應：${skipped} 筆`);
  if (misses.length > 0) {
    console.log(`  無對應技能（前 20 筆）：${misses.join(', ')}`);
  }

  // 統計
  const total = db.prepare('SELECT COUNT(*) as cnt FROM skills').get();
  const withDesc = db.prepare(
    "SELECT COUNT(*) as cnt FROM skills WHERE effect_desc IS NOT NULL AND effect_desc != ''"
  ).get();
  console.log(`\n  DB 狀態：${withDesc.cnt} / ${total.cnt} 筆技能有效果描述`);

  db.close();
}

// ── 4. 主流程 ──────────────────────────────────────────────────

async function main() {
  console.log('═══ fetch-skill-effects.js ═══\n');

  let effectMap = null;

  // 嘗試遠端
  if (useRemote) {
    effectMap = await fetchRemoteMoves();
  }

  // 回退本地
  if (!effectMap) {
    try {
      effectMap = loadLocalMoves();
    } catch (e) {
      console.error(`✗ ${e.message}`);
      process.exit(1);
    }
  }

  if (!effectMap || effectMap.size === 0) {
    console.error('✗ 未取得任何技能效果資料');
    process.exit(1);
  }

  // 批量更新 DB
  updateEffectDesc(effectMap);

  // 自動觸發標籤清洗
  console.log('\n── 觸發標籤清洗（update-skill-tags.cjs）──\n');
  const { execSync } = await import('child_process');
  execSync('node src/update-skill-tags.cjs', { cwd: join(__dirname, '..'), stdio: 'inherit' });
}

main().catch((e) => {
  console.error('致命錯誤：', e);
  process.exit(1);
});
