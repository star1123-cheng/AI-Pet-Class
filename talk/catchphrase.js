// 口頭禪積木（docs/03 4.2.1）：三格接龍選詞組句，再選理由。只記代碼。

export const SLOTS = [
  {
    id: 'a',
    name: '開頭',
    words: [
      { id: 'a1', text: '我是', p: 0.5 },
      { id: 'a2', text: '今天也是', p: 0.3 },
      { id: 'a3', text: '哇！我是', p: 0.2 },
    ],
  },
  {
    id: 'b',
    name: '中間',
    words: [
      { id: 'b1', text: '認真學習的', p: 0.45 },
      { id: 'b2', text: '會查證的', p: 0.35 },
      { id: 'b3', text: '愛亂猜的', p: 0.2 },
    ],
  },
  {
    id: 'c',
    name: '結尾',
    words: [
      { id: 'c1', text: 'AI 寵物！', p: 0.5 },
      { id: 'c2', text: '小幫手～', p: 0.3 },
      { id: 'c3', text: '外星人！', p: 0.2 },
    ],
  },
];

export const REASONS = [
  { id: 'r1', text: '我選機率最高的詞，聽起來最順' },
  { id: 'r2', text: '我故意選機率低的詞，比較有趣' },
  { id: 'r3', text: '我想提醒大家：AI 說的要查證' },
];

const word = (id) => SLOTS.flatMap((s) => s.words).find((w) => w.id === id);

// ids：每格選的詞代碼，例如 ['a1', 'b2', 'c3']；格子不對或沒選完回傳 null
export function phraseText(ids) {
  if (!Array.isArray(ids) || ids.length !== SLOTS.length) return null;
  const words = ids.map((id, i) => (SLOTS[i].words.some((w) => w.id === id) ? word(id) : null));
  if (words.includes(null)) return null;
  // 中文接英文時補半形空格（「的 AI」）
  return words.reduce((out, w) => out + (out && /[A-Za-z0-9]/.test(w.text[0]) && !/\s$/.test(out) ? ' ' : '') + w.text, '');
}

// 事件代碼，符合 GAS 的 CODE_RE
export const phraseCode = (ids) => ids.join('.');
