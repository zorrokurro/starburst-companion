try {
const { contextBridge, ipcRenderer } = require('electron');
console.log('[preload] modules loaded');

const api = {
  // ── Window controls ──
  minimize: () => ipcRenderer.send('minimize-window'),
  close: () => ipcRenderer.send('close-window'),
  togglePin: () => ipcRenderer.invoke('toggle-pin'),
  isPinned: () => ipcRenderer.invoke('get-pin-state'),
  getVersion: () => ipcRenderer.invoke('get-version'),

  // ── 2.6 Ghost mode (click-through) ──
  toggleGhostMode: () => ipcRenderer.invoke('toggle-ghost-mode'),
  isGhostMode: () => ipcRenderer.invoke('get-ghost-state'),
  onGhostModeChanged: (cb) => ipcRenderer.on('ghost-mode-changed', (_e, v) => cb(v)),

  // ── 1. Window snapping ──
  toggleWindowSnap: (enable) => ipcRenderer.invoke('toggle-window-snap', enable),
  isSnapping: () => ipcRenderer.invoke('get-snap-state'),

  // ── 2. Screenshot capture ──
  captureScreenRegion: (region) => ipcRenderer.invoke('capture-screen-region', region),

  // ── 5. Auto-launch ──
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),

  // ── 3. Multi-profile teams ──
  profiles: {
    list: () => ipcRenderer.invoke('db:profiles:list'),
    create: (name) => ipcRenderer.invoke('db:profiles:create', name),
    rename: (id, name) => ipcRenderer.invoke('db:profiles:rename', id, name),
    delete: (id) => ipcRenderer.invoke('db:profiles:delete', id),
    setActive: (id) => ipcRenderer.invoke('db:profiles:set-active', id),
  },
  teams: {
    save: (profileId, data) => ipcRenderer.invoke('db:teams:save', profileId, data),
    load: (profileId) => ipcRenderer.invoke('db:teams:load', profileId),
    clear: (profileId) => ipcRenderer.invoke('db:teams:clear', profileId),
  },

  // ── 1.1 Database IPC bridge ──
  dbQuery: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // ── 1.2 Sprite lazy-load ──
  getOrFetchSprite: (cnId) => ipcRenderer.invoke('sprite:get-or-fetch', cnId),

  // ── Auto-update ──
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (_event, data) => callback(data));
  },
  startDownload: () => ipcRenderer.invoke('start-download'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),

  // ── Data update (jsDelivr) ──
  checkDataUpdate: () => ipcRenderer.invoke('data:update-check'),
  applyDataUpdate: () => ipcRenderer.invoke('data:update-apply'),
  onDataUpdateAvailable: (callback) => {
    ipcRenderer.on('data-update-available', (_event, data) => callback(data));
  },
  onDataUpdateDone: (callback) => {
    ipcRenderer.on('data-update-done', (_event, data) => callback(data));
  },

  // ── Bootstrap (first-launch DB download) ──
  onBootstrapProgress: (cb) => ipcRenderer.on('bootstrap:progress', (_e, data) => cb(data)),
  onBootstrapComplete: (cb) => ipcRenderer.on('bootstrap:complete', () => cb()),
  onBootstrapError: (cb) => ipcRenderer.on('bootstrap:error', (_e, data) => cb(data)),
  retryBootstrap: () => ipcRenderer.send('bootstrap:retry'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('[preload] electronAPI exposed OK, dbQuery:', typeof api.dbQuery);
} catch (err) {
  console.error('[preload] FATAL:', err.message, err.stack);
}
