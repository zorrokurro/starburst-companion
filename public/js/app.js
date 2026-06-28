const TYPE_COLORS = {
  '普通': '#A8A878', '火': '#F08030', '水': '#6890F0', '草': '#78C850',
  '電': '#F8D030', '冰': '#98D8D8', '戰鬥': '#C03028', '毒': '#A040A0',
  '地面': '#E0C068', '飛行': '#A890F0', '超能': '#F85888', '蟲': '#A8B820',
  '岩石': '#B8A038', '鬼': '#705898', '龍': '#7038F8', '惡': '#705848',
  '鋼': '#B8B8D0', '光': '#F8D030', '暗影': '#705898', '聖靈': '#F8D030',
  '次元': '#7038F8', '混沌': '#705848', '自然': '#78C850',
  '遠古': '#795548', '邪靈': '#4a235a', '王': '#ffd700',
  '神靈': '#fff', '輪迴': '#34495e', '虛空': '#9b59b6', '機械': '#95a5a6',
};

const STAT_COLORS = {
  hp: '#ff5959', atk: '#f5ac78', def: '#fae078',
  spatk: '#9db7f5', spdef: '#a7db8d', speed: '#fa92b2',
};

const STAT_LABELS = { hp: '體力', atk: '攻擊', def: '防禦', spatk: '特攻', spdef: '特防', speed: '速度' };

const SOUL_SEAL_KIND_LABELS = {
  0:'PVE', 1:'強攻', 2:'護盾', 3:'減傷', 4:'輔助', 5:'恢復', 6:'免傷',
  7:'免疫異常', 8:'消回合', 9:'先制', 10:'控制', 11:'強化', 12:'弱化',
  13:'封屬', 14:'額外傷害', 15:'減PP', 16:'護罩', 17:'閃避', 18:'干擾'
};

function renderSoulSealKinds(kindStr) {
  if (!kindStr) return '';
  const kinds = kindStr.trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
  if (!kinds.length) return '';
  return kinds.map(k => {
    const label = SOUL_SEAL_KIND_LABELS[k] || `#${k}`;
    return `<span class="skill-tag-badge tag-soul-kind">${label}</span>`;
  }).join(' ');
}

function typeBadgeHTML(type) {
  const c = TYPE_COLORS[type] || '#68A090';
  return `<span class="type-badge" style="background:${c}">${type}</span>`;
}

function spriteImgURL(cnId) {
  return `${CDN_HEAD_BASE}/${cnId}.png`;
}

function spriteImgFallback(cnId, types) {
  const t = types?.[0];
  const map = {
    '火': '🔥', '水': '💧', '草': '🌿', '電': '⚡', '冰': '❄️',
    '戰鬥': '🥊', '毒': '☠️', '地面': '🌍', '飛行': '🦅', '超能': '🔮',
    '蟲': '🐛', '岩石': '🪨', '鬼': '👻', '龍': '🐉', '惡': '🌑',
    '鋼': '⚙️', '普通': '⭐', '光': '✨', '暗影': '🌑', '聖靈': '🌟',
    '次元': '🌀', '混沌': '🌀', '自然': '🍀', '機械': '⚙️', '遠古': '🏛️',
    '邪靈': '😈', '王': '👑', '神靈': '👻', '輪迴': '🔄', '虛空': '🌌',
  };
  return map[t] || '❓';
}

const CDN_HEAD_BASE = 'https://seerh5.61.com/resource/assets/pet/head';
const DEFAULT_PET_IMG = '/sprites/default-pet.png';
const DEFAULT_AVATAR_SVG = '/sprites/default-avatar.svg';

async function loadSpriteImage(cnId) {
  const api = window.electronAPI;
  if (api?.getOrFetchSprite) {
    try {
      const result = await api.getOrFetchSprite(cnId);
      if (result?.path) {
        return `file:///${result.path.replace(/\\/g, '/')}`;
      }
    } catch (e) { /* fall through */ }
  }
  return `${CDN_HEAD_BASE}/${cnId}.png`;
}

