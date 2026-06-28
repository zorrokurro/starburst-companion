# HEALTH_CHECK.md — 程式碼健康檢查報告

> 執行日期: 2026-06-27
> 檢查方法: 全專案檔案逐一閱讀、grep 追蹤引用鏈、交叉比對 import/require/script tag

---

## 一、可以安全刪除的東西

以下項目經全專案引用追蹤確認，沒有任何活碼依賴它們。

### 1.1 根目錄垃圾檔案

| 檔案 | 大小 | 刪除理由 |
|------|------|---------|
| `0` | 0 bytes | 無副檔名、無內容、無任何檔案引用。疑似 bug 產物 |
| `undefined` | 4,096 bytes | SQLite DB 檔。better-sqlite3 收到 `undefined` 路徑時自動建立。所有正式腳本都用 `db/seer.db`，此檔為 bug 殘留 |
| `undefined-shm` | 32,768 bytes | 上述 undefined DB 的 WAL shared memory 檔 |
| `undefined-wal` | 0 bytes | 上述 undefined DB 的 WAL 檔 |
| `seer_encyclopedia.db` | 0 bytes | 空 DB 檔，全專案無任何腳本引用此路徑 |

### 1.2 已死的前端模組

| 檔案 | 刪除理由 |
|------|---------|
| `public/service-worker.js` | 從未被註冊。`index.html` 沒有 `navigator.serviceWorker.register()`，全專案 grep 零結果。且其內部用 `fetch()` 請求 Express API，與 Electron IPC 架構矛盾 |
| `public/manifest.json` | PWA manifest。`index.html` 有 `<link rel="manifest">` 但 app 是 Electron desktop，不需要 PWA。且 service-worker 未註冊，manifest 無意義 |
| `public/js/collections.js` | `CollectionsPage` 物件從未被實例化或呼叫。`index.html` 沒有對應的 HTML section/id。完全死 UI 代碼 |
| `public/js/radar-chart.js` | `RadarChart.renderTeamRadar()` 和 `calcDefenseWeaknesses()` 從未被呼叫。`team-sim.js:107` 有 `await RadarChart.init()` 但其內部用 `fetch('/api/type-chart-matrix')` 發 HTTP 請求——在 Electron 的 `app://` 協議下必定失敗。`team-sim.js` 自己有完整的 `renderRadar()` 實作（line 187），從未委託給 `RadarChart` |

### 1.3 死亡 artifact 檔案

| 檔案 | 刪除理由 |
|------|---------|
| `release/` 整個目錄（~1.8 GB, 9,781 檔案） | electron-builder 的輸出物。包含 NSIS 安裝檔（789 MB）、unpacked app、blockmap、dll。這些是 build 產物，應加到 .gitignore，不應留在專案目錄佔空間。下次 `npm run build` 會重新生成 |

### 1.4 可安全移除的 import/export 死碼

| 位置 | 內容 | 理由 |
|------|------|------|
| `src/db.js:362` | `export { getTypeColor }` | 匯出但全專案零引用。前端 `app.js` 有自己的 `TYPE_COLORS` |
| `src/db.js:361` | `export { isInCollection }` | 匯出但全專案零引用 |
| `src/server.js:254` | `export { app, getDb as db }` | 匯出但全專案零引用。`server.js` 從未被其他模組 import |
| `src/server.js:13` | `import { calculateSTAB, getTypeEffectivenessFrom }` | import 了但從未呼叫。`getTypeEffectivenessFrom` 只出現在 import 行 |

### 1.5 可安全移除的常數重複定義

以下常數在多個檔案中重複定義，應統一到一個來源：

| 常數 | 出現位置 | 建議 |
|------|---------|------|
| `TYPE_COLORS` | `app.js:1`、`db.js:66`、`radar-chart.js:13`（已死） | 統一用 `db.js` 的版本（後端也用），或建一個 `constants.js` |
| `STAT_LABELS` | `app.js:17`、`statCalculator.js:13`、`team-sim.js:44` | 統一用 `statCalculator.js` 的版本 |
| `STAT_COLORS` | `app.js:12`、`collections.js:89`（已死） | 移除 collections.js 的副本 |
| `SOUL_SEAL_KIND_LABELS` + `renderSoulSealKinds()` | `app.js:19-33`、`team-sim.js:46-60` | 統一到 `app.js` 或提取到共用模組 |

---

## 二、需要決定去留的東西

### 2.1 Express server (src/server.js) — 要保留還是刪除？

