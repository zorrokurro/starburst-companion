// ═══════════════════════════════════════════════════════════════════════════════
// main.cjs — 賽爾號戰術模擬器 Electron 主進程 (Phase 3: Pro-Grade HUD)
// ═══════════════════════════════════════════════════════════════════════════════

// ── 3.7 極限限制記憶體 & 禁用 GPU 冗餘（必須在 app.ready 之前）──
const { app, protocol } = require('electron');
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

// ★ Register app:// as privileged scheme (needed for localStorage/sessionStorage)
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

// ── Log must be available before single-instance lock (lock failure needs logging) ──
const log = require('electron-log');

// ── Single Instance Lock ──
// If lock fails, don't quit immediately — zombie processes from old installs
// may hold the lock. Defer the decision to app.whenReady().
let gotTheLock = app.requestSingleInstanceLock();
let secondInstanceReceived = false;

if (gotTheLock) {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
} else {
  // Lock failed: another instance *might* be running.
  // Wait for second-instance event — if it fires, focus existing window and quit.
  // If no event comes by the time app is ready, assume zombie lock and proceed.
  log.info('[lock] Single instance lock failed, waiting for second-instance...');
  app.on('second-instance', () => {
    secondInstanceReceived = true;
    log.info('[lock] second-instance received, focusing existing window');
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    app.quit();
  });
}