function handleSpriteImageError(img) {
  const cnId = img.dataset.cnId;
  const fallbackPhase = parseInt(img.dataset.fallbackPhase || '0', 10);
  if (fallbackPhase === 0) {
    // Phase 0→1: Try CDN
    img.dataset.fallbackPhase = '1';
    img.src = `${CDN_HEAD_BASE}/${cnId}.png`;
  } else if (fallbackPhase === 1) {
    // Phase 1→2: Offline fallback SVG
    img.dataset.fallbackPhase = '2';
    img.onerror = null;
    img.src = DEFAULT_AVATAR_SVG;
  } else {
    // Last resort: emoji fallback
    img.onerror = null;
    img.src = DEFAULT_PET_IMG;
  }
}

function spriteEmoji(types, cnId) {
  if (cnId) {
    const localPath = spriteImgURL(cnId);
    return `<img src="${localPath}" data-cn-id="${cnId}" data-fallback-phase="0" alt="" loading="lazy" onerror="handleSpriteImageError(this)"><span style="display:none;font-size:1.5em">${spriteImgFallback(cnId, types)}</span>`;
  }
  return `<span style="font-size:1.5em">${spriteImgFallback(null, types)}</span>`;
}

function typeBarColor(type) {
  return TYPE_COLORS[type] || '#68A090';
}

// ═══════════════════════════════════════════════════════════
//  Hash Router
// ═══════════════════════════════════════════════════════════

const ROUTES = {
  'index':       'view-index',
  'type-chart':  'view-type-chart',
  'team-sim':    'view-team-sim',
};

const routeInitialized = {};

function handleRoute() {
  const hash = (window.location.hash || '#index').replace('#', '');

  // 1. 切換 View
  document.querySelectorAll('.spa-view').forEach(v => v.classList.add('hidden'));
  const viewId = ROUTES[hash] || ROUTES['index'];
  const activeView = document.getElementById(viewId);
  if (activeView) activeView.classList.remove('hidden');

  // 2. 導覽列高亮
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('href') === '#' + hash);
  });

  // 3. 懶初始化：首次進入某 View 時執行對應 init
  if (!routeInitialized[hash]) {
    routeInitialized[hash] = true;
    if (hash === 'type-chart' && typeof TypeChart !== 'undefined') {
      TypeChart.init();
    } else if (hash === 'team-sim' && typeof TeamSim !== 'undefined') {
      TeamSim.init();
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  Index Page State
// ═══════════════════════════════════════════════════════════

const IndexState = {
  page: 1,
  loading: false,
  hasMore: true,
  total: 0,
  viewMode: 'list',
  sort: 'cn_id',
  order: 'ASC',
  selectedTypes: [],
  regionStatus: [],
  minTotal: null,
  maxTotal: null,
  search: '',
  finalOnly: false,
  allTypes: [],
  favoriteSprites: new Set(),
};

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  // Index page (always init on load)
  loadFilterOptions();
  initFilterListeners();
  initViewToggle();
  initInfiniteScroll();
  initDetailModal();
  loadSprites(true);

  // Router
  window.addEventListener('hashchange', handleRoute);
  handleRoute();

  // Electron auto-update banner
  initUpdateBanner();
  initDataUpdateBanner();
});

// ═══════════════════════════════════════════════
//  Auto-Update Banner (Electron only)
// ═══════════════════════════════════════════════

function initUpdateBanner() {
  const api = window.electronAPI;
  if (!api?.onUpdateStatus) return; // Not in Electron

  const banner = document.getElementById('update-banner');
  if (!banner) return;

  function showBanner(state, html) {
    banner.className = `update-banner state-${state}`;
    banner.innerHTML = html;
  }

  function hideBanner() {
    banner.className = 'update-banner hidden';
    banner.innerHTML = '';
  }

  api.onUpdateStatus((data) => {
    switch (data.type) {
      case 'checking':
        showBanner('checking', '⏳ 檢查更新中…');
        break;

      case 'update-available':
        showBanner('available',
          `📥 有新版本 v${data.version} <span style="opacity:0.7;margin-left:2px;">— 點擊下載</span>`
        );
        banner.onclick = () => {
          api.startDownload();
          showBanner('downloading', '⏳ 下載中… <div class="update-progress-bar"><div class="update-progress-fill" style="width:0%"></div></div>');
        };
        break;

      case 'not-available':
        hideBanner();
        break;

      case 'update-downloaded':
        showBanner('downloaded', `⚡ 立即重啟更新 v${data.version}`);
        banner.onclick = () => api.quitAndInstall();
        break;

      case 'error':
        showBanner('error', '❌ 更新失敗');
        banner.onclick = () => hideBanner();
        break;

      default:
        hideBanner();
    }
  });

  api.onUpdateProgress((data) => {
    const fill = banner.querySelector('.update-progress-fill');
    if (fill) {
      fill.style.width = `${data.percent}%`;
    }
    // Update text with percentage
    const textNode = banner.childNodes[0];
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      textNode.textContent = `⏳ 下載中 ${data.percent}% `;
    }
  });
}

