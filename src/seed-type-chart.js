import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'seer.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Single-type effectiveness chart (attack_type -> defend_type : multiplier)
// 0 = immune, 0.5 = not very effective, 1 = normal, 2 = super effective
const typeChart = {
  普通: {},
  水: { 地面: 2, 火: 2, 聖靈: 0.5, 水: 0.5, 混沌: 0.5, 自然: 0.5, 草: 0.5 },
  火: { 冰: 2, 機械: 2, 草: 2, 聖靈: 0.5, 水: 0.5, 混沌: 0.5, 火: 0.5, 自然: 0.5 },
  草: { 地面: 2, 水: 2, 龍: 2, 聖靈: 0.5, 機械: 0.5, 混沌: 0.5, 火: 0.5, 草: 0.5, 遠古: 0.5, 飛行: 0.5 },
  電: { 暗影: 2, 次元: 2, 水: 2, 混沌: 2, 飛行: 2, 聖靈: 0.5, 電: 0.5, 神秘: 0.5, 自然: 0.5, 草: 0.5, 地面: 0 },
  地面: { 機械: 2, 火: 2, 王: 2, 電: 2, 光: 0.5, 聖靈: 0.5, 暗影: 0.5, 自然: 0.5, 草: 0.5, 超能: 0.5, 飛行: 0 },
  機械: { 冰: 2, 戰鬥: 2, 遠古: 2, 邪靈: 2, 機械: 0.5, 次元: 0.5, 水: 0.5, 火: 0.5, 電: 0.5 },
  冰: { 地面: 2, 次元: 2, 草: 2, 遠古: 2, 飛行: 2, 冰: 0.5, 聖靈: 0.5, 機械: 0.5, 水: 0.5, 混沌: 0.5, 火: 0.5 },
  超能: { 戰鬥: 2, 神秘: 2, 自然: 2, 機械: 0.5, 超能: 0.5, 龍: 0 },
  戰鬥: { 光: 2, 冰: 2, 聖靈: 2, 機械: 2, 戰鬥: 0.5, 暗影: 0.5, 王: 0.5, 超能: 0.5 },
  暗影: { 暗影: 2, 次元: 2, 超能: 2, 冰: 0.5, 聖靈: 0.5, 機械: 0.5, 邪靈: 0.5, 龍: 0.5 },
  光: { 光: 2, 冰: 2, 聖靈: 2, 邪靈: 2, 水: 0.5, 火: 0.5, 電: 0.5, 草: 0.5, 遠古: 0.5 },
  龍: { 暗影: 2, 超能: 2, 冰: 0.5, 聖靈: 0.5, 機械: 0.5, 自然: 0.5, 邪靈: 0.5, 龍: 0.5, 草: 0 },
  神秘: { 聖靈: 2, 王: 2, 電: 2, 神秘: 2, 自然: 2, 地面: 0.5, 戰鬥: 0.5, 混沌: 0.5, 邪靈: 0.5 },
  聖靈: { 冰: 2, 水: 2, 火: 2, 電: 2, 草: 2, 遠古: 2, 光: 0.5, 戰鬥: 0.5, 神秘: 0.5 },
  次元: { 機械: 2, 自然: 2, 超能: 2, 邪靈: 2, 飛行: 2, 冰: 0.5, 混沌: 0.5, 王: 0.5, 暗影: 0 },
  遠古: { 光: 2, 神秘: 2, 草: 2, 飛行: 2, 冰: 0.5, 機械: 0.5, 王: 0.5 },
  邪靈: { 暗影: 2, 次元: 2, 神秘: 2, 自然: 2, 龍: 2, 冰: 0.5, 聖靈: 0.5, 機械: 0.5, 混沌: 0.5, 王: 0.5, 超能: 0.5 },
  自然: { 地面: 2, 水: 2, 火: 2, 王: 2, 電: 2, 草: 2, 飛行: 2, 龍: 2, 戰鬥: 0.5, 暗影: 0.5, 機械: 0.5, 次元: 0.5, 混沌: 0.5, 神秘: 0.5, 超能: 0.5, 邪靈: 0.5 },
  王: { 戰鬥: 2, 暗影: 2, 次元: 2, 邪靈: 2, 自然: 0.5, 超能: 0.5 },
  混沌: { 冰: 2, 次元: 2, 神秘: 2, 自然: 2, 邪靈: 2, 飛行: 2, 戰鬥: 0.5, 機械: 0.5, 電: 0.5 },
  神靈: { 冰: 2, 水: 2, 混沌: 2, 火: 2, 電: 2, 草: 2, 遠古: 2, 邪靈: 2, 光: 0.5, 戰鬥: 0.5, 機械: 0.5 },
  輪迴: { 聖靈: 2, 暗影: 2, 次元: 2, 混沌: 2, 邪靈: 2, 龍: 2, 冰: 0.5, 自然: 0.5, 超能: 0.5 },
  蟲: { 地面: 2, 戰鬥: 2, 混沌: 2, 草: 2, 蟲: 2, 冰: 0.5, 水: 0.5, 火: 0.5, 龍: 0.5 },
  虛空: { 戰鬥: 2, 神秘: 2, 自然: 2, 超能: 2, 輪迴: 2, 龍: 2, 聖靈: 0.5, 暗影: 0.5, 次元: 0.5, 飛行: 0.5 },
};

const allTypes = Object.keys(typeChart);

const insertTypeChart = db.prepare(`
  INSERT OR REPLACE INTO type_chart (attack_type, defend_type, multiplier)
  VALUES (?, ?, ?)
`);

const seedTransaction = db.transaction(() => {
  // Clear existing data
  db.exec('DELETE FROM type_chart');

  let count = 0;
  for (const attackType of allTypes) {
    for (const defendType of allTypes) {
      if (attackType === defendType) continue; // Skip self (always 1x)

      const chart = typeChart[attackType];
      let multiplier = 1; // Default: normal

      if (chart && defendType in chart) {
        multiplier = chart[defendType];
      }

      // Only insert non-default values
      if (multiplier !== 1) {
        insertTypeChart.run(attackType, defendType, multiplier);
        count++;
      }
    }
  }

  console.log(`Inserted ${count} type effectiveness entries`);
});

seedTransaction();
db.close();
console.log('Type chart seeded successfully!');
