import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = 'https://wiki.biligame.com/seer/api.php';
const DELAY_MS = 200;
const SAVE_INTERVAL = 100;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://wiki.biligame.com/seer/'
};

async function fetchJSON(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchCategoryMembers(category) {
  const pages = [];
  let continueToken = null;
  do {
    let url = `${API}?action=query&list=categorymembers&cmtitle=${encodeURIComponent(category)}&cmlimit=500&format=json`;
    if (continueToken) url += `&cmcontinue=${encodeURIComponent(continueToken)}`;
    const data = await fetchJSON(url);
    if (data.query?.categorymembers) {
      for (const m of data.query.categorymembers) {
        if (m.ns === 0) pages.push(m.title);
      }
    }
    continueToken = data.continue?.cmcontinue || null;
    if (continueToken) await sleep(DELAY_MS);
  } while (continueToken);
  return pages;
}

function parseTemplate(wikitext, templateName) {
  const regex = new RegExp(`\\{\\{${templateName}\\s*\\n([\\s\\S]*?)\\}\\}`, 'i');
  const match = wikitext.match(regex);
  if (!match) return null;
  const block = match[1];
  const fields = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*\|([^=]+?)\s*=\s*(.*)$/);
    if (m) fields[m[1].trim()] = m[2].trim();
  }
  return fields;
}

async function fetchPageWikitext(title) {
  const url = `${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json`;
  const data = await fetchJSON(url);
  return data.parse?.wikitext?.['*'] || null;
}

function loadProgress(outputFile) {
  const path = join(__dirname, outputFile);
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch { return []; }
  }
  return [];
}

function saveProgress(results, outputFile) {
  writeFileSync(join(__dirname, outputFile), JSON.stringify(results, null, 2), 'utf-8');
}

async function fetchAll(templateName, category, outputFile) {
  console.log(`\n=== Fetching ${templateName} from ${category} ===`);

  const existing = loadProgress(outputFile);
  const doneTitles = new Set(existing.filter(r => r.fields || r.error).map(r => r.title));
  console.log(`Resuming: ${doneTitles.size} already fetched`);

  const titles = await fetchCategoryMembers(category);
  console.log(`Found ${titles.length} pages in category`);

  const results = [...existing];
  let errors = 0;
  let noTemplate = 0;
  let fetched = 0;

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    if (doneTitles.has(title)) continue;

    try {
      const wikitext = await fetchPageWikitext(title);
      if (!wikitext) {
        noTemplate++;
        results.push({ title, raw: null, error: 'no wikitext' });
      } else {
        const fields = parseTemplate(wikitext, templateName);
        if (!fields) {
          noTemplate++;
          results.push({ title, raw: wikitext.substring(0, 500), error: 'template not found' });
        } else {
          results.push({ title, fields });
        }
      }
    } catch (e) {
      errors++;
      results.push({ title, error: e.message });
    }

    fetched++;
    if (fetched % SAVE_INTERVAL === 0) {
      saveProgress(results, outputFile);
      console.log(`  [${doneTitles.size + fetched}/${titles.length}] progress saved (${results.filter(r => r.fields).length} parsed)`);
    }
    await sleep(DELAY_MS);
  }

  saveProgress(results, outputFile);
  console.log(`\nSaved ${results.length} entries to ${outputFile}`);
  console.log(`  Parsed: ${results.filter(r => r.fields).length}`);
  console.log(`  No template: ${noTemplate}`);
  console.log(`  Errors: ${errors}`);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'both';

  if (mode === 'engravings' || mode === 'both') {
    await fetchAll('刻印', 'Category:刻印', 'engravings_raw.json');
  }
  if (mode === 'souls' || mode === 'both') {
    await fetchAll('魂印', 'Category:魂印', 'soul_seals_raw.json');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