// ═══════════════════════════════════════════════
//  Data Update Banner (jsDelivr)
// ═══════════════════════════════════════════════

function initDataUpdateBanner() {
  const api = window.electronAPI;
  if (!api?.onDataUpdateAvailable) return;

  const banner = document.getElementById('data-update-banner');
  if (!banner) return;

  function showBanner(state, html) {
    banner.className = `update-banner state-${state}`;
    banner.innerHTML = html;
  }

  function hideBanner() {
    banner.className = 'update-banner hidden';
    banner.innerHTML = '';
  }

  api.onDataUpdateAvailable((data) => {
    showBanner('available',
      `📊 資料更新 v${data.remoteVersion} <span style="opacity:0.7;margin-left:2px;">— 點擊套用</span>`
    );
    banner.onclick = async () => {
      showBanner('downloading', '⏳ 下載資料中…');
      const result = await api.applyDataUpdate();
      if (result.ok) {
        showBanner('downloaded', `✅ 資料已更新至 v${result.version}（${result.totalRows} 筆）`);
        setTimeout(hideBanner, 4000);
      } else {
        showBanner('error', `❌ 更新失敗: ${result.error}`);
        banner.onclick = hideBanner;
      }
    };
  });

  api.onDataUpdateDone((data) => {
    if (data.error) {
      showBanner('error', `❌ 更新失敗: ${data.error}`);
      banner.onclick = hideBanner;
    }
  });

  // Check for data updates on startup
  api.checkDataUpdate();
}

// ── Filter Options ──
async function loadFilterOptions() {
  try {
    const [types, stats] = await Promise.all([API.filters.types(), API.filters.stats()]);
    IndexState.allTypes = types;
    renderTypeChips(types);
    document.getElementById('stat-min').min = stats.min_total;
    document.getElementById('stat-min').placeholder = stats.min_total;
    document.getElementById('stat-max').max = stats.max_total;
    document.getElementById('stat-max').placeholder = stats.max_total;
  } catch (err) {
    console.error('Failed to load filters:', err);
  }
}

function renderTypeChips(types) {
  const container = document.getElementById('type-filters');
  container.innerHTML = types.map(t =>
    `<span class="type-chip" data-type="${t}" style="background:${TYPE_COLORS[t] || '#68A090'}">${t}</span>`
  ).join('');
}

function initFilterListeners() {
  document.getElementById('type-filters').addEventListener('click', e => {
    const chip = e.target.closest('.type-chip');
    if (!chip) return;
    const type = chip.dataset.type;
    if (IndexState.selectedTypes.includes(type)) {
      IndexState.selectedTypes = IndexState.selectedTypes.filter(t => t !== type);
    } else if (IndexState.selectedTypes.length >= 2) {
      IndexState.selectedTypes = [type];
    } else {
      IndexState.selectedTypes.push(type);
    }
    document.querySelectorAll('.type-chip').forEach(c => c.classList.toggle('active', IndexState.selectedTypes.includes(c.dataset.type)));
    resetAndLoad();
  });

  document.getElementById('sort-select').addEventListener('change', e => {
    IndexState.sort = e.target.value;
    resetAndLoad();
  });

  document.getElementById('btn-order').addEventListener('click', e => {
    IndexState.order = IndexState.order === 'ASC' ? 'DESC' : 'ASC';
    e.target.textContent = IndexState.order === 'ASC' ? '↑' : '↓';
    resetAndLoad();
  });

  let statTimeout;
  const onStatChange = () => {
    clearTimeout(statTimeout);
    statTimeout = setTimeout(() => {
      const minV = document.getElementById('stat-min').value;
      const maxV = document.getElementById('stat-max').value;
      IndexState.minTotal = minV !== '' ? Number(minV) : null;
      IndexState.maxTotal = maxV !== '' ? Number(maxV) : null;
      resetAndLoad();
    }, 300);
  };
  document.getElementById('stat-min').addEventListener('input', onStatChange);
  document.getElementById('stat-max').addEventListener('input', onStatChange);

  let searchTimeout;
  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      IndexState.search = e.target.value.trim();
      resetAndLoad();
    }, 300);
  });

  document.getElementById('final-only').addEventListener('change', e => {
    IndexState.finalOnly = e.target.checked;
    resetAndLoad();
  });
}