const {
  BrowserWindow, ipcMain, globalShortcut, screen, session,
  Tray, Menu, nativeImage, desktopCapturer, crashReporter,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { autoUpdater } = require('electron-updater');

const isDev = process.argv.includes('--dev');

// ── 3.10 電子日誌系統 ──
log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'debug' : 'error';
log.info('═══ App starting ═══');

// ═══════════════════════════════════════════════════════════════
//  10. Crash Reporter (Phase 3)
// ═══════════════════════════════════════════════════════════════
// CrashReporter disabled for stability

let mainWindow = null;
let tray = null;
let isPinned = false;
let isQuitting = false;
let isShuttingDown = false;
let isGhostMode = false;
let isSnapping = false;
let snapInterval = null;
let isBootstrapping = false;

// Module caches (loaded dynamically via import())
let dbModule = null;
let typeCalcModule = null;
let damageCalcModule = null;

function getBundlePath(...segments) {
  return app.isPackaged
    ? path.join(process.resourcesPath, ...segments)
    : path.join(__dirname, ...segments);
}

// ═══════════════════════════════════════════════════════════════
//  9. IPC Origin Verification Helper (Phase 3)
// ═══════════════════════════════════════════════════════════════
const ALLOWED_SENDER_URLS = [
  'app://localhost/index.html',
  'file:///',
];

function verifySender(event) {
  const url = event.senderFrame?.url || '';
  if (ALLOWED_SENDER_URLS.some(allowed => url.startsWith(allowed))) return true;
  log.warn(`IPC rejected from untrusted origin: ${url}`);
  return false;
}

// ═══════════════════════════════════════════════════════════════
//  1.1 Custom Protocol (取代 Express 靜態伺服)
// ═══════════════════════════════════════════════════════════════

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.dmp': 'application/octet-stream',
};

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/')) pathname = pathname.slice(1);
    if (!pathname || pathname === '') pathname = 'index.html';

    const publicPath = path.join(__dirname, 'public', pathname);
    try {
      const data = fs.readFileSync(publicPath);
      const ext = path.extname(publicPath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      return new Response(data, { headers: { 'Content-Type': mime } });
    } catch {
      // 8. If sprite image missing, serve the default avatar SVG
      if (pathname.startsWith('sprites/head/') || pathname.startsWith('sprites/body/')) {
        try {
          const fallback = fs.readFileSync(path.join(__dirname, 'public', 'sprites', 'default-avatar.svg'));
          return new Response(fallback, { headers: { 'Content-Type': 'image/svg+xml' } });
        } catch { /* fall through */ }
      }
      return new Response('Not Found', { status: 404 });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  1.3 資料同步機制 (jsDelivr Data Distribution)
// ═══════════════════════════════════════════════════════════════

const DIST_DATA_BASE = 'https://cdn.jsdelivr.net/gh/zorrokurro/starburst-companion@master/dist-data';
const DIST_TABLES = ['sprites', 'skills', 'sprite_skills', 'soul_seals', 'engravings', 'generic_traits', 'type_chart'];
const INIT_DB_URLS = [
  `${DIST_DATA_BASE}/seer.db`,
  'https://raw.githubusercontent.com/zorrokurro/starburst-companion/master/dist-data/seer.db',
];

let pendingDataUpdate = null;

async function checkDataPatch() {
  try {
    if (!dbModule) dbModule = await import('./src/db.js');
    const db = dbModule.getDb();
    const localVersion = db.prepare('SELECT value FROM meta WHERE key = ?').get('data_version');
    const currentVersion = localVersion?.value || '0.0.0';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${DIST_DATA_BASE}/version.json`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return;

    const remote = await response.json();
    if (remote.version === currentVersion) {
      log.info(`Data version up to date: ${currentVersion}`);
      return;
    }

    log.info(`Remote data update available: ${currentVersion} → ${remote.version}`);
    pendingDataUpdate = { remoteVersion: remote.version, localVersion: currentVersion, tables: remote.tables };
    mainWindow?.webContents.send('data-update-available', {
      remoteVersion: remote.version,
      localVersion: currentVersion,
    });
  } catch (err) {
    log.error('Data version check failed:', err.message);
  }
}

async function applyDataUpdate() {
  if (!pendingDataUpdate) return { ok: false, error: 'No pending update' };
  const { remoteVersion, tables } = pendingDataUpdate;

  try {
    if (!dbModule) dbModule = await import('./src/db.js');
    const db = dbModule.getDb();

    const upsertFns = {
      sprites: (rows) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO sprites
          (id, cn_id, name_zh, name_en, types, base_hp, base_atk, base_def, base_spatk, base_spdef, base_speed,
           height, weight, gender, evolves_from, evolves_to, evolve_level)
          VALUES (@id, @cn_id, @name_zh, @name_en, @types, @base_hp, @base_atk, @base_def, @base_spatk, @base_spdef, @base_speed,
           @height, @weight, @gender, @evolves_from, @evolves_to, @evolve_level)`);
        const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
        tx(rows);
      },
      skills: (rows) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO skills (id, name, power, accuracy, pp, category, type, effect_desc, tags)
          VALUES (@id, @name, @power, @accuracy, @pp, @category, @type, @effect_desc, @tags)`);
        const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
        tx(rows);
      },
      sprite_skills: (rows) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO sprite_skills (sprite_id, skill_id, is_signature)
          VALUES (@sprite_id, @skill_id, @is_signature)`);
        const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
        tx(rows);
      },
      soul_seals: (rows) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO soul_seals (id, sprite_id, effect_desc, name_zh_tw, kind)
          VALUES (@id, @sprite_id, @effect_desc, @name_zh_tw, @kind)`);
        const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
        tx(rows);
      },
      engravings: (rows) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO engravings
          (id, name, type, description, series_name, rarity, max_equip_level, max_hold_count,
           base_hp, base_atk, base_def, base_spatk, base_spdef, base_speed,
           hidden_hp, hidden_atk, hidden_def, hidden_spatk, hidden_spdef, hidden_speed,
           has_hidden_attr, exclusive_sprite_id, exclusive_skill, angle_count)
          VALUES (@id, @name, @type, @description, @series_name, @rarity, @max_equip_level, @max_hold_count,
           @base_hp, @base_atk, @base_def, @base_spatk, @base_spdef, @base_speed,
           @hidden_hp, @hidden_atk, @hidden_def, @hidden_spatk, @hidden_spdef, @hidden_speed,
           @has_hidden_attr, @exclusive_sprite_id, @exclusive_skill, @angle_count)`);
        const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
        tx(rows);
      },
      generic_traits: (rows) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO generic_traits (id, name, category, element_type, formula_type, description_template, custom_values, note)
          VALUES (@id, @name, @category, @element_type, @formula_type, @description_template, @custom_values, @note)`);
        const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
        tx(rows);
      },
      type_chart: (rows) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO type_chart (attack_type, defend_type, multiplier)
          VALUES (@attack_type, @defend_type, @multiplier)`);
        const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
        tx(rows);
      },
    };

    let totalRows = 0;
    for (const tableName of tables) {
      if (!upsertFns[tableName]) continue;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${DIST_DATA_BASE}/${tableName}.json`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Failed to fetch ${tableName}.json: ${res.status}`);
      const rows = await res.json();
      upsertFns[tableName](rows);
      totalRows += rows.length;
      log.info(`Applied ${tableName}: ${rows.length} rows`);
    }

    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('data_version', remoteVersion);
    pendingDataUpdate = null;
    log.info(`Data update complete: v${remoteVersion}, ${totalRows} total rows`);
    mainWindow?.webContents.send('data-update-done', { version: remoteVersion, totalRows });
    return { ok: true, version: remoteVersion, totalRows };
  } catch (err) {
    log.error('Data update failed:', err.message);
    mainWindow?.webContents.send('data-update-done', { error: err.message });
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//  ASAR Data Migration
// ═══════════════════════════════════════════════════════════════

function migrateUserDataFiles(userDataPath) {
  const srcDb = getBundlePath('db', 'seer.db');
  const destDbDir = path.join(userDataPath, 'db');
  const destDb = path.join(destDbDir, 'seer.db');

  if (!fs.existsSync(destDb) && fs.existsSync(srcDb)) {
    fs.mkdirSync(destDbDir, { recursive: true });
    fs.copyFileSync(srcDb, destDb);
    for (const ext of ['-wal', '-shm']) {
      const srcWal = srcDb + ext;
      if (fs.existsSync(srcWal)) fs.copyFileSync(srcWal, destDb + ext);
    }
    log.info('Database migrated to userData');
  }

  const spritesDir = path.join(userDataPath, 'sprites', 'head');
  if (!fs.existsSync(spritesDir)) {
    fs.mkdirSync(spritesDir, { recursive: true });
  }
}

// ═══════════════════════════════════════════════════════════════
//  Bootstrap — 首次啟動從 jsDelivr 下載完整 DB
// ═══════════════════════════════════════════════════════════════

async function downloadInitDb(dbDir, dbPath, bootstrapWin) {
  const controller = new AbortController();

  try {
    fs.mkdirSync(dbDir, { recursive: true });

    let response = null;
    for (const url of INIT_DB_URLS) {
      try {
        log.info(`Trying download: ${url}`);
        const timeout = setTimeout(() => controller.abort(), 30000);
        response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (response.ok) {
          log.info(`Download OK from: ${url}`);
          break;
        }
        log.warn(`Download failed from ${url}: HTTP ${response.status}`);
        response = null;
      } catch (err) {
        log.warn(`Download failed from ${url}: ${err.message}`);
        response = null;
      }
    }

    if (!response || !response.ok) throw new Error('All download sources failed');

    const totalBytes = Number(response.headers.get('content-length') || 0);
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;

      if (bootstrapWin && !bootstrapWin.isDestroyed()) {
        bootstrapWin.webContents.send('bootstrap:progress', {
          received,
          total: totalBytes,
          percent: totalBytes ? Math.round(received / totalBytes * 100) : -1,
        });
      }
    }

    const buffer = Buffer.concat(chunks);
    fs.writeFileSync(dbPath, buffer);

    const header = buffer.slice(0, 16).toString('utf8');
    if (!header.startsWith('SQLite format 3')) {
      log.error('Downloaded file is not a valid SQLite DB. Header:', header);
      fs.unlinkSync(dbPath);
      throw new Error('下載的檔案不是有效的資料庫（可能下載到錯誤頁面）');
    }

    log.info(`Download complete: ${buffer.length} bytes`);
    return true;
  } catch (err) {
    log.error('downloadInitDb failed:', err.message);
    return false;
  }
}

