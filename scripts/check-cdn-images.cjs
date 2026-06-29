const https = require('https');
const fs = require('fs');
const path = require('path');

const sprites = require(path.join(__dirname, '..', 'dist-data', 'sprites.json'));
const CDN = 'https://seerh5.61.com/resource/assets/pet/head';

function checkUrl(url) {
  return new Promise(resolve => {
    const req = https.request(url, { method: 'HEAD', timeout: 5000 }, res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function main() {
  const sample = sprites.slice(0, 50);
  let ok = 0, fail = 0;
  const missing = [];

  for (const s of sample) {
    const url = `${CDN}/${s.cn_id}.png`;
    const exists = await checkUrl(url);
    if (exists) ok++;
    else { fail++; missing.push({ cn_id: s.cn_id, name: s.name_zh }); }
  }

  console.log(`Checked ${sample.length}: ${ok} OK, ${fail} missing`);
  if (missing.length) {
    console.log('Missing sprites:');
    missing.forEach(m => console.log(`  #${m.cn_id} ${m.name}`));
  }
}

main().catch(console.error);
