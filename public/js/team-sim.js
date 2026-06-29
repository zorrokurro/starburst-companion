/**
 * team-sim.js — 隊伍模擬器模組
 * 從 team-sim.html 內聯 script 提取，適配 SPA 架構
 * 所有 DOM ID 已加 ts- 前綴避免衝突
 */
const TeamSim = (() => {
  let initialized = false;
  let allSprites = [];
  let myTeam = [null, null, null, null, null, null];
  let enemyTeam = [null, null, null, null, null, null];
  let currentSelector = null;
  let currentConfigSlot = null;
  let currentDamageAttackerIdx = 0;
  let currentDamageDefenderIdx = 0;
  let typeChart = {};
  let damageHistory = [];
  let textModalMode = 'export';

  const NATURE_OPTIONS = [
    { value: '', label: '勤奮（無修正）' },
    { value: '實幹', label: '實幹（無修正）' },
    { value: '坦率', label: '坦率（無修正）' },
    { value: '害羞', label: '害羞（無修正）' },
    { value: '浮躁', label: '浮躁（無修正）' },
    { value: '孤獨', label: '孤獨 +攻擊 -防禦' },
    { value: '勇敢', label: '勇敢 +攻擊 -速度' },
    { value: '固執', label: '固執 +攻擊 -特攻' },
    { value: '調皮', label: '調皮 +攻擊 -特防' },
    { value: '大膽', label: '大膽 +防禦 -攻擊' },
    { value: '頑皮', label: '頑皮 +防禦 -特攻' },
    { value: '無慮', label: '無慮 +防禦 -特防' },
    { value: '悠閒', label: '悠閒 +防禦 -速度' },
    { value: '保守', label: '保守 +特攻 -攻擊' },
    { value: '穩重', label: '穩重 +特攻 -防禦' },
    { value: '馬虎', label: '馬虎 +特攻 -特防' },
    { value: '冷靜', label: '冷靜 +特攻 -速度' },
    { value: '沉著', label: '沉著 +特防 -攻擊' },
    { value: '溫順', label: '溫順 +特防 -防禦' },
    { value: '慎重', label: '慎重 +特防 -特攻' },
    { value: '狂妄', label: '狂妄 +特防 -速度' },
    { value: '膽小', label: '膽小 +速度 -攻擊' },
    { value: '急躁', label: '急躁 +速度 -防禦' },
    { value: '天真', label: '天真 +速度 -特防' },
    { value: '開朗', label: '開朗 +速度 -特攻' },
  ];

  const STAT_KEYS = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'];

  const battleOptions = {
    critical: false, fixedDamage: 0, percentDamage: 0,
    attackerAtkRank: 0, attackerSpatkRank: 0,
    defenderDefRank: 0, defenderSpdefRank: 0,
    damageMultiplier: 0, damageReduction: 0,
    qiling: false, puni: false, emperor: false, supreme: false,
  };

  // ── Helpers ──

  function rankSelectOptions(selected) {
    const labels = ['-6','-5','-4','-3','-2','-1','0','+1','+2','+3','+4','+5','+6'];
    return labels.map((l, i) => `<option value="${i-6}" ${(i-6) === selected ? 'selected' : ''}>${l}</option>`).join('');
  }

  function defaultSpriteConfig() {
    return {
      level: 100,
      evs: { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 },
      nature: '',
      extraStats: { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 },
      selectedSkills: [],
      genericTraitId: null,
      traitStarLevel: 0,
      currentHp: null,
      abilityRanks: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 },
    };
  }

  function ensureSpriteConfig(sprite) {
    if (!sprite.ivs) sprite.ivs = { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 };
    if (!sprite.nature) sprite.nature = '';
    if (!sprite.extraStats) sprite.extraStats = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };
    if (!sprite.evs) sprite.evs = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };
    if (sprite.genericTraitId === undefined) sprite.genericTraitId = null;
    if (sprite.traitStarLevel === undefined) sprite.traitStarLevel = 0;
    if (sprite.currentHp === undefined) sprite.currentHp = null;
    if (!sprite.abilityRanks) sprite.abilityRanks = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };
    return sprite;
  }

  function $(id) { return document.getElementById(id); }

  function calculateMaxHp(sprite) {
    const base = sprite.base_hp || 0;
    const iv = sprite.ivs?.hp ?? 31;
    const ev = sprite.evs?.hp ?? 0;
    const level = sprite.level || 100;
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10 + (sprite.extraStats?.hp || 0);
  }

  // ── Init ──

  async function init() {
    if (initialized) return;
    initialized = true;

    allSprites = await API.invoke('db:sprites:all');

    await loadTypeChart();
    renderTeam('my');
    renderTeam('enemy');
    loadSavedTeams();
    loadProfiles();

    $('ts-modalSearch').addEventListener('input', e => renderModalSpriteList(e.target.value));
  }

  async function loadTypeChart() {
    Object.assign(typeChart, await API.invoke('db:type-chart-matrix'));
  }

  // ── Type Multiplier (client-side) ──

  function getSingleTypeLocal(a, d) {
    if (a === d) return 1;
    return typeChart[a]?.[d] ?? 1;
  }

  function calcDefLocal(a, ds) {
    if (ds.length === 1) return getSingleTypeLocal(a, ds[0]);
    const m1 = getSingleTypeLocal(a, ds[0]);
    const m2 = getSingleTypeLocal(a, ds[1]);
    if (m1 === 2 && m2 === 2) return 4;
    if (m1 === 0 || m2 === 0) return (m1 + m2) / 4;
    return (m1 + m2) / 2;
  }

  function calcTypeLocal(atks, defs) {
    if (atks.length === 1 && defs.length === 1) return getSingleTypeLocal(atks[0], defs[0]);
    if (atks.length === 1) return calcDefLocal(atks[0], defs);
    const m1 = calcDefLocal(atks[0], defs);
    const m2 = calcDefLocal(atks[1], defs);
    if (m1 === 2 && m2 === 2) return 4;
    if (m1 === 0 || m2 === 0) return (m1 + m2) / 4;
    return (m1 + m2) / 2;
  }

  // ── Team Rendering ──

  function renderTeam(side) {
    const team = side === 'my' ? myTeam : enemyTeam;
    const container = $(side === 'my' ? 'ts-myTeam' : 'ts-enemyTeam');
    if (!container) return;

    container.className = 'ts-team-grid';
    container.innerHTML = team.map((sprite, i) => {
      if (!sprite) {
        return `<div class="team-slot" onclick="TeamSim.openSpriteSelector('${side}')"><div class="add-hint">+ 點擊加入精靈</div></div>`;
      }
      ensureSpriteConfig(sprite);
      const hasCustomIvs = Object.values(sprite.ivs).some(v => v !== 31);
      const hasCustomEvs = Object.values(sprite.evs).some(v => v !== 0);
      const hasNature = sprite.nature !== '';
      const hasExtra = Object.values(sprite.extraStats).some(v => v !== 0);
      const hints = [];
      if (hasNature) hints.push(sprite.nature);
      if (hasCustomIvs) hints.push('IV自訂');
      if (hasCustomEvs) hints.push('EV自訂');
      if (hasExtra) hints.push('刻印');
      if (sprite.soul_seals?.length) hints.push(`魂印×${sprite.soul_seals.length}`);
      const hintStr = hints.length ? hints.join(' · ') : '';
      const evTotal = Object.values(sprite.evs).reduce((a, b) => a + b, 0);

      return `
        <div class="team-slot filled">
          <div class="sprite-name">${sprite.name_zh}</div>
          <div class="sprite-types">${(sprite.types || []).map(t => typeBadgeHTML(t)).join('')}</div>
          <div class="sprite-stats">Lv.${sprite.level || 100} · EV ${evTotal}/510</div>
          ${hintStr ? `<div class="sprite-config-hint">${hintStr}</div>` : ''}
          <button class="config-btn" onclick="TeamSim.openConfig('${side}', ${i})">設定</button>
          <button class="remove-btn" onclick="TeamSim.removeFromTeam('${side}', ${i})">移除</button>
        </div>`;
    }).join('');

    updateMatrix();
    if (side === 'my') renderRadar();
    showTacticCard();
  }

  function renderRadar() {
    const myF = myTeam.filter(s => s);
    const radarCard = $('ts-radarCard');
    if (!radarCard) return;
    if (myF.length < 2) { radarCard.style.display = 'none'; return; }
    radarCard.style.display = 'block';

    const allTypes = Object.keys(typeChart).sort();
    const numTypes = allTypes.length;
    if (numTypes === 0) return;

    const offensive = {};
    const defensive = {};
    for (const type of allTypes) {
      offensive[type] = 0;
      defensive[type] = 0;
      for (const sprite of myF) {
        const st = sprite.types || [];
        for (const t of st) {
          if (typeChart[t]?.[type] >= 2) { offensive[type]++; break; }
        }
        for (const t of st) {
          if (typeChart[type]?.[t] >= 2) { defensive[type]++; break; }
        }
      }
    }

    const cx = 200, cy = 200, maxR = 150;
    const angleStep = (2 * Math.PI) / numTypes;
    const maxVal = Math.max(1, ...Object.values(offensive), ...Object.values(defensive));

    function pt(i, val) {
      const a = i * angleStep - Math.PI / 2;
      const r = (val / maxVal) * maxR;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }

    function buildRadar(data, color, fillColor) {
      let s = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">`;
      for (let lv = 1; lv <= 4; lv++) {
        const r = (lv / 4) * maxR;
        let pts = [];
        for (let i = 0; i < numTypes; i++) {
          const a = i * angleStep - Math.PI / 2;
          pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
        }
        s += `<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
      }
      for (let i = 0; i < numTypes; i++) {
        const a = i * angleStep - Math.PI / 2;
        s += `<line x1="${cx}" y1="${cy}" x2="${cx + maxR * Math.cos(a)}" y2="${cy + maxR * Math.sin(a)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
        const lx = cx + (maxR + 18) * Math.cos(a);
        const ly = cy + (maxR + 18) * Math.sin(a);
        s += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="var(--text-muted)" font-size="9">${allTypes[i]}</text>`;
      }
      let pts = [];
      for (let i = 0; i < numTypes; i++) pts.push(pt(i, data[allTypes[i]]));
      s += `<polygon points="${pts.join(' ')}" fill="${fillColor}" stroke="${color}" stroke-width="2"/>`;
      for (let i = 0; i < numTypes; i++) {
        const p = pt(i, data[allTypes[i]]).split(',');
        s += `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="${color}"/>`;
      }
      s += `</svg>`;
      return s;
    }

    $('ts-radarOffense').innerHTML = buildRadar(offensive, '#4caf50', 'rgba(76,175,80,0.15)')
      + `<div class="radar-legend"><span style="color:#4caf50">● 進攻覆蓋（能克制該屬性）</span></div>`;
    $('ts-radarDefense').innerHTML = buildRadar(defensive, '#e05555', 'rgba(224,85,85,0.15)')
      + `<div class="radar-legend"><span style="color:#e05555">● 防禦弱點（被該屬性克制）</span></div>`;

    let warnings = [];
    for (const type of allTypes) {
      if (defensive[type] >= 3) warnings.push(type);
    }
    $('ts-weaknessWarnings').innerHTML = warnings.length === 0 ? ''
      : warnings.map(t => `<div class="weakness-warning">⚠️ 隊伍存在嚴重的【${t}】防禦盲點，缺乏聯防手段！</div>`).join('');
  }

  // ── Sprite Selector Modal ──

  function openSpriteSelector(side) {
    currentSelector = side;
    $('ts-spriteModal').classList.add('active');
    $('ts-modalSearch').value = '';
    renderModalSpriteList();
  }

  function renderModalSpriteList(filter = '') {
    const list = $('ts-modalSpriteList');
    if (!list) return;
    const filtered = allSprites.filter(s => s.name_zh.includes(filter) || s.cn_id.includes(filter));
    list.innerHTML = filtered.map(s => `
      <div class="sprite-item" onclick="TeamSim.selectSpriteFromModal(${s.id})">
        <div><strong>${s.name_zh}</strong> <span style="color:var(--text-muted);margin-left:10px;">#${s.cn_id}</span></div>
        <div>${(s.types || []).map(t => typeBadgeHTML(t)).join('')}</div>
      </div>
    `).join('');
  }

  async function selectSpriteFromModal(id) {
    const sprite = await API.sprites.get(id);
    Object.assign(sprite, defaultSpriteConfig());
    sprite.skills = sprite.skills || [];
    sprite.selectedSkills = sprite.skills.slice(0, 4);
    addToTeam(currentSelector, sprite);
    closeModal();
  }

  function addToTeam(side, sprite) {
    const team = side === 'my' ? myTeam : enemyTeam;
    const emptySlot = team.findIndex(s => s === null);
    if (emptySlot === -1) { alert('隊伍已滿（最多6隻）'); return; }
    team[emptySlot] = sprite;
    renderTeam(side);
  }

  function removeFromTeam(side, index) {
    (side === 'my' ? myTeam : enemyTeam)[index] = null;
    renderTeam(side);
  }

  // ── Config Modal ──

  function openConfig(side, index) {
    currentConfigSlot = { side, index };
    const sprite = (side === 'my' ? myTeam : enemyTeam)[index];
    ensureSpriteConfig(sprite);
    const evTotal = Object.values(sprite.evs).reduce((a, b) => a + b, 0);

    const natureOptions = NATURE_OPTIONS.map(o =>
      `<option value="${o.value}" ${sprite.nature === o.value ? 'selected' : ''}>${o.label}</option>`
    ).join('');

    const statInput = (key, prefix, val, max) => `
      <div class="config-field">
        <label>${STAT_LABELS[key]}</label>
        <input type="number" id="ts-${prefix}${key}" min="0" max="${max}" value="${val || 0}">
      </div>`;

    const ivSlider = (key, val) => `
      <div class="config-field">
        <label>${STAT_LABELS[key]}</label>
        <div class="range-row">
          <input type="range" id="ts-iv${key}" min="0" max="31" value="${val ?? 31}" oninput="document.getElementById('ts-iv${key}Val').textContent=this.value">
          <span class="range-val" id="ts-iv${key}Val">${val ?? 31}</span>
        </div>
      </div>`;

    $('ts-configContent').innerHTML = `
      <h4>${sprite.name_zh}</h4>
      <div class="config-grid">
        <div class="config-field">
          <label>等級</label>
          <input type="number" id="ts-configLevel" min="1" max="100" value="${sprite.level || 100}">
        </div>
        <div class="config-field">
          <label>性格</label>
          <select id="ts-configNature">${natureOptions}</select>
        </div>
      </div>
      <h4 style="margin-top:15px;">學習力（EVs）<span style="font-size:12px;color:var(--text-muted);font-weight:normal" id="ts-evTotalDisplay">總計 ${evTotal}/510</span></h4>
      <div class="ev-preset-row">
        <button class="ev-preset-btn" onclick="TeamSim.applyEvPreset('atk-speed')">攻速 255</button>
        <button class="ev-preset-btn" onclick="TeamSim.applyEvPreset('spatk-speed')">特攻速 255</button>
        <button class="ev-preset-btn" onclick="TeamSim.applyEvPreset('atk-hp')">攻體 255</button>
        <button class="ev-preset-btn" onclick="TeamSim.applyEvPreset('spatk-hp')">特攻體 255</button>
        <button class="ev-preset-btn ev-preset-clear" onclick="TeamSim.applyEvPreset('clear')">清空</button>
      </div>
      <div class="config-grid">
        ${STAT_KEYS.map(k => statInput(k, 'ev', sprite.evs[k], 255)).join('')}
      </div>
      <div class="collapse-toggle" onclick="TeamSim.toggleCollapse(this)">
        <span class="arrow">▶</span> 個體值（IVs）— 點擊展開
      </div>
      <div class="collapse-body">
        <div class="config-grid">
          ${STAT_KEYS.map(k => ivSlider(k, sprite.ivs[k])).join('')}
        </div>
      </div>
      <div class="collapse-toggle" onclick="TeamSim.toggleCollapse(this)">
        <span class="arrow">▶</span> 刻印額外能力（Extra Stats）— 點擊展開
      </div>
      <div class="collapse-body">
        <div class="config-grid">
          ${STAT_KEYS.map(k => statInput(k, 'extra', sprite.extraStats[k], 999)).join('')}
        </div>
      </div>
      <h4 style="margin-top:15px;">技能選擇</h4>
      <div id="ts-skillSelection">
        ${(sprite.skills || []).map((skill, i) => `
          <label style="display:block;padding:5px;cursor:pointer;">
            <input type="checkbox" class="ts-skill-checkbox" value="${i}" ${sprite.selectedSkills?.some(s => s.id === skill.id) ? 'checked' : ''}>
            ${skill.name} (${skill.category || '未知'}) — 威力: ${skill.power || 0} ${skill.type || ''}${skill.priority ? ` [先制${skill.priority > 0 ? '+' : ''}${skill.priority}]` : ''} ${(skill.tags || []).map(t => `<span class="skill-tag-badge tag-${t.tag}">${t.tag}</span>`).join(' ')}
          </label>
        `).join('')}
      </div>
      ${(sprite.soul_seals && sprite.soul_seals.length > 0) ? `
        <h4 style="margin-top:15px;">魂印</h4>
        <div class="soul-seal-list">
          ${sprite.soul_seals.map(ss => `
            <div class="soul-seal-item">
              ${ss.name_zh_tw ? `<div class="soul-seal-name">${ss.name_zh_tw}</div>` : ''}
              <div class="soul-seal-kinds">${renderSoulSealKinds(ss.kind)}</div>
              <div class="soul-seal-effect">${ss.effect_desc || '—'}</div>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:8px;"><a href="https://github.com/layja/seer-data/issues/new?labels=soul-seal&title=%E9%AD%82%E5%8D%B0%E6%A8%99%E9%A1%8C%E9%8C%AF%E8%AA%A4&template=soul-seal-report.md" target="_blank" rel="noopener" style="color:#666;font-size:12px;text-decoration:none;">發現魂印標籤錯誤？點此回報</a></div>
      ` : '<div style="margin-top:15px;color:var(--text-muted);font-size:13px;">此精靈無魂印資料</div>'}
      ${sprite.exclusiveEngraving ? `
        <div style="margin-top:12px;padding:8px 12px;background:var(--bg-secondary);border-radius:6px;font-size:13px;">
          此精靈有專屬刻印：<strong>${sprite.exclusiveEngraving.name}</strong>（${sprite.exclusiveEngraving.type || ''}）
          — 體${sprite.exclusiveEngraving.base_hp ?? 0} 攻${sprite.exclusiveEngraving.base_atk ?? 0} 防${sprite.exclusiveEngraving.base_def ?? 0} 特攻${sprite.exclusiveEngraving.base_spatk ?? 0} 特防${sprite.exclusiveEngraving.base_spdef ?? 0} 速${sprite.exclusiveEngraving.base_speed ?? 0}
        </div>
      ` : ''}
      <div style="margin-top:12px;">
        <label style="font-size:13px;font-weight:600;">搜尋刻印</label>
        <input type="text" id="ts-engravingSearch" placeholder="輸入刻印名稱搜尋..." style="width:100%;margin-top:4px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;">
        <div id="ts-engravingResults" style="max-height:200px;overflow-y:auto;margin-top:4px;"></div>
      </div>
      <div style="margin-top:15px;padding:10px 12px;background:var(--bg-secondary);border-radius:6px;">
        <h4 style="margin:0 0 8px 0;">通用特性</h4>
        <div class="config-grid">
          <div class="config-field">
            <label>特性</label>
            <select id="ts-configTrait" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;">
              <option value="">無</option>
            </select>
          </div>
          <div class="config-field">
            <label>星級</label>
            <select id="ts-configTraitStar" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;">
              <option value="0">★☆☆☆☆☆（0星）</option>
              <option value="1">★☆☆☆☆☆（1星）</option>
              <option value="2">★★☆☆☆☆（2星）</option>
              <option value="3">★★★☆☆☆（3星）</option>
              <option value="4">★★★★☆☆（4星）</option>
              <option value="5">★★★★★☆（5星）</option>
            </select>
          </div>
        </div>
        <div id="ts-traitDesc" style="font-size:12px;color:var(--text-muted);margin-top:6px;min-height:18px;"></div>
      </div>
      <div style="margin-top:15px;padding:10px 12px;background:var(--bg-secondary);border-radius:6px;">
        <h4 style="margin:0 0 8px 0;">戰鬥狀態</h4>
        <div class="config-grid">
          <div class="config-field" style="grid-column:1/-1;">
            <label>當前體力</label>
            <input type="number" id="ts-configCurrentHp" min="0" placeholder="留空=滿血（${calculateMaxHp(sprite)}）" style="width:100%;">
          </div>
        </div>
        <div class="config-grid" style="grid-template-columns:1fr 1fr;">
          <div class="config-field">
            <label>攻擊等級</label>
            <select id="ts-configAtkRank" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;">${rankSelectOptions(sprite.abilityRanks?.atk || 0)}</select>
          </div>
          <div class="config-field">
            <label>防禦等級</label>
            <select id="ts-configDefRank" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;">${rankSelectOptions(sprite.abilityRanks?.def || 0)}</select>
          </div>
          <div class="config-field">
            <label>特攻等級</label>
            <select id="ts-configSpatkRank" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;">${rankSelectOptions(sprite.abilityRanks?.spatk || 0)}</select>
          </div>
          <div class="config-field">
            <label>特防等級</label>
            <select id="ts-configSpdefRank" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;">${rankSelectOptions(sprite.abilityRanks?.spdef || 0)}</select>
          </div>
          <div class="config-field" style="grid-column:1/-1;">
            <label>速度等級</label>
            <select id="ts-configSpeedRank" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;">${rankSelectOptions(sprite.abilityRanks?.speed || 0)}</select>
          </div>
        </div>
      </div>
      <div class="btn-group">
        <button onclick="TeamSim.saveConfig()">儲存設定</button>
        <button class="btn-secondary" onclick="TeamSim.closeConfigModal()">取消</button>
      </div>
    `;

    STAT_KEYS.forEach(k => {
      const el = $(`ts-ev${k}`);
      if (el) el.addEventListener('input', updateEvTotal);
    });

    // Engraving search
    const searchInput = $('ts-engravingSearch');
    const resultsDiv = $('ts-engravingResults');
    let searchTimeout = null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (q.length < 1) { resultsDiv.innerHTML = ''; return; }
        searchTimeout = setTimeout(async () => {
          try {
            const data = await API.invoke('db:engravings:search', { search: q, limit: 10 });
            if (!data.rows?.length) { resultsDiv.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:4px;">無結果</div>'; return; }
            resultsDiv.innerHTML = data.rows.map(e => `
              <div style="padding:6px 8px;border:1px solid var(--border);border-radius:4px;margin-bottom:4px;font-size:12px;cursor:pointer;" class="engraving-result-item"
                data-name="${e.name}" data-type="${e.type||''}" data-series="${e.series_name||''}" data-rarity="${e.rarity||''}"
                data-hp="${e.base_hp??0}" data-atk="${e.base_atk??0}" data-def="${e.base_def??0}" data-spatk="${e.base_spatk??0}" data-spdef="${e.base_spdef??0}" data-speed="${e.base_speed??0}"
                data-hh="${e.hidden_hp??0}" data-ha="${e.hidden_atk??0}" data-hd="${e.hidden_def??0}" data-hs="${e.hidden_spatk??0}" data-hsp="${e.hidden_spdef??0}" data-hsd="${e.hidden_speed??0}">
                <strong>${e.name}</strong> <span style="color:var(--text-muted)">${e.type||''} ${e.rarity||''}</span><br>
                體${e.base_hp??0} 攻${e.base_atk??0} 防${e.base_def??0} 特攻${e.base_spatk??0} 特防${e.base_spdef??0} 速${e.base_speed??0}
                ${(e.hidden_hp||e.hidden_atk||e.hidden_def||e.hidden_spatk||e.hidden_spdef||e.hidden_speed) ? `<br><span style="color:var(--accent)">隱藏: 體${e.hidden_hp??0} 攻${e.hidden_atk??0} 防${e.hidden_def??0} 特攻${e.hidden_spatk??0} 特防${e.hidden_spdef??0} 速${e.hidden_speed??0}</span>` : ''}
              </div>
            `).join('');
            resultsDiv.querySelectorAll('.engraving-result-item').forEach(item => {
              item.addEventListener('click', () => {
                const info = `已選擇: ${item.dataset.name}（${item.dataset.type}）— 體${item.dataset.hp} 攻${item.dataset.atk} 防${item.dataset.def} 特攻${item.dataset.spatk} 特防${item.dataset.spdef} 速${item.dataset.speed}`;
                resultsDiv.innerHTML = `<div style="padding:6px 8px;background:var(--bg-secondary);border-radius:4px;font-size:12px;">${info}</div>`;
              });
            });
          } catch (err) { console.error('Engraving search error:', err); }
        }, 300);
      });
    }

    // Generic Trait dropdown
    const traitSelect = $('ts-configTrait');
    const traitStarSelect = $('ts-configTraitStar');
    const traitDesc = $('ts-traitDesc');
    if (traitSelect) {
      const renderTraitSelect = () => {
        if (!_traitCache) return;
        const categories = {};
        _traitCache.forEach(t => {
          if (!categories[t.category]) categories[t.category] = [];
          categories[t.category].push(t);
        });
        let opts = '<option value="">無</option>';
        for (const [cat, list] of Object.entries(categories)) {
          opts += `<optgroup label="${cat}">`;
          for (const t of list) {
            const vals = JSON.parse(t.custom_values || '[]');
            const valStr = vals.map((v, i) => v !== null ? `${i}★:${v}%` : `${i}★:—`).join(' ');
            opts += `<option value="${t.id}" title="${valStr}">${t.name}</option>`;
          }
          opts += '</optgroup>';
        }
        traitSelect.innerHTML = opts;
        traitSelect.value = sprite.genericTraitId || '';
        traitStarSelect.value = sprite.traitStarLevel || 0;
        updateTraitDesc(traitSelect.value, traitStarSelect.value);
      };

      if (!_traitCache) {
        API.genericTraits.getAll().then(traits => {
          _traitCache = traits;
          renderTraitSelect();
        });
      } else {
        renderTraitSelect();
      }

      traitSelect.addEventListener('change', () => {
        updateTraitDesc(traitSelect.value, traitStarSelect.value);
      });
      traitStarSelect.addEventListener('change', () => {
        updateTraitDesc(traitSelect.value, traitStarSelect.value);
      });
    }

    $('ts-configModal').classList.add('active');
  }

  function updateEvTotal() {
    let total = 0;
    STAT_KEYS.forEach(k => { total += parseInt($(`ts-ev${k}`)?.value) || 0; });
    const display = $('ts-evTotalDisplay');
    if (display) {
      display.textContent = `總計 ${total}/510`;
      display.style.color = total > 510 ? '#e74c3c' : 'var(--text-muted)';
    }
  }

  function applyEvPreset(type) {
    const presets = {
      'atk-speed':   { hp: 0, atk: 255, def: 0, spatk: 0, spdef: 0, speed: 255 },
      'spatk-speed': { hp: 0, atk: 0, def: 0, spatk: 255, spdef: 0, speed: 255 },
      'atk-hp':      { hp: 255, atk: 255, def: 0, spatk: 0, spdef: 0, speed: 0 },
      'spatk-hp':    { hp: 255, atk: 0, def: 0, spatk: 255, spdef: 0, speed: 0 },
      'clear':       { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 },
    };
    const ev = presets[type];
    if (!ev) return;
    STAT_KEYS.forEach(k => {
      const el = $(`ts-ev${k}`);
      if (el) el.value = ev[k];
    });
    updateEvTotal();
  }

  function toggleCollapse(el) {
    el.classList.toggle('open');
    el.nextElementSibling.classList.toggle('open');
  }

  let _traitCache = null;
  function updateTraitDesc(traitId, starLevel) {
    const descEl = $('ts-traitDesc');
    if (!descEl) return;
    if (!traitId) { descEl.textContent = ''; return; }
    if (!_traitCache) { descEl.textContent = ''; return; }
    const trait = _traitCache.find(t => t.id === parseInt(traitId));
    if (!trait) { descEl.textContent = ''; return; }
    const vals = JSON.parse(trait.custom_values || '[]');
    const val = vals[parseInt(starLevel)];
    const desc = trait.description_template.replace('{value}', val !== null ? val : '??');
    descEl.textContent = (val !== null ? desc : desc + '（數值缺失）') + (trait.note ? ` [備註]` : '');
  }

  function saveConfig() {
    const { side, index } = currentConfigSlot;
    const sprite = (side === 'my' ? myTeam : enemyTeam)[index];

    sprite.level = parseInt($('ts-configLevel').value) || 100;
    sprite.nature = $('ts-configNature').value;
    sprite.evs = {}; sprite.ivs = {}; sprite.extraStats = {};
    STAT_KEYS.forEach(k => {
      sprite.evs[k] = parseInt($(`ts-ev${k}`)?.value) || 0;
      sprite.ivs[k] = parseInt($(`ts-iv${k}`)?.value) ?? 31;
      sprite.extraStats[k] = parseInt($(`ts-extra${k}`)?.value) || 0;
    });

    const checkboxes = document.querySelectorAll('.ts-skill-checkbox:checked');
    sprite.selectedSkills = Array.from(checkboxes).map(cb => sprite.skills[parseInt(cb.value)]);

    const traitVal = $('ts-configTrait')?.value;
    sprite.genericTraitId = traitVal ? parseInt(traitVal) : null;
    sprite.traitStarLevel = parseInt($('ts-configTraitStar')?.value) || 0;

    const hpVal = $('ts-configCurrentHp')?.value;
    sprite.currentHp = hpVal !== '' && hpVal != null ? parseInt(hpVal) || null : null;
    sprite.abilityRanks = {
      atk: parseInt($('ts-configAtkRank')?.value) || 0,
      def: parseInt($('ts-configDefRank')?.value) || 0,
      spatk: parseInt($('ts-configSpatkRank')?.value) || 0,
      spdef: parseInt($('ts-configSpdefRank')?.value) || 0,
      speed: parseInt($('ts-configSpeedRank')?.value) || 0,
    };

    renderTeam(side);
    closeConfigModal();
  }

  // ── Matrix ──

  function updateMatrix() {
    const hasMy = myTeam.some(s => s !== null);
    const hasEnemy = enemyTeam.some(s => s !== null);
    if (!hasMy || !hasEnemy) { $('ts-matrixCard').style.display = 'none'; return; }
    $('ts-matrixCard').style.display = 'block';
    const matrix = [];
    for (const a of myTeam.filter(s => s)) {
      const row = [];
      for (const d of enemyTeam.filter(s => s)) {
        row.push(calcTypeLocal(a.types || [], d.types || []));
      }
      matrix.push(row);
    }
    renderMatrix(matrix);
  }

  function renderMatrix(matrix) {
    const table = $('ts-matchupMatrix');
    if (!table) return;
    const myF = myTeam.filter(s => s);
    const enF = enemyTeam.filter(s => s);
    let html = '<thead><tr><th>己方 \\ 對手</th>';
    enF.forEach(s => { html += `<th>${s.name_zh}<br>${(s.types||[]).map(t => typeBadgeHTML(t)).join('')}</th>`; });
    html += '</tr></thead><tbody>';
    matrix.forEach((row, i) => {
      const a = myF[i];
      html += `<tr><th>${a.name_zh}<br>${(a.types||[]).map(t => typeBadgeHTML(t)).join('')}</th>`;
      row.forEach((m) => {
        const cls = m >= 4 ? 'matrix-4x' : m >= 2 ? 'matrix-2x' : m > 1 ? 'matrix-1x' : m >= 0.5 ? 'matrix-0_5x' : m > 0 ? 'matrix-0_25x' : 'matrix-0x';
        html += `<td class="matrix-cell ${cls}" onclick="TeamSim.showDamageDetail(${i},${row.indexOf(m)})">${m}x</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
    table.innerHTML = html;
  }

  // ── Damage Detail ──

  async function showDamageDetail(attackerIndex, defenderIndex) {
    currentDamageAttackerIdx = attackerIndex;
    currentDamageDefenderIdx = defenderIndex;
    const attacker = myTeam.filter(s => s)[attackerIndex];
    const defender = enemyTeam.filter(s => s)[defenderIndex];
    ensureSpriteConfig(attacker);
    ensureSpriteConfig(defender);

    battleOptions.attackerAtkRank = attacker.abilityRanks?.atk || 0;
    battleOptions.attackerSpatkRank = attacker.abilityRanks?.spatk || 0;
    battleOptions.defenderDefRank = defender.abilityRanks?.def || 0;
    battleOptions.defenderSpdefRank = defender.abilityRanks?.spdef || 0;

    $('ts-damageContent').innerHTML = `
      <div style="margin-bottom:10px;">
        <strong>${attacker.name_zh}</strong> (${(attacker.types||[]).join('/')}) vs <strong>${defender.name_zh}</strong> (${(defender.types||[]).join('/')})
      </div>
      <div class="battle-options">
        <label><input type="checkbox" id="ts-optCrit" ${battleOptions.critical ? 'checked' : ''}> 必定暴擊</label>
        <div class="opt-group"><span class="opt-label">固定傷害</span><input type="number" id="ts-optFixed" min="0" value="${battleOptions.fixedDamage}"></div>
        <div class="opt-group"><span class="opt-label">百分比斬殺</span><input type="number" id="ts-optPercent" min="0" max="100" step="0.1" value="${battleOptions.percentDamage}">%</div>
      </div>
      <div class="battle-options" style="border-color:rgba(241,196,15,0.2);">
        <div class="opt-group"><span class="opt-label">攻擊方物攻等級</span><select id="ts-optAtkRank">${rankSelectOptions(battleOptions.attackerAtkRank)}</select></div>
        <div class="opt-group"><span class="opt-label">攻擊方特攻等級</span><select id="ts-optSpatkRank">${rankSelectOptions(battleOptions.attackerSpatkRank)}</select></div>
        <div class="opt-group"><span class="opt-label">防禦方物防等級</span><select id="ts-optDefRank">${rankSelectOptions(battleOptions.defenderDefRank)}</select></div>
        <div class="opt-group"><span class="opt-label">防禦方特防等級</span><select id="ts-optSpdefRank">${rankSelectOptions(battleOptions.defenderSpdefRank)}</select></div>
      </div>
      <div class="battle-options" style="border-color:rgba(39,174,96,0.2);">
        <div class="opt-group"><span class="opt-label">魂印/技能增傷</span><input type="number" id="ts-optDmgMul" min="0" max="500" step="1" value="${battleOptions.damageMultiplier}">%</div>
        <div class="opt-group"><span class="opt-label">魂印/技能減傷</span><input type="number" id="ts-optDmgRed" min="0" max="100" step="1" value="${battleOptions.damageReduction}">%</div>
        <span style="font-size:11px;color:var(--text-muted);">增傷=100%為無修正，減傷=0%為無修正</span>
      </div>
      <div class="battle-options meta-check-group" style="border-color:rgba(139,92,246,0.25);">
        <span class="meta-check-label">快速環境配置</span>
        <label><input type="checkbox" id="ts-optQiling" ${battleOptions.qiling ? 'checked' : ''}> 啟靈元神魂印 (固定減傷 30%)</label>
        <label><input type="checkbox" id="ts-optPuni" ${battleOptions.puni ? 'checked' : ''}> 聖靈譜尼魂印 (免控增傷 20%)</label>
        <label><input type="checkbox" id="ts-optEmperor" ${battleOptions.emperor ? 'checked' : ''}> 皇帝套裝 (傷害提升 15%)</label>
        <label><input type="checkbox" id="ts-optSupreme" ${battleOptions.supreme ? 'checked' : ''}> 至尊套裝 (傷害提升 12%)</label>
      </div>
      <div id="ts-damageResults"><div style="color:var(--text-muted);padding:10px;">計算中...</div></div>
    `;
    $('ts-damageDetail').classList.add('active');

    const bind = (id, key, opts = {}) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener(opts.event || 'change', e => {
        battleOptions[key] = opts.parse ? opts.parse(e.target) : e.target.value;
        runDamageCalc();
      });
    };
    bind('ts-optCrit', 'critical', { event: 'change', parse: e => e.target.checked });
    bind('ts-optFixed', 'fixedDamage', { event: 'input', parse: e => parseFloat(e.target.value) || 0 });
    bind('ts-optPercent', 'percentDamage', { event: 'input', parse: e => parseFloat(e.target.value) || 0 });
    bind('ts-optAtkRank', 'attackerAtkRank', { parse: e => parseInt(e.target.value) });
    bind('ts-optSpatkRank', 'attackerSpatkRank', { parse: e => parseInt(e.target.value) });
    bind('ts-optDefRank', 'defenderDefRank', { parse: e => parseInt(e.target.value) });
    bind('ts-optSpdefRank', 'defenderSpdefRank', { parse: e => parseInt(e.target.value) });
    bind('ts-optDmgMul', 'damageMultiplier', { event: 'input', parse: e => parseFloat(e.target.value) || 0 });
    bind('ts-optDmgRed', 'damageReduction', { event: 'input', parse: e => parseFloat(e.target.value) || 0 });
    bind('ts-optQiling', 'qiling', { event: 'change', parse: e => e.target.checked });
    bind('ts-optPuni', 'puni', { event: 'change', parse: e => e.target.checked });
    bind('ts-optEmperor', 'emperor', { event: 'change', parse: e => e.target.checked });
    bind('ts-optSupreme', 'supreme', { event: 'change', parse: e => e.target.checked });

    runDamageCalc();
  }

  async function runDamageCalc() {
    const attacker = myTeam.filter(s => s)[currentDamageAttackerIdx];
    const defender = enemyTeam.filter(s => s)[currentDamageDefenderIdx];
    if (!attacker || !defender) return;

    // 合併環境套裝/魂印效果到增減傷
    let effectiveDmgMul = battleOptions.damageMultiplier;
    let effectiveDmgRed = battleOptions.damageReduction;
    if (battleOptions.qiling) effectiveDmgRed += 30;
    if (battleOptions.puni) effectiveDmgMul += 20;
    if (battleOptions.emperor) effectiveDmgMul += 15;
    if (battleOptions.supreme) effectiveDmgMul += 12;

    const payload = {
      attacker: { types: attacker.types, base_hp: attacker.base_hp, base_atk: attacker.base_atk, base_def: attacker.base_def, base_spatk: attacker.base_spatk, base_spdef: attacker.base_spdef, base_speed: attacker.base_speed },
      defender: { types: defender.types, base_hp: defender.base_hp, base_atk: defender.base_atk, base_def: defender.base_def, base_spatk: defender.base_spatk, base_spdef: defender.base_spdef, base_speed: defender.base_speed },
      skills: attacker.selectedSkills || attacker.skills || [],
      params: {
        attackerLevel: attacker.level || 100,
        defenderLevel: defender.level || 100,
        attackerIVs: attacker.ivs,
        defenderIVs: defender.ivs,
        attackerEVs: attacker.evs,
        defenderEVs: defender.evs,
        attackerNature: attacker.nature || null,
        defenderNature: defender.nature || null,
        attackerExtraStats: attacker.extraStats,
        defenderExtraStats: defender.extraStats,
        attackerRanks: {
          atk: battleOptions.attackerAtkRank,
          spatk: battleOptions.attackerSpatkRank,
          speed: attacker.abilityRanks?.speed || 0,
        },
        defenderRanks: {
          def: battleOptions.defenderDefRank,
          spdef: battleOptions.defenderSpdefRank,
          speed: defender.abilityRanks?.speed || 0,
        },
        attackerTraits: attacker.genericTraitId ? { traitId: attacker.genericTraitId, starLevel: attacker.traitStarLevel || 0 } : null,
        defenderTraits: defender.genericTraitId ? { traitId: defender.genericTraitId, starLevel: defender.traitStarLevel || 0 } : null,
        options: {
          critical: battleOptions.critical,
          fixedDamage: battleOptions.fixedDamage,
          percentDamage: battleOptions.percentDamage / 100,
          damageMultiplier: 1 + effectiveDmgMul / 100,
          damageReduction: 1 - effectiveDmgRed / 100,
        },
      },
    };

    try {
      const results = await API.invoke('db:calculate-damage', payload);
      renderDamageResults(results, attacker, defender);
    } catch (err) {
      $('ts-damageResults').innerHTML = `<div style="color:var(--danger);">計算失敗: ${err.message}</div>`;
    }
  }

  function renderDamageResults(results, attacker, defender) {
    const container = $('ts-damageResults');
    const statChip = (label, val) => `<span class="stat-chip">${label} <span class="sv">${val}</span></span>`;
    const aStats = results[0]?.attackerStats;
    const dStats = results[0]?.defenderStats;

    let statsHtml = '';
    let speedHtml = '';
    if (aStats && dStats) {
      statsHtml = `
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">
          ${attacker.name_zh} 實際能力值：${statChip('體力', aStats.hp)} ${statChip('攻擊', aStats.atk)} ${statChip('防禦', aStats.def)} ${statChip('特攻', aStats.spatk)} ${statChip('特防', aStats.spdef)} ${statChip('速度', aStats.speed)}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
          ${defender.name_zh} 實際能力值：${statChip('體力', dStats.hp)} ${statChip('攻擊', dStats.atk)} ${statChip('防禦', dStats.def)} ${statChip('特攻', dStats.spatk)} ${statChip('特防', dStats.spdef)} ${statChip('速度', dStats.speed)}
        </div>`;

      // 速度線對比
      const spdDiff = aStats.speed - dStats.speed;
      const spdSign = spdDiff > 0 ? '+' : '';
      const spdColor = spdDiff > 0 ? 'var(--danger)' : spdDiff < 0 ? 'var(--accent)' : 'var(--text-muted)';
      const spdLabel = spdDiff > 0 ? '攻擊方超速' : spdDiff < 0 ? '防禦方超速' : '同速';
      speedHtml = `
        <div class="speed-line-bar">
          <span class="speed-line-label">[系統提示] 攻擊方最終速度：${aStats.speed} | 防禦方最終速度：${dStats.speed}</span>
          <span class="speed-line-diff" style="color:${spdColor}">(${spdLabel} ${spdSign}${spdDiff})</span>
        </div>`;
    }

    container.innerHTML = `
      ${statsHtml}${speedHtml}
      ${results.map(r => {
        const pctAvg = parseFloat(r.hpPercentage?.avg || 0);
        const cls = pctAvg >= 50 ? 'damage-high' : pctAvg >= 25 ? 'damage-mid' : 'damage-low';
        const detail = r.damage.details || {};
        let extra = '';
        if (detail.critical) extra += ' 暴擊×' + detail.criticalMultiplier;
        if (r.percentDamage) extra += ` 斬殺${r.percentDamage.percent}%`;
        if (detail.fixedDamage > 0) extra += ` 固傷${detail.fixedDamage}`;
        return `
          <div class="skill-row">
            <div>
              <div class="skill-name">${r.skill.name}</div>
              <div class="skill-power">${r.skill.category || ''} | 威力: ${r.skill.power || 0} | ${r.skill.type || ''}${extra ? ' |' + extra : ''}</div>
            </div>
            <div class="damage-value">
              <span class="${cls}">${r.damage.min} ~ ${r.damage.max}</span>
              <div style="font-size:11px;color:var(--text-muted);">平均 ${r.damage.avg}（約${r.hpPercentage.avg}%體力）</div>
              ${r.ohko ? `<div class="ohko-badge ohko-${r.ohko.status}">${r.ohko.label}</div>` : ''}
            </div>
          </div>`;
      }).join('')}
    `;

    // Push to damage history (FIFO, max 5)
    if (results.length > 0) {
      const record = {
        attacker: attacker.name_zh,
        attackerConfig: `Lv.${attacker.level || 100} ${attacker.nature || '無性格'} EV(${Object.values(attacker.evs).join('/')})`,
        defender: defender.name_zh,
        defenderConfig: `Lv.${defender.level || 100} ${defender.nature || '無性格'} EV(${Object.values(defender.evs).join('/')})`,
        skills: results.map(r => ({
          name: r.skill.name,
          range: `${r.damage.min} ~ ${r.damage.max}`,
          avg: r.damage.avg,
          pct: r.hpPercentage?.avg || 0,
        })),
      };
      damageHistory.push(record);
      if (damageHistory.length > 5) damageHistory.shift();
      renderDamageHistory();
    }
  }

  function renderDamageHistory() {
    const panel = $('ts-damage-history');
    const list = $('ts-historyList');
    if (!panel || !list) return;
    if (damageHistory.length === 0) {
      panel.classList.remove('active');
      return;
    }
    panel.classList.add('active');
    list.innerHTML = damageHistory.map((rec, i) => `
      <div class="ts-history-item">
        <div class="hist-header">#${i + 1} ${rec.attacker} → ${rec.defender}</div>
        <div class="hist-detail">
          攻: ${rec.attackerConfig}<br>
          防: ${rec.defenderConfig}
        </div>
        ${rec.skills.map(s => `
          <div class="hist-damage">${s.name}: ${s.range}（約${Math.round(s.pct)}%）</div>
        `).join('')}
      </div>
    `).join('');
  }

  function clearDamageHistory() {
    damageHistory = [];
    renderDamageHistory();
  }

  // ── Tactical Advice ──

  function showTacticCard() {
    const hasMy = myTeam.some(s => s !== null);
    const hasEnemy = enemyTeam.some(s => s !== null);
    const card = $('ts-tacticCard');
    if (!card) return;
    card.style.display = (hasMy && hasEnemy) ? 'block' : 'none';

    const atkSel = $('ts-tacticAttacker');
    const defSel = $('ts-tacticDefender');
    if (!atkSel || !defSel) return;

    const mySlots = myTeam.map((s, i) => s ? { index: i, name: s.name_zh } : null).filter(Boolean);
    const enSlots = enemyTeam.map((s, i) => s ? { index: i, name: s.name_zh } : null).filter(Boolean);

    const prevAtk = atkSel.value;
    const prevDef = defSel.value;
    atkSel.innerHTML = mySlots.map(s => `<option value="${s.index}" ${String(s.index) === prevAtk ? 'selected' : ''}>${s.name}</option>`).join('');
    defSel.innerHTML = enSlots.map(s => `<option value="${s.index}" ${String(s.index) === prevDef ? 'selected' : ''}>${s.name}</option>`).join('');
  }

  function parseStatusEffects(effectDesc) {
    if (!effectDesc) return [];
    const results = [];
    const seen = new Set();

    // Pattern A: 直接命名 — "n%令對方/令對手{狀態}"
    // 資料庫中實際格式，覆蓋大多數技能
    const directPatterns = [
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?害怕/, status: '害怕' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?麻痺/, status: '麻痺' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?中毒/, status: '中毒' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?凍傷/, status: '凍傷' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?睡眠/, status: '睡眠' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?(?:灼傷|燒傷)/, status: '灼傷' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?石化/, status: '石化' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?混亂/, status: '混亂' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?疲憊/, status: '疲憊' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?冰封/, status: '冰封' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?流血/, status: '流血' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?癱瘓/, status: '癱瘓' },
      { regex: /(\d+(?:\.\d+)?)\s*%\s*令(?:對手|對方)(?:進入)?失明/, status: '失明' },
    ];

    for (const p of directPatterns) {
      const m = effectDesc.match(p.regex);
      if (m && !seen.has(p.status)) {
        seen.add(p.status);
        results.push({ chance: parseFloat(m[1]), status: p.status });
      }
    }

    return results;
  }

  async function runTacticAdvice() {
    const container = $('ts-tacticResults');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--text-muted);padding:10px;">計算中...</div>';

    const atkIdx = parseInt($('ts-tacticAttacker')?.value);
    const defIdx = parseInt($('ts-tacticDefender')?.value);
    if (isNaN(atkIdx) || isNaN(defIdx)) {
      container.innerHTML = '<div style="color:var(--text-muted);padding:10px;">請先選擇雙方精靈</div>';
      return;
    }

    const attacker = myTeam[atkIdx];
    const defender = enemyTeam[defIdx];
    if (!attacker || !defender) return;

    ensureSpriteConfig(attacker);
    ensureSpriteConfig(defender);

    const skills = attacker.selectedSkills || attacker.skills || [];
    if (skills.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);padding:10px;">攻擊方無可用技能</div>';
      return;
    }

    const params = {
      attackerLevel: attacker.level || 100,
      defenderLevel: defender.level || 100,
      attackerIVs: attacker.ivs,
      defenderIVs: defender.ivs,
      attackerEVs: attacker.evs,
      defenderEVs: defender.evs,
      attackerNature: attacker.nature || null,
      defenderNature: defender.nature || null,
      attackerExtraStats: attacker.extraStats,
      defenderExtraStats: defender.extraStats,
      attackerRanks: {
        atk: attacker.abilityRanks?.atk || 0,
        spatk: attacker.abilityRanks?.spatk || 0,
        speed: attacker.abilityRanks?.speed || 0,
      },
      defenderRanks: {
        def: defender.abilityRanks?.def || 0,
        spdef: defender.abilityRanks?.spdef || 0,
        speed: defender.abilityRanks?.speed || 0,
      },
      attackerTraits: attacker.genericTraitId ? { traitId: attacker.genericTraitId, starLevel: attacker.traitStarLevel || 0 } : null,
      defenderTraits: defender.genericTraitId ? { traitId: defender.genericTraitId, starLevel: defender.traitStarLevel || 0 } : null,
    };

    let calcResults;
    try {
      calcResults = await API.invoke('db:calculate-damage', {
        attacker: { types: attacker.types, base_hp: attacker.base_hp, base_atk: attacker.base_atk, base_def: attacker.base_def, base_spatk: attacker.base_spatk, base_spdef: attacker.base_spdef, base_speed: attacker.base_speed },
        defender: { types: defender.types, base_hp: defender.base_hp, base_atk: defender.base_atk, base_def: defender.base_def, base_spatk: defender.base_spatk, base_spdef: defender.base_spdef, base_speed: defender.base_speed },
        skills,
        params,
      });
    } catch (err) {
      container.innerHTML = `<div style="color:var(--danger);padding:10px;">計算失敗: ${err.message}</div>`;
      return;
    }

    const defenderMaxHp = calcResults[0]?.defenderStats?.hp || 1;

    let results = calcResults.map(r => {
      const statusEffects = parseStatusEffects(r.skill.effect_desc);
      const isGuaranteedKill = r.damage.min >= defenderMaxHp;
      const isKill = r.damage.max >= defenderMaxHp;
      return {
        skill: r.skill,
        damage: r.damage,
        hpPercentage: r.hpPercentage,
        ohko: r.ohko,
        isGuaranteedKill,
        isKill,
        statusEffects,
        defenderMaxHp,
        attackerStats: r.attackerStats,
        defenderStats: r.defenderStats,
      };
    });

    const sortBy = $('ts-tacticSort')?.value || 'recommend';
    results = sortTacticResults(results, sortBy);

    renderTacticResults(results, attacker, defender, defenderMaxHp);
  }

  function sortTacticResults(results, sortBy) {
    return [...results].sort((a, b) => {
      if (sortBy === 'recommend') {
        if (a.isGuaranteedKill !== b.isGuaranteedKill) return b.isGuaranteedKill - a.isGuaranteedKill;
        if (a.isKill !== b.isKill) return b.isKill - a.isKill;
        return b.damage.avg - a.damage.avg;
      }
      if (sortBy === 'damage') return b.damage.avg - a.damage.avg;
      if (sortBy === 'status') {
        const aMax = a.statusEffects.length > 0 ? Math.max(...a.statusEffects.map(s => s.chance)) : 0;
        const bMax = b.statusEffects.length > 0 ? Math.max(...b.statusEffects.map(s => s.chance)) : 0;
        return bMax - aMax;
      }
      return 0;
    });
  }

  function renderTacticResults(results, attacker, defender, defenderMaxHp) {
    const container = $('ts-tacticResults');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);padding:10px;">無可用技能結果</div>';
      return;
    }

    const aStats = results[0]?.attackerStats;
    const dStats = results[0]?.defenderStats;
    let statsHtml = '';
    if (aStats && dStats) {
      statsHtml = `
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
          ${attacker.name_zh}：體${aStats.hp} 攻${aStats.atk} 防${aStats.def} 特攻${aStats.spatk} 特防${aStats.spdef} 速${aStats.speed}
          ｜${defender.name_zh} 體力 ${defenderMaxHp}
        </div>`;
    }

    container.innerHTML = `
      ${statsHtml}
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">
        技能排序：${{ recommend: '推薦（秒殺>傷害）', damage: '傷害最高', status: '異常機率' }[results[0] ? ($('ts-tacticSort')?.value || 'recommend') : 'recommend']}
      </div>
      ${results.map((r, i) => {
        const pctAvg = parseFloat(r.hpPercentage?.avg || 0);
        const dmgClass = pctAvg >= 50 ? 'damage-high' : pctAvg >= 25 ? 'damage-mid' : 'damage-low';
        let badges = '';
        if (r.isGuaranteedKill) badges += '<span class="tactic-badge tactic-badge-ohko">確殺</span>';
        else if (r.isKill) badges += `<span class="tactic-badge tactic-badge-chance">可能秒殺 ${r.ohko.probability}%</span>`;
        else badges += `<span class="tactic-badge tactic-badge-nokill">無法秒殺</span>`;
        for (const se of r.statusEffects) {
          badges += `<span class="tactic-badge tactic-badge-status">${se.status} ${se.chance}%</span>`;
        }
        const typeBadge = (r.skill.type || '') ? typeBadgeHTML(r.skill.type) : '';
        return `
          <div class="tactic-skill-row">
            <div style="flex:1;min-width:0;">
              <div class="tactic-skill-name">${i + 1}. ${r.skill.name} ${typeBadge}</div>
              <div class="tactic-skill-meta">${r.skill.category || ''} ｜ 威力 ${r.skill.power || 0} ｜ ${r.skill.accuracy ? '命中 ' + r.skill.accuracy : ''}</div>
            </div>
            <div style="text-align:right;">
              <div class="tactic-damage-range ${dmgClass}">${r.damage.min} ~ ${r.damage.max}</div>
              <div style="font-size:11px;color:var(--text-muted);">平均 ${r.damage.avg}（約${r.hpPercentage.avg}%）</div>
              <div style="margin-top:3px;">${badges}</div>
            </div>
          </div>`;
      }).join('')}
    `;
  }

  // ── Save / Share / Import ──

  function serializeTeam(team) {
    return team.map(s => s ? {
      id: s.id, level: s.level, evs: s.evs, ivs: s.ivs,
      nature: s.nature, extraStats: s.extraStats,
      selectedSkillIds: (s.selectedSkills || []).map(sk => sk.id),
      currentHp: s.currentHp,
      abilityRanks: s.abilityRanks,
      genericTraitId: s.genericTraitId,
      traitStarLevel: s.traitStarLevel,
    } : null);
  }

  function saveTeam() {
    const teamData = { myTeam: serializeTeam(myTeam), enemyTeam: serializeTeam(enemyTeam) };
    const name = prompt('請輸入隊伍名稱：');
    if (!name) return;
    const saved = JSON.parse(localStorage.getItem('savedTeams') || '[]');
    saved.push({ name, data: teamData, savedAt: new Date().toISOString() });
    localStorage.setItem('savedTeams', JSON.stringify(saved));
    loadSavedTeams();
    alert('隊伍已儲存！');
  }

  function shareTeam() {
    const code = btoa(JSON.stringify({ myTeam: serializeTeam(myTeam), enemyTeam: serializeTeam(enemyTeam) }));
    $('ts-shareCode').value = code;
    $('ts-shareModal').classList.add('active');
  }

  function copyShareCode() {
    navigator.clipboard?.writeText($('ts-shareCode').value);
    alert('代碼已複製到剪貼簿！');
  }

  function openImportModal() { $('ts-importModal').classList.add('active'); }

  async function importTeam() {
    const code = $('ts-importCode').value.trim();
    if (!code) { alert('請貼上隊伍代碼'); return; }
    try {
      const data = JSON.parse(atob(code));
      for (const slot of ['myTeam', 'enemyTeam']) {
        const team = data[slot] || [];
        for (let i = 0; i < 6; i++) {
          if (team[i]) {
            const sprite = await API.sprites.get(team[i].id);
            Object.assign(sprite, defaultSpriteConfig());
            sprite.level = team[i].level || 100;
            sprite.evs = team[i].evs || sprite.evs;
            sprite.ivs = team[i].ivs || sprite.ivs;
            sprite.nature = team[i].nature || '';
            sprite.extraStats = team[i].extraStats || sprite.extraStats;
            sprite.selectedSkills = (team[i].selectedSkillIds || []).map(id => sprite.skills.find(s => s.id === id)).filter(Boolean);
            if (team[i].currentHp !== undefined) sprite.currentHp = team[i].currentHp;
            if (team[i].abilityRanks) sprite.abilityRanks = team[i].abilityRanks;
            if (team[i].genericTraitId !== undefined) sprite.genericTraitId = team[i].genericTraitId;
            if (team[i].traitStarLevel !== undefined) sprite.traitStarLevel = team[i].traitStarLevel;
            (slot === 'myTeam' ? myTeam : enemyTeam)[i] = sprite;
          } else {
            (slot === 'myTeam' ? myTeam : enemyTeam)[i] = null;
          }
        }
      }
      renderTeam('my'); renderTeam('enemy'); closeImportModal();
      alert('隊伍匯入成功！');
    } catch (e) { alert('代碼格式錯誤：' + e.message); }
  }

  function loadSavedTeams() {
    const saved = JSON.parse(localStorage.getItem('savedTeams') || '[]');
    const list = $('ts-savedTeamsList');
    if (!list) return;
    if (saved.length === 0) { list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">尚無儲存的隊伍</div>'; return; }
    list.innerHTML = saved.map((team, i) => `
      <div class="saved-team-item">
        <div><strong>${team.name}</strong> <span style="color:var(--text-muted);margin-left:10px;">${new Date(team.savedAt).toLocaleDateString()}</span></div>
        <div class="btn-group">
          <button onclick="TeamSim.loadSavedTeam(${i})">載入</button>
          <button class="btn-secondary" onclick="TeamSim.renameSavedTeam(${i})">重新命名</button>
          <button class="btn-danger" onclick="TeamSim.deleteSavedTeam(${i})">刪除</button>
        </div>
      </div>
    `).join('');
  }

  async function loadSavedTeam(index) {
    const saved = JSON.parse(localStorage.getItem('savedTeams') || '[]');
    const team = saved[index];
    if (!team) return;
    for (const slot of ['myTeam', 'enemyTeam']) {
      const teamData = team.data[slot] || [];
      for (let i = 0; i < 6; i++) {
        if (teamData[i]) {
          const sprite = await API.sprites.get(teamData[i].id);
          Object.assign(sprite, defaultSpriteConfig());
          sprite.level = teamData[i].level || 100;
          sprite.evs = teamData[i].evs || sprite.evs;
          sprite.ivs = teamData[i].ivs || sprite.ivs;
          sprite.nature = teamData[i].nature || '';
          sprite.extraStats = teamData[i].extraStats || sprite.extraStats;
          sprite.selectedSkills = (teamData[i].selectedSkillIds || []).map(id => sprite.skills.find(s => s.id === id)).filter(Boolean);
          if (teamData[i].currentHp !== undefined) sprite.currentHp = teamData[i].currentHp;
          if (teamData[i].abilityRanks) sprite.abilityRanks = teamData[i].abilityRanks;
          if (teamData[i].genericTraitId !== undefined) sprite.genericTraitId = teamData[i].genericTraitId;
          if (teamData[i].traitStarLevel !== undefined) sprite.traitStarLevel = teamData[i].traitStarLevel;
          (slot === 'myTeam' ? myTeam : enemyTeam)[i] = sprite;
        } else {
          (slot === 'myTeam' ? myTeam : enemyTeam)[i] = null;
        }
      }
    }
    renderTeam('my'); renderTeam('enemy');
    alert('隊伍載入成功！');
  }

  function renameSavedTeam(index) {
    const saved = JSON.parse(localStorage.getItem('savedTeams') || '[]');
    const n = prompt('請輸入新名稱：', saved[index].name);
    if (n) { saved[index].name = n; localStorage.setItem('savedTeams', JSON.stringify(saved)); loadSavedTeams(); }
  }

  function deleteSavedTeam(index) {
    if (!confirm('確定要刪除這個隊伍嗎？')) return;
    const saved = JSON.parse(localStorage.getItem('savedTeams') || '[]');
    saved.splice(index, 1);
    localStorage.setItem('savedTeams', JSON.stringify(saved));
    loadSavedTeams();
  }

  function clearAll() {
    if (!confirm('確定要清空所有隊伍嗎？')) return;
    myTeam = [null, null, null, null, null, null];
    enemyTeam = [null, null, null, null, null, null];
    renderTeam('my'); renderTeam('enemy');
  }

  // ── Text Export/Import ──

  function openTextModal(mode) {
    textModalMode = mode;
    const modal = $('ts-textModal');
    const title = $('ts-textModalTitle');
    const action = $('ts-textModalAction');
    const textarea = $('ts-textArea');

    if (mode === 'export') {
      title.textContent = '匯出文本';
      action.textContent = '複製';
      textarea.readOnly = true;
      textarea.value = generateTextExport();
    } else {
      title.textContent = '匯入文本';
      action.textContent = '匯入';
      textarea.readOnly = false;
      textarea.value = '';
      textarea.placeholder = '貼上 Showdown 格式文本...';
    }
    modal.classList.add('active');
  }

  function closeTextModal() {
    $('ts-textModal')?.classList.remove('active');
  }

  function textModalAction() {
    if (textModalMode === 'export') {
      navigator.clipboard?.writeText($('ts-textArea').value);
      alert('文本已複製到剪貼簿！');
    } else {
      importText();
    }
  }

  function generateTextExport() {
    return myTeam.filter(s => s).map(s => {
      const lines = [];
      lines.push(s.name_zh);
      lines.push(`性格: ${s.nature || '勤奮'}`);
      const evParts = STAT_KEYS.filter(k => s.evs[k] > 0).map(k => `${s.evs[k]} ${STAT_LABELS[k]}`);
      lines.push(`學習力: ${evParts.length ? evParts.join(' / ') : '0'}`);
      const ivAll31 = Object.values(s.ivs).every(v => v === 31);
      lines.push(`個體值: ${ivAll31 ? '31' : STAT_KEYS.map(k => `${STAT_LABELS[k]} ${s.ivs[k]}`).join(' / ')}`);
      (s.selectedSkills || []).forEach(sk => {
        lines.push(`- ${sk.name}`);
      });
      return lines.join('\n');
    }).join('\n\n');
  }

  function importText() {
    const text = $('ts-textArea').value.trim();
    if (!text) { alert('請貼上文本內容'); return; }
    try {
      const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
      let slotIndex = 0;
      for (const block of blocks) {
        if (slotIndex >= 6) break;
        const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) continue;

        const name = lines[0];
        const sprite = allSprites.find(s => s.name_zh === name);
        if (!sprite) continue;

        const newSprite = { ...sprite };
        Object.assign(newSprite, defaultSpriteConfig());
        newSprite.skills = sprite.skills || [];
        newSprite.selectedSkills = newSprite.skills.slice(0, 4);

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith('性格:')) {
            const natureVal = line.replace('性格:', '').trim();
            const matched = NATURE_OPTIONS.find(o => natureVal.includes(o.value) && o.value !== '');
            newSprite.nature = matched ? matched.value : '';
          } else if (line.startsWith('學習力:')) {
            const evStr = line.replace('學習力:', '').trim();
            STAT_KEYS.forEach(k => newSprite.evs[k] = 0);
            const evParts = evStr.split('/').map(p => p.trim());
            for (const part of evParts) {
              const m = part.match(/(\d+)\s*(.+)/);
              if (m) {
                const val = parseInt(m[1]);
                const label = m[2];
                const key = STAT_KEYS.find(k => STAT_LABELS[k] === label);
                if (key) newSprite.evs[key] = val;
              }
            }
          } else if (line.startsWith('個體值:')) {
            const ivStr = line.replace('個體值:', '').trim();
            if (ivStr === '31') {
              STAT_KEYS.forEach(k => newSprite.ivs[k] = 31);
            } else {
              const ivParts = ivStr.split('/').map(p => p.trim());
              for (const part of ivParts) {
                const m = part.match(/(.+)\s+(\d+)/);
                if (m) {
                  const label = m[1];
                  const val = parseInt(m[2]);
                  const key = STAT_KEYS.find(k => STAT_LABELS[k] === label);
                  if (key) newSprite.ivs[key] = val;
                }
              }
            }
          } else if (line.startsWith('-')) {
            const skillName = line.replace(/^-\s*/, '').trim();
            const matchedSkill = newSprite.skills.find(s => s.name === skillName);
            if (matchedSkill) {
              newSprite.selectedSkills = newSprite.selectedSkills.filter(s => s.name !== skillName);
              newSprite.selectedSkills.push(matchedSkill);
            }
          }
        }

        myTeam[slotIndex] = newSprite;
        slotIndex++;
      }
      for (let i = slotIndex; i < 6; i++) myTeam[i] = null;
      renderTeam('my');
      closeTextModal();
      alert('文本匯入成功！');
    } catch (e) {
      alert('文本解析失敗：' + e.message);
    }
  }

  // ── Modal Close ──

  function closeModal() { $('ts-spriteModal')?.classList.remove('active'); }
  function closeConfigModal() { $('ts-configModal')?.classList.remove('active'); }
  function closeImportModal() { $('ts-importModal')?.classList.remove('active'); }
  function closeShareModal() { $('ts-shareModal')?.classList.remove('active'); }

  // ── 3. Multi-Profile Management ──

  let currentProfileId = null;

  async function loadProfiles() {
    const api = window.electronAPI;
    if (!api?.profiles) return;
    const profiles = await api.profiles.list();
    const select = $('ts-profileSelect');
    if (!select) return;
    const active = profiles.find(p => p.is_active);
    select.innerHTML = '<option value="">（預設配置）</option>' +
      profiles.map(p => `<option value="${p.id}" ${active && active.id === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
    select.onchange = () => switchProfile(select.value ? Number(select.value) : null);
  }

  async function switchProfile(profileId) {
    const api = window.electronAPI;
    if (!api?.profiles) return;
    currentProfileId = profileId;
    if (profileId) {
      await api.profiles.setActive(profileId);
      const teams = await api.teams.load(profileId);
      myTeam = [null, null, null, null, null, null];
      enemyTeam = [null, null, null, null, null, null];
      for (const t of teams) {
        if (!t.sprite_id) continue;
        const sprite = await API.sprites.get(t.sprite_id);
        if (!sprite) continue;
        Object.assign(sprite, defaultSpriteConfig());
        try { Object.assign(sprite, JSON.parse(t.config_json || '{}')); } catch {}
        const slotArr = t.side === 'my' ? myTeam : enemyTeam;
        slotArr[t.slot_index] = sprite;
      }
    } else {
      myTeam = [null, null, null, null, null, null];
      enemyTeam = [null, null, null, null, null, null];
    }
    renderTeam('my');
    renderTeam('enemy');
  }

  async function createProfile() {
    const api = window.electronAPI;
    if (!api?.profiles) return;
    const name = prompt('請輸入配置名稱：');
    if (!name?.trim()) return;
    const p = await api.profiles.create(name.trim());
    if (p) { await loadProfiles(); $('ts-profileSelect').value = p.id; switchProfile(p.id); }
  }

  async function renameProfile() {
    const api = window.electronAPI;
    if (!api?.profiles || !currentProfileId) { alert('請先選擇一個配置'); return; }
    const name = prompt('請輸入新名稱：');
    if (!name?.trim()) return;
    await api.profiles.rename(currentProfileId, name.trim());
    await loadProfiles();
  }

  async function deleteProfile() {
    const api = window.electronAPI;
    if (!api?.profiles || !currentProfileId) { alert('請先選擇一個配置'); return; }
    if (!confirm('確定要刪除此配置嗎？')) return;
    await api.profiles.delete(currentProfileId);
    currentProfileId = null;
    await loadProfiles();
    switchProfile(null);
  }

  // Override saveTeam to also persist to SQLite profile
  const _origSaveTeam = saveTeam;
  async function saveTeam() {
    const api = window.electronAPI;
    if (api?.teams && currentProfileId) {
      // Save to SQLite profile
      for (let i = 0; i < 6; i++) {
        if (myTeam[i]) {
          await api.teams.save(currentProfileId, {
            side: 'my', slotIndex: i, spriteId: myTeam[i].id,
            config: {
              level: myTeam[i].level, evs: myTeam[i].evs, ivs: myTeam[i].ivs,
              nature: myTeam[i].nature, extraStats: myTeam[i].extraStats,
              currentHp: myTeam[i].currentHp, abilityRanks: myTeam[i].abilityRanks,
              genericTraitId: myTeam[i].genericTraitId, traitStarLevel: myTeam[i].traitStarLevel,
            },
          });
        }
      }
      for (let i = 0; i < 6; i++) {
        if (enemyTeam[i]) {
          await api.teams.save(currentProfileId, {
            side: 'enemy', slotIndex: i, spriteId: enemyTeam[i].id,
            config: {
              level: enemyTeam[i].level, evs: enemyTeam[i].evs, ivs: enemyTeam[i].ivs,
              nature: enemyTeam[i].nature, extraStats: enemyTeam[i].extraStats,
              currentHp: enemyTeam[i].currentHp, abilityRanks: enemyTeam[i].abilityRanks,
              genericTraitId: enemyTeam[i].genericTraitId, traitStarLevel: enemyTeam[i].traitStarLevel,
            },
          });
        }
      }
      alert('隊伍已儲存至配置！');
      return;
    }
    _origSaveTeam();
  }

  // ═══════════════════════════════════════════════
  //  對位分析（Matchup Analysis）
  // ═══════════════════════════════════════════════

  let _lastMatchupResult = null;

  function runMatchupAnalysis() {
    const myTeamFiltered = myTeam.filter(Boolean);
    const enemyTeamFiltered = enemyTeam.filter(Boolean);
    if (myTeamFiltered.length === 0 || enemyTeamFiltered.length === 0) {
      alert('請先加入雙方精靈');
      return;
    }
    const btn = document.getElementById('ts-matchupBtn');
    const status = document.getElementById('ts-matchupStatus');
    btn.disabled = true;
    status.textContent = '計算中...';

    const myConfigs = myTeamFiltered.map(s => ({
      level: s.level || 100, ivs: s.ivs, evs: s.evs, nature: s.nature,
      extraStats: s.extraStats, abilityRanks: s.abilityRanks,
    }));
    const enemyConfigs = enemyTeamFiltered.map(s => ({
      level: s.level || 100, ivs: s.ivs, evs: s.evs, nature: s.nature,
      extraStats: s.extraStats, abilityRanks: s.abilityRanks,
    }));

    API.invoke('db:full-matchup', {
      myTeam: myTeamFiltered,
      enemyTeam: enemyTeamFiltered,
      configs: { my: myConfigs, enemy: enemyConfigs },
    }).then(result => {
      _lastMatchupResult = result;
      renderMatchupAnalysis(result, myTeamFiltered, enemyTeamFiltered);
      btn.disabled = false;
      status.textContent = `${myTeamFiltered.length}x${enemyTeamFiltered.length} 對位分析完成`;
    }).catch(err => {
      btn.disabled = false;
      status.textContent = '計算失敗';
      console.error(err);
    });
  }

  function renderMatchupAnalysis(result, myTeamFiltered, enemyTeamFiltered) {
    const container = document.getElementById('ts-matchupResults');
    const { matrix, bestCounters, bestTargets } = result;
    let html = '';

    // NxM 威脅矩陣
    html += '<div style="overflow-x:auto;margin-bottom:16px;">';
    html += '<table class="matchup-matrix-threat">';
      html += `<thead><tr><th></th>`;
    for (const e of enemyTeamFiltered) {
      const types = Array.isArray(e.types) ? e.types : JSON.parse(e.types || '[]');
      html += `<th>${e.name_zh || '?'}<br><span style="font-size:10px;color:var(--text-muted)">${types.map(t => typeBadgeHTML(t)).join('')}</span></th>`;
    }
    html += '</tr></thead><tbody>';
    for (let i = 0; i < myTeamFiltered.length; i++) {
      const myTypes = Array.isArray(myTeamFiltered[i].types) ? myTeamFiltered[i].types : JSON.parse(myTeamFiltered[i].types || '[]');
      html += `<tr><td>${myTeamFiltered[i].name_zh || '?'}<br><span style="font-size:10px">${myTypes.map(t => typeBadgeHTML(t)).join('')}</span></td>`;
      for (let j = 0; j < enemyTeamFiltered.length; j++) {
        const cell = matrix[i][j];
        const atk = cell.atkThreat;
        const def = cell.defThreat;
        const diff = atk - def;
        const cls = diff >= 30 ? 'threat-high' : diff >= 10 ? 'threat-medium' : diff >= -10 ? 'threat-low' : 'threat-none';
        html += `<td><div class="threat-cell ${cls}" onclick="TeamSim.showDamageDetail(${myTeam.indexOf(myTeamFiltered[i])},${enemyTeam.indexOf(enemyTeamFiltered[j])})">${atk}</div><div style="font-size:10px;color:var(--text-muted)">vs ${def}</div></td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';

    // 最佳對位推薦
    html += '<h3 style="color:var(--accent);margin:12px 0 8px;">最佳派出建議</h3>';
    html += '<div class="counter-list">';
    const sorted = [...bestCounters].sort((a, b) => b.score - a.score);
    for (let idx = 0; idx < sorted.length; idx++) {
      const c = sorted[idx];
      const myName = myTeamFiltered[c.myIndex]?.name_zh || '?';
      const enemyName = enemyTeamFiltered[c.enemyIndex]?.name_zh || '?';
      const m = matrix[c.myIndex][c.enemyIndex];
      const scoreCls = c.score >= 0 ? 'score-positive' : 'score-negative';
      html += `<div class="counter-item">
        <div class="rank">#${idx + 1}</div>
        <div class="names"><strong>${myName}</strong><span class="vs">vs</span><strong>${enemyName}</strong></div>
        <div style="font-size:12px;color:var(--text-muted)">${m.bestAtkSkill?.skill.name || '—'}</div>
        <div class="score ${scoreCls}">${c.score >= 0 ? '+' : ''}${c.score}</div>
      </div>`;
    }
    html += '</div>';

    container.innerHTML = html;
    document.getElementById('ts-matchupAnalysisCard').style.display = '';
  }

  // ═══════════════════════════════════════════════
  //  Ban/Pick 模擬
  // ═══════════════════════════════════════════════

  let _banPickState = null;

  function startBanPick() {
    const myPool = myTeam.filter(Boolean);
    const enemyPool = enemyTeam.filter(Boolean);
    if (myPool.length === 0 || enemyPool.length === 0) {
      alert('請先加入雙方精靈池（建議各 6+ 隻）');
      return;
    }
    _banPickState = {
      phase: 'ban',       // ban → pick → done
      myPool: [...myPool],
      enemyPool: [...enemyPool],
      myBans: [],
      enemyBans: [],
      myPicks: [],
      enemyPicks: [],
      log: [],
      turn: 0,            // 0=enemy ban, 1=my ban, 2+= alternating picks
    };
    document.getElementById('ts-banPickReset').style.display = '';
    document.getElementById('ts-banPickCard').style.display = '';
    renderBanPick();
  }

  function resetBanPick() {
    _banPickState = null;
    document.getElementById('ts-banPickResults').innerHTML = '';
    document.getElementById('ts-banPickStatus').textContent = '';
    document.getElementById('ts-banPickReset').style.display = 'none';
  }

  function renderBanPick() {
    const s = _banPickState;
    if (!s) return;
    const container = document.getElementById('ts-banPickResults');
    const statusEl = document.getElementById('ts-banPickStatus');
    let html = '';

    const totalBans = 3;
    const myBansDone = s.myBans.length;
    const enemyBansDone = s.enemyBans.length;
    const myPicksDone = s.myPicks.length;
    const enemyPicksDone = s.enemyPicks.length;

    // Phase indicator
    if (myBansDone < totalBans || enemyBansDone < totalBans) {
      const whose = enemyBansDone <= myBansDone ? '對方 Ban' : '我方 Ban';
      const count = Math.max(enemyBansDone, myBansDone) + 1;
      statusEl.textContent = `${whose} #${count}（共 ${totalBans} 輪）`;
      html += `<div class="banpick-phase active"><div class="phase-label">Ban 階段</div><div class="phase-desc">${whose}：點擊選擇要 Ban 的精靈</div></div>`;
    } else if (myPicksDone < 5 || enemyPicksDone < 5) {
      const whose = enemyPicksDone <= myPicksDone ? '對方 Pick' : '我方 Pick';
      const count = Math.max(enemyPicksDone, myPicksDone) + 1;
      statusEl.textContent = `${whose} #${count}（共 5 隻）`;
      html += `<div class="banpick-phase active"><div class="phase-label">Pick 階段</div><div class="phase-desc">${whose}：點擊選擇要 Pick 的精靈</div></div>`;
    } else {
      statusEl.textContent = 'Ban/Pick 完成';
      html += `<div class="banpick-phase done"><div class="phase-label">完成</div><div class="phase-desc">雙方陣容已確定</div></div>`;
    }

    // Enemy pool
    html += '<h4 style="color:var(--text-muted);margin:8px 0 4px;">對方精靈池</h4>';
    html += '<div class="banpick-grid">';
    for (let i = 0; i < s.enemyPool.length; i++) {
      const sp = s.enemyPool[i];
      if (!sp) continue;
      const isBanned = s.enemyBans.some(b => b.name_zh === sp.name_zh);
      const isPicked = s.enemyPicks.some(p => p.name_zh === sp.name_zh);
      const cls = isBanned ? 'banned' : isPicked ? 'picked' : '';
      const types = Array.isArray(sp.types) ? sp.types : JSON.parse(sp.types || '[]');
      const clickAction = !isBanned && !isPicked ? `TeamSim.banPickAction('enemy',${i})` : '';
      html += `<div class="banpick-sprite ${cls}" ${clickAction ? `onclick="${clickAction}"` : ''}>
        <div class="sprite-types">${types.map(t => typeBadgeHTML(t)).join('')}</div>
        <div class="sprite-name">${sp.name_zh || '?'}</div>
      </div>`;
    }
    html += '</div>';

    // My pool
    html += '<h4 style="color:var(--text-muted);margin:12px 0 4px;">我方精靈池</h4>';
    html += '<div class="banpick-grid">';
    for (let i = 0; i < s.myPool.length; i++) {
      const sp = s.myPool[i];
      if (!sp) continue;
      const isBanned = s.myBans.some(b => b.name_zh === sp.name_zh);
      const isPicked = s.myPicks.some(p => p.name_zh === sp.name_zh);
      const cls = isBanned ? 'banned' : isPicked ? 'picked' : '';
      const myTypes = Array.isArray(sp.types) ? sp.types : JSON.parse(sp.types || '[]');
      const clickAction = !isBanned && !isPicked ? `TeamSim.banPickAction('my',${i})` : '';
      html += `<div class="banpick-sprite ${cls}" ${clickAction ? `onclick="${clickAction}"` : ''}>
        <div class="sprite-types">${myTypes.map(t => typeBadgeHTML(t)).join('')}</div>
        <div class="sprite-name">${sp.name_zh || '?'}</div>
      </div>`;
    }
    html += '</div>';

    // Log
    if (s.log.length > 0) {
      html += '<div class="banpick-log">';
      for (const entry of s.log) {
        html += `<div class="log-entry ${entry.type === 'ban' ? 'log-ban' : 'log-pick'}">${entry.text}</div>`;
      }
      html += '</div>';
    }

    container.innerHTML = html;
  }

  function banPickAction(side, index) {
    const s = _banPickState;
    if (!s) return;
    const totalBans = 3;

    // Ban phase
    if (s.myBans.length < totalBans || s.enemyBans.length < totalBans) {
      if (s.enemyBans.length <= s.myBans.length) {
        // Enemy ban turn
        if (side !== 'enemy') return;
        const sp = s.enemyPool[index];
        if (!sp || s.enemyBans.some(b => b.name_zh === sp.name_zh)) return;
        s.enemyBans.push(sp);
        s.log.push({ type: 'ban', text: `對方 Ban: ${sp.name_zh}` });
      } else {
        // My ban turn
        if (side !== 'my') return;
        const sp = s.myPool[index];
        if (!sp || s.myBans.some(b => b.name_zh === sp.name_zh)) return;
        s.myBans.push(sp);
        s.log.push({ type: 'ban', text: `我方 Ban: ${sp.name_zh}` });
      }
      renderBanPick();
      return;
    }

    // Pick phase
    const myPicksDone = s.myPicks.length;
    const enemyPicksDone = s.enemyPicks.length;
    if (myPicksDone >= 5 && enemyPicksDone >= 5) return;

    if (enemyPicksDone <= myPicksDone) {
      // Enemy pick turn
      if (side !== 'enemy') return;
      const sp = s.enemyPool[index];
      if (!sp || s.enemyBans.some(b => b.name_zh === sp.name_zh) || s.enemyPicks.some(p => p.name_zh === sp.name_zh)) return;
      s.enemyPicks.push(sp);
      s.log.push({ type: 'pick', text: `對方 Pick: ${sp.name_zh}` });
    } else {
      // My pick turn
      if (side !== 'my') return;
      const sp = s.myPool[index];
      if (!sp || s.myBans.some(b => b.name_zh === sp.name_zh) || s.myPicks.some(p => p.name_zh === sp.name_zh)) return;
      s.myPicks.push(sp);
      s.log.push({ type: 'pick', text: `我方 Pick: ${sp.name_zh}` });
    }
    renderBanPick();
  }

  return {
    init, openSpriteSelector, selectSpriteFromModal, addToTeam, removeFromTeam,
    openConfig, saveConfig, closeConfigModal, toggleCollapse, applyEvPreset,
    showDamageDetail, saveTeam, shareTeam, copyShareCode,
    openImportModal, importTeam, closeModal, clearDamageHistory,
    openTextModal, closeTextModal, textModalAction,
    loadSavedTeam, renameSavedTeam, deleteSavedTeam, clearAll,
    createProfile, renameProfile, deleteProfile, loadProfiles, switchProfile,
    runTacticAdvice,
    runMatchupAnalysis, startBanPick, resetBanPick, banPickAction,
  };
})();
