// 機率接龍（docs/03 4.1）。不碰 DOM，可以用 node --test 測。
// 溫度 T：抽中機率＝原本機率的 (1÷T) 次方，再換算回 100%。
// T 小 → 最高機率的字幾乎每次被選中；T 大 → 機率變平均，容易抽到怪字。

export const CHAINS = [
  {
    id: 'weather',
    start: '今天天氣很',
    words: [
      { id: 'w1', text: '好', p: 0.45 },
      { id: 'w2', text: '熱', p: 0.25 },
      { id: 'w3', text: '冷', p: 0.15 },
      { id: 'w4', text: '悶', p: 0.1 },
      { id: 'w5', text: '圓', p: 0.05 },
    ],
  },
  {
    id: 'animal',
    start: '我最喜歡的動物是',
    words: [
      { id: 'w1', text: '貓', p: 0.3 },
      { id: 'w2', text: '狗', p: 0.3 },
      { id: 'w3', text: '兔子', p: 0.2 },
      { id: 'w4', text: '鯨魚', p: 0.15 },
      { id: 'w5', text: '桌子', p: 0.05 },
    ],
  },
  {
    id: 'class',
    start: '小明走進教室，看見',
    words: [
      { id: 'w1', text: '同學', p: 0.4 },
      { id: 'w2', text: '老師', p: 0.3 },
      { id: 'w3', text: '黑板', p: 0.2 },
      { id: 'w4', text: '月亮', p: 0.08 },
      { id: 'w5', text: '香蕉', p: 0.02 },
    ],
  },
];

// 溫度滑桿 5 段（docs/03 4.1）；寵物一開始是第 4 段「高」
export const TEMPS = [
  { level: 1, name: '很低', t: 0.1 },
  { level: 2, name: '低', t: 0.5 },
  { level: 3, name: '中', t: 1 },
  { level: 4, name: '高', t: 1.6 },
  { level: 5, name: '很高', t: 2.5 },
];
export const DEFAULT_LEVEL = 4;

export function tempOf(level) {
  return TEMPS.find((x) => x.level === level) || TEMPS[DEFAULT_LEVEL - 1];
}

// 套用溫度後的機率（總和為 1）
export function applyTemperature(probs, t) {
  const w = probs.map((p) => Math.pow(p, 1 / t));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

// 依機率抽一個位置
export function sampleIndex(probs, random = Math.random) {
  let r = random();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r < 0) return i;
  }
  return probs.length - 1;
}

// 依溫度從候選清單（每項有 p）抽一項
export function pickByTemperature(items, t, random = Math.random) {
  return items[sampleIndex(applyTemperature(items.map((x) => x.p), t), random)];
}

export function drawWord(chain, t, random = Math.random) {
  return pickByTemperature(chain.words, t, random);
}

// 是不是機率最高的字（同分都算）
export function isTopWord(chain, word) {
  return word.p === Math.max(...chain.words.map((w) => w.p));
}