async function bootstrapWithWindow(userData) {
  return new Promise((resolve) => {
    isBootstrapping = true;
    const dbDir = path.join(userData, 'db');
    const dbPath = path.join(dbDir, 'seer.db');

    log.info('[bootstrap] Downloading DB via PowerShell...');
    fs.mkdirSync(dbDir, { recursive: true });

    const tryDownload = (index) => {
      if (index >= INIT_DB_URLS.length) {
        log.error('[bootstrap] All download sources failed');
        isBootstrapping = false;
        resolve(false);
        return;
      }

      const url = INIT_DB_URLS[index];
      log.info(`[bootstrap] Trying: ${url}`);

      const curlExe = 'C:\\Windows\\System32\\curl.exe';
      execFile(curlExe, ['-L', '-s', '-o', dbPath, '--max-time', '60', url], { timeout: 65000 }, (err, stdout, stderr) => {
        if (err || !fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) {
          log.warn(`[bootstrap] Failed: ${err ? err.message : 'empty file'}`);
          tryDownload(index + 1);
          return;
        }

        // Validate SQLite header
        try {
          const fd = fs.openSync(dbPath, 'r');
          const buf = Buffer.alloc(16);
          fs.readSync(fd, buf, 0, 16, 0);
          fs.closeSync(fd);
          const header = buf.toString('utf8');
          if (!header.startsWith('SQLite format 3')) {
            log.error(`[bootstrap] Invalid DB file, header: ${header}`);
            fs.unlinkSync(dbPath);
            tryDownload(index + 1);
            return;
          }
        } catch (e) {
          log.error(`[bootstrap] Validation error: ${e.message}`);
          tryDownload(index + 1);
          return;
        }

        const size = fs.statSync(dbPath).size;
        log.info(`[bootstrap] Download OK: ${size} bytes from ${url}`);
        isBootstrapping = false;
        resolve(true);
      });
    };

    tryDownload(0);
  });
}

// ═══════════════════════════════════════════════════════════════
//  2.4 記憶視窗位置與大小 (Window State Keeper)
// ═══════════════════════════════════════════════════════════════

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(getWindowStatePath(), 'utf-8'));
  } catch { return null; }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify({
      x: bounds.x, y: bounds.y,
      width: bounds.width, height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    }));
  } catch (err) { log.error('Window state save failed:', err.message); }
}

function isBoundsVisibleOnAnyDisplay(bounds) {
  return screen.getAllDisplays().some(d => {
    const { x, y, width, height } = d.bounds;
    return bounds.x < x + width && bounds.x + bounds.width > x &&
           bounds.y < y + height && bounds.y + bounds.height > y;
  });
}

function getInitialWindowBounds() {
  const saved = loadWindowState();
  if (saved) {
    const b = { x: saved.x, y: saved.y, width: saved.width, height: saved.height };
    if (isBoundsVisibleOnAnyDisplay(b)) return { ...b, maximized: saved.isMaximized };
  }
  return { width: 450, height: 850 };
}

// ═══════════════════════════════════════════════════════════════
//  4. System Tray (Phase 3)
// ═══════════════════════════════════════════════════════════════

function createTray() {
  const iconPath = path.join(__dirname, 'public', 'icons', 'icon-192.svg');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) throw new Error('empty');
  } catch {
    // Fallback: create a tiny colored square icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('星爆輔助器');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '顯示視窗', click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      },
    },
    {
      label: '👻 幽靈模式', click: () => {
        isGhostMode = !isGhostMode;
        if (mainWindow) mainWindow.setIgnoreMouseEvents(isGhostMode, { forward: true });
        mainWindow?.webContents.send('ghost-mode-changed', isGhostMode);
      },
    },
    { type: 'separator' },
    {
      label: '完全退出', click: () => {
        isQuitting = true;
        gracefulShutdown();
      },
    },
  ]);

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) { mainWindow.hide(); }
      else { mainWindow.show(); mainWindow.focus(); }
    }
  });

  tray.setContextMenu(contextMenu);
  log.info('System tray created');
}