// ── View Toggle ──
function initViewToggle() {
  document.getElementById('btn-list-view').addEventListener('click', () => setViewMode('list'));
  document.getElementById('btn-grid-view').addEventListener('click', () => setViewMode('grid'));
}

function setViewMode(mode) {
  IndexState.viewMode = mode;
  const container = document.getElementById('sprite-container');
  container.className = `sprite-container ${mode === 'grid' ? 'grid-view' : 'list-view'}`;
  document.getElementById('btn-list-view').classList.toggle('active', mode === 'list');
  document.getElementById('btn-grid-view').classList.toggle('active', mode === 'grid');
  const sprites = container._data;
  if (sprites) renderSprites(sprites, false);
}

// ── Load Sprites ──
async function loadSprites(reset = false) {
  if (IndexState.loading) return;
  if (!reset && !IndexState.hasMore) return;

  IndexState.loading = true;
  const indicator = document.getElementById('loading-indicator');
  indicator.style.display = 'block';

  if (reset) {
    IndexState.page = 1;
    IndexState.hasMore = true;
    document.getElementById('sprite-container').innerHTML = '';
  }

  try {
    const result = await API.sprites.list({
      sort: IndexState.sort,
      order: IndexState.order,
      types: IndexState.selectedTypes.length ? IndexState.selectedTypes : undefined,
      finalOnly: IndexState.finalOnly || undefined,
      minTotal: IndexState.minTotal,
      maxTotal: IndexState.maxTotal,
      search: IndexState.search || undefined,
      page: IndexState.page,
      limit: 30,
    });

    IndexState.total = result.total;
    document.getElementById('sprite-count').textContent = `共 ${result.total} 筆精靈`;

    if (reset) {
      renderSprites(result.data, true);
    } else {
      appendSprites(result.data);
    }

    if (result.page >= result.totalPages) {
      IndexState.hasMore = false;
    } else {
      IndexState.page++;
    }
  } catch (err) {
    console.error('Load sprites failed:', err);
    document.getElementById('sprite-count').textContent = `載入失敗：${err.message || '未知錯誤'}`;
  } finally {
    IndexState.loading = false;
    indicator.style.display = 'none';
  }
}

function resetAndLoad() {
  loadSprites(true);
}

// ── Render Sprites ──
function renderSprites(sprites, reset = true) {
  const container = document.getElementById('sprite-container');
  container._data = sprites;
  if (reset) container.innerHTML = '';

  const showHeader = IndexState.viewMode === 'list' && reset;
  if (showHeader) {
    const header = document.createElement('div');
    header.className = 'list-header';
    header.innerHTML = `
      <span>圖</span><span>名稱</span><span>屬性</span><span>總和</span>
      <span>體力</span><span>攻擊</span><span>防禦</span><span>特攻</span><span>特防</span><span>速度</span><span></span>
    `;
    container.appendChild(header);
  }

  for (const sprite of sprites) {
    const el = IndexState.viewMode === 'grid' ? createGridCard(sprite) : createListRow(sprite);
    container.appendChild(el);
  }
}

function appendSprites(sprites) {
  const container = document.getElementById('sprite-container');
  container._data = [...(container._data || []), ...sprites];
  for (const sprite of sprites) {
    const el = IndexState.viewMode === 'grid' ? createGridCard(sprite) : createListRow(sprite);
    container.appendChild(el);
  }
}

