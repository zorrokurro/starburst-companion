const https = require('https');
const fs = require('fs');
const path = require('path');

const sprites = require(path.join(__dirname, '..', 'dist-data', 'sprites.json'));
const CDN = 'https://seerh5.61.com/resource/assets/pet/head';
const BWIKI_BASE = 'https://wiki.biligame.com/seer';
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

function headCheck(url) {
  return new Promise(resolve => {
    const req = https.request(url, { method: 'HEAD', timeout: 10000, headers: HEADERS }, res => {
      resolve(res.statusCode);
    });
    req.on('error', () => resolve('ERR'));
    req.on('timeout', () => { req.destroy(); resolve('TIMEOUT'); });
    req.end();
  });
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS, timeout: 15000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchPage(res.headers.location).then(resolve, reject);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: HEADERS, timeout: 15000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadFile(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scanCDN(ids, concurrency = 5, delayMs = 200) {
  const missing = [];
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(id => headCheck(`${CDN}/${id}.png`)));
    batch.forEach((id, j) => {
      if (results[j] === 404) missing.push(id);
      else if (results[j] !== 200) missing.push(id); // TIMEOUT/ERR also treated as potentially missing
    });
    process.stdout.write(`\r  Scanned ${Math.min(i + concurrency, ids.length)}/${ids.length} (missing so far: ${missing.length})`);
    if (i + concurrency < ids.length) await sleep(delayMs);
  }
  console.log('');
  return missing;
}

async function fetchBWIKIImage(cnId) {
  const pageUrl = `${BWIKI_BASE}/精灵:${cnId}`;
  try {
    const html = await fetchPage(pageUrl);
    // Look for head image: alt="头像-{cnId}.png" or alt="头像-{cnId}"
    const pattern = new RegExp(`alt="头像-${cnId}[\\w.-]*"[^>]*src="([^"]+)"`, 'i');
    const match = html.match(pattern);
    if (match) return match[1];

    // Alternative: look for src containing the hash pattern
    const pattern2 = new RegExp(`src="(https://patchwiki\\.biligame\\.com/images/seer/[^"]*头像-${cnId}[^"]*)"`, 'i');
    const match2 = html.match(pattern2);
    if (match2) return match2[1];

    // Try another pattern: look for any img with head image in the pet profile
    const pattern3 = new RegExp(`"(https://patchwiki\\.biligame\\.com/images/seer/[a-f0-9]/[a-f0-9]{2}/[a-z0-9]+\\.png)"`, 'gi');
    const allMatches = [...html.matchAll(pattern3)];
    // Return the first one that looks like a head image (small file)
    for (const m of allMatches) {
      if (m[1].includes('头像') || m[1].includes(cnId.toString())) {
        return m[1];
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const ALL_IDS = sprites.map(s => s.cn_id);

  console.log(`=== Phase 1: Scan CDN for ${ALL_IDS.length} sprites ===`);
  const missingIds = await scanCDN(ALL_IDS, 5, 300);
  console.log(`\nFound ${missingIds.length} sprites potentially missing from CDN`);

  // Filter out TIMEOUT ones - re-check with longer timeout
  console.log(`\n=== Phase 2: Re-check ${missingIds.length} candidates ===`);
  const confirmed = [];
  for (let i = 0; i < missingIds.length; i += 3) {
    const batch = missingIds.slice(i, i + 3);
    const results = await Promise.all(batch.map(id => headCheck(`${CDN}/${id}.png`)));
    batch.forEach((id, j) => {
      if (results[j] === 404) confirmed.push(id);
    });
    process.stdout.write(`\r  Re-checked ${Math.min(i + 3, missingIds.length)}/${missingIds.length} (confirmed 404: ${confirmed.length})`);
    await sleep(500);
  }
  console.log(`\n\nConfirmed ${confirmed.length} sprites with 404 on CDN`);

  if (confirmed.length === 0) {
    console.log('No missing sprites found!');
    return;
  }

  // Save confirmed missing list
  const missingList = confirmed.map(id => {
    const sprite = sprites.find(s => s.cn_id === id);
    return { cn_id: id, name: sprite?.name_zh || 'Unknown' };
  });
  fs.writeFileSync(
    path.join(__dirname, '..', 'dist-data', 'missing-sprites.json'),
    JSON.stringify(missingList, null, 2)
  );
  console.log(`Saved missing list to dist-data/missing-sprites.json`);

  console.log(`\n=== Phase 3: Fetch images from BWIKI for ${confirmed.length} sprites ===`);
  const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'sprites-fallback');
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let downloaded = 0, failed = 0;
  for (let i = 0; i < confirmed.length; i++) {
    const cnId = confirmed[i];
    const sprite = sprites.find(s => s.cn_id === cnId);
    const name = sprite?.name_zh || 'unknown';
    process.stdout.write(`\r  [${i+1}/${confirmed.length}] Fetching #${cnId} ${name}...`);

    const imgUrl = await fetchBWIKIImage(cnId);
    if (!imgUrl) {
      console.log(`  ✗ #${cnId} ${name}: No image found on BWIKI`);
      failed++;
      await sleep(300);
      continue;
    }

    const dest = path.join(OUTPUT_DIR, `${cnId}.png`);
    try {
      await downloadFile(imgUrl, dest);
      const size = fs.statSync(dest).size;
      console.log(`  ✓ #${cnId} ${name} (${(size/1024).toFixed(1)}KB)`);
      downloaded++;
    } catch (e) {
      console.log(`  ✗ #${cnId} ${name}: Download failed: ${e.message}`);
      failed++;
    }
    await sleep(300);
  }

  console.log(`\n\n=== Done ===`);
  console.log(`Downloaded: ${downloaded} | Failed: ${failed}`);
  console.log(`Files saved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
