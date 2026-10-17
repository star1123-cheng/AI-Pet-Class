import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHealth, balanceScore, WEIGHTS } from '../engine/health.js';
import { GRID } from '../engine/raster.js';

// 在 16×16 上畫一個實心方塊，當作測試用的「圖」
function block(x, y, w, h) {
  const g = new Float32Array(GRID * GRID);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) g[yy * GRID + xx] = 1;
  return g;
}
const s = (label, grid, flagged = false) => ({ label, grid, flagged });

test('沒有資料時 dataQuality 是 0', () => {
  const h = checkHealth([], { classes: ['圓', '方'] });
  assert.equal(h.total, 0);
  assert.equal(h.dataQuality, 0);
  assert.deepEqual(h.counts, { 圓: 0, 方: 0 });
});

test('各類張數與類別平衡＝最少÷最多', () => {
  const samples = [s('圓', block(0, 0, 4, 4)), s('圓', block(0, 0, 5, 5)), s('方', block(8, 8, 4, 4))];
  const h = checkHealth(samples, { classes: ['圓', '方'] });
  assert.deepEqual(h.counts, { 圓: 2, 方: 1 });
  assert.equal(h.balance, 0.5);
  assert.equal(h.smallestClass, '方');
});

test('只餵一類：平衡為 0', () => {
  assert.equal(balanceScore([5]), 0);
  const h = checkHealth([s('圓', block(0, 0, 4, 4))], { classes: ['圓', '方'] });
  assert.equal(h.balance, 0);
});

test('各類 bbox 面積平均與標準差', () => {
  const samples = [s('圓', block(0, 0, 2, 2)), s('圓', block(0, 0, 4, 4))];
  const h = checkHealth(samples);
  assert.equal(h.area['圓'].mean, 10);
  assert.equal(h.area['圓'].std, 6);
});

test('多樣性：大小都一樣分數低、大小不同分數高', () => {
  const same = [1, 2, 3, 4].map(() => s('圓', block(2, 2, 10, 10)));
  const varied = [3, 6, 9, 12].map((w) => s('圓', block(2, 2, w, w)));
  assert.equal(checkHealth(same).diversity, 0);
  assert.ok(checkHealth(varied).diversity > 0.9);
});

test('乾淨度＝1－已確認標錯÷總張數', () => {
  const samples = [s('圓', block(0, 0, 3, 3)), s('圓', block(0, 0, 3, 3), true), s('方', block(0, 0, 3, 3))];
  const h = checkHealth(samples);
  assert.equal(h.flaggedCount, 1);
  assert.ok(Math.abs(h.clean - 2 / 3) < 1e-9);
});

test('dataQuality＝100×(0.4 平衡＋0.3 多樣性＋0.3 乾淨度)', () => {
  assert.deepEqual(WEIGHTS, { balance: 0.4, diversity: 0.3, clean: 0.3 });
  const samples = [3, 6, 9, 12].flatMap((w) => [s('圓', block(0, 0, w, w)), s('方', block(4, 4, w, w))]);
  const h = checkHealth(samples);
  const expected = Math.round(100 * (0.4 * h.balance + 0.3 * h.diversity + 0.3 * h.clean));
  assert.equal(h.dataQuality, expected);
  assert.ok(h.dataQuality >= 95);
});

test('可疑樣本：找出離同類中心最遠、而且更像別類的那張', () => {
  const samples = [
    s('圓', block(0, 0, 4, 4)),
    s('圓', block(0, 0, 4, 4)),
    s('圓', block(0, 0, 5, 5)),
    s('圓', block(10, 10, 4, 4)), // 這張其實是方的位置 → 標錯
    s('方', block(10, 10, 4, 4)),
    s('方', block(10, 10, 5, 5)),
  ];
  const h = checkHealth(samples);
  const sus = h.suspicious.find((x) => x.label === '圓');
  assert.equal(sus.index, 3);
  assert.equal(sus.closerToOther, '方');
  // 方只有 2 張，不判斷可疑
  assert.equal(h.suspicious.some((x) => x.label === '方'), false);
});