function createListRow(sprite) {
  const row = document.createElement('div');
  row.className = 'sprite-row';
  const types = Array.isArray(sprite.types) ? sprite.types : [];
  const isFav = IndexState.favoriteSprites.has(sprite.id);
  row.innerHTML = `
    <div class="sprite-thumb">${spriteEmoji(types, sprite.cn_id)}</div>
    <div><div class="sprite-name">${sprite.name_zh}</div><div class="sprite-id">#${sprite.cn_id}</div></div>
    <div class="types-cell">${types.map(typeBadgeHTML).join('')}</div>
    <div class="stat-cell total">${sprite.base_total || 0}</div>
    <div class="stat-cell">${sprite.base_hp ?? '-'}</div>
    <div class="stat-cell">${sprite.base_atk ?? '-'}</div>
    <div class="stat-cell">${sprite.base_def ?? '-'}</div>
    <div class="stat-cell">${sprite.base_spatk ?? '-'}</div>
    <div class="stat-cell">${sprite.base_spdef ?? '-'}</div>
    <div class="stat-cell">${sprite.base_speed ?? '-'}</div>
    <button class="fav-btn ${isFav ? 'favorited' : ''}" data-id="${sprite.id}" title="收藏">${isFav ? '♥' : '♡'}</button>
  `;
  row.addEventListener('click', e => {
    if (e.target.closest('.fav-btn')) return;
    openDetail(sprite.id);
  });
  row.querySelector('.fav-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleFavoriteQuick(sprite.id, e.currentTarget);
  });
  return row;
}

function createGridCard(sprite) {
  const card = document.createElement('div');
  card.className = 'sprite-card';
  const types = Array.isArray(sprite.types) ? sprite.types : [];
  const isFav = IndexState.favoriteSprites.has(sprite.id);

  card.innerHTML = `
    <div class="sprite-card-inner">
      <div class="sprite-card-front">
        <button class="card-fav ${isFav ? 'favorited' : ''}" data-id="${sprite.id}" title="收藏">${isFav ? '♥' : '♡'}</button>
        <div class="card-img">${spriteEmoji(types, sprite.cn_id)}</div>
        <div class="card-name">${sprite.name_zh}</div>
        <div class="card-id">#${sprite.cn_id}</div>
        <div class="card-types">${types.map(typeBadgeHTML).join('')}</div>
        <div class="card-total">種族值 ${sprite.base_total || 0}</div>
      </div>
      <div class="sprite-card-back">
        <div class="back-header">${sprite.name_zh} 種族值</div>
        ${['hp','atk','def','spatk','spdef','speed'].map(s => {
          const v = sprite[`base_${s}`] || 0;
          const pct = Math.min(v / 200 * 100, 100);
          return `<div class="stat-bar">
            <span class="stat-label">${STAT_LABELS[s]}</span>
            <div class="stat-track"><div class="stat-fill" style="width:${pct}%;background:${STAT_COLORS[s]}"></div></div>
            <span class="stat-value">${v}</span>
          </div>`;
        }).join('')}
        <div class="back-hint">點擊翻回正面</div>
      </div>
    </div>
  `;

  card.addEventListener('click', e => {
    if (e.target.closest('.card-fav')) return;
    card.classList.toggle('flipped');
  });

  card.querySelector('.card-fav').addEventListener('click', e => {
    e.stopPropagation();
    toggleFavoriteQuick(sprite.id, e.currentTarget);
  });

  return card;
}

// ── Favorite Quick Toggle ──
async function toggleFavoriteQuick(spriteId, btnEl) {
  try {
    const collections = await API.collections.list();
    if (collections.length === 0) {
      const col = await API.collections.create('我的最愛');
      await API.collections.addItem(col.id, spriteId);
      IndexState.favoriteSprites.add(spriteId);
      btnEl.classList.add('favorited');
      btnEl.textContent = '♥';
    } else {
      const colId = collections[0].id;
      const isFav = IndexState.favoriteSprites.has(spriteId);
      if (isFav) {
        await API.collections.removeItem(colId, spriteId);
        IndexState.favoriteSprites.delete(spriteId);
        btnEl.classList.remove('favorited');
        btnEl.textContent = '♡';
      } else {
        await API.collections.addItem(colId, spriteId);
        IndexState.favoriteSprites.add(spriteId);
        btnEl.classList.add('favorited');
        btnEl.textContent = '♥';
      }
    }
  } catch (err) {
    console.error('Toggle favorite failed:', err);
  }
}

