// 筆畫 → 16×16 灰階（0–1）。
// 不把圖形縮放置中：大小與位置要保留下來當特徵，第 2 堂「只畫大圓、測小圓」的偏誤實驗要靠它。
// 做法：先在 80×80 的細格上畫出線寬 14 的線（每細格看中心點是否在線上），
// 再每 5×5 細格取平均變成 16×16（面積平均），最後做 1 格模糊。

import { CANVAS_SIZE, LINE_WIDTH } from './stroke.js';

export const GRID = 16;
const SUB = 5; // 每格切成 5×5 細格
const FINE = GRID * SUB;

export function rasterize(strokes, options = {}) {
  const size = options.size ?? CANVAS_SIZE;
  const lineWidth = options.lineWidth ?? LINE_WIDTH;
  const blur = options.blur ?? true;

  const fine = new Uint8Array(FINE * FINE);
  const cell = size / FINE;
  const r = lineWidth / 2;
  const r2 = r * r;

  for (const pts of strokes) {
    if (!pts.length) continue;
    // 只有一個點（點一下）也要畫成圓點
    const segs = pts.length === 1 ? [[pts[0], pts[0]]] : pairs(pts);
    for (const [a, b] of segs) {
      // 只掃描線段外框附近的細格，連畫很多筆也不會慢
      const x0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - r) / cell));
      const x1 = Math.min(FINE - 1, Math.floor((Math.max(a.x, b.x) + r) / cell));
      const y0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - r) / cell));
      const y1 = Math.min(FINE - 1, Math.floor((Math.max(a.y, b.y) + r) / cell));
      for (let fy = y0; fy <= y1; fy++) {
        const cy = (fy + 0.5) * cell;
        for (let fx = x0; fx <= x1; fx++) {
          const idx = fy * FINE + fx;
          if (fine[idx]) continue;
          const cx = (fx + 0.5) * cell;
          if (distToSegment2(cx, cy, a, b) <= r2) fine[idx] = 1;
        }
      }
    }
  }

  // 面積平均：每格＝線條蓋住的比例
  const grid = new Float32Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let sum = 0;
      for (let sy = 0; sy < SUB; sy++) {
        const row = (gy * SUB + sy) * FINE + gx * SUB;
        for (let sx = 0; sx < SUB; sx++) sum += fine[row + sx];
      }
      grid[gy * GRID + gx] = sum / (SUB * SUB);
    }
  }

  return blur ? normalize(blur1(grid)) : grid;
}

// 形狀格：先把筆畫的外框裁成正方形、放大到整個畫布，再轉 16×16。
// 不管畫多大、畫在哪，形狀都看得清楚；大小與位置交給 rasterize() 的「原圖格」。
// 原因：只用原圖格時，大小不同的圓彼此不像，混合測試準確率只有約 53%（見 docs/05 第 5 節）
export function shapeRaster(strokes, options = {}) {
  const size = options.size ?? CANVAS_SIZE;
  const pad = options.pad ?? 0.08;
  const pts = strokes.flat();
  if (!pts.length) return new Float32Array(GRID * GRID);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  // 點一下或很短的線：外框至少當 1 格寬，避免放大成一大片
  const side = Math.max(x1 - x0, y1 - y0, size / GRID) * (1 + 2 * pad);
  const k = size / side;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const half = size / 2;
  const moved = strokes.map((s) => s.map((p) => ({ x: (p.x - cx) * k + half, y: (p.y - cy) * k + half })));
  return rasterize(moved, options);
}

// 一張圖的兩種特徵：grid＝原圖格（保留大小位置）、shape＝形狀格
export function features(strokes, options = {}) {
  return { grid: rasterize(strokes, options), shape: shapeRaster(strokes, options) };
}

// 1 格模糊：3×3 權重 [1 2 1]×[1 2 1]，邊界外當 0
export function blur1(grid) {
  const k = [1, 2, 1];
  const out = new Float32Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= GRID) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= GRID) continue;
          sum += grid[yy * GRID + xx] * k[dy + 1] * k[dx + 1];
        }
      }
      out[y * GRID + x] = sum / 16;
    }
  }
  return out;
}

// 最亮的格子拉到 1，讓畫得輕或重都在同一個尺度
function normalize(grid) {
  let max = 0;
  for (const v of grid) if (v > max) max = v;
  if (max === 0) return grid;
  for (let i = 0; i < grid.length; i++) grid[i] /= max;
  return grid;
}

// 外框（以格為單位），threshold 以上算有畫到；空白圖回傳 null
export function bbox(grid, threshold = 0.2) {
  let x0 = GRID, y0 = GRID, x1 = -1, y1 = -1;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (grid[y * GRID + x] < threshold) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  return { x: x0, y: y0, w, h, area: w * h };
}

export function isBlank(grid, threshold = 0.2) {
  return bbox(grid, threshold) === null;
}

function pairs(pts) {
  const out = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
  return out;
}

function distToSegment2(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = a.x + t * dx - px;
  const ey = a.y + t * dy - py;
  return ex * ex + ey * ey;
}
