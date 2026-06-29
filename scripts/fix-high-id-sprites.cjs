const https = require('https');
const fs = require('fs');
const path = require('path');
const sprites = require(path.join(__dirname, '..', 'dist-data', 'sprites.json'));
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const OUTPUT = path.join(__dirname, '..', 'public', 'sprites-fallback');
if (!fs.existsSync(OUTPUT)) fs.mkdirSync(OUTPUT, { recursive: true });

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS, timeout: 15000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) { fetchPage(res.headers.location).then(resolve, reject); return; }
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function dl(url, dest) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(dest);
    https.get(url, { headers: HEADERS, timeout: 15000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) { dl(res.headers.location, dest).then(resolve, reject); return; }
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      res.pipe(f); f.on('finish', () => { f.close(); resolve(); });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchImg(cnId) {
  try {
    const html = await fetchPage('https://wiki.biligame.com/seer/\u7cbe\u7075:' + cnId);
    const patterns = [
      new RegExp('src="(https://patchwiki\\.biligame\\.com/images/seer/[a-f0-9]/[a-f0-9]{2}/[a-z0-9]+\\.png)"[^>]*alt="[^"]*\u5934\u50cf[^"]*"', 'i'),
      new RegExp('alt="[^"]*\u5934\u50cf-' + cnId + '[^"]*"[^>]*src="(https://patchwiki\\.biligame\\.com/images/seer/[^"]+)"', 'i'),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m) return m[1];
    }
    const all = [...html.matchAll(/"(https:\/\/patchwiki\.biligame\.com\/images\/seer\/[a-f0-9]\/[a-f0-9]{2}\/[a-z0-9]+\.png)"/gi)];
    if (all.length) return all[0][1];
  } catch (e) { /* ignore */ }
  return null;
}

async function main() {
  const highIds = sprites.filter(s => s.cn_id >= 15000).map(s => s.cn_id);
  const extra = [15094, 15136, 15141, 15151, 15155];
  const toCheck = [...new Set([...highIds, ...extra])];
  console.log('To check:', toCheck.length);

  let ok = 0, fail = 0;
  for (let i = 0; i < toCheck.length; i++) {
    const cnId = toCheck[i];
    const sprite = sprites.find(s => s.cn_id === cnId);
    const name = sprite ? sprite.name_zh : '';
    process.stdout.write('[' + (i + 1) + '/' + toCheck.length + '] #' + cnId + ' ' + name + '...');

    if (fs.existsSync(path.join(OUTPUT, cnId + '.png'))) { console.log(' SKIP'); ok++; continue; }

    const url = await fetchImg(cnId);
    if (!url) { console.log(' \u2717 no img'); fail++; await sleep(500); continue; }
    try {
      await dl(url, path.join(OUTPUT, cnId + '.png'));
      console.log(' \u2713');
      ok++;
    } catch (e) { console.log(' \u2717 ' + e.message); fail++; }
    await sleep(500);
  }
  console.log('\nDone:', ok, 'ok,', fail, 'failed');
}

main().catch(console.error);
