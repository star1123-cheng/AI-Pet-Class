import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, shapeStroke, testSets, trainingSet, biasedTrainingSet, SHAPES } from '../engine/synth.js';
import { accuracy } from '../engine/knn.js';
import { bbox, shapeRaster, rasterize } from '../engine/raster.js';
import { checkHealth } from '../engine/health.js';

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

test('同一個種子產生一樣的圖', () => {
  const a = shapeStroke('circle', { jitter: 3 }, makeRng(5));
  const b = shapeStroke('circle', { jitter: 3 }, makeRng(5));
  assert.deepEqual(a, b);
});

test('不認得的圖形會丟錯', () => {
  assert.throws(() => shapeStroke('star'));
});

test('三種測試集：張數、標籤、大圓真的比小圓大', () => {
  assert.equal(testSets.mixed().length, 20);
  assert.deepEqual([...new Set(testSets.mixed().map((s) => s.label))].sort(), ['三角', '圓', '方'].sort());
  const big = testSets.bigCircles();
  const small = testSets.smallCircles();
  assert.ok(big.every((s) => s.label === '圓') && small.every((s) => s.label === '圓'));
  assert.ok(mean(big.map((s) => bbox(s.grid).area)) > mean(small.map((s) => bbox(s.grid).area)) * 3);
});

test('形狀格：同一個圓畫大畫小，形狀格很接近', () => {
  const big = [shapeStroke('circle', { size: 120 }, makeRng(1))];
  const small = [shapeStroke('circle', { size: 40, cx: 80, cy: 80 }, makeRng(1))];
  const d = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  assert.ok(d(shapeRaster(big), shapeRaster(small)) < d(rasterize(big), rasterize(small)) / 2);
});

// ── P1 完成標準 ──
// 用 10 組不同種子取平均，避免剛好抽到好種子

test('完成標準：混合測試集（每類 5 個訓練樣本）準確率 ≥ 85%', () => {
  const accs = [];
  for (let s = 1; s <= 10; s++) accs.push(accuracy(trainingSet(5, s * 13), testSets.mixed(20, s * 7 + 300)));
  const m = mean(accs);
  assert.ok(m >= 0.85, `10 組平均準確率 ${(m * 100).toFixed(1)}%`);
});

test('完成標準：只用大圓訓練時，小圓準確率比大圓低 ≥ 20 個百分點', () => {
  const gaps = [];
  for (let s = 1; s <= 10; s++) {
    const train = biasedTrainingSet(5, s * 17);
    gaps.push(accuracy(train, testSets.bigCircles(20, s * 5 + 100)) - accuracy(train, testSets.smallCircles(20, s * 3 + 200)));
  }
  const m = mean(gaps);
  assert.ok(m >= 0.2, `10 組平均差距 ${(m * 100).toFixed(1)} 個百分點`);
});

test('資料健檢：只有大圓的訓練集，圓的多樣性比大小都有的低', () => {
  const biased = checkHealth(biasedTrainingSet(), { classes: ['圓', '方', '三角'] });
  const varied = checkHealth(trainingSet(), { classes: ['圓', '方', '三角'] });
  const circleDiv = (h) => h.area['圓'].std / h.area['圓'].mean;
  assert.ok(circleDiv(biased) < circleDiv(varied));
  assert.equal(varied.balance, 1);
  assert.equal(SHAPES.length, 3);
});
