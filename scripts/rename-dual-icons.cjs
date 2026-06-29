const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'types-dual');

const S2T = {
  '冰':'冰','暗影':'暗影','龙':'龍','神秘':'神秘','邪灵':'邪靈',
  '草':'草','超能':'超能','机械':'機械','战斗':'戰鬥',
  '次元':'次元','地面':'地面','电':'電','飞行':'飛行',
  '光':'光','混沌':'混沌','火':'火','圣灵':'聖靈',
  '水':'水','虚空':'虛空','远古':'遠古','自然':'自然',
  '轮回':'輪迴','虫':'蟲','王':'王','普通':'普通',
};

const TYPES = Object.keys(S2T).sort((a, b) => b.length - a.length);

function parseDualName(simpName) {
  for (const t1 of TYPES) {
    if (simpName.startsWith(t1)) {
      const rest = simpName.slice(t1.length);
      for (const t2 of TYPES) {
        if (rest === t2) return [S2T[t1], S2T[t2]];
      }
    }
  }
  return null;
}

// Build DB dual combos to check coverage
const sprites = require(path.join(__dirname, '..', 'dist-data', 'sprites.json'));
const dbDuals = new Set();
sprites.forEach(s => {
  const types = JSON.parse(s.types);
  if (types.length === 2) dbDuals.add(types.sort().join('/'));
});

let renamed = 0;
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png'));
const existing = new Set();

for (const file of files) {
  const simpName = file.replace('.png', '');
  const parsed = parseDualName(simpName);
  if (!parsed) { console.log('  SKIP:', file); continue; }
  const [a, b] = parsed;
  const tradKey = [a, b].sort().join('/'); // DB key
  const tradFlat = [a, b].sort().join(''); // flat filename
  const dstName = tradFlat + '.png';
  const src = path.join(DIR, file);
  const dst = path.join(DIR, dstName);
  
  existing.add(tradKey);
  
  if (file === dstName) { continue; }
  if (fs.existsSync(dst)) { fs.unlinkSync(src); continue; }
  fs.renameSync(src, dst);
  renamed++;
}

// Check coverage
const missing = [...dbDuals].filter(k => !existing.has(k));
console.log('Renamed:', renamed);
console.log('Icons available:', existing.size);
console.log('DB combos:', dbDuals.size);
console.log('Missing from icons:', missing.length);
if (missing.length) missing.forEach(m => console.log('  ', m));
