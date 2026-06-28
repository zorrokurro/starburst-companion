# Task 07 — dawnnights/seerh5 資料源評估報告

## 結論：✅ 建議採用

seerh5 資料遠超 4399 爬蟲，是更優質的主資料源。

---

## 資料量對比

| 指標 | 4399 爬蟲 | seerh5 |
|------|-----------|--------|
| 精靈數量 | 210 | **6,460** |
| 技能數量 | 1,829 | **27,089** |
| 精靈-技能映射 | 433 | **5,573 隻精靈有技能表** |
| 種族值 | ❌ 無 | ✅ HP/Atk/Def/SpAtk/SpDef/Spd 全 |
| 屬性表 | 200 筆 | **138 屬性(20單+112雙+6特殊)** |
| 特殊效果 | ❌ 無 | **532 筆效果描述 + 1,939 筆附加效果** |
| 進化鏈 | ❌ 無 | ✅ EvolvesFrom/To/EvolvingLv |
| 性別 | ❌ 無 | ✅ 5,004 隻有性別資料 |

---

## 檔案結構

### monsters.json (6,460 筆)
```json
{
  "ID": "1",           // → cn_id
  "DefName": "布布种子", // → name_zh (簡體)
  "Type": "1",         // → type1/type2 (需解碼)
  "HP": "55",          // → hp
  "Atk": "69",         // → attack
  "Def": "65",         // → defense
  "SpAtk": "45",       // → sp_attack
  "SpDef": "55",       // → sp_defense
  "Spd": "31",         // → speed
  "EvolvesFrom": "0",  // → 進化來源
  "EvolvesTo": "2",    // → 進化目標
  "EvolvingLv": "18",  // → 進化等級
  "Gender": "2",       // → 性別 (0=無, 1=公, 2=母, 3=雌雄皆有)
  "PetClass": "1",     // → 精靈分類
  "LearnableMoves": {  // → sprite_skills 映射
    "Move": [
      {"ID": "10001", "LearningLv": "1"},
      {"ID": "20001", "LearningLv": "4"}
    ]
  }
}
```

### moves.json (27,089 筆)
```json
{
  "ID": "10001",       // → skill_id
  "Name": "撞击",      // → name (簡體)
  "Type": "8",         // → type (屬性ID)
  "Power": "35",       // → power
  "Category": "1",     // → category (1=物攻, 2=特攻, 3=屬攻)
  "Accuracy": "95",    // → accuracy
  "MaxPP": "35",       // → pp
  "CD": "1000",        // → cooldown (ms)
  "SideEffect": "12",  // → 附加效果ID (對應 effectDes)
  "SideEffectArg": "10" // → 效果參數
}
```

### skillTypes.json (138 筆)
- IDs 1-20: 單屬性 (草/水/火/飛行/電/機械/地面/普通/冰/超能/戰鬥/光/暗影/神秘/龍/聖靈/次元/遠古/邪靈/自然)
- IDs 21-132: 雙屬性組合 (如 21=草超能, 22=草戰鬥...)
- IDs 221-226: 特殊屬性 (王/混沌/神靈/輪迴/蟲/虛空)

### effectDes.json (532 筆)
```json
{
  "id": 532,
  "kind": 1,
  "kinddes": "寒月",
  "desc": "回合开始时，转移至在场精灵体力较低的一方...",
  "monster": 4147  // 關聯精靈ID
}
```

### SideEffects (1,939 筆)
```json
{
  "ID": "1000001",
  "help": "给与对象损伤的一半会回复自己的体力",
  "des": "给予对象损伤一半，会回复自己的体力"
}
```

---

## 屬性解碼方案

精靈的 `Type` 欄位是單一數字，需解碼為 type1/type2：

```javascript
function decodeType(typeId, skillTypes) {
  const entry = skillTypes.find(t => t.id === String(typeId));
  if (!entry) return { type1: null, type2: null };
  
  const parts = entry.cn.split(' ');  // "草 超能" → ["草", "超能"]
  return {
    type1: parts[0] || null,
    type2: parts[1] || null
  };
}
```

---

## 中文語系

所有文字為**簡體中文**，需經過 `opencc-js` s2t 轉換：
- 精靈名稱: `布布种子` → `布布種子`
- 技能名稱: `撞击` → `撞擊`
- 屬性名稱: `草` → `草` (不變), `战斗` → `戰鬥`, `龙` → `龍`, `圣灵` → `聖靈`

---

## 建議匯入流程

1. 下載 `monsters.json` + `moves.json` + `skillTypes.json` + `effectDes.json` (已完成)
2. 解碼 `Type` 欄位 → type1/type2
3. 將 `LearnableMoves` 展開為 sprite_skills 記錄
4. 全部名稱/描述套用 s2t() 轉換
5. 寫入 DB (替換或合併現有 210 筆資料)

---

## 注意事項

- 部分高 ID 精靈 (如 1400849-1400851) 缺少 stats 資料 (可能是未實裝)
- 882 隻精靈無屬性 (Type=0)，可能是未分類或特殊精靈
- FormParam 欄位 (589 隻) 可能表示多形態精靈
- 資料日期: MOVES_0626 表示 2024-06-26 版本
