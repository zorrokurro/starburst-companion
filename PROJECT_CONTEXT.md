# PROJECT_CONTEXT.md — 賽爾號戰術模擬器

> 最後更新: 2026-06-27
> 建立者: 新工程師接手時透過 codebase 反向推導

---

## 一、專案是什麼

這是一個針對網頁遊戲《賽爾號》（Seer）打造的 **離線戰術輔助工具**，以 Electron desktop app 為主要載體。目標用戶是台服賽爾號的實戰玩家，核心功能包含：精靈圖鑑瀏覽（6,460 隻精靈的種族值、技能、魂印、刻印資料）、屬性克制計算器、隊伍模擬與傷害試算。它的定位是「遊戲旁的第二螢幕」——玩家開著遊戲的同時，開這個工具查資料、算傷害、配隊伍。專案的終極價值在於：官方從未公開完整的數值公式與屬性表，這個工具把散落在國服 H5 客戶端、BWIKI wiki、社群資料的碎片整合成一個可查詢、可計算的本地資料庫。

---

## 二、資料層的演進歷史與原因

### 第一階段：4399 爬蟲（raw/ 目錄，已 deprecated）

- **做法**：用 Playwright 爬 `news.4399.com/seer/jinglingdaquan/`，依屬性分類頁遍歷精靈，再逐一進入詳情頁爬取名稱、屬性、種族值、技能、魂印。
- **成果**：210 隻精靈的 JSON（存於 `deprecated/raw/`），含基本種族值和技能列表。
- **棄用原因**：爬蟲非常脆弱（頁面結構變動就失效）、效率極低（每隻精靈要等 1.5 秒 + 頁面載入）、且 4399 圖鑑只收錄了約 210 隻精靈，遠低於遊戲實際的 6,000+ 隻。沒有進化鏈、沒有性別、沒有屬性表、沒有特殊效果描述。**資料量與完整性都嚴重不足。**

### 第二階段：seerh5 資料源（seerh5_data/ 目錄，主要資料源）

- **做法**：採用開源專案 `dawnnights/seerh5` 的結構化 JSON 資料（從國服 H5 遊戲客戶端拆出的資料包），包含 `monsters.json`（6,460 精靈）、`moves.json`（27,089 技能）、`skillTypes.json`（138 屬性組合）、`effectDes.json`（532 魂印效果）。
- **採用原因**：相比 4399 爬蟲，seerh5 資料量是 30 倍（精靈數）到 15 倍（技能數），且是結構化 JSON，不需要爬蟲解析 HTML。有完整的種族值、進化鏈、性別、屬性映射、技能效果描述。
- **相對 4399 的優勢**：一次性全量匯入、資料結構穩定、欄位完整度碾壓爬蟲。
- **需要注意**：所有文字是簡體中文，需要經過 `opencc-js` s2t 轉換為繁體。882 隻精靈缺少屬性（Type=0），部分高 ID 精靈缺少 stats（可能是未實裝的遊戲內容）。

### 第三階段：台服/陸服區分機制（已放棄）

- **做法**：在 sprites 表建立了 `tw_id`、`region_status`（預設 `pending_verify`）、`verify_diffs` 表（記錄陸服值 vs 台服值的差異），並寫了 `deprecated/region-verify-attempt/verify.js`（互動式逐筆校對腳本）和 `batch-verify.js`（批次假裝校對完成的 fallback 腳本）。
- **建立原因**：賽爾號有國服（陸服）和台服兩個版本，理論上精靈數值可能不同。專案一開始希望同時支援兩個版本。
- **放棄原因**：從 NEEDS.md 和程式碼推斷，台服尚未上線 H5 版本，沒有公開的台服 API 或資料包可以比對。`batch-verify.js` 的存在說明曾想「先假裝校對完了讓系統能跑」，但最終整個機制被 deprecated，目前所有精靈的 `region_status` 仍為 `pending_verify` 或 `verified_fallback`，`tw_id` 欄位大多為空。**根本原因是缺少台服資料源。**
- **注意**：`deprecated/cron-check-tw.js` 是一個台服 H5 上線監控腳本（每 60 秒輪詢 `seerh5.taomee.com.tw` 檢查是否偵測到 H5 載入器關鍵字），說明曾積極等待台服上線，但此腳本已被移到 deprecated 目錄。

