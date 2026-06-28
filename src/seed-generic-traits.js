import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'db', 'seer.db'));

db.pragma('foreign_keys = ON');

const traits = [
  // ── 屬性增傷 (16) ──
  {
    name: '流水', category: '屬性增傷', element_type: '水', formula_type: 'CUSTOM',
    description_template: '所有水系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '炎火', category: '屬性增傷', element_type: '火', formula_type: 'CUSTOM',
    description_template: '所有火系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '飞空', category: '屬性增傷', element_type: '飛行', formula_type: 'CUSTOM',
    description_template: '所有飛行系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '蓄电', category: '屬性增傷', element_type: '電', formula_type: 'CUSTOM',
    description_template: '所有電系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '碎裂', category: '屬性增傷', element_type: '地面', formula_type: 'CUSTOM',
    description_template: '所有地面系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '冰霜', category: '屬性增傷', element_type: '冰', formula_type: 'CUSTOM',
    description_template: '所有冰系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '机能', category: '屬性增傷', element_type: '機械', formula_type: 'CUSTOM',
    description_template: '所有機械系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '魔幻', category: '屬性增傷', element_type: '超能', formula_type: 'CUSTOM',
    description_template: '所有超能系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '战意', category: '屬性增傷', element_type: '戰鬥', formula_type: 'CUSTOM',
    description_template: '所有戰鬥系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '平衡', category: '屬性增傷', element_type: '普通', formula_type: 'CUSTOM',
    description_template: '所有普通系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '黑夜', category: '屬性增傷', element_type: '暗影', formula_type: 'CUSTOM',
    description_template: '所有暗影系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '光环', category: '屬性增傷', element_type: '光', formula_type: 'CUSTOM',
    description_template: '所有光系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '奇异', category: '屬性增傷', element_type: '神秘', formula_type: 'CUSTOM',
    description_template: '所有神秘系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '威严', category: '屬性增傷', element_type: '龍', formula_type: 'CUSTOM',
    description_template: '所有龍系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '圣灵', category: '屬性增傷', element_type: '聖靈', formula_type: 'CUSTOM',
    description_template: '所有聖靈系技能的威力增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '叶绿', category: '屬性增傷', element_type: '草', formula_type: 'CUSTOM',
    description_template: '所有草系技能的威力增加{value}%',
    custom_values: [5, 6, 8, 10, 12, 14], note: null
  },

  // ── 攻擊增傷 (2) ──
  {
    name: '强袭', category: '攻擊增傷', element_type: null, formula_type: 'CUSTOM',
    description_template: '自身使用攻擊技能時，威力增加{value}%',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },
  {
    name: '精神', category: '攻擊增傷', element_type: null, formula_type: 'CUSTOM',
    description_template: '自身使用特攻技能時，威力增加{value}%',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },

  // ── 狀態觸發-受擊 (6) ──
  {
    name: '冰冷', category: '狀態觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使對手進入冰凍狀態',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },
  {
    name: '高热', category: '狀態觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使對手進入灼傷狀態',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },
  {
    name: '中毒', category: '狀態觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使對手中毒',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },
  {
    name: '阴森', category: '狀態觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使對手進入害怕狀態',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },
  {
    name: '带电', category: '狀態觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使對手麻痺',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },
  {
    name: '睡眠', category: '狀態觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使對手入睡',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },

  // ── 狀態觸發-自身 (4) ──
  {
    name: '火热', category: '狀態觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '自身使用攻擊技能時有{value}%機率使對手灼傷',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },
  {
    name: '极寒', category: '狀態觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '自身使用攻擊技能時有{value}%機率使對手冰凍',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },
  {
    name: '颤栗', category: '狀態觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '自身使用攻擊技能時有{value}%機率使對手害怕',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },
  {
    name: '静电', category: '狀態觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '自身使用攻擊技能時有{value}%機率使對手麻痺',
    custom_values: [3, 4, 5, 6, 7, 8], note: null
  },

  // ── 能力等級觸發-自身+1 (5) ──
  {
    name: '反击', category: '能力等級觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使自身攻擊+1',
    custom_values: [5, 6, 7, 8, 7, 8], note: '4星數值疑似資料錯誤(7%<3星8%)，待後續版本更新或其他來源校正'
  },
  {
    name: '反攻', category: '能力等級觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使自身特攻+1',
    custom_values: [5, 6, 8, 10, 12, 14], note: null
  },
  {
    name: '抵抗', category: '能力等級觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使自身防禦+1',
    custom_values: [5, 6, 8, 10, 12, 14], note: null
  },
  {
    name: '坚韧', category: '能力等級觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使自身特防+1',
    custom_values: [5, 6, 8, 10, 12, 14], note: null
  },
  {
    name: '借风', category: '能力等級觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使自身速度+1',
    custom_values: [5, 6, 8, 10, 12, 14], note: null
  },

  // ── 能力等級觸發-對方-1 (5) ──
  {
    name: '反抗', category: '能力等級觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使對手攻擊-1',
    custom_values: [5, 6, 8, 10, 12, 14], note: null
  },
  {
    name: '忽略', category: '能力等級觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使對手特攻-1',
    custom_values: [5, 6, 8, 10, 12, 14], note: null
  },
  {
    name: '反驳', category: '能力等級觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使對手防禦-1',
    custom_values: [5, 6, 8, 10, 12, 14], note: null
  },
  {
    name: '草率', category: '能力等級觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使對手特防-1',
    custom_values: [5, 6, 8, 10, 12, 14], note: null
  },
  {
    name: '慌张', category: '能力等級觸發', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率使對手速度-1',
    custom_values: [5, 6, 8, 10, 12, 14], note: null
  },

  // ── 面板/機率類 (11) ──
  {
    name: '精准', category: '面板機率', element_type: null, formula_type: 'CUSTOM',
    description_template: '所有技能命中率增加{value}%',
    custom_values: [5, 6, 7, 8, 9, 10],
    note: 'BWIKI與PVE概論數值有出入(4-5星BWIKI為12%/14%，PVE概論為9%/10%)，採用較新版本PVE概論'
  },
  {
    name: '回避', category: '面板機率', element_type: null, formula_type: 'CUSTOM',
    description_template: '自身所有技能迴避率增加{value}%',
    custom_values: [5, 6, 7, 8, 12, 14], note: null
  },
  {
    name: '会心', category: '面板機率', element_type: null, formula_type: 'CUSTOM',
    description_template: '所有技能的致命一擊率增加{value}%',
    custom_values: [6, 7.5, 8.8, 10, null, 14],
    note: '0-3星採用手機版BWIKI數據(6%/7.5%/8.8%/10%)，4星數值缺失，5星數據來自PVE百科全書6000次測試結論'
  },
  {
    name: '吸血', category: '面板機率', element_type: null, formula_type: 'CUSTOM',
    description_template: '每次造成傷害後回復自身{value}%傷害值的生命',
    custom_values: [6, 7, 8, 9, 10, 11], note: null
  },
  {
    name: '瞬杀', category: '面板機率', element_type: null, formula_type: 'CUSTOM',
    description_template: '使用攻擊技能時有{value}%機率秒殺對方',
    custom_values: [3, 3.5, 4, 5, 6, 7], note: null
  },
  {
    name: '回神', category: '面板機率', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率回復自身1/8的最大體力',
    custom_values: [3, 4, 5, 6, 7, 8],
    note: 'BWIKI與PVE概論數值有出入(BWIKI為3%/3.5%/4%/5%/6%/7%)，採用較新版本PVE概論'
  },
  {
    name: '顽强', category: '面板機率', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率回復自身1/4的最大體力',
    custom_values: [3, 4, 5, 6, 7, 8],
    note: 'BWIKI與PVE概論數值有出入(BWIKI為3%/3.5%/4%/5%/6%/7%)，採用較新版本PVE概論'
  },
  {
    name: '虚无', category: '面板機率', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率免疫該傷害(擋傷)',
    custom_values: [1, 1.3, 1.5, 2, null, null],
    note: '4-5星數值缺失，BWIKI與手機版僅顯示0-3星(1%/1.3%/1.5%/2%)，PVE百科全書確認「虛無實際機率和面板相同」'
  },
  {
    name: '免爆', category: '面板機率', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到暴擊傷害時有{value}%機率免疫該傷害(擋傷)',
    custom_values: [6, 7.5, 8.8, 10, null, null],
    note: '4-5星數值缺失，BWIKI與手機版僅顯示0-3星(6%/7.5%/8.8%/10%)'
  },
  {
    name: '坚硬', category: '面板機率', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害減少{value}%',
    custom_values: [5, 6, 8, 10, 9, 10],
    note: 'BWIKI與PVE概論數值有出入(BWIKI為5%/6%/7%/8%)，採用PVE百科全書數據(5%/6%/8%/10%/9%/10%)，官方證實3星=5星>4星'
  },
  {
    name: '反弹', category: '面板機率', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率反彈固定傷害',
    custom_values: [20, 25, 30, 35, 40, 45],
    note: '0-3星採用BWIKI數據(20%/25%/30%/35%)，4-5星數據來自PVE概論(40%/45%)，反彈傷害依次為60/70/80/90/100/110點'
  },

  // ── 固傷複合 (3) ──
  {
    name: '吸收', category: '固傷複合', element_type: null, formula_type: 'CUSTOM',
    description_template: '受到攻擊傷害時有{value}%機率吸收固定傷害並回復體力',
    custom_values: [5, 6, 8, 10, 12, 14],
    note: '存機率值，固定傷害值：35/40/50/60/60/60點'
  },
  {
    name: '强攻', category: '固傷複合', element_type: null, formula_type: 'CUSTOM',
    description_template: '使用攻擊技能時有{value}%機率附加固定傷害',
    custom_values: [5, 6, 8, 10, 12, 14],
    note: '存機率值，固定傷害值：35/40/50/60/70/80點'
  },
  {
    name: '强念', category: '固傷複合', element_type: null, formula_type: 'CUSTOM',
    description_template: '使用特攻技能時有{value}%機率附加固定傷害',
    custom_values: [5, 6, 8, 10, 12, 14],
    note: '存機率值，固定傷害值：35/40/50/60/70/80點'
  },
];

const insert = db.prepare(`
  INSERT OR REPLACE INTO generic_traits (name, category, element_type, formula_type, description_template, custom_values, note)
  VALUES (@name, @category, @element_type, @formula_type, @description_template, @custom_values, @note)
`);

const runAll = db.transaction((rows) => {
  for (const row of rows) {
    insert.run({
      name: row.name,
      category: row.category,
      element_type: row.element_type,
      formula_type: row.formula_type,
      description_template: row.description_template,
      custom_values: JSON.stringify(row.custom_values),
      note: row.note,
    });
  }
});

runAll(traits);
console.log(`Seeded ${traits.length} generic traits.`);

const stats = db.prepare('SELECT category, COUNT(*) as cnt FROM generic_traits GROUP BY category').all();
console.log('Category breakdown:');
for (const s of stats) console.log(`  ${s.category}: ${s.cnt}`);

const nullCheck = db.prepare('SELECT name, custom_values FROM generic_traits WHERE custom_values LIKE \'%null%\'' ).all();
if (nullCheck.length > 0) {
  console.log(`\nTraits with null values in custom_values (expected):`);
  for (const r of nullCheck) console.log(`  ${r.name}: ${r.custom_values}`);
}

db.close();
