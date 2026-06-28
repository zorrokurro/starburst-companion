import OpenCC from 'opencc-js';

const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });

const TYPE_MAP = {
  '水系': '水', '火系': '火', '草系': '草', '电系': '電',
  '地面系': '地面', '机械系': '機械', '冰系': '冰', '超能系': '超能',
  '战斗系': '戰鬥', '暗影系': '暗影', '光系': '光', '龙系': '龍',
  '神秘系': '神秘', '圣灵系': '聖靈', '次元系': '次元', '远古系': '遠古',
  '邪灵系': '邪靈', '自然系': '自然', '混沌系': '混沌', '神灵系': '神靈',
  '飞行系': '飛行', '轮回系': '輪迴', '虫系': '蟲', '虚空系': '虛空',
  '王系': '王', '普通系': '普通',
  '水': '水', '火': '火', '草': '草', '电': '電',
  '地面': '地面', '机械': '機械', '冰': '冰', '超能': '超能',
  '战斗': '戰鬥', '暗影': '暗影', '光': '光', '龙': '龍',
  '神秘': '神秘', '圣灵': '聖靈', '次元': '次元', '远古': '遠古',
  '邪灵': '邪靈', '自然': '自然', '混沌': '混沌', '神灵': '神靈',
  '飞行': '飛行', '轮回': '輪迴', '虫': '蟲', '虚空': '虛空',
  '王': '王', '普通': '普通',
};

export function s2t(text) {
  if (!text) return text;
  return converter(text);
}

export function convertType(rawType) {
  if (!rawType) return rawType;
  const cleaned = rawType.replace(/系$/, '');
  return TYPE_MAP[cleaned] || TYPE_MAP[rawType] || s2t(cleaned);
}

export function convertTypes(rawTypes) {
  if (!rawTypes || !Array.isArray(rawTypes)) return rawTypes;
  return rawTypes.map(t => convertType(t));
}
