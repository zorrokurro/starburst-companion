const https = require('https');
const fs = require('fs');
const path = require('path');
const sprites = require(path.join(__dirname, '..', 'dist-data', 'sprites.json'));
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'sprites-fallback');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS, timeout: 15000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) { fetchPage(res.headers.location).then(resolve, reject); return; }
      let data = ''; res.on('data', c => data += c); res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: HEADERS, timeout: 15000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) { downloadFile(res.headers.location, dest).then(resolve, reject); return; }
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      res.pipe(file); file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchBWIKIImage(cnId) {
  const pageUrl = `https://wiki.biligame.com/seer/精灵:${cnId}`;
  try {
    const html = await fetchPage(pageUrl);
    // Pattern: src="...patchwiki...png" with alt containing 头像 or cnId
    const pattern = new RegExp(`src="(https://patchwiki\\.biligame\\.com/images/seer/[a-f0-9]/[a-f0-9]{2}/[a-z0-9]+\\.png)"[^>]*alt="[^"]*头像[^"]*"`, 'i');
    const match = html.match(pattern);
    if (match) return match[1];
    // Try reversed order: alt first, then src
    const pattern2 = new RegExp(`alt="[^"]*头像-${cnId}[^"]*"[^>]*src="(https://patchwiki\\.biligame\\.com/images/seer/[^"]+)"`, 'i');
    const match2 = html.match(pattern2);
    if (match2) return match2[1];
    // Broader: find any patchwiki image in profile area
    const pattern3 = new RegExp(`"(https://patchwiki\\.biligame\\.com/images/seer/[a-f0-9]/[a-f0-9]{2}/[a-z0-9]+\\.png)"`, 'gi');
    const allMatches = [...html.matchAll(pattern3)];
    for (const m of allMatches) { return m[1]; } // Return first image found
    return null;
  } catch (e) { return null; }
}

async function main() {
  // IDs known to be 404 from scan: collect from the scan output
  // From earlier checks + partial scan: #4000 confirmed 4000-area + high IDs
  // Let's check the missing-sprites.json or just scan a range
  const missingIds = [];
  const checkIds = [];
  
  // Add known problem ranges
  for (let i = 2685; i <= 2700; i++) checkIds.push(i);
  for (let i = 3000; i <= 3010; i++) checkIds.push(i);
  for (let i = 3070; i <= 3080; i++) checkIds.push(i);
  for (let i = 3670; i <= 3690; i++) checkIds.push(i);
  for (let i = 3990; i <= 4010; i++) checkIds.push(i);
  for (let i = 4425; i <= 4440; i++) checkIds.push(i);
  for (let i = 5265; i <= 5300; i++) checkIds.push(i);
  for (let i = 5380; i <= 5400; i++) checkIds.push(i);
  for (let i = 5440; i <= 5470; i++) checkIds.push(i);
  for (let i = 5510; i <= 5540; i++) checkIds.push(i);
  // Also check very high IDs
  for (let i = 5000; i <= 5010; i++) checkIds.push(i);

  console.log(`Checking ${checkIds.length} candidate IDs for 404...`);
  
  // Deduplicate
  const uniqueCheck = [...new Set(checkIds)];
  
  for (let i = 0; i < uniqueCheck.length; i += 5) {
    const batch = uniqueCheck.slice(i, i + 5);
    const results = await Promise.all(batch.map(id => {
      return new Promise(resolve => {
        const req = https.request(`https://seerh5.61.com/resource/assets/pet/head/${id}.png`, { method: 'HEAD', timeout: 8000, headers: HEADERS }, res => resolve({ id, status: res.statusCode }));
        req.on('error', () => resolve({ id, status: 'ERR' }));
        req.on('timeout', () => { req.destroy(); resolve({ id, status: 'TIMEOUT' }); });
        req.end();
      });
    }));
    results.forEach(r => { if (r.status === 404) missingIds.push(r.id); });
    process.stdout.write(`\r  Checked ${Math.min(i + 5, uniqueCheck.length)}/${uniqueCheck.length}`);
    await sleep(200);
  }
  
  console.log(`\nFound ${missingIds.length} sprites with 404 on CDN`);

  if (missingIds.length === 0) {
    // Fallback: just check #4000
    missingIds.push(4000);
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\nFetching ${missingIds.length} images from BWIKI...`);
  let downloaded = 0, failed = 0;
  for (const cnId of missingIds) {
    const sprite = sprites.find(s => s.cn_id === cnId);
    const name = sprite?.name_zh || 'unknown';
    process.stdout.write(`  #${cnId} ${name}...`);
    const imgUrl = await fetchBWIKIImage(cnId);
    if (!imgUrl) { console.log(' ✗ no image'); failed++; await sleep(500); continue; }
    try {
      const dest = path.join(OUTPUT_DIR, `${cnId}.png`);
      await downloadFile(imgUrl, dest);
      console.log(` ✓ (${(fs.statSync(dest).size / 1024).toFixed(0)}KB)`);
      downloaded++;
    } catch (e) { console.log(` ✗ ${e.message}`); failed++; }
    await sleep(500);
  }
  console.log(`\nDone: ${downloaded} downloaded, ${failed} failed`);
}

main().catch(console.error);
