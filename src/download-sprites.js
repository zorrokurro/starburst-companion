import Database from 'better-sqlite3';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const SPRITES_DIR = join(__dirname, '..', 'public', 'sprites');
const HEAD_DIR = join(SPRITES_DIR, 'head');
const BODY_DIR = join(SPRITES_DIR, 'body');

// ── Fallback 鏈路定義 ──
const HEAD_SOURCES = [
  { label: 'H5',   url: 'https://seerh5.61.com/resource/assets/pet/head/{id}.png' },
  { label: 'Flash', url: 'http://res.seer.61.com/resource/pet/head/{id}.png' },
];

const BODY_SOURCES = [
  { label: 'H5',   url: 'https://seerh5.61.com/resource/assets/fightResource/pet/{id}.png' },
  { label: 'Flash', url: 'http://res.seer.61.com/resource/pet/icon/{id}.png' },
];

const CONCURRENCY = 5;
const DELAY_MS = 200;
const MAX_RETRIES = 2;
const MIN_FILE_SIZE = 100; // bytes — 低於此值視為空白/無效圖片

mkdirSync(HEAD_DIR, { recursive: true });
mkdirSync(BODY_DIR, { recursive: true });

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 單次 HTTP 下載嘗試
 * @returns {{ ok: boolean, status?: number, size?: number, error?: string, source?: string }}
 */
async function fetchOnce(url, destPath) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return { ok: false, status: resp.status };

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < MIN_FILE_SIZE) {
      return { ok: false, status: 0, size: buffer.length, error: 'empty_file' };
    }
    writeFileSync(destPath, buffer);
    return { ok: true, size: buffer.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * 帶重試的下載（對單一 URL）
 */
async function downloadWithRetry(url, destPath) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await fetchOnce(url, destPath);
    if (result.ok) return result;
    if (attempt < MAX_RETRIES) await sleep(1000 * (attempt + 1));
  }
  return { ok: false, error: 'max_retries_exceeded' };
}

/**
 * Fallback 鏈路下載：依序嘗試多個來源，第一個成功即止
 * @param {Array<{label: string, url: string}>} sources
 * @param {string} destPath
 * @param {string} id
 */
async function downloadWithFallback(sources, destPath, id) {
  for (const source of sources) {
    const url = source.url.replace('{id}', id);
    const result = await downloadWithRetry(url, destPath);

    if (result.ok) {
      return { ...result, source: source.label };
    }
  }
  return { ok: false, source: 'all_failed', error: 'all_sources_failed' };
}

async function downloadPet(id) {
  const headPath = join(HEAD_DIR, `${id}.png`);
  const bodyPath = join(BODY_DIR, `${id}.png`);

  const headExists = existsSync(headPath) && statSync(headPath).size >= MIN_FILE_SIZE;
  const bodyExists = existsSync(bodyPath) && statSync(bodyPath).size >= MIN_FILE_SIZE;

  const tasks = [];
  if (!headExists) {
    tasks.push(
      downloadWithFallback(HEAD_SOURCES, headPath, id).then(r => ({ type: 'head', ...r }))
    );
  }
  if (!bodyExists) {
    tasks.push(
      downloadWithFallback(BODY_SOURCES, bodyPath, id).then(r => ({ type: 'body', ...r }))
    );
  }

  if (tasks.length === 0) return { id, skipped: true };

  const results = await Promise.all(tasks);
  return { id, skipped: false, results };
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const rows = db.prepare('SELECT cn_id FROM sprites').all();
  db.close();

  const ids = rows.map(r => String(r.cn_id));
  console.log(`Total sprites: ${ids.length}`);
  console.log('Fallback chain:');
  console.log(`  Head: ${HEAD_SOURCES.map(s => s.label).join(' → ')}`);
  console.log(`  Body: ${BODY_SOURCES.map(s => s.label).join(' → ')}`);
  console.log('');

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const sourceStats = {};

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(id => downloadPet(id)));

    for (const r of results) {
      if (r.skipped) {
        skipped++;
      } else {
        downloaded++;
        for (const res of (r.results || [])) {
          if (res.ok) {
            sourceStats[res.source] = (sourceStats[res.source] || 0) + 1;
          } else {
            failed++;
          }
        }
      }
    }

    const progress = Math.min(i + CONCURRENCY, ids.length);
    process.stdout.write(
      `\r[${progress}/${ids.length}] downloaded=${downloaded} skipped=${skipped} failed=${failed}`
    );

    if (i + CONCURRENCY < ids.length) await sleep(DELAY_MS);
  }

  console.log('\n\nDone!');
  console.log(`  Downloaded: ${downloaded} sprites`);
  console.log(`  Skipped (already exist): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log('  Source breakdown:');
  for (const [src, cnt] of Object.entries(sourceStats)) {
    console.log(`    ${src}: ${cnt}`);
  }
}

main().catch(console.error);
