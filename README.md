# 星爆輔助器 (Seer Tactics)

賽爾號 PvP 戰術輔助工具

## 功能

- **精靈圖鑑**：搜尋 5,500+ 隻精靈的種族值、屬性、技能
- **傷害計算器**：精確計算技能傷害、属性克制、暴擊、增減傷
- **速度/先判計算**：先制技能比較、超車計算、速度線標記
- **陣容分析**：26 種屬性覆蓋雷達圖、弱點警告、技能標籤覆蓋
- **對位建議**：NxM 雙向傷害分析、最佳派出推薦、威脅評分
- **Ban/Pick 模擬**：威脅排序、Ban/Pick 流程模擬
- **戰術建議**：技能推薦、OHKO 分析、異常狀態機率

## 安裝

### Windows
1. 下載 `seer-tactics-setup-x.x.x.exe`
2. 執行安裝程式，選擇安裝目錄
3. 桌面捷徑會自動建立

### 開發模式
```bash
npm install
npm run dev
```

## 使用方法

### 精靈搜尋
1. 點擊「精靈圖鑑」分頁
2. 在搜尋框輸入精靈名稱或編號
3. 點擊精靈卡片查看詳細資訊

### 陣容模擬
1. 點擊「戰術模擬」分頁
2. 點擊「加入己方精靈」/「加入對手精靈」
3. 點擊精靈卡片進行配置（等級、學習力、性格等）
4. 點擊「分析全對位」查看對位建議

### 傷害計算
1. 在陣容模擬中配置好雙方精靈
2. 點擊對位矩陣中的格子
3. 查看技能傷害、OHKO 機率、異常狀態

### Ban/Pick 模擬
1. 在陣容模擬中加入雙方精靈池
2. 點擊「開始模擬」
3. 依序點擊精靈進行 Ban/Pick

## 技術架構

- **前端**：原生 HTML/CSS/JS（無框架依賴）
- **後端**：Electron + Node.js
- **資料庫**：SQLite（better-sqlite3）
- **打包**：electron-builder（NSIS 安裝程式）
- **自動更新**：electron-updater + GitHub Releases

## 開發指令

```bash
npm run dev          # 開發模式
npm run build        # 打包 Windows 安裝程式
npm test             # 執行測試（171 tests）
npm run import:seerh5  # 匯入精靈資料
npm run fetch:effects  # 更新技能效果
```

## 資料來源

- SeerH5 資料庫
- BWIKI 賽爾號百科
- 效果描述資料 (effectDes.json)