**現狀**：
- `main.cjs`（Electron）和 `src/server.js`（Express）有 **完全平行的 API surface**。每一個 Express route 都有對應的 IPC handler，兩者呼叫相同的 `src/db.js` 函數
- `main.cjs` 中有 3 處 **copy-pasted SQL**（`/api/sprites/all`、`/api/types`、`/api/type-chart`），與 Express 版完全一樣的 SQL 字串寫了兩份
- 前端 `api.js` 已全面遷移到 IPC-only，`fetch()` 呼叫只剩 `radar-chart.js`（已判定為死碼）
- `npm run serve` 可獨立啟動 Express server，但啟動後前端不會用它（因為 api.js 用 IPC）

**選項 A：保留 server.js（建議）**
- 理由：開發期間 `npm run serve` 可以快速測試 API，不需要啟動 Electron
- 行動：把 `main.cjs` 中 copy-pasted SQL 提取到 `db.js` 共用函數，消除重複

**選項 B：刪除 server.js**
- 理由：生產環境完全不用，維護兩套是負擔
- 行動：刪除 `server.js`，移除 `package.json` 的 `serve` script，移除 `express` 相關引用

### 2.2 radar-chart.js — 要保留還是刪除？

**現狀**：
- `team-sim.js:107` 有 `await RadarChart.init()` 呼叫
- 但 `RadarChart.init()` 內部用 `fetch()` 發 HTTP 請求，在 Electron 下必定失敗
- `team-sim.js:187` 自己有完整的 `renderRadar()` 實作，從未委託給 `RadarChart`
- `team-sim.js:766` 的 `renderTeamRadar()` 是完全未被呼叫的死函數

**選項 A：刪除 radar-chart.js，移除 index.html 的 script tag（建議）**
- 理由：team-sim.js 已有獨立的雷達圖實作，radar-chart.js 是遷移前的殘留
- 行動：刪除 `public/js/radar-chart.js`，移除 `index.html:317` 的 script tag，移除 `team-sim.js:107` 的 `RadarChart.init()` 呼叫

**選項 B：整合 radar-chart.js，讓 team-sim.js 委託給它**
- 理由：避免邏輯重複，統一雷達圖實作
- 行動：將 `team-sim.js:187` 的 `renderRadar()` 邏輯移到 `radar-chart.js`，改用 IPC 取代 fetch

### 2.3 abilities / resistances / sprite_abilities 空表 — 要保留還是刪除？

**現狀**：
- `abilities`：init-db.js 有 CREATE TABLE，無任何匯入腳本，無任何 API/前端引用
- `resistances`：init-db.js 有 CREATE TABLE，無任何匯入腳本，無任何 API/前端引用
- `sprite_abilities`：init-db.js 有 CREATE TABLE，無任何匯入腳本，無任何 API/前端引用

**選項 A：全部刪除（建議）**
- 理由：三張表都是空殼，沒有資料源也沒有消費者。如果未來需要，重新 CREATE TABLE 即可
- 行動：從 `init-db.js` 移除三個 CREATE TABLE 語句，從 `db.js` 移除相關 index（如果有）

**選項 B：保留 abilities + sprite_abilities，刪除 resistances**
- 理由：abilities 可能是為了未來「特性/被動技能」功能準備的。但 resistances 看不出用途

### 2.4 gacha_pools 表 — 要保留還是刪除？

**現狀**：
- 有匯入腳本 `import-gacha-pools.js`（npm script: `import:gacha`）
- 資料來自 `seerh5_data/Monsterpool.json`
- 但全專案 **零 API 端點** 查詢此表，**零前端 UI** 使用此資料

**選項 A：保留但標記為 untracked（建議）**
- 理由：資料已經匯入，佔空間不大，未來可能做抽卡模擬
- 行動：在 NEEDS.md 中追蹤此功能

**選項 B：刪除表 + 匯入腳本**
- 理由：完全沒人用，是廢棄 schema

### 2.5 verify_diffs 表 — 要保留還是刪除？

**現狀**：
- init-db.js 有 CREATE TABLE
- 專用的 region-verify-attempt 機制已被 deprecated
- 表中可能有 `batch-verify.js` 寫入的 fallback 資料

**選項 A：保留（建議）**
- 理由：台服校對需求仍在 NEEDS.md #1 追蹤中，只是暫時沒資料源。表結構是為了這個需求設計的

**選項 B：刪除**
- 理由：整套機制已 deprecated，如果台服上線再重建

### 2.6 deprecated/ 目錄 — 要保留還是刪除？

