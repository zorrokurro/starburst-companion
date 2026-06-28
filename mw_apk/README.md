# MW手冊 APK 拆解資源

> APK 來源: `C:\Users\layja\Downloads\base.apk.1`
> 套件名稱: `com.peekay.mw_manual`
> 版本: 1.5 (versionCode 53)
> 拆解日期: 2026-06-26

---

## 目錄結構

```
mw_apk/
├── README.md                  ← 本文件
├── xinghuang1.png             ← 星環圖片
│
├── scripts/                   ← 遊戲腳本
│   ├── mw_h5.js               ← 一鍵日常/泰坦挖礦/勇者之塔 (含 CommandID)
│   ├── speed.js               ← TimerHooker v2.0.11 (計時器加速/廣告跳過)
│   └── jsgear.js              ← JsGear v1.2 (計時器倍速控制引擎)
│
├── html/                      ← H5 工具頁面
│   ├── stat_calculator.html   ← 精靈能力值計算器 (範例UI)
│   ├── http_server_index.html ← 本地HTTP伺服器搜尋頁面
│   ├── h5_protocol.html       ← ByteArray協議序列化 + packHead 協議頭
│   └── native_api_demo.html   ← MW手冊 JS→Native API 文檔
│
└── sprites/                   ← 精靈動畫資源
    ├── pet_4.js               ← 精靈ID:4 動畫數據 (CreateJS格式)
    ├── pet_4_atlas.png        ← 精靈ID:4 精靈圖集
    ├── preview_4.js           ← 精靈ID:4 預覽動畫
    ├── preview_4_atlas.png    ← 精靈ID:4 預覽圖集
    ├── pet_1702.js            ← 精靈ID:1702 動畫數據
    ├── pet_1702_atlas.png     ← 精靈ID:1702 精靈圖集
    ├── preview_1702.js        ← 精靈ID:1702 預覽動畫
    ├── preview_1702_atlas.png ← 精靈ID:1702 預覽圖集
    ├── pet_3129.js            ← 精靈ID:3129 動畫數據
    ├── pet_3129_atlas.png     ← 精靈ID:3129 精靈圖集
    ├── preview_3129.js        ← 精靈ID:3129 預覽動畫
    ├── preview_3129_atlas.png ← 精靈ID:3129 預覽圖集
    ├── fight_1702.png         ← 精靈ID:1702 戰鬥圖
    ├── fight_3129.png         ← 精靈ID:3129 戰鬥圖
    └── fight_4.png            ← 精靈ID:4 戰鬥圖
```

---

## 關鍵發現

### 1. 遊戲 CommandID (mw_h5.js)

```javascript
// 已知 CommandID
CommandID.RES_PRODUCTORBUY  // 戰隊生產
CommandID.CHANGE_PET        // 切換精靈
CommandID.FIGHT_H5_PVE_BOSS // H5 PvE 戰鬥

// 數字型 CommandID
46301  // 抽刻印 (send(46301, [1, 0]))
42395  // SPT懸賞/泰坦礦洞 (send(42395, [taskType, ...]))
```

**日常任務流程:**
1. `SocketConnection.send(46301, [1, 0])` — 抽刻印
2. `SocketConnection.send(42395, [111, 4, 1, 0])` — 接取SPT懸賞
3. `SocketConnection.send(CommandID.RES_PRODUCTORBUY, [2, 0])` — 戰隊生產 (x5)

**泰坦礦洞:**
- 進入: `SocketConnection.sendWithPromise(42395, [104, 1, mode, 0])`
- 戰鬥: `SocketConnection.send(CommandID.FIGHT_H5_PVE_BOSS, [104, mode, task])`
- 挖礦路線: easy=25格, normal=34格, hard=48格

**勇者之塔:**
- `SocketConnection.send(CommandID.FIGHT_H5_PVE_BOSS, [101, i, 1~5])`

### 2. 協議序列化 (h5_protocol.html)

**ByteArray** — 大端序 (BIG_ENDIAN) 二進制序列化:
- `writeByte` / `readByte` — 1 byte
- `writeShort` / `readShort` — 2 bytes
- `writeInt` / `readInt` — 4 bytes
- `writeLong` / `readLong` — 8 bytes
- `writeUTF` / `readUTF` — 4-byte length prefix + UTF-8 bytes

**packHead** — 協議頭打包函數:
```javascript
packHead = function(result, e, n, r) {
    if (n > 1000) {
        for (var s = 0, c = 0; c < r.length; c++) {
            s ^= 255 & r[c];
        }
    }
    result = result - Math.floor(result / 3) + 113 + r.length % 17 + n % 23 + s + 7
    m_w.setIndex(result);
}
```

### 3. MW手冊 Native API (native_api_demo.html)

```javascript
mw.toast(text)           // 彈出吐司提示
mw.snack(text)           // 彈出底部提示
mw.setScreen("true/false") // 設置螢幕方向
mw.getStatusHeight()     // 獲取狀態欄高度
mw.closeApp()            // 關閉當前工具
```

### 4. 第三方依賴

| 庫 | 版本 | 用途 |
|---|---|---|
| Kotlin Coroutines | 1.6.4 | 異步處理 |
| OkHttp3 | - | HTTP 客戶端 |
| NanoHTTPD | - | 內嵌 HTTP 伺服器 |
| AgentWeb | - | WebView 框架 |
| QQ/Tencent Connect | - | QQ 登入 |
| Tencent X5 | - | 瀏覽器引擎 |
| SpiderMan | - | 崩潰報告 |
| DiDi Socket Server | - | TCP Socket 通訊 |
| Material Design 3 | 1.13.0-alpha09 | UI 組件 |

### 5. Native Libraries

| 檔案 | 大小 | 說明 |
|---|---|---|
| `libgojni.so` | 15.5 MB | Go 語言 JNI 橋接 (僅 arm64) |
| `libmw_manual.so` | ~3 KB | 應用自身 native lib |
| `libyuv-decoder.so` | ~10 KB | YUV 圖片解碼器 |

### 6. 權限 (24項)

重要: `INTERNET`, `READ_EXTERNAL_STORAGE`, `MANAGE_EXTERNAL_STORAGE`, `NFC`, `READ_LOGS`, `DUMP`

---

## 與現有專案的關聯

| MW手冊資源 | 現有專案對應 | 狀態 |
|---|---|---|
| 精靈能力值計算 | `src/damageCalculator.js` | 已有更完整版本 |
| 本地搜尋頁面 | `src/server.js` | 已有 Express API |
| ByteArray 協議 | 無 | **可新增** → `mw_apk/html/h5_protocol.html` |
| CommandID 知識 | 無 | **可新增** → `mw_apk/scripts/mw_h5.js` |
| 精靈動畫資源 | 無 | **可新增** → `mw_apk/sprites/` |
| TimerHooker | 無 | 參考用途 → `mw_apk/scripts/speed.js` |