// ── Infinite Scroll ──
function initInfiniteScroll() {
  const trigger = document.getElementById('load-more-trigger');
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !IndexState.loading && IndexState.hasMore) {
      loadSprites(false);
    }
  }, { rootMargin: '200px' });
  observer.observe(trigger);
}

// ── Detail Modal ──
function renderPetAdvance(adv) {
  const stats = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'];
  const statLabels = { hp: '體力', atk: '攻擊', def: '防禦', spatk: '特攻', spdef: '特防', speed: '速度' };

  const raceRows = stats.map(s => {
    const oldVal = adv[`old_race_${s}`];
    const newVal = adv[`new_race_${s}`];
    const diff = (oldVal != null && newVal != null) ? newVal - oldVal : null;
    const diffCls = diff > 0 ? 'diff-pos' : diff < 0 ? 'diff-neg' : '';
    const diffStr = diff !== null ? (diff > 0 ? `<span class="${diffCls}">+${diff}</span>` : diff < 0 ? `<span class="${diffCls}">${diff}</span>` : '-') : '-';
    return `<tr>
      <td>${statLabels[s]}</td>
      <td style="text-align:center">${oldVal ?? '-'}</td>
      <td style="text-align:center">${newVal ?? '-'}</td>
      <td style="text-align:center">${diffStr}</td>
    </tr>`;
  }).join('');

  const oldTotal = stats.reduce((s, k) => s + (adv[`old_race_${k}`] || 0), 0);
  const newTotal = stats.reduce((s, k) => s + (adv[`new_race_${k}`] || 0), 0);
  const totalDiff = newTotal - oldTotal;
  const totalDiffCls = totalDiff > 0 ? 'diff-pos' : totalDiff < 0 ? 'diff-neg' : '';

  const skillTags = (skills) => {
    if (!skills?.length) return '<span style="color:var(--text-muted)">—</span>';
    return skills.map(sk => `
      <span class="skill-tag">
        <span class="skill-name">${sk.name}</span>
        ${sk.power ? `<span class="skill-meta"> 威力${sk.power}</span>` : ''}
        ${sk.category ? `<span class="skill-meta"> ${sk.category}</span>` : ''}
      </span>
    `).join('');
  };

  const oldSeName = adv.old_se_id ? `魂印 #${adv.old_se_id}` : '—';
  const newSeName = adv.new_se_id ? `魂印 #${adv.new_se_id}` : '—';

  return `
    <div class="detail-section pet-advance-section">
      <h3>神諭進階 / 特訓</h3>
      <div class="pet-advance-card">
        <div class="pet-advance-desc">${adv.desc || ''}</div>
        <table class="pet-advance-table">
          <thead>
            <tr><th>能力</th><th style="text-align:center">進階前</th><th style="text-align:center">進階後</th><th style="text-align:center">變化</th></tr>
          </thead>
          <tbody>
            ${raceRows}
            <tr class="total-row">
              <td>總和</td>
              <td style="text-align:center">${oldTotal}</td>
              <td style="text-align:center">${newTotal}</td>
              <td style="text-align:center"><span class="${totalDiffCls}">${totalDiff > 0 ? '+' : ''}${totalDiff}</span></td>
            </tr>
          </tbody>
        </table>
        <div class="pet-advance-meta">魂印變化：<strong>${oldSeName}</strong> → <strong style="color:#f1c40f">${newSeName}</strong></div>
        ${adv.sp_skills?.length ? `<div class="pet-advance-meta">專屬技能：${skillTags(adv.sp_skills)}</div>` : ''}
        ${adv.extra_skills?.length ? `<div class="pet-advance-meta">額外技能：${skillTags(adv.extra_skills)}</div>` : ''}
        ${adv.adv_effect_desc ? `<div class="pet-advance-effect"><strong>進階效果：</strong><br>${adv.adv_effect_desc.replace(/\n/g, '<br>')}</div>` : ''}
      </div>
    </div>
  `;
}