**現狀**：
- `deprecated/raw/`（210 檔案，4399 爬蟲產出的精靈 JSON）
- `deprecated/scraper.js`（4399 爬蟲）
- `deprecated/import.js`（舊版匯入腳本）
- `deprecated/seed-sprites.js`（舊版 seed 腳本）
- `deprecated/debug-tools/`（4 個 debug 腳本）
- `deprecated/cron-check-tw.js`（台服監控）
- `deprecated/region-verify-attempt/`（台服校對機制）
- `deprecated/import-mw-souls/`（魂印解析嘗試）

**選項 A：全部保留（建議）**
- 理由：歷史參考價值。raw/ 的 210 檔案可作為台服校對的基線資料

**選項 B：只保留 region-verify-attempt/ 和 import-mw-souls/，其餘刪除**
- 理由：scraper.js、import.js、seed-sprites.js 已被完全替代；debug-tools 是一次性工具；raw/ 的 210 檔案已被 seerh5 的 6,460 筆取代

---

## 三、已知半成品的真實完成度

| 功能 | 完成度 | 詳細說明 |
|------|--------|---------|
| **OCR 截圖識別** | **25%** | 截圖功能 100% 完成（desktopCapturer + 區域裁切 + 儲存 PNG）。OCR 識別 0%（無 tesseract.js 依賴、無圖片分析代碼）。精靈比對 0%（無 sprite fingerprint 比對邏輯）。前端結果展示 10%（只有一行 alert 提示「OCR 模組待整合」） |
| **Auto-updater** | **75%** | electron-updater 整合 100%、IPC handlers 100%、preload bridge 100%、事件監聽與進度回報 100%。缺失：server URL 為 placeholder `your-update-server.com`、無發佈基礎設施、無 code signing、無 app-update.yml |
| **資料補丁伺服器** | **40%** | 版本比對邏輯 80%、sprite INSERT OR REPLACE 80%、IPC 通知 100%。缺失：server URL 為 placeholder、只支援 sprites 表、無多表支援、無完整性驗證、無回滾機制、無前端通知 UI、meta 表未在 init-db.js 中建立 |
| **魂印 trigger_condition** | **0%** | `import-soul-seals-bwiki.js` 硬編碼 `trigger_condition = NULL`。`deprecated/import-mw-souls/` 有 50+ 條正則嘗試解析但已 deprecated。目前完全沒有 populated 的 trigger_condition |
| **魂印 name_zh_tw** | **Bug** | `import-soul-seals-bwiki.js:44` 把 `f['魂印效果']`（效果描述）填入 `name_zh_tw` 欄位，應為 `f['魂印名称']`。結果：name_zh_tw 欄位存的是效果描述而非魂印名稱 |
| **傷害公式校準** | **10%** | 公式框架完整（STAB、屬性倍率、暴擊、隨機波動、OHKO 分析），但使用的是暫定公式（參考寶可夢架構），未經實際對戰數據驗證。`test/damage.test.js` 的校準測試案例全部被註解掉（空的 `BILIBILI_CASES` 陣列） |
| **PWA 支援** | **10%** | `service-worker.js` 和 `manifest.json` 存在但從未註冊。Electron app 不需要 PWA。如果目標是 web 版本，需要重寫 |
| **精靈圖片下載** | **90%** | `download-sprites.js` 完整實現 CDN 下載（fallback chain、retry、concurrency control），但從未執行。`sprites/head/` 和 `sprites/body/` 為空 |
| **技能效果抓取** | **80%** | `fetch-skill-effects.js` 支援本地 JSON 和遠端 API 兩種模式，可批量更新 `skills.effect_desc`。但遠端 URL 只有一個 (`seerh5.61.com`)，且依賴 `fast-xml-parser` 但未在 package.json 中宣告 |
| **技能標籤系統** | **30%** | `update-skill-tags.js` 只有 3 條正則規則（消強、控場、回血），完整度很低。且只在 `fetch-skill-effects.js` 執行完後被動觸發，無獨立執行的 npm script |

---

## 四、發現的新「未授權範圍」清單

以下是 **NEEDS.md 8 個需求之外、沒有對應任何任務追蹤的功能/檔案**，且不包含之前已確認的 cron-check-tw、gacha_pools：