### 第四階段：BWIKI 刻印/魂印資料（bwiki_data/ 目錄）

- **做法**：寫了 `bwiki_data/fetch-bwiki.mjs` 爬蟲，從 `wiki.biligame.com/seer/` 的 MediaWiki API 抓取 `{{刻印}}` 和 `{{魂印}}` 模板的結構化欄位，分別存為 `engravings_raw.json`（~300+ 筆刻印）和 `soul_seals_raw.json`（~300+ 筆魂印）。
- **為什麼需要**：seerh5 的 `effectDes.json` 只有魂印的效果描述文字（kind=1），缺少刻印的完整資料（名稱、類型、初始/隱藏數值、稀有度、角數、專屬精靈等）。BWIKI 是唯一有完整刻印結構化資料的公開來源。
- **解決的缺口**：刻印的全部欄位（base/hidden stats、rarity、angle_count、exclusive_sprite_id）、魂印的 kind 分類碼。

### 第五階段：gacha_pools 與 pet_advances 表

- **gacha_pools**：資料來自 `seerh5_data/Monsterpool.json`，由 `import-gacha-pools.js` 匯入。記錄精靈的抽卡池資訊（pool_id、item_id、monster_cn_id、kind、is_unique）。**匯入原因不明，需向專案 owner 確認**——目前前端並未使用這張表的資料，可能是為了未來「模擬抽卡」功能預先準備的。
- **pet_advances**：資料來自 `seerh5_data/pet_advance.json`，由 `import-pet-advance.js` 匯入。記錄 25 個「神諭進階」任務的詳細資訊：進階前後的種族值、舊/新魂印 ID 映射（old_se_id → new_se_id）、進階專屬技能、進階效果描述。**這是在 team-sim 的精靈詳情頁中使用的**——查看精靈時會顯示 pet_advance 資料。

### 第六階段：魂印資料補全嘗試（deprecated/import-mw-souls/）

- **做法**：寫了 `import-mw-souls.js`，用 50+ 條正則從 `soul_seals.effect_desc` 文字中自動解析觸發條件（trigger_condition），並嘗試從 MW手冊 APK 的 `mw.getSoul(petId)` API 補全魂印名稱。
- **現狀**：腳本在 deprecated 目錄，說明效果不理想或已放棄。主要問題是 MW手冊環境難以取得，且文字解析的精準度有限。
- **後來的做法**：改為從 BWIKI 抓取魂印（`import-soul-seals-bwiki.js`），直接取得結構化的魂印資料，不再依賴文字解析。但 BWIKI 版的魂印 `trigger_condition` 全部為 NULL（匯入腳本未處理觸發條件），`name_zh_tw` 欄位填的是效果描述而非魂印名稱（程式碼 `import-soul-seals-bwiki.js:44` 的 bug）。

---

## 三、現在的系統架構

### 資料庫 Schema 全貌（seer.db, SQLite）

