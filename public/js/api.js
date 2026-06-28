// ═══════════════════════════════════════════════════════════════
// api.js — IPC-Only API Layer (取代 Express HTTP Fetch)
// ═══════════════════════════════════════════════════════════════

const API = {
  // 通用 IPC 呼叫（直接走 preload bridge）
  async invoke(channel, ...args) {
    const api = window.electronAPI;
    if (!api?.dbQuery) throw new Error('Electron IPC not available');
    return api.dbQuery(channel, ...args);
  },

  // 保留原有 get/post/del 介面（部分舊代碼仍在使用）
  async get(url) {
    const action = this._mapUrlToAction(url);
    if (action) return this.invoke(action.channel, ...action.args);
    throw new Error(`GET ${url} not mapped to IPC`);
  },
  async post(url, body) {
    const action = this._mapUrlToAction(url, body);
    if (action) return this.invoke(action.channel, ...action.args);
    throw new Error(`POST ${url} not mapped to IPC`);
  },
  async put(url, body) {
    const action = this._mapUrlToAction(url, body);
    if (action) return this.invoke(action.channel, ...action.args);
    throw new Error(`PUT ${url} not mapped to IPC`);
  },
  async del(url) {
    const action = this._mapUrlToAction(url);
    if (action) return this.invoke(action.channel, ...action.args);
    throw new Error(`DELETE ${url} not mapped to IPC`);
  },

  // ── URL → IPC Channel 映射表 ──
  _mapUrlToAction(url, body) {
    // Parse URL
    const [path, queryString] = url.split('?');
    const params = {};
    if (queryString) {
      for (const pair of queryString.split('&')) {
        const [k, v] = pair.split('=');
        params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }

    const segments = path.split('/').filter(Boolean); // remove empty segments

    // GET /api/sprites
    if (segments[0] === 'api' && segments[1] === 'sprites' && !segments[2]) {
      const result = {
        channel: 'db:sprites:list',
        args: [{
          sort: params.sort,
          order: params.order,
          types: params.types ? params.types.split(',').filter(Boolean) : undefined,
          finalOnly: params.finalOnly === '1',
          minTotal: params.minTotal != null ? Number(params.minTotal) : undefined,
          maxTotal: params.maxTotal != null ? Number(params.maxTotal) : undefined,
          search: params.search,
          page: params.page ? Number(params.page) : undefined,
          limit: params.limit ? Number(params.limit) : undefined,
        }],
      };
      return result;
    }

    // GET /api/sprites/all
    if (segments[0] === 'api' && segments[1] === 'sprites' && segments[2] === 'all') {
      return { channel: 'db:sprites:all', args: [] };
    }

    // GET /api/sprites/:id/collections
    if (segments[0] === 'api' && segments[1] === 'sprites' && segments[3] === 'collections') {
      return { channel: 'db:sprites:collections', args: [Number(segments[2])] };
    }

    // GET /api/sprites/:id
    if (segments[0] === 'api' && segments[1] === 'sprites' && segments[2]) {
      return { channel: 'db:sprites:get', args: [Number(segments[2])] };
    }

    // GET /api/filters/types
    if (segments[0] === 'api' && segments[1] === 'filters' && segments[2] === 'types') {
      return { channel: 'db:filters:types', args: [] };
    }

    // GET /api/filters/stats
    if (segments[0] === 'api' && segments[1] === 'filters' && segments[2] === 'stats') {
      return { channel: 'db:filters:stats', args: [] };
    }

    // GET /api/collections
    if (segments[0] === 'api' && segments[1] === 'collections' && !segments[2]) {
      return { channel: 'db:collections:list', args: [] };
    }

    // POST /api/collections (body.name)
    if (segments[0] === 'api' && segments[1] === 'collections' && !segments[2]) {
      return { channel: 'db:collections:create', args: [body?.name] };
    }

    // GET /api/collections/:id
    if (segments[0] === 'api' && segments[1] === 'collections' && segments[2] && !segments[3]) {
      return { channel: 'db:collections:get', args: [Number(segments[2])] };
    }

    // PUT /api/collections/:id (body.name)
    if (segments[0] === 'api' && segments[1] === 'collections' && segments[2] && !segments[3]) {
      return { channel: 'db:collections:update', args: [Number(segments[2]), body?.name] };
    }

    // DELETE /api/collections/:id
    if (segments[0] === 'api' && segments[1] === 'collections' && segments[2] && !segments[3]) {
      return { channel: 'db:collections:delete', args: [Number(segments[2])] };
    }

    // PUT /api/collections/:id/reorder
    if (segments[0] === 'api' && segments[1] === 'collections' && segments[2] && segments[3] === 'reorder') {
      return { channel: 'db:collections:reorder', args: [Number(segments[2]), body?.sortOrder] };
    }

    // POST /api/collections/:id/items
    if (segments[0] === 'api' && segments[1] === 'collections' && segments[2] && segments[3] === 'items' && !segments[4]) {
      return { channel: 'db:collections:addItem', args: [Number(segments[2]), body?.spriteId] };
    }

    // DELETE /api/collections/:id/items/:spriteId
    if (segments[0] === 'api' && segments[1] === 'collections' && segments[2] && segments[3] === 'items' && segments[4]) {
      return { channel: 'db:collections:removeItem', args: [Number(segments[2]), Number(segments[4])] };
    }

    // PUT /api/collections/:id/items/reorder
    if (segments[0] === 'api' && segments[1] === 'collections' && segments[2] && segments[3] === 'items' && segments[4] === 'reorder') {
      return { channel: 'db:collections:reorderItem', args: [Number(segments[2]), body?.spriteId, body?.sortOrder] };
    }

    // GET /api/types
    if (segments[0] === 'api' && segments[1] === 'types' && !segments[2]) {
      return { channel: 'db:types:list', args: [] };
    }

    // GET /api/type-chart
    if (segments[0] === 'api' && segments[1] === 'type-chart' && !segments[2]) {
      return { channel: 'db:type-chart', args: [] };
    }

    // GET /api/type-chart-matrix
    if (segments[0] === 'api' && segments[1] === 'type-chart-matrix') {
      return { channel: 'db:type-chart-matrix', args: [] };
    }

    // POST /api/calculate-effectiveness
    if (segments[0] === 'api' && segments[1] === 'calculate-effectiveness') {
      return { channel: 'db:calculate-effectiveness', args: [body] };
    }

    // POST /api/calculate-damage
    if (segments[0] === 'api' && segments[1] === 'calculate-damage') {
      return { channel: 'db:calculate-damage', args: [body] };
    }

    // POST /api/team-matchup
    if (segments[0] === 'api' && segments[1] === 'team-matchup') {
      return { channel: 'db:team-matchup', args: [body] };
    }

    // GET /api/engravings/filters
    if (segments[0] === 'api' && segments[1] === 'engravings' && segments[2] === 'filters') {
      return { channel: 'db:engravings:filters', args: [] };
    }

    // GET /api/engravings
    if (segments[0] === 'api' && segments[1] === 'engravings' && !segments[2]) {
      return { channel: 'db:engravings:search', args: [params] };
    }

    return null;
  },

  // ── Typed API methods (保持原有介面) ──
  sprites: {
    list(params = {}) {
      return API.invoke('db:sprites:list', params);
    },
    get(id) { return API.invoke('db:sprites:get', id); },
    getCollections(id) { return API.invoke('db:sprites:collections', id); },
  },

  filters: {
    types() { return API.invoke('db:filters:types'); },
    stats() { return API.invoke('db:filters:stats'); },
  },

  collections: {
    list() { return API.invoke('db:collections:list'); },
    get(id) { return API.invoke('db:collections:get', id); },
    create(name) { return API.invoke('db:collections:create', name); },
    update(id, name) { return API.invoke('db:collections:update', id, name); },
    delete(id) { return API.invoke('db:collections:delete', id); },
    reorder(id, sortOrder) { return API.invoke('db:collections:reorder', id, sortOrder); },
    addItem(colId, spriteId) { return API.invoke('db:collections:addItem', colId, spriteId); },
    removeItem(colId, spriteId) { return API.invoke('db:collections:removeItem', colId, spriteId); },
    reorderItem(colId, spriteId, sortOrder) { return API.invoke('db:collections:reorderItem', colId, spriteId, sortOrder); },
  },

  genericTraits: {
    getAll() { return API.invoke('db:generic-traits:list'); },
  },
};
