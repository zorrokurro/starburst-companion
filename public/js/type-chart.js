/**
 * type-chart.js — 屬性克制計算器模組 (IPC-Only)
 */
const TypeChart = (() => {
  let allSprites = [];
  let allTypes = [];
  let initialized = false;

  async function init() {
    if (initialized) return;
    initialized = true;

    const [sprites, types] = await Promise.all([
      API.invoke('db:sprites:all'),
      API.invoke('db:types:list'),
    ]);

    allSprites = sprites;
    allTypes = types;

    renderSpriteList();
    renderTypeSelects();

    document.getElementById('tc-spriteSearch').addEventListener('input', e => {
      renderSpriteList(e.target.value);
    });
  }

  function renderSpriteList(filter = '') {
    const list = document.getElementById('tc-spriteList');
    if (!list) return;
    const filtered = allSprites.filter(s =>
      s.name_zh.includes(filter) || String(s.cn_id).includes(filter)
    );

    list.innerHTML = filtered.map(s => `
      <div class="sprite-item" data-id="${s.id}">
        <div>
          <strong>${s.name_zh}</strong>
          <span style="color:var(--text-muted);margin-left:10px;">#${s.cn_id}</span>
        </div>
        <div>${s.types.map(t => typeBadgeHTML(t)).join('')}</div>
      </div>
    `).join('');

    list.querySelectorAll('.sprite-item').forEach(item => {
      item.addEventListener('click', () => selectSprite(Number(item.dataset.id)));
    });
  }

  function renderTypeSelects() {
    const type1 = document.getElementById('tc-type1');
    const type2 = document.getElementById('tc-type2');
    if (!type1 || !type2) return;

    allTypes.forEach(t => {
      type1.innerHTML += `<option value="${t}">${t}</option>`;
      type2.innerHTML += `<option value="${t}">${t}</option>`;
    });
  }

  async function selectSprite(id) {
    const sprite = await API.sprites.get(id);

    document.querySelectorAll('#tc-spriteList .sprite-item').forEach(el => {
      el.classList.toggle('selected', Number(el.dataset.id) === id);
    });

    calculateEffectiveness(sprite.types);

    const spriteDiv = document.getElementById('tc-selectedSprite');
    spriteDiv.innerHTML = `
      <div class="sprite-info">
        <h3>${sprite.name_zh}</h3>
        <div style="margin:5px 0;">${sprite.types.map(t => typeBadgeHTML(t)).join('')}</div>
        <div class="sprite-stats">
          HP: ${sprite.base_hp} | 攻擊: ${sprite.base_atk} | 防禦: ${sprite.base_def} |
          特攻: ${sprite.base_spatk} | 特防: ${sprite.base_spdef} | 速度: ${sprite.base_speed}
        </div>
      </div>
      <div>
        <a href="#team-sim" style="color:var(--accent);">加入隊伍模擬 →</a>
      </div>
    `;
    spriteDiv.style.display = 'flex';
    document.getElementById('tc-resultCard').style.display = 'block';
  }

  function calculateByType() {
    const type1 = document.getElementById('tc-type1').value;
    const type2 = document.getElementById('tc-type2').value;
    if (!type1) { alert('請選擇至少一個屬性'); return; }

    const types = type2 ? [type1, type2] : [type1];
    const spriteDiv = document.getElementById('tc-selectedSprite');
    spriteDiv.innerHTML = `
      <div class="sprite-info">
        <h3>自訂屬性組合</h3>
        <div style="margin:5px 0;">${types.map(t => typeBadgeHTML(t)).join('')}</div>
      </div>
    `;
    spriteDiv.style.display = 'flex';
    calculateEffectiveness(types);
    document.getElementById('tc-resultCard').style.display = 'block';
  }

  async function calculateEffectiveness(types) {
    const data = await API.invoke('db:calculate-effectiveness', {
      attackTypes: allTypes,
      defendTypes: types,
    });

    const { effectiveness } = data;

    renderEffectivenessList('tc-superEffective', effectiveness.superEffective);
    renderEffectivenessList('tc-notEffective', effectiveness.notEffective);
    renderEffectivenessList('tc-immune', effectiveness.immune);
    renderEffectivenessList('tc-normal', effectiveness.normal);
  }

  function renderEffectivenessList(elementId, items) {
    const div = document.getElementById(elementId);
    if (!div) return;
    if (items.length === 0) { div.innerHTML = '<span style="color:var(--text-muted);">（無）</span>'; return; }

    div.innerHTML = items.map(item => {
      const multiplierText = item.multiplier === 2 ? '×2' :
        item.multiplier === 0.5 ? '×0.5' :
        item.multiplier === 0 ? '×0' : `×${item.multiplier}`;
      return `<span class="type-badge type-${item.type}">${item.type}<span class="multiplier-badge">${multiplierText}</span></span>`;
    }).join('');
  }

  return { init, calculateByType };
})();