```
┌─────────────────────────────────────────────────────────┐
│                      sprites                            │
│  id (PK) │ cn_id (UNIQUE) │ tw_id │ name_zh │ types   │
│  base_hp │ base_atk │ base_def │ base_spatk │ ...     │
│  gender │ evolves_from │ evolves_to │ evolve_level     │
│  region_status │ height │ weight │ source_url          │
├──────────┴───────┬──────────────────────────────────────┤
│                  │                                      │
│  ┌───────────────▼──────────┐  ┌───────────────────────▼──────┐
│  │      sprite_skills       │  │         soul_seals            │
│  │  sprite_id (FK→sprites)  │  │  id (PK) │ sprite_id (FK)   │
│  │  skill_id (FK→skills)    │  │  trigger_condition           │
│  │  is_signature            │  │  effect_desc │ name_zh_tw    │
│  └───────────┬──────────────┘  │  kind                        │
│              │                 └──────────────────────────────┘
│  ┌───────────▼──────────┐      ┌──────────────────────────────┐
│  │       skills          │      │        engravings             │
│  │  id (PK) │ name      │      │  id (PK, BWIKI ID)           │
│  │  power │ accuracy │ pp│      │  name │ type │ description   │
│  │  category │ type     │      │  base_atk/def/... │ hidden_*  │
│  │  effect_desc │ tags  │      │  angle_count │ rarity         │
│  └──────────────────────┘      │  exclusive_sprite_id (FK)     │
│                                │  exclusive_skill              │
│                                └──────────────────────────────┘
├───────────────────────────────────────────────────────────────┤
│  type_chart                                                   │
│  attack_type │ defend_type (composite PK) │ multiplier        │
├───────────────────────────────────────────────────────────────┤
│  pet_advances                                                 │
│  id (PK) │ monster_id │ monster_name                          │
│  old_race_* │ new_race_* (進階前後種族值)                      │
│  old_se_id │ new_se_id (魂印映射) │ sp_moves │ extra_moves    │
│  adv_effect_desc │ desc                                       │
├───────────────────────────────────────────────────────────────┤
│  gacha_pools                                                  │
│  id (PK) │ pool_id │ item_id │ monster_cn_id │ kind │ is_unique│
├───────────────────────────────────────────────────────────────┤
│  collections ──1:N──▶ collection_items                        │
│  id │ name │ sort_order     collection_id (FK) │ sprite_id (FK)│
├───────────────────────────────────────────────────────────────┤
│  profiles ──1:N──▶ teams                                      │
│  id │ name │ is_active       profile_id (FK) │ side │ slot_index│
│                        │       sprite_id │ config_json          │
│                        └───────────────────────────────────────│
├───────────────────────────────────────────────────────────────┤
│  meta (key-value)                                             │
│  key │ value (用於資料版本控制 data_version)                    │
├───────────────────────────────────────────────────────────────┤
│  verify_diffs (已 deprecated，實際未使用)                      │
│  id │ sprite_id │ field │ cn_value │ tw_value │ status         │
├───────────────────────────────────────────────────────────────┤
│  abilities (空表，未匯入任何資料)                               │
│  id │ name │ effect_desc │ fusion_recipe                      │
├───────────────────────────────────────────────────────────────┤
│  resistances (空表，未匯入任何資料)                             │
│  id │ status_type │ description                               │
└───────────────────────────────────────────────────────────────┘
```

### 後端 API 端點（Express, src/server.js）

| 方法 | 路徑 | 功能 |
|------|------|------|
| GET | `/api/sprites` | 精靈列表（支援分頁、排序、屬性篩選、種族值範圍、搜尋） |
| GET | `/api/sprites/all` | 全部精靈（無分頁） |
| GET | `/api/sprites/:id` | 單一精靈詳情（含技能、魂印、刻印、收藏、進階資料） |
| GET | `/api/sprites/:id/collections` | 該精靈所屬的收藏清單 |
| GET | `/api/filters/types` | 取得所有精靈的屬性清單 |
| GET | `/api/filters/stats` | 取得種族值範圍（min/max） |
| GET | `/api/types` | 所有攻擊屬性列表 |
| GET | `/api/type-chart` | 完整屬性表 |
| GET | `/api/type-chart-matrix` | 屬性表矩陣格式 |
| POST | `/api/calculate-effectiveness` | 計算屬性克制係數 |
| POST | `/api/calculate-damage` | 計算所有技能傷害 |
| POST | `/api/team-matchup` | 兩支隊伍的屬性克制矩陣 |
| GET | `/api/collections` | 收藏清單列表 |
| GET/POST/PUT/DELETE | `/api/collections/*` | 收藏 CRUD |
| GET | `/api/engravings` | 刻印搜尋（支援名稱、類型、系列、稀有度篩選） |
| GET | `/api/engravings/filters` | 刻印篩選選項 |

**注意**：Electron 模式下不走 Express，而是透過 IPC（`preload.js` → `main.cjs`）直接調用 `src/db.js` 的函數。`src/api.js` 將 URL pattern 映射為 IPC 呼叫。