function initDetailModal() {
  const modal = document.getElementById('detail-modal');
  modal.querySelector('.modal-overlay').addEventListener('click', closeDetail);
  modal.querySelector('.modal-close').addEventListener('click', closeDetail);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
}

async function openDetail(id) {
  const modal = document.getElementById('detail-modal');
  const body = document.getElementById('detail-body');
  modal.style.display = 'flex';
  body.innerHTML = '<div class="loading">載入中…</div>';

  try {
    const sprite = await API.sprites.get(id);
    const collections = await API.collections.list();
    const types = Array.isArray(sprite.types) ? sprite.types : [];
    const stats = ['hp','atk','def','spatk','spdef','speed'];

    body.innerHTML = `
      <div class="detail-header">
        <div class="detail-img">${spriteEmoji(types, sprite.cn_id)}</div>
        <div class="detail-info">
          <h2>${sprite.name_zh}</h2>
          <div class="detail-id">#${sprite.cn_id}${sprite.tw_id ? ` / TW#${sprite.tw_id}` : ''}</div>
          <div class="detail-types">${types.map(typeBadgeHTML).join('')}</div>
          ${sprite.gender ? `<div style="font-size:13px;color:var(--text-muted)">性別：${sprite.gender}</div>` : ''}
        </div>
      </div>

      ${(sprite.evolves_from || sprite.evolves_to) ? `
        <div class="detail-section">
          <h3>進化鏈</h3>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px">
            ${sprite.evolves_from ? `<a href="#" class="evo-link" data-id="${sprite.evolves_from}">${sprite.evolves_from_name || sprite.evolves_from}</a><span>→</span>` : ''}
            <strong>${sprite.name_zh}</strong>
            ${sprite.evolves_to ? `<span>→</span><a href="#" class="evo-link" data-id="${sprite.evolves_to}">${sprite.evolves_to_name || sprite.evolves_to}</a>` : ''}
            ${sprite.evolve_level ? `<span style="color:var(--text-muted);font-size:12px">(Lv.${sprite.evolve_level})</span>` : ''}
          </div>
        </div>
      ` : ''}

      <div class="stats-grid">
        <div class="stat-box total-stat">
          <div class="stat-label">種族值總和</div>
          <div class="stat-val">${sprite.base_total || 0}</div>
        </div>
        ${stats.map(s => `
          <div class="stat-box">
            <div class="stat-label">${STAT_LABELS[s]}</div>
            <div class="stat-val" style="color:${STAT_COLORS[s]}">${sprite[`base_${s}`] ?? '-'}</div>
          </div>
        `).join('')}
      </div>

      ${sprite.skills?.length ? `
        <div class="detail-section">
          <h3>技能列表</h3>
          <table class="skills-table">
            <thead><tr><th>技能名</th><th>威力</th><th>命中</th><th>PP</th><th>分類</th><th>標籤</th><th>效果</th></tr></thead>
            <tbody>
              ${sprite.skills.map(sk => `
                <tr class="${sk.is_signature ? 'signature' : ''}">
                  <td>${sk.name}${sk.is_signature ? ' ★' : ''}</td>
                  <td>${sk.power ?? '-'}</td>
                  <td>${sk.accuracy ?? '-'}</td>
                  <td>${sk.pp ?? '-'}</td>
                  <td>${sk.category || '-'}</td>
                  <td>${(sk.tags || []).map(t => `<span class="skill-tag-badge tag-${t.tag}">${t.tag}</span}`).join(' ') || '-'}</td>
                  <td>${sk.effect_desc || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${sprite.soul_seals?.length ? `
        <div class="detail-section soul-seal-section">
          <h3>專屬魂印</h3>
          ${sprite.soul_seals.map(ss => `
            <div class="soul-seal-card">
              ${ss.name_zh_tw ? `<div class="soul-seal-name">${ss.name_zh_tw}</div>` : ''}
              <div class="soul-seal-kinds">${renderSoulSealKinds(ss.kind)}</div>
              <div class="soul-seal-effect">${ss.effect_desc || '-'}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${sprite.exclusiveEngraving ? `
        <div class="detail-section engraving-section">
          <h3>專屬刻印</h3>
          <div class="engraving-card">
            <div class="engraving-header">
              <span class="engraving-name">${sprite.exclusiveEngraving.name}</span>
              <span class="engraving-type">${sprite.exclusiveEngraving.type || ''}</span>
              ${sprite.exclusiveEngraving.rarity ? `<span class="engraving-rarity">${sprite.exclusiveEngraving.rarity}</span>` : ''}
              ${sprite.exclusiveEngraving.series_name ? `<span class="engraving-series">${sprite.exclusiveEngraving.series_name}</span>` : ''}
            </div>
            ${sprite.exclusiveEngraving.description ? `<div class="engraving-desc">${sprite.exclusiveEngraving.description}</div>` : ''}
            <table class="engraving-stats">
              <tr><th></th><th>體力</th><th>攻擊</th><th>防禦</th><th>特攻</th><th>特防</th><th>速度</th></tr>
              <tr><td>初始</td>
                <td>${sprite.exclusiveEngraving.base_hp ?? '-'}</td>
                <td>${sprite.exclusiveEngraving.base_atk ?? '-'}</td>
                <td>${sprite.exclusiveEngraving.base_def ?? '-'}</td>
                <td>${sprite.exclusiveEngraving.base_spatk ?? '-'}</td>
                <td>${sprite.exclusiveEngraving.base_spdef ?? '-'}</td>
                <td>${sprite.exclusiveEngraving.base_speed ?? '-'}</td>
              </tr>
              <tr><td>隱藏</td>
                <td>${sprite.exclusiveEngraving.hidden_hp ?? '-'}</td>
                <td>${sprite.exclusiveEngraving.hidden_atk ?? '-'}</td>
                <td>${sprite.exclusiveEngraving.hidden_def ?? '-'}</td>
                <td>${sprite.exclusiveEngraving.hidden_spatk ?? '-'}</td>
                <td>${sprite.exclusiveEngraving.hidden_spdef ?? '-'}</td>
                <td>${sprite.exclusiveEngraving.hidden_speed ?? '-'}</td>
              </tr>
            </table>
            ${sprite.exclusiveEngraving.exclusive_skill ? `<div class="engraving-skill">專屬技能 ID: ${sprite.exclusiveEngraving.exclusive_skill}</div>` : ''}
          </div>
        </div>
      ` : ''}

      ${sprite.pet_advance ? renderPetAdvance(sprite.pet_advance) : ''}

      <div class="detail-section">
        <h3>收藏分類</h3>
        <div id="detail-collections" style="display:flex;gap:6px;flex-wrap:wrap">
          ${sprite.collections?.length
            ? sprite.collections.map(c => `<span class="type-badge" style="background:var(--accent)">${c.name}</span>`).join('')
            : '<span style="color:var(--text-muted);font-size:13px">尚未加入任何收藏分類</span>'
          }
        </div>
        <div class="detail-actions">
          ${collections.map(c => {
            const inCol = sprite.collections?.some(sc => sc.id === c.id);
            return `<button class="btn-small ${inCol ? 'btn-danger' : ''}" data-col-id="${c.id}" data-sprite-id="${sprite.id}">
              ${inCol ? `移除自「${c.name}」` : `加入「${c.name}」`}
            </button>`;
          }).join('')}
        </div>
      </div>
    `;

    body.querySelectorAll('.detail-actions .btn-small').forEach(btn => {
      btn.addEventListener('click', async () => {
        const colId = Number(btn.dataset.colId);
        const spriteId = Number(btn.dataset.spriteId);
        const inCol = btn.classList.contains('btn-danger');
        try {
          if (inCol) {
            await API.collections.removeItem(colId, spriteId);
            IndexState.favoriteSprites.delete(spriteId);
          } else {
            await API.collections.addItem(colId, spriteId);
            IndexState.favoriteSprites.add(spriteId);
          }
          openDetail(spriteId);
        } catch (err) {
          console.error('Toggle collection item failed:', err);
        }
      });
    });

    body.querySelectorAll('.evo-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        openDetail(Number(link.dataset.id));
      });
    });
  } catch (err) {
    body.innerHTML = `<div class="loading">載入失敗：${err.message}</div>`;
  }
}

function closeDetail() {
  document.getElementById('detail-modal').style.display = 'none';
}
