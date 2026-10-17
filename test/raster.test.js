import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rasterize, bbox, isBlank, blur1, GRID } from '../engine/raster.js';

const line = (x0, y0, x1, y1, n = 20) =>
  Array.from({ length: n + 1 }, (_, i) => ({
    x: x0 + ((x1 - x0) * i) / n,
    y: y0 + ((y1 - y0) * i) / n,
  }));

test('輸出 16×16＝256 格，值在 0–1', () => {
  const g = rasterize([line(40, 160, 280, 160)]);
  assert.equal(g.length, GRID * GRID);
  for (const v of g) assert.ok(v >= 0 && v <= 1);
  assert.equal(Math.max(...g), 1);
});

test('空白畫布全部是 0', () => {
  const g = rasterize([]);
  assert.ok(g.every((v) => v === 0));
  assert.equal(isBlank(g), true);
});

test('保留位置：左上角的點只亮在左上角', () => {
  const g = rasterize([[{ x: 20, y: 20 }]]);
  const b = bbox(g);
  assert.ok(b.x <= 1 && b.y <= 1);
  assert.equal(g[15 * GRID + 15], 0);
});

test('保留大小：大正方形外框比小正方形大', () => {
  const sq = (c, h) => [
    line(c - h, c - h, c + h, c - h),
    line(c + h, c - h, c + h, c + h),
    line(c + h, c + h, c - h, c + h),
    line(c - h, c + h, c - h, c - h),
  ];
  const big = bbox(rasterize(sq(160, 120)));
  const small = bbox(rasterize(sq(160, 40)));
  assert.ok(big.area > small.area * 3);
});

test('1 格模糊：單一亮點會擴散到鄰格、總量不變', () => {
  const g = new Float32Array(GRID * GRID);
  g[5 * GRID + 5] = 1;
  const b = blur1(g);
  assert.ok(b[5 * GRID + 6] > 0 && b[4 * GRID + 4] > 0);
  assert.equal(b[5 * GRID + 8], 0);
  const sum = b.reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - 1) < 1e-6);
});

test('20 筆、每筆 200 點的圖在 50 ms 內轉完', () => {
  const strokes = Array.from({ length: 20 }, (_, i) => line(10, 10 + i * 15, 310, 300 - i * 10, 200));
  const t = performance.now();
  rasterize(strokes);
  assert.ok(performance.now() - t < 50);
});