### 前端頁面/模組

| 檔案 | 功能 |
|------|------|
| `public/index.html` | 單頁應用（SPA），頂部導航切換三個視圖 |
| `js/app.js` | 精靈圖鑑主頁：搜尋、排序、篩選、分頁、精靈詳情 modal |
| `js/type-chart.js` | 屬性克制計算器：選擇精靈或自訂屬性，顯示克制關係 |
| `js/team-sim.js` | 隊伍模擬：6v6 配置、能力值計算（含 IV/EV/性格/刻印）、傷害試算、克制矩陣、雷達圖、隊伍匯入匯出、多配置（profile）管理 |
| `js/collections.js` | 收藏管理：建立/刪除收藏、加入/移除精靈 |
| `js/radar-chart.js` | SVG 雷達圖：26 軸的屬性覆蓋分析 |
| `js/localize.js` | 繁簡轉換：50+ 詞彙對照 |
| `js/api.js` | API 層：Electron IPC 封裝（無 HTTP） |

**模組串接**：`index.html` 依序載入 localize → api → app → collections → type-chart → radar-chart → team-sim，全部以全域變數掛載（`Locale`、`App`、`TypeChart`、`TeamSim` 等）。

### Electron 主進程（main.cjs）

- 無邊框透明視窗（frameless + transparent）
- 自訂 `app://` 協議取代 Express 靜態伺服
- 系統匣（System Tray）+ 幽靈模式（滑鼠穿透）
- 磁吸遊戲視窗（透過 PowerShell 呼叫 Win32 API 偵測遊戲視窗位置）
- 截圖功能（desktopCapturer）
- 自動更新（electron-updater, 發佈到 `your-update-server.com`）
- IPC 資料補丁機制（從 `your-data-server.com` 拉增量更新）
- 多配置隊伍管理（profiles + teams 表）
- 記憶視窗位置、模糊時降記憶體、全域快捷鍵 Alt+Q

---

## 四、目前已知但尚未解決的缺口

| # | 缺口 | 狀態 | 為什麼還沒做 |
|---|------|------|-------------|
| 1 | **台服資料校對** | 全部 5,576 隻精靈 `pending_verify` | 缺資料源：台服尚未上線 H5 版本，無公開 API |
| 2 | **魂印名稱與觸發條件** | BWIKI 版有 effect_desc 但 trigger_condition 全為 NULL、name_zh_tw 填的是效果文字而非名稱 | BWIKI 爬蟲只抓了 `{{魂印}}` 模板的原始欄位，trigger_condition 需要語義解析；name_zh_tw 的 bug 在 `import-soul-seals-bwiki.js:44` |
| 3 | **精靈圖片（頭像/全身圖）** | `download-sprites.js` 已寫好但未執行，`sprites/head/` 和 `sprites/body/` 為空 | 需要批次執行下載腳本（~6,000 張圖，可從 `seerh5.61.com` CDN 下載） |
| 4 | **傷害公式校準** | 使用暫定公式（參考寶可夢/賽爾號通用架構），未經實際對戰數據驗證 | 缺校準數據：無公開傷害公式文檔，需從遊戲客戶端 JS 逆向或收集對戰數據回歸分析 |
| 5 | **abilities 表** | 空表，未匯入任何資料 | 不明，需確認是否為刻意保留的 placeholder |
| 6 | **resistances 表** | 空表，未匯入任何資料 | 不明，需確認是否為刻意保留的 placeholder |
| 7 | **屬性表完整性** | `seed-type-chart.js` 硬編碼 26×26 矩陣，部分屬性組合可能有誤 | 缺官方屬性表文檔；目前的數據來源不明，需向專案 owner 確認 |
| 8 | **性格定義不完整** | 25 種性格只定了 20 種（缺 5 種），未定義的性格回退為無修正 | 賽爾號官方未公開完整性格列表 |
| 9 | **gacha_pools 前端未使用** | 資料已匯入但前端無對應 UI | 可能是為未來功能預先準備 |
| 10 | **遊戲協議文檔** | 僅有 MW手冊 APK 拆解的片段（CommandID、ByteArray 序列化），無完整協議 | 缺完整文檔；需從 H5 客戶端 JS 逆向 |
| 11 | **OCR 截圖識別** | `takeScreenshot()` 已能截圖，但提示「OCR 模組待整合」 | 技術難度中等（需整合 tesseract.js 或類似方案） |
| 12 | **資料補丁伺服器** | `checkDataPatch()` 呼叫 `your-data-server.com`，為 placeholder URL | 未架設資料更新伺服器 |
| 13 | **Auto-update 伺服器** | `publish.url` 指向 `your-update-server.com`，為 placeholder URL | 未架設發佈伺服器 |

