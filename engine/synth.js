// 用程式畫圓、方、三角，當作測試資料，也可以當「神祕資料包」的素材。
// 一律用固定種子的亂數，同樣的種子每次產生一樣的圖，測試才穩定。

import { features } from './raster.js';
import { CANVAS_SIZE } from './stroke.js';

export const SHAPES = ['circle', 'square', 'triangle'];
export const LABELS = { circle: '圓', square: '方', triangle: '三角' };

// mulberry32：很小的可重現亂數
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng, lo, hi) => lo + (hi - lo) * rng();

// 產生一個圖形的筆畫（單一筆）
// shape：circle / square / triangle
// size：外接圓半徑（px）；cx, cy：中心；rotation：旋轉（弧度）；jitter：手抖程度（px）
export function shapeStroke(shape, { size = 100, cx = 160, cy = 160, rotation = 0, jitter = 0 } = {}, rng = makeRng()) {
  let outline;
  if (shape === 'circle') {
    // 手畫的圓：起點隨機、可能多畫一點點、半徑有點起伏
    const start = rng() * Math.PI * 2;
    const sweep = Math.PI * 2 * between(rng, 1.0, 1.08);
    const wobble = between(rng, 0, 0.08);
    const phase = rng() * Math.PI * 2;
    const n = 48;
    outline = [];
    for (let i = 0; i <= n; i++) {
      const t = start + (sweep * i) / n;
      const r = size * (1 + wobble * Math.sin(2 * t + phase));
      outline.push({ x: Math.cos(t) * r, y: Math.sin(t) * r });
    }
  } else if (shape === 'square') {
    const h = size * 0.75; // 半邊長，讓方和圓看起來差不多大
    outline = densify([
      { x: -h, y: -h },
      { x: h, y: -h },
      { x: h, y: h },
      { x: -h, y: h },
      { x: -h, y: -h },
    ]);
  } else if (shape === 'triangle') {
    const pts = [0, 1, 2, 0].map((i) => {
      const t = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      return { x: Math.cos(t) * size, y: Math.sin(t) * size * 0.9 + size * 0.1 };
    });
    outline = densify(pts);
  } else {
    throw new Error(`不認得的圖形：${shape}`);
  }

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return outline.map((p) => ({
    x: clamp(cx + p.x * cos - p.y * sin + (rng() - 0.5) * 2 * jitter),
    y: clamp(cy + p.x * sin + p.y * cos + (rng() - 0.5) * 2 * jitter),
  }));
}

// 產生一張樣本 { label, kind, grid, shape, params }（kind 是圖形英文名，shape 是形狀格）
export function makeSample(kind, params, rng) {
  const stroke = shapeStroke(kind, params, rng);
  return { label: LABELS[kind], kind, ...features([stroke]), params };
}

// 隨機參數：範圍可覆寫
export function randomParams(rng, range = {}) {
  const r = { size: [55, 130], offset: 30, rotation: 0.3, jitter: 3, ...range };
  return {
    size: between(rng, r.size[0], r.size[1]),
    cx: 160 + between(rng, -r.offset, r.offset),
    cy: 160 + between(rng, -r.offset, r.offset),
    rotation: between(rng, -r.rotation, r.rotation),
    jitter: r.jitter,
  };
}

export function makeSet(shapes, n, seed, range) {
  const rng = makeRng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const shape = shapes[i % shapes.length];
    out.push(makeSample(shape, randomParams(rng, range), rng));
  }
  return out;
}

// ── 測試集 ──
export const BIG = { size: [105, 135], offset: 15 };
export const SMALL = { size: [30, 50], offset: 20 };

export const testSets = {
  // 大圓、小圓：第 2 堂偏誤實驗用
  bigCircles: (n = 20, seed = 101) => makeSet(['circle'], n, seed, BIG),
  smallCircles: (n = 20, seed = 202) => makeSet(['circle'], n, seed, SMALL),
  // 混合 20 張：三類輪流、大小位置都不同
  mixed: (n = 20, seed = 303) => makeSet(SHAPES, n, seed),
};

// 每類 n 張的訓練集
export function trainingSet(perClass = 5, seed = 7, range) {
  return makeSet(SHAPES, perClass * SHAPES.length, seed, range);
}

// 偏誤訓練集：圓只有大圓，方與三角大小都有
export function biasedTrainingSet(perClass = 5, seed = 11) {
  return [
    ...makeSet(['circle'], perClass, seed, BIG),
    ...makeSet(['square', 'triangle'], perClass * 2, seed + 1),
  ];
}

// 在折線的每一段插點，讓抖動看起來自然
function densify(pts, step = 8) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

function clamp(v) {
  return v < 0 ? 0 : v > CANVAS_SIZE ? CANVAS_SIZE : v;
}
