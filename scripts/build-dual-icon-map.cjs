const fs = require('fs');
const path = require('path');
const sprites = require(path.join(__dirname, '..', 'dist-data', 'sprites.json'));

const dbDuals = new Set();
sprites.forEach(s => {
  const types = JSON.parse(s.types);
  if (types.length === 2) dbDuals.add(types.sort().join('/'));
});

const iconFiles = fs.readdirSync(path.join(__dirname, '..', 'public', 'types-dual')).map(f => f.replace('.png',''));

const tradToSimp = {
  '冰':'冰','暗影':'暗影','龍':'龙','神秘':'神秘','邪靈':'邪灵',
  '草':'草','超能':'超能','機械':'机械','戰鬥':'战斗',
  '次元':'次元','地面':'地面','電':'电','飛行':'飞行',
  '光':'光','混沌':'混沌','火':'火','聖靈':'圣灵',
  '水':'水','虛空':'虚空','遠古':'远古','自然':'自然',
  '輪迴':'轮回','蟲':'虫','王':'王','普通':'普通',
};

function tradToSimpName(trad) {
  return trad.split('').map(c => tradToSimp[c] || c).join('');
}

const mapping = {};
const missing = [];
for (const combo of dbDuals) {
  const [a, b] = combo.split('/');
  const simp1 = tradToSimpName(a) + tradToSimpName(b);
  const simp2 = tradToSimpName(b) + tradToSimpName(a);
  if (iconFiles.includes(simp1)) {
    mapping[combo] = simp1;
  } else if (iconFiles.includes(simp2)) {
    mapping[combo] = simp2;
  } else {
    missing.push(combo);
  }
}

console.log('Mapped:', Object.keys(mapping).length);
console.log('Missing:', missing.length);
if (missing.length) missing.forEach(m => console.log('  ', m));

console.log('\nconst DUAL_ICON_MAP = {');
for (const [k, v] of Object.entries(mapping).sort()) {
  console.log('  "' + k + '": "' + v + '",');
}
console.log('};');
