/**
 * localize.js — 簡繁體術語即時切換
 * 全域模組，掛載到 window.Locale
 */
const Locale = (() => {
  let lang = localStorage.getItem('lang') || 'tw';

  const MAP_TW_CN = {
    '個體值': '个体值', '種族值': '种族值', '學習力': '努力值',
    '魂印': '魂印', '刻印': '刻印', '體力': '体力',
    '攻擊': '攻击', '防禦': '防御', '速度': '速度',
    '等級': '等级', '精靈': '精灵', '隊伍': '队伍',
    '屬性': '属性', '暴擊': '暴击', '傷害': '伤害',
    '增傷': '增伤', '減傷': '减伤', '計算': '计算',
    '匯出': '导出', '匯入': '导入', '儲存': '储存',
    '設定': '设置', '移除': '移除', '搜尋': '搜索',
    '點擊': '点击', '複製': '复制', '貼上': '粘贴',
    '關閉': '关闭', '確定': '确定', '取消': '取消',
    '加入': '加入', '清空': '清空', '分享': '分享',
    '選擇': '选择', '展開': '展开', '載入': '加载',
    '實際能力值': '实际能力值', '必定暴擊': '必定暴击',
    '固定傷害': '固定伤害', '百分比斬殺': '百分比斩杀',
    '攻擊方': '攻击方', '防禦方': '防御方',
    '己方': '己方', '對手': '对手',
    '技能選擇': '技能选择', '刻印額外能力': '刻印额外能力',
    '儲存設定': '储存设置', '精靈設定': '精灵设置',
    '克制係數矩陣': '克制系数矩阵',
    '已儲存的隊伍': '已储存的队伍',
    '傷害試算': '伤害试算',
    '魂印/技能增傷': '魂印/技能增伤',
    '魂印/技能減傷': '魂印/技能减伤',
    '增傷=100%為無修正': '增伤=100%为无修正',
    '減傷=0%為無修正': '减伤=0%为无修正',
    '攻擊方物攻等級': '攻击方物攻等级',
    '攻擊方特攻等級': '攻击方特攻等级',
    '防禦方物防等級': '防御方物防等级',
    '防禦方特防等級': '防御方特防等级',
    '尚無儲存的隊伍': '尚无储存的队伍',
    '分享隊伍': '分享队伍', '匯入隊伍': '导入队伍',
    '匯出文本': '导出文本', '匯入文本': '导入文本',
    '加入己方精靈': '加入己方精灵',
    '加入對手精靈': '加入对手精灵',
    '儲存隊伍': '储存队伍', '清空全部': '清空全部',
    '只看最終進化': '只看最终进化',
    '此精靈無魂印資料': '此精灵无魂印资料',
    '請輸入隊伍名稱': '请输入队伍名称',
    '發現魂印標籤錯誤': '发现魂印标签错误',
    '複製代碼': '复制代码',
    '代碼已複製到剪貼簿': '代码已复制到剪贴板',
    '文本已複製到剪貼簿': '文本已复制到剪贴板',
    '文本匯入成功': '文本导入成功',
    '文本解析失敗': '文本解析失败',
    '隊伍匯入成功': '队伍导入成功',
    '隊伍載入成功': '队伍加载成功',
    '確定要清空所有隊伍嗎': '确定要清空所有队伍吗',
    '確定要刪除這個隊伍嗎': '确定要删除这个队伍吗',
    '估算值提醒': '估算值提醒',
    '傷害計算提示': '伤害计算提示',
    '速度線': '速度线', '先制': '先制',
    '一擊擊殺': '一击击杀',
    '無法確一': '无法确一',
    '機率一擊擊殺': '概率一击击杀',
    '快速環境配置': '快速环境配置',
    '啟靈元神魂印': '启灵元神魂印',
    '固定減傷': '固定减伤',
    '聖靈譜尼魂印': '圣灵谱尼魂印',
    '免控增傷': '免控增伤',
    '皇帝套裝': '皇帝套装',
    '至尊套裝': '至尊套装',
    '傷害提升': '伤害提升',
    '系統提示': '系统提示',
    '最終速度': '最终速度',
    '攻擊方超速': '攻击方超速',
    '防禦方超速': '防御方超速',
    '同速': '同速',
    '確定一擊擊殺': '确定一击击杀',
    '無法確一擊殺': '无法确一击杀',
    '機率擊殺': '概率击杀',
    '請貼上隊伍代碼': '请粘贴队伍代码',
    '請貼上文本內容': '请粘贴文本内容',
  };

  const MAP_CN_TW = {};
  for (const [tw, cn] of Object.entries(MAP_TW_CN)) {
    if (tw !== cn) MAP_CN_TW[cn] = tw;
  }

  function getMap() { return lang === 'tw' ? MAP_TW_CN : MAP_CN_TW; }

  function walkAndReplace(root, map) {
    const keys = Object.keys(map).sort((a, b) => b.length - a.length);
    if (!keys.length) return;
    const re = new RegExp(keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const t = node.textContent;
      if (re.test(t)) node.textContent = t.replace(re, m => map[m] || m);
    }
  }

  function apply() { walkAndReplace(document.body, getMap()); }

  function toggle() {
    lang = lang === 'tw' ? 'cn' : 'tw';
    localStorage.setItem('lang', lang);
    const btn = document.getElementById('locale-toggle');
    if (btn) btn.textContent = lang === 'tw' ? '简' : '繁';
    apply();
  }

  function init() {
    const btn = document.getElementById('locale-toggle');
    if (btn) btn.textContent = lang === 'tw' ? '简' : '繁';
    if (lang === 'cn') apply();
  }

  return { toggle, init, apply, isCN: () => lang === 'cn' };
})();
window.Locale = Locale;
