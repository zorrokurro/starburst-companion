# 需求追蹤文件

> 最後更新: 2026-06-28

---

## 狀態圖例

| 狀態 | 說明 |
|------|------|
| ✅ 可用 | 現有資料可直接使用 |
| ⚠️ 部分 | 有部分資料，缺其他欄位 |
| 🔍 可取得 | 找到外部公開來源，可寫腳本抓取 |
| ❌ 缺資料 | 無法從現有或公開來源取得 |

---

## 需求 #1：台服資料校對

**狀態：❌ 缺資料**

| 項目 | 內容 |
|------|------|
| 說明 | 5,576 隻精靈全部 `pending_verify`，需要台服 verified_ids |
| 現有資料 | `raw/` 210檔、`seerh5_data/` 6,460隻 — 全部是國服簡體中文 |
| 外部來源 | 無公開台服 API 或資料包 |
| 可行方案 | 需人工比對台服遊戲內資料，或等待台服 H5 上線後抓包 |
| 需要你提供 | 台服精靈 ID 對照表 / 台服 API 回應 / 台服遊戲截圖 |

---

## 需求 #2：魂印（Soul Seals）資料

**狀態：⚠️ 部分 — 有 ID 無定義**

| 項目 | 內容 |
|------|------|
| 說明 | monsters.json 有 `AddSeParam` 標記，pet_advance.json 有 `OldSeId/NewSeId` |
| 現有資料 | 2,259 隻有魂印 slot；25 個進階任務有魂印 ID 映射 |
| 缺少 | 魂印**名稱**、**效果描述**、**觸發條件** |
| 外部來源 | MW手冊 APK 的 `mw.getSoul(petId)` API 可取得魂印文字 |
| 可行方案 | 若有 MW手冊環境，可用 JS bridge `mw.getSoul("5000")` 逐隻抓取 |
| 需要你提供 | 魂印資料庫 JSON / MW手冊環境 / 或手動提供效果文字 |

---

## 需求 #3：圖片資源

**狀態：🔍 可取得**

| 項目 | 內容 |
|------|------|
| 說明 | 所有 JSON 零個圖片 URL |
| 外部來源 1 | **官方 H5 CDN**：`http://seerh5.61.com/resource/assets/pet/head/{id}.png` (頭像) |
| 外部來源 2 | **官方 H5 CDN**：`http://seerh5.61.com/resource/assets/fightResource/pet/{id}.png` (全身) |
| 外部來源 3 | **GitHub SeerAPI/seer-unity-assets**：Unity 端精靈頭像/全身圖/道具圖標 |
| 外部來源 4 | **4399 精靈圖鑑**：`https://news.4399.com/seer/jinglingdaquan/` (已有爬蟲) |
| 外部來源 5 | **巴哈/巴哈**：SWF 格式可轉 PNG |
| 可行方案 | 寫 Python 批次下載腳本，從 `seerh5.61.com` 按 ID 下載頭像+全身圖 |
| 參考腳本 | CSDN 已有範例：遍歷 ID 1~6000，下載 head/{id}.png 和 fightResource/pet/{id}.png |

---

## 需求 #4：傷害公式校準

**狀態：❌ 缺資料**

| 項目 | 內容 |
|------|------|
| 說明 | effectDes.json 只有文字描述，moves.json 缺等級/种族值/學習力/性格修正 |
| 現有資料 | `src/damageCalculator.js` 使用佔位公式 |
| 現有參數 | Power、Type、Category (moves.json) + 種族值 (monsters.json) + 屬性表 (typesRelation.json) |
| 缺少 | 等級、學習力、性格修正、個體值、實際傷害數值（用於校準） |
| 外部來源 | 無公開傷害公式文檔 |
| 可行方案 | 從遊戲客戶端 JS 逆向，或收集對戰數據回歸分析 |
| 需要你提供 | 遊戲內實際傷害數據 / 客戶端 JS 代碼片段 |

---

## 需求 #5：神諭魂印資料庫

**狀態：⚠️ 部分 — 有進階資料無魂印定義**

| 項目 | 內容 |
|------|------|
| 說明 | pet_advance.json 有 25 個神諭進階任務 |
| 現有資料 | 每個任務含 `OldSe`/`NewSe` ID、新技能、新被動效果文字 |
| 缺少 | 魂印本身的名稱和效果定義（只有 ID 沒有內容） |
| 外部來源 | 同需求 #2，MW手冊的 `mw.getSoul()` API |
| 可行方案 | 匯入 pet_advance 的進階資料到 DB，魂印部分標記為 "待補" |

---

## 需求 #6：精靈圖庫

**狀態：🔍 可取得**

