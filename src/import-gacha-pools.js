import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');
const DATA_DIR = join(__dirname, '..', 'seerh5_data');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const monstersRaw = JSON.parse(readFileSync(join(DATA_DIR, 'Monsterpool.json'), 'utf-8'));
const pools = monstersRaw.Root.Pool;

const insertPool = db.prepare(`
  INSERT INTO gacha_pools (id, pool_id, item_id, monster_cn_id, monster_name, kind, is_unique)
  VALUES (@id, @pool_id, @item_id, @monster_cn_id, @monster_name, @kind, @is_unique)
`);

const importTransaction = db.transaction(() => {
  db.exec('DELETE FROM gacha_pools');

  let globalId = 1;
  let totalRows = 0;

  for (const pool of pools) {
    const items = Array.isArray(pool.item) ? pool.item : [pool.item];

    for (const item of items) {
      insertPool.run({
        id: globalId++,
        pool_id: pool.id,
        item_id: item.id,
        monster_cn_id: String(item.monsterid),
        monster_name: item.monstername,
        kind: item.kind,
        is_unique: item.isjustone || 0,
      });
      totalRows++;
    }

    console.log(`  Pool ${pool.id}: ${items.length} items`);
  }

  return totalRows;
});

console.log('Importing gacha pools from Monsterpool.json...');
const total = importTransaction();
console.log(`Done. Total rows: ${total}`);

db.close();