| # | 項目 | 類型 | 狀態 | 說明 |
|---|------|------|------|------|
| 1 | `src/fetch-skill-effects.js` | 腳本 | 能跑，有 bug | 技能效果批量更新腳本。依賴 `fast-xml-parser` 但未在 package.json 宣告（`--remote` 模式會失敗）。有 npm script `fetch:effects` |
| 2 | `src/update-skill-tags.js` | 腳本 | 半成品 | 技能標籤自動化。只有 3 條正則規則，無獨立 npm script，只被 fetch-skill-effects.js 動態 import |
| 3 | `src/typeCalculator.test.js` | 測試 | 能跑 | 屬性計算器單元測試。使用非標準測試模式（自己 assert + process.exit），不在 `npm test` 的 glob 範圍內（`src/**/*.test.js` 應該會匹配到，但其自行管理 process.exit） |
| 4 | `test/damage.test.js` | 測試 | 部分完成 | 傷害公式測試。8 個測試群組框架完整，但校準測試案例（`BILIBILI_CASES`）全部被註解掉，實際上只跑基礎功能測試 |
| 5 | `public/manifest.json` | 設定 | 死碼 | PWA manifest。Electron app 不需要。且 service-worker 未註冊 |
| 6 | `src/seed-type-chart.js` | 腳本 | 能跑 | 硬編碼 26×26 屬性表 seed 腳本。數據來源不明，可能是手動整理或從遊戲客戶端提取 |
| 7 | `bwiki_data/fetch-bwiki.mjs` | 腳本 | 能跑 | BWIKI 爬蟲。有 npm script 缺（沒有在 package.json 中宣告），需手動 `node bwiki_data/fetch-bwiki.mjs` 執行 |
| 8 | `mw_apk/` 整個目錄 | 參考資料 | 唯讀 | MW手冊 APK 拆解內容：game protocol (ByteArray/packHead)、3 隻精靈 sprite、自動化腳本、stat calculator HTML。唯一被實際引用的是 `README.md`（NEEDS.md #8 提到） |
| 9 | `mw_apk/html/stat_calculator.html` | 參考 | 唯讀 | 能力值計算器 HTML。功能已被 `src/statCalculator.js` 取代且更完整 |
| 10 | `mw_apk/scripts/mw_h5.js` | 參考 | 唯讀 | 遊戲自動化腳本。包含已知 CommandID（46301, 42395 等），有協議參考價值 |
| 11 | `mw_apk/html/h5_protocol.html` | 參考 | 唯讀 | ByteArray 序列化 + packHead 協議文檔。對未來做遊戲協議逆向有高參考價值 |
| 12 | `deprecated/debug-tools/` | 工具 | 死碼 | 4 個一次性 debug 腳本：`check-skills.cjs`（查詢技能填充率）、`test-page.mjs`（API smoke test）、`test-page2.mjs`（CSS debug）、`test-page3.mjs`（頁面結構 debug） |
| 13 | `seerh5_data/EVALUATION.md` | 文件 | 唯讀 | 資料源評估報告。被 PROJECT_CONTEXT.md 引用 |
| 14 | `PROJECT_CONTEXT.md` | 文件 | 唯讀 | 專案上下文文件。剛建立的 |
| 15 | `src/s2t.js` 的 `convertTypes` | 函數 | 死碼 | 匯出但只被 deprecated 腳本使用。active code 中零引用 |
| 16 | `statCalculator.js` 多餘 exports | 函數 | 死碼 | `calculateStat`、`getNatureMultiplier`、`applyRankModifier`、`STAT_KEYS`、`STAT_LABELS` 全部只在模組內部使用，export 但無外部消費者 |
| 17 | `team-sim.js:766` renderTeamRadar | 函數 | 死碼 | ~80 行的雷達圖實作，從未被呼叫。是 `radar-chart.js` 的重複 |

---

## 五、附錄：未宣告的依賴

| 套件 | 使用位置 | package.json 狀態 |
|------|---------|------------------|
| `express` | `src/server.js:1` | **未宣告**。clean `npm install` 會失敗 |
| `fast-xml-parser` | `src/fetch-skill-effects.js:109,115` | **未宣告**。`--remote` 模式下的 XML 解析會失敗 |

---

## 六、附錄：schema 漂移

| 問題 | 詳情 |
|------|------|
| `meta` 表 | `db.js:22` 有 `CREATE TABLE IF NOT EXISTS meta`，但 `init-db.js` 中 **沒有** 定義 `meta` 表。資料補丁機制依賴此表 |
| `profiles` / `teams` 表 | `init-db.js:184-200` 和 `db.js:24-41` 各定義了一次。兩者 CREATE TABLE 語句相同，但這種重複容易導致未來不同步 |
| `engravings` 表 | `init-db.js:70-95` 和 `import-engravings.js:28-55` 各定義了一次。兩者相同 |
| `pet_advances` 表 | `init-db.js:142-165` 和 `import-pet-advance.js:15-31` 各定義了一次。兩者相同 |

**建議**：所有 table CREATE 應統一在 `init-db.js` 中定義，import 腳本不應自行 CREATE TABLE。