| 項目 | 內容 |
|------|------|
| 說明 | 官方精靈圖庫 URL |
| 來源 1 | `http://seerh5.61.com/resource/assets/pet/head/{id}.png` — 頭像 (小圖) |
| 來源 2 | `http://seerh5.61.com/resource/assets/fightResource/pet/{id}.png` — 全身圖 |
| 來源 3 | `https://github.com/SeerAPI/seer-unity-assets` — Unity 資源 (頭像/全身/道具) |
| 來源 4 | `https://news.4399.com/seer/jinglingdaquan/` — 4399 圖鑑 (已有爬蟲) |
| 可行方案 | 批次下載腳本 (Python/Node)，按精靈 ID 遍歷下載 |

---

## 需求 #7：台服精靈查詢 API

**狀態：❌ 缺資料**

| 項目 | 內容 |
|------|------|
| 說明 | 需要台服 API 提供 verified_ids |
| 現有資料 | 無 |
| 外部來源 | 台服尚未上線 H5 版本（國服 H5 在 seerh5.61.com） |
| 可行方案 | 等待台服 H5 上線後抓包分析 |
| 需要你提供 | 台服 API 端點 / 台服遊戲客戶端 |

---

## 需求 #8：遊戲協議文檔

**狀態：⚠️ 部分 — 有 APK 拆解的協議片段**

| 項目 | 內容 |
|------|------|
| 說明 | 可能包含傷害公式細節 |
| 現有資料 (mw_apk) | ByteArray 序列化 (大端序)、packHead 協議頭算法 |
| 已知 CommandID | `46301` (抽刻印)、`42395` (SPT/泰坦)、`FIGHT_H5_PVE_BOSS` (PvE)、`CHANGE_PET` (換精靈) |
| 已知 API | `SocketConnection.send()`, `PetManager`, `FightManager`, `BubblerManager` |
| 缺少 | 完整 CommandID 列表、回應包格式、傷害計算協議 |
| 外部來源 | Nattsu39/seer-pet-code (Protobuf 精靈配置交換協議) |
| 可行方案 | 從遊戲 H5 客戶端 JS 逆向完整協議 |

---

## 需求 #9：Gacha 抽卡池資料

**狀態：⚠️ 部分 — 有資料結構無 UI/API**

| 項目 | 內容 |
|------|------|
| 說明 | `gacha_pools` 表已建好並有 import 腳本，但目前無前端 UI 和 API endpoint |
| 現有資料 | gacha_pools 表含 pool_id, item_id, monster_cn_id, kind, is_unique 等欄位 |
| 現有腳本 | `npm run import:gacha` (import-gacha-pools.js) |
| 狀態 | **保留但不活躍** — 資料模型已建立，待未來實作抽卡模擬功能時使用 |
| 備註 | import 腳本已可正常匯入，暫無對外 API 或 UI 頁面 |

---

## 需求 #10：OCR 截圖識別模組

**狀態：❌ 未開始**

| 項目 | 內容 |
|------|------|
| 說明 | 透過截圖自動讀取遊戲畫面資訊（HP、克制倍率、能力等級等），輔助戰術模擬 |
| 現有基礎 | `main.cjs` 已有 `desktopCapturer` 截圖 IPC + 圖片儲存功能 |

### OCR 實作方向（重要洞察）

根據黑狐提供的台服實測截圖（復更後版本，推測為**巔峰之戰 3D 版**），得知：

1. **畫面已顯示計算好的克制倍率數字**（如 1.125、1.25），不是只有「效果絕佳」等文字提示
2. **OCR 任務大幅簡化**：不需要做「辨識精靈圖像 → 自己重新計算克制」這種影像分類任務，只需要做**固定區域的文字 OCR**
3. 需要讀取的內容：
   - HP 數字（血量條旁的數值）
   - 克制倍率數字（畫面直接顯示）
   - 回合數
   - 右上角能力等級 buff 小圖示（這個可能仍需圖像比對）
4. 這本質上是**文字 OCR 而非影像分類**，難度與工作量比最初 25% 完成度評估時設想的低很多

### UI 版本注意事項

- 台服復更後大概率是**巔峰之戰 3D 版介面**（非舊版 Flash 介面）
- 未來做 screen region 校準時，**必須以 3D 版 UI 佈局為準，不要參考舊版**

---

## 外部資源摘要

| 資源 | URL | 可用 |
|------|-----|------|
| 官方 H5 頭像 CDN | `http://seerh5.61.com/resource/assets/pet/head/{id}.png` | 🔍 |
| 官方 H5 全身 CDN | `http://seerh5.61.com/resource/assets/fightResource/pet/{id}.png` | 🔍 |
| SeerAPI Unity 資源 | `https://github.com/SeerAPI/seer-unity-assets` | 🔍 |
| 4399 精靈圖鑑 | `https://news.4399.com/seer/jinglingdaquan/` | ✅ 已有爬蟲 |
| seer-pet-code 協議 | `https://github.com/Nattsu39/seer-pet-code` | 🔍 |
| BWIKI 精靈圖鑑 | `https://wiki.biligame.com/seer/精靈圖鑑` | 🔍 |
| MW手冊 APK | `mw_apk/` (已拆解) | ✅ 已取得 |
