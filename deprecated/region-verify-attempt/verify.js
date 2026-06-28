import Database from 'better-sqlite3';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const RAW_DIR = join(__dirname, '..', 'raw');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function displaySpriteInfo(sprite) {
  console.log('\n' + '='.repeat(60));
  console.log(`精靈: ${sprite.name_zh} (CN: ${sprite.cn_id})`);
  console.log('='.repeat(60));
  console.log(`屬性: ${sprite.types}`);
  console.log(`體力: ${sprite.base_hp}  攻擊: ${sprite.base_atk}  防禦: ${sprite.base_def}`);
  console.log(`特攻: ${sprite.base_spatk}  特防: ${sprite.base_spdef}  速度: ${sprite.base_speed}`);
  console.log(`身高: ${sprite.height}m  體重: ${sprite.weight}kg`);
  console.log(`性別: ${sprite.gender || '無性別'}`);
  console.log(`來源: ${sprite.source_url}`);
}

async function verifySprites() {
  if (!existsSync(RAW_DIR)) {
    console.log('raw/ 目錄不存在');
    return;
  }

  const files = readdirSync(RAW_DIR).filter(f => f.endsWith('.json'));
  console.log(`找到 ${files.length} 個待校對的精靈資料\n`);

  const getSprite = db.prepare('SELECT * FROM sprites WHERE cn_id = ?');
  const insertDiff = db.prepare(`
    INSERT INTO verify_diffs (sprite_id, field, cn_value, tw_value, status, verified_by, verified_at)
    VALUES (?, ?, ?, ?, 'pending', 'user', datetime('now'))
  `);
  const updateRegionStatus = db.prepare('UPDATE sprites SET region_status = ? WHERE cn_id = ?');

  let verified = 0;
  let skipped = 0;

  for (const file of files) {
    const data = JSON.parse(readFileSync(join(RAW_DIR, file), 'utf-8'));
    displaySpriteInfo(data);

    const answer = await question('\n是否開始校對? (y/n/s=跳過): ');
    if (answer.toLowerCase() === 's') {
      skipped++;
      continue;
    }
    if (answer.toLowerCase() !== 'y') continue;

    const spriteRow = getSprite.get(data.cn_id);
    
    const fields = [
      { key: 'name_zh', label: '名稱', cn: data.name_zh },
      { key: 'types', label: '屬性', cn: JSON.stringify(data.types) },
      { key: 'base_hp', label: '體力', cn: String(data.base_stats?.hp) },
      { key: 'base_atk', label: '攻擊', cn: String(data.base_stats?.atk) },
      { key: 'base_def', label: '防禦', cn: String(data.base_stats?.def) },
      { key: 'base_spatk', label: '特攻', cn: String(data.base_stats?.spatk) },
      { key: 'base_spdef', label: '特防', cn: String(data.base_stats?.spdef) },
      { key: 'base_speed', label: '速度', cn: String(data.base_stats?.speed) },
    ];

    let allSame = true;
    for (const field of fields) {
      console.log(`\n欄位: ${field.label}`);
      console.log(`  陸服值: ${field.cn}`);
      const twValue = await question('  台服值 (直接Enter=一致): ');
      
      if (twValue && twValue !== field.cn) {
        allSame = false;
        if (spriteRow) {
          insertDiff.run(spriteRow.id, field.key, field.cn, twValue);
          console.log(`  → 已記錄差異`);
        }
      } else {
        console.log(`  → 一致`);
      }
    }

    if (spriteRow) {
      const status = allSame ? 'shared' : 'pending_verify';
      updateRegionStatus.run(status, data.cn_id);
    }

    verified++;
    console.log(`\n校對完成 (${verified}/${files.length})`);
  }

  console.log(`\n校對結束: 已校對 ${verified} 筆, 跳過 ${skipped} 筆`);
  rl.close();
  db.close();
}

verifySprites().catch(console.error);