// ═══════════════════════════════════════════════════════════════
//  5. Auto-Launch on Startup (Phase 3)
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('get-auto-launch', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('set-auto-launch', (_e, enabled) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
    });
    log.info(`Auto-launch: ${enabled}`);
  } catch (err) {
    log.error('set-auto-launch failed:', err.message);
  }
  return enabled;
});

// ═══════════════════════════════════════════════════════════════
//  6. Blur Memory Trimming (Phase 3)
// ═══════════════════════════════════════════════════════════════

function trimMemory() {
  if (global.gc) {
    global.gc();
    log.info('GC triggered on blur');
  }
  // Chromium memory trim via V8 flag is already set at startup
  // Additional: trim process working set on Windows
  if (process.platform === 'win32') {
    execFile('powershell', [
      '-NoProfile', '-Command',
      `[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()`,
    ], { timeout: 3000 }, () => {});
  }
}

// ═══════════════════════════════════════════════════════════════
//  1. Window Snapping — Win32 API via PowerShell (Phase 3)
// ═══════════════════════════════════════════════════════════════

const SEER_WINDOW_TITLES = ['賽爾號', 'seer', 'seerh5', '淘米'];
let lastGameBounds = null;
let snapEnabled = false;

function findGameWindow() {
  return new Promise((resolve) => {
    // Use PowerShell to enumerate visible windows via Win32 API
    const psScript = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class WinAPI {
          [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
          [DllImport("user32.dll", CharSet=CharSet.Unicode)]
          public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
          [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
        }
"@
      Add-Type @"
        using System;
        using System.Collections.Generic;
        using System.Runtime.InteropServices;
        public class WindowEnum {
          public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
          [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
        }
"@
      $results = @()
      $callback = [WindowEnum+EnumWindowsProc]{
        param($hWnd, $lParam)
        if ([WinAPI]::IsWindowVisible($hWnd)) {
          $sb = New-Object System.Text.StringBuilder 256
          [WinAPI]::GetWindowText($hWnd, $sb, 256) | Out-Null
          $title = $sb.ToString()
          if ($title) {
            $rect = New-Object WinAPI+RECT
            [WinAPI]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
            $results += [PSCustomObject]@{
              Title = $title; Left = $rect.Left; Top = $rect.Top
              Width = $rect.Right - $rect.Left; Height = $rect.Bottom - $rect.Top
            }
          }
        }
        return $true
      }
      [WindowEnum]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
      $results | ConvertTo-Json -Compress
    `.trim();

    execFile('powershell', ['-NoProfile', '-Command', psScript], {
      timeout: 2000,
      maxBuffer: 1024 * 1024,
    }, (err, stdout) => {
      if (err) { resolve(null); return; }
      try {
        let windows = JSON.parse(stdout.trim());
        if (!Array.isArray(windows)) windows = [windows];
        const match = windows.find(w =>
          SEER_WINDOW_TITLES.some(t => w.Title.toLowerCase().includes(t.toLowerCase()))
        );
        resolve(match || null);
      } catch { resolve(null); }
    });
  });
}

async function snapToGameWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || !snapEnabled) return;
  if (mainWindow.isFocused() || isSnapping) return;

  const game = await findGameWindow();
  if (!game || game.Width < 100 || game.Height < 100) return;

  // Check if game window moved
  const key = `${game.Left},${game.Top},${game.Width},${game.Height}`;
  if (lastGameBounds === key) return;
  lastGameBounds = key;

  isSnapping = true;
  const ourBounds = mainWindow.getBounds();
  const snapX = game.Left + game.Width + 2;
  const snapY = game.Top;
  const snapH = game.Height;

  // Only snap if within reasonable distance (200px) or overlapping
  const dist = Math.abs(ourBounds.x - (game.Left + game.Width));
  if (dist < 200 || ourBounds.x < game.Left + game.Width) {
    mainWindow.setBounds({
      x: snapX, y: snapY,
      width: ourBounds.width,
      height: Math.min(snapH, 900),
    });
  }
  isSnapping = false;
}

function startWindowSnapping() {
  if (snapInterval) return;
  snapEnabled = true;
  snapInterval = setInterval(snapToGameWindow, 500);
  log.info('Window snapping started (500ms poll)');
}

function stopWindowSnapping() {
  snapEnabled = false;
  if (snapInterval) { clearInterval(snapInterval); snapInterval = null; }
}

ipcMain.handle('toggle-window-snap', (_e, enable) => {
  if (enable) startWindowSnapping();
  else stopWindowSnapping();
  return snapEnabled;
});

ipcMain.handle('get-snap-state', () => snapEnabled);

// ═══════════════════════════════════════════════════════════════
//  2. Screenshot + OCR for Sprite Recognition (Phase 3)
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('capture-screen-region', async (_e, region) => {
  if (!verifySender(_e)) return { error: 'unauthorized' };
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    if (!sources.length) return { error: 'no screen source' };

    const img = sources[0].thumbnail;
    // region: { x, y, width, height } in screen coords
    const cropped = img.crop(region || { x: 0, y: 0, width: 400, height: 300 });
    const pngBuffer = cropped.toPNG();
    const userData = app.getPath('userData');
    const capturePath = path.join(userData, 'capture.png');
    fs.writeFileSync(capturePath, pngBuffer);
    return { path: capturePath, width: cropped.getSize().width, height: cropped.getSize().height };
  } catch (err) {
    log.error('Screen capture failed:', err.message);
    return { error: err.message };
  }
});

// ═══════════════════════════════════════════════════════════════
//  Graceful Shutdown
// ═══════════════════════════════════════════════════════════════

async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  isQuitting = true;
  log.info('Graceful shutdown...');

  saveWindowState();
  stopWindowSnapping();

  try {
    if (!dbModule) dbModule = await import('./src/db.js');
    const db = dbModule.getDb();
    log.info('Running VACUUM...');
    db.exec('VACUUM;');
    dbModule.closeDb();
    log.info('Database vacuumed and closed');
  } catch (err) { log.error('VACUUM failed:', err.message); }

  try { globalShortcut.unregisterAll(); } catch {}
  if (tray) { tray.destroy(); tray = null; }
  if (mainWindow) mainWindow.destroy();
  app.quit();
}

// ═══════════════════════════════════════════════════════════════
//  3. Multi-Profile Teams IPC (Phase 3)
// ═══════════════════════════════════════════════════════════════

function registerProfileIpc(getDbFn) {
  ipcMain.handle('db:profiles:list', (_e) => {
    if (!verifySender(_e)) return [];
    return getDbFn().prepare('SELECT * FROM profiles ORDER BY sort_order, id').all();
  });

  ipcMain.handle('db:profiles:create', (_e, name) => {
    if (!verifySender(_e)) return null;
    const d = getDbFn();
    const r = d.prepare('INSERT INTO profiles (name) VALUES (?)').run(name);
    return d.prepare('SELECT * FROM profiles WHERE id = ?').get(r.lastInsertRowid);
  });

  ipcMain.handle('db:profiles:rename', (_e, id, name) => {
    if (!verifySender(_e)) return null;
    const d = getDbFn();
    d.prepare('UPDATE profiles SET name = ? WHERE id = ?').run(name, id);
    return d.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
  });

  ipcMain.handle('db:profiles:delete', (_e, id) => {
    if (!verifySender(_e)) return { ok: false };
    getDbFn().prepare('DELETE FROM profiles WHERE id = ?').run(id);
    return { ok: true };
  });

  ipcMain.handle('db:profiles:set-active', (_e, profileId) => {
    if (!verifySender(_e)) return { ok: false };
    const d = getDbFn();
    d.prepare('UPDATE profiles SET is_active = 0').run();
    d.prepare('UPDATE profiles SET is_active = 1 WHERE id = ?').run(profileId);
    return { ok: true };
  });

  ipcMain.handle('db:teams:save', (_e, profileId, teamData) => {
    if (!verifySender(_e)) return { ok: false };
    const d = getDbFn();
    d.prepare(`INSERT OR REPLACE INTO teams (profile_id, side, slot_index, sprite_id, config_json)
               VALUES (?, ?, ?, ?, ?)`).run(
      profileId, teamData.side, teamData.slotIndex,
      teamData.spriteId, JSON.stringify(teamData.config)
    );
    return { ok: true };
  });

  ipcMain.handle('db:teams:load', (_e, profileId) => {
    if (!verifySender(_e)) return [];
    return getDbFn().prepare('SELECT * FROM teams WHERE profile_id = ?').all(profileId);
  });

  ipcMain.handle('db:teams:clear', (_e, profileId) => {
    if (!verifySender(_e)) return { ok: false };
    getDbFn().prepare('DELETE FROM teams WHERE profile_id = ?').run(profileId);
    return { ok: true };
  });
}

// ═══════════════════════════════════════════════════════════════
//  1.1 IPC Handlers (ES modules via dynamic import)
// ═══════════════════════════════════════════════════════════════

async function registerIpcHandlers() {
  log.info('[ipc] importing db.js...');
  dbModule = await import('./src/db.js');
  log.info('[ipc] importing typeCalculator.js...');
  typeCalcModule = await import('./src/typeCalculator.js');
  log.info('[ipc] importing damageCalculator.js...');
  damageCalcModule = await import('./src/damageCalculator.js');
  log.info('[ipc] imports done');

  const {
    querySprites, getSpriteById, getDistinctTypes, getDistinctTypeCombinations, getStatRange,
    getAllSpritesAll, getTypeChartAttackTypes, getTypeChartList,
    getAllCollections, getCollectionById, createCollection, updateCollection,
    deleteCollection, reorderCollection, getCollectionItems, addToCollection,
    removeFromCollection, reorderCollectionItem, getSpriteCollections,
    searchEngravings, getEngravingsFilters, getAllGenericTraits, getMovesetsBySpriteId, parseTypes, db: getDb,
    insertBattleLog, getBattleLogs, getBattleStats, getBattleSummary,
    aggregateMeta, getMetaReports,
  } = dbModule;
  const {
    calculateTypeMultiplier,
    getTypeEffectivenessAgainst, getTypeChartMatrix,
  } = typeCalcModule;
  const { calculateAllSkillsDamage } = damageCalcModule;

  // ── 3. Register profile/team IPC ──
  registerProfileIpc(getDb);

  // ── Sprites (with sender verification) ──
  ipcMain.handle('db:sprites:list', (_e, params) => {
    const senderUrl = _e.senderFrame?.url || 'unknown';
    if (!verifySender(_e)) {
      log.warn('db:sprites:list REJECTED sender:', senderUrl);
      return { data: [], total: 0 };
    }
    try {
      log.info('db:sprites:list called from:', senderUrl);
      const result = querySprites(params);
      log.info('db:sprites:list result: total=', result.total);
      return result;
    } catch (err) {
      log.error('db:sprites:list failed:', err.message);
      return { data: [], total: 0 };
    }
  });

  ipcMain.handle('db:sprites:all', (_e) => {
    if (!verifySender(_e)) return [];
    return getAllSpritesAll();
  });

  ipcMain.handle('db:sprites:get', (_e, id) => {
    if (!verifySender(_e)) return null;
    return getSpriteById(Number(id));
  });
  ipcMain.handle('db:sprites:collections', (_e, id) => {
    if (!verifySender(_e)) return [];
    return getSpriteCollections(Number(id));
  });
  ipcMain.handle('db:sprites:movesets', (_e, id) => {
    if (!verifySender(_e)) return [];
    return getMovesetsBySpriteId(Number(id));
  });

  // ── Battle Logs ──
  ipcMain.handle('db:battle:log', (_e, log) => {
    if (!verifySender(_e)) return null;
    try { return insertBattleLog(log); } catch { return null; }
  });
  ipcMain.handle('db:battle:logs', (_e, limit, offset) => {
    if (!verifySender(_e)) return [];
    try { return getBattleLogs(limit, offset); } catch { return []; }
  });
  ipcMain.handle('db:battle:stats', (_e) => {
    if (!verifySender(_e)) return [];
    try { return getBattleStats(); } catch { return []; }
  });
  ipcMain.handle('db:battle:summary', (_e) => {
    if (!verifySender(_e)) return { total: 0, wins: 0, losses: 0, winRate: '0.0' };
    try { return getBattleSummary(); } catch { return { total: 0, wins: 0, losses: 0, winRate: '0.0' }; }
  });

  // ── Meta ──
  ipcMain.handle('db:meta:aggregate', (_e, season) => {
    if (!verifySender(_e)) return null;
    try { return aggregateMeta(season); } catch { return null; }
  });
  ipcMain.handle('db:meta:reports', (_e, season, limit) => {
    if (!verifySender(_e)) return [];
    try { return getMetaReports(season, limit); } catch { return []; }
  });

  // ── Filters ──
  ipcMain.handle('db:filters:types', (_e) => {
    if (!verifySender(_e)) return [];
    try { return getDistinctTypes(); } catch { return []; }
  });
  ipcMain.handle('db:filters:type-combinations', (_e) => {
    if (!verifySender(_e)) return { single: [], dual: [] };
    try { return getDistinctTypeCombinations(); } catch { return { single: [], dual: [] }; }
  });
  ipcMain.handle('db:filters:stats', (_e) => {
    if (!verifySender(_e)) return { min_total: 0, max_total: 800 };
    try { return getStatRange(); } catch { return { min_total: 0, max_total: 800 }; }
  });

  // ── Collections ──
  ipcMain.handle('db:collections:list', (_e) => {
    if (!verifySender(_e)) return [];
    return getAllCollections();
  });
  ipcMain.handle('db:collections:get', (_e, id) => {
    if (!verifySender(_e)) return null;
    const col = getCollectionById(Number(id));
    if (col) col.items = getCollectionItems(col.id);
    return col;
  });
  ipcMain.handle('db:collections:create', (_e, name) => {
    if (!verifySender(_e)) return null;
    return createCollection(name);
  });
  ipcMain.handle('db:collections:update', (_e, id, name) => {
    if (!verifySender(_e)) return null;
    return updateCollection(Number(id), name);
  });
  ipcMain.handle('db:collections:delete', (_e, id) => {
    if (!verifySender(_e)) return { ok: false };
    deleteCollection(Number(id));
    return { ok: true };
  });
  ipcMain.handle('db:collections:reorder', (_e, id, sortOrder) => {
    if (!verifySender(_e)) return { ok: false };
    reorderCollection(Number(id), sortOrder);
    return { ok: true };
  });
  ipcMain.handle('db:collections:addItem', (_e, colId, spriteId) => {
    if (!verifySender(_e)) return { ok: false };
    addToCollection(Number(colId), Number(spriteId));
    return { ok: true };
  });
  ipcMain.handle('db:collections:removeItem', (_e, colId, spriteId) => {
    if (!verifySender(_e)) return { ok: false };
    removeFromCollection(Number(colId), Number(spriteId));
    return { ok: true };
  });
  ipcMain.handle('db:collections:reorderItem', (_e, colId, spriteId, sortOrder) => {
    if (!verifySender(_e)) return { ok: false };
    reorderCollectionItem(Number(colId), Number(spriteId), sortOrder);
    return { ok: true };
  });

  // ── Types ──
  ipcMain.handle('db:types:list', (_e) => {
    if (!verifySender(_e)) return [];
    return getTypeChartAttackTypes();
  });
  ipcMain.handle('db:type-chart', (_e) => {
    if (!verifySender(_e)) return [];
    return getTypeChartList();
  });
  ipcMain.handle('db:type-chart-matrix', (_e) => {
    if (!verifySender(_e)) return {};
    return getTypeChartMatrix();
  });

  // ── Calculations ──
  ipcMain.handle('db:calculate-effectiveness', (_e, { attackTypes, defendTypes }) => {
    if (!verifySender(_e)) return { multiplier: 1, effectiveness: {} };
    if (!attackTypes || !defendTypes) throw new Error('attackTypes and defendTypes required');
    return {
      multiplier: calculateTypeMultiplier(attackTypes, defendTypes),
      effectiveness: getTypeEffectivenessAgainst(defendTypes),
    };
  });

  ipcMain.handle('db:calculate-damage', (_e, { attacker, defender, skills, params }) => {
    if (!verifySender(_e)) return [];
    if (!attacker || !defender) throw new Error('attacker and defender required');
    if (!params.traitCache) {
      params.traitCache = getAllGenericTraits();
    }
    return calculateAllSkillsDamage(attacker, defender, skills || [], params || {});
  });

  ipcMain.handle('db:team-matchup', (_e, { team1, team2 }) => {
    if (!verifySender(_e)) return [];
    if (!team1 || !team2) throw new Error('team1 and team2 required');
    return team1.map(a =>
      team2.map(d => calculateTypeMultiplier(a.types || [], d.types || []))
    );
  });

  ipcMain.handle('db:full-matchup', (_e, { myTeam, enemyTeam, configs }) => {
    if (!verifySender(_e)) return {};
    if (!myTeam || !enemyTeam) throw new Error('myTeam and enemyTeam required');
    const { calculateFullMatchup } = require('./src/matchupCalculator.js');
    return calculateFullMatchup(myTeam, enemyTeam, configs || {});
  });

  // ── Engravings ──
  ipcMain.handle('db:engravings:filters', (_e) => {
    if (!verifySender(_e)) return { types: [], rarities: [], series: [] };
    return getEngravingsFilters();
  });
  ipcMain.handle('db:engravings:search', (_e, params) => {
    if (!verifySender(_e)) return { rows: [], total: 0 };
    return searchEngravings(params);
  });

  // ── Generic Traits ──
  ipcMain.handle('db:generic-traits:list', (_e) => {
    if (!verifySender(_e)) return [];
    return getAllGenericTraits();
  });

  // ── Data update (jsDelivr) ──
  ipcMain.handle('data:update-check', async (_e) => {
    if (!verifySender(_e)) return { ok: false };
    await checkDataPatch();
    return { ok: true, pending: !!pendingDataUpdate, update: pendingDataUpdate };
  });

  ipcMain.handle('data:update-apply', async (_e) => {
    if (!verifySender(_e)) return { ok: false };
    return await applyDataUpdate();
  });

  log.info('IPC handlers registered (with sender verification)');
}

// ═══════════════════════════════════════════════════════════════
//  1.2 精靈頭像動態懶載入 IPC
// ═══════════════════════════════════════════════════════════════

function registerSpriteLoader() {
  const userDataSprites = path.join(app.getPath('userData'), 'sprites', 'head');

  ipcMain.handle('sprite:get-or-fetch', async (_e, cnId) => {
    if (!verifySender(_e)) return null;
    const localPath = path.join(userDataSprites, `${cnId}.png`);
    if (fs.existsSync(localPath)) return { path: localPath, source: 'local' };

    const cdnUrl = `https://seerh5.61.com/resource/assets/pet/head/${cnId}.png`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(cdnUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.mkdirSync(userDataSprites, { recursive: true });
        fs.writeFileSync(localPath, buffer);
        return { path: localPath, source: 'cdn' };
      }
    } catch (err) { log.warn(`Sprite ${cnId} fetch failed: ${err.message}`); }
    // 8. Offline fallback: return null → frontend uses default-avatar.svg
    return null;
  });
}

// ═══════════════════════════════════════════════════════════════
//  Window Controls IPC
// ═══════════════════════════════════════════════════════════════

ipcMain.on('minimize-window', (_e) => {
  if (!verifySender(_e)) return;
  mainWindow?.minimize();
});

ipcMain.on('close-window', (_e) => {
  if (!verifySender(_e)) return;
  if (tray && !isQuitting) {
    mainWindow?.hide();
    return;
  }
  gracefulShutdown();
});

ipcMain.handle('toggle-pin', (_e) => {
  if (!verifySender(_e)) return isPinned;
  isPinned = !isPinned;
  mainWindow?.setAlwaysOnTop(isPinned, 'screen-saver');
  return isPinned;
});
ipcMain.handle('get-pin-state', () => isPinned);
ipcMain.handle('get-version', () => app.getVersion());

// ═══════════════════════════════════════════════════════════════
//  2.6 滑鼠穿透幽靈模式 (Click-Through HUD)
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('toggle-ghost-mode', (_e) => {
  if (!verifySender(_e)) return isGhostMode;
  isGhostMode = !isGhostMode;
  if (mainWindow) mainWindow.setIgnoreMouseEvents(isGhostMode, { forward: true });
  return isGhostMode;
});
ipcMain.handle('get-ghost-state', () => isGhostMode);

// ═══════════════════════════════════════════════════════════════
//  Auto-Updater
// ═══════════════════════════════════════════════════════════════

autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

autoUpdater.on('checking-for-update', () => {
  mainWindow?.webContents.send('update-status', { type: 'checking' });
});
autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-status', { type: 'update-available', version: info.version, releaseDate: info.releaseDate });
});
autoUpdater.on('update-not-available', () => {
  mainWindow?.webContents.send('update-status', { type: 'not-available' });
});
autoUpdater.on('error', (err) => {
  mainWindow?.webContents.send('update-status', { type: 'error', message: err.message });
});
autoUpdater.on('download-progress', (p) => {
  mainWindow?.webContents.send('update-progress', { percent: Math.round(p.percent), bytesPerSecond: p.bytesPerSecond, transferred: p.transferred, total: p.total });
});
autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update-status', { type: 'update-downloaded', version: info.version });
});