---

## 五、這個專案執行上的潛規則

### 已知的「自行擴大範圍」事件

1. **cron 監控腳本**：`deprecated/cron-check-tw.js` 是一個台服 H5 上線監控腳本，會每 60 秒輪詢台服網址。這類「額外工具」沒有被要求就先做了，最終被移入 deprecated 目錄。**現在的規則**：這類非核心功能（監控、自動化腳本等）應該先詢問專案 owner 是否需要，不要自行實作。

2. **region-verify-attempt 整套機制**：包括互動式校對腳本（`verify.js`）、批次假裝校對（`batch-verify.js`）、sprite_list 等輔助檔案。這套機制是為了因應「台服資料校對」需求而建的，但因為缺少台服資料源而完全沒用上。**教訓**：在沒有資料源的情況下，不應該先建處理框架。

3. **import-mw-souls 腳本**：嘗試從文字描述中用正則解析觸發條件，屬於「在缺少結構化資料時用 NLP 式方法補救」的嘗試。效果不理想，被移入 deprecated。**教訓**：與其用 hacky 方法補救，不如等有更好的資料源（後來 BWIKI 方案確實解決了部分問題）。

### 現在的規則

- **不要自行假設需求**：如果某個功能看起來「應該做」，先確認是否在 NEEDS.md 中有追蹤，或直接問專案 owner。
- **deprecated 目錄是歷史檔案庫**：裡面的東西不代表「做錯了」，而是「暫時不需要但保留參考」。
- **placeholder URL 不要動**：`your-data-server.com` 和 `your-update-server.com` 是佔位符，不是 bug。
- **BWIKI 爬蟲的延遲設定**：`fetch-bwiki.mjs` 設定 200ms 延遲是為了避免被 wiki 封 IP，不要隨意調低。

---

## 六、自我檢查

重新閱讀本文後，以下內容需要標註不確定性：

| 段落 | 不確定處 |
|------|---------|
| 二、gacha_pools 匯入原因 | 明確寫了「匯入原因不明，需向專案 owner 確認」，但觀察到前端未使用此表 |
| 二、pet_advances 匯入時間點 | 不確定是 seerh5 匯入的同時期做的，還是後來才補的。從 import-pet-advance.js 的程式碼風格（獨立腳本、獨立匯入流程）推斷是後來補的，但無法確定 |
| 四、abilities/resistances 空表原因 | 不確定是刻意保留的 placeholder，還是被遺忘的。兩張表都在 init-db.js 中有 CREATE TABLE 但無對應的匯入腳本 |
| 四、屬性表數據來源 | `seed-type-chart.js` 硬編碼的 26×26 矩陣，不清楚是從哪裡來的（可能是手動整理、可能是從遊戲客戶端提取） |
| 五、cron-check-tw.js 是否被要求做 | 從 deprecated 目錄位置推斷是「自行加的」，但也有可能是被要求做的後來不需要了。不確定 |
| 三、Electron 功能完整性 | 未實際測試過 Electron app，所有 Electron 功能描述都是從程式碼推斷的 |
| 三、API server.js 的用途 | server.js 用於 dev 模式（`npm run serve`），Electron 模式下不使用。但不確定是否還有其他用途 |

**未編造、未猜測的內容**：所有功能描述、表結構、API 端點、腳本用途均來自直接閱讀對應檔案的程式碼。所有「不確定」之處已如實標註。