ipcMain.handle('start-download', async (_e) => {
  if (!verifySender(_e)) return { ok: false };
  try { await autoUpdater.downloadUpdate(); return { ok: true }; }
  catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('quit-and-install', (_e) => {
  if (!verifySender(_e)) return;
  autoUpdater.quitAndInstall(false, true);
});

// ═══════════════════════════════════════════════════════════════
//  App Ready
// ═══════════════════════════════════════════════════════════════

let appReady = false;

app.whenReady().then(async () => {
  try {
    // If a real second-instance arrived while we were starting up, focus it and quit
    if (!gotTheLock && secondInstanceReceived) {
      log.info('[lock] Second instance detected during startup, quitting');
      app.quit();
      return;
    }
    if (!gotTheLock) {
      log.info('[lock] No lock but no second-instance — assuming zombie, proceeding');
    }

    const userData = app.getPath('userData');

    // ★ 協議必須第一時間註冊
    registerAppProtocol();

    // ★ Grant storage/clipboard permissions for app:// origin
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowed = ['storage', 'clipboard-read', 'clipboard-sanitized-write'];
      callback(allowed.includes(permission));
    });

    if (app.isPackaged) {
      // 舊版遷移
      migrateUserDataFiles(userData);

      const dbPath = path.join(userData, 'db', 'seer.db');
      if (!fs.existsSync(dbPath)) {
        log.info('[ready] DB missing, launching bootstrap window...');
        const ok = await bootstrapWithWindow(userData);
        if (!ok) { app.quit(); return; }
      } else {
        // Validate DB has data (re-bootstrap if empty)
        try {
          const { default: Database } = await import('better-sqlite3');
          const tmpDb = new Database(dbPath, { readonly: true });
          const count = tmpDb.prepare('SELECT COUNT(*) as c FROM sprites').get().c;
          tmpDb.close();
          if (count === 0) {
            log.warn('[ready] DB is empty, re-bootstrapping...');
            fs.unlinkSync(dbPath);
            const ok = await bootstrapWithWindow(userData);
            if (!ok) { app.quit(); return; }
          }
        } catch (e) {
          log.warn('[ready] DB validation failed, re-bootstrapping:', e.message);
          try { fs.unlinkSync(dbPath); } catch {}
          const ok = await bootstrapWithWindow(userData);
          if (!ok) { app.quit(); return; }
        }
      }

      process.env.SEER_DB_PATH = dbPath;
    } else {
      delete process.env.SEER_DB_PATH;
    }

    // ★ Window must exist BEFORE async imports to prevent window-all-closed → app.quit()
    const { x, y, width, height, maximized } = getInitialWindowBounds();

    mainWindow = new BrowserWindow({
      x, y, width, height,
      minWidth: 380,
      minHeight: 500,
      frame: false,
      backgroundColor: '#0f1118',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    // 9. Set CSP via webContents session headers
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      if (details.url.startsWith('app://')) {
        callback({ responseHeaders: details.responseHeaders });
        return;
      }
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' https://seerh5.61.com; " +
            "img-src 'self' data: file: https://seerh5.61.com blob:; " +
            "script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "connect-src 'self' https://api.github.com https://objects.githubusercontent.com https://raw.githubusercontent.com; " +
            "font-src 'self'; " +
            "object-src 'none'; " +
            "base-uri 'none'; " +
            "form-action 'none'; " +
            "frame-ancestors 'none';"
          ],
        },
      });
    });

    // 6. Blur → memory trimming
    mainWindow.on('blur', () => {
      if (isPinned) mainWindow?.setOpacity(0.6);
      trimMemory();
    });
    mainWindow.on('focus', () => { mainWindow?.setOpacity(1.0); });

    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        if (tray) {
          mainWindow.hide();
          return;
        }
        gracefulShutdown();
      }
    });

    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
      if (code === -3) return;
      log.error('Load failed:', code, desc);
      setTimeout(() => mainWindow?.loadURL('app://localhost/index.html'), 1000);
    });

    mainWindow.webContents.on('console-message', (_e, level, msg) => {
      if (msg.includes('[preload]') || msg.includes('electronAPI')) {
        log.info('[renderer]', msg);
      }
    });

    // ★ Now safe to do async imports — window exists, event loop stays alive
    log.info('[ready] Registering IPC handlers...');
    await registerIpcHandlers();
    log.info('[ready] IPC handlers done');

    registerSpriteLoader();
    createTray();

    // 2.5 全域快捷鍵 Alt+Q
    globalShortcut.register('Alt+Q', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) { mainWindow.hide(); }
      else { mainWindow.show(); mainWindow.focus(); }
    });

    // ★ Load URL and show window AFTER IPC handlers are registered
    mainWindow.loadURL('app://localhost/index.html');

    mainWindow.once('ready-to-show', () => {
      if (maximized) mainWindow.maximize();
      mainWindow.show();
    });

    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      mainWindow.webContents.on('did-finish-load', () => {
        setTimeout(() => {
          autoUpdater.checkForUpdates().catch(() => {});
        }, 3000);
      });
    }

    appReady = true;
    log.info('App ready');
  } catch (err) {
    log.error('FATAL:', err.message, err.stack);
  }
});

app.on('window-all-closed', () => {
  if (!appReady) return;
  gracefulShutdown();
});
app.on('before-quit', () => { isQuitting = true; });
