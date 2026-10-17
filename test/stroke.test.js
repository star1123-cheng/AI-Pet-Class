import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStrokeRecorder, toLogical, isPalm } from '../engine/stroke.js';

test('一筆畫：down → move → up 會留下一筆點陣列', () => {
  const r = createStrokeRecorder();
  assert.equal(r.down(1, 10, 10), true);
  assert.deepEqual(r.move(1, 20, 10), [{ x: 10, y: 10 }, { x: 20, y: 10 }]);
  assert.equal(r.up(1), true);
  assert.equal(r.strokes.length, 1);
  assert.equal(r.strokes[0].length, 2);
});

test('距離太近的點不記錄', () => {
  const r = createStrokeRecorder();
  r.down(1, 10, 10);
  assert.equal(r.move(1, 10.5, 10.5), null);
  assert.equal(r.strokes[0].length, 1);
});

test('第二根手指在畫的時候被忽略', () => {
  const r = createStrokeRecorder();
  r.down(1, 10, 10);
  assert.equal(r.down(2, 50, 50), false);
  assert.equal(r.move(2, 60, 60), null);
  r.up(1);
  assert.equal(r.strokes.length, 1);
});

test('手掌（接觸面大）不能開始畫，畫到一半變手掌則整筆作廢', () => {
  const r = createStrokeRecorder({ palmSize: 60 });
  assert.equal(r.down(1, 10, 10, { width: 90, height: 80 }), false);
  assert.equal(r.strokes.length, 0);
  r.down(2, 10, 10, { width: 20, height: 20 });
  r.move(2, 30, 30, { width: 20, height: 20 });
  r.move(2, 40, 40, { width: 100, height: 100 });
  assert.equal(r.strokes.length, 0);
  assert.equal(r.drawing, false);
});

test('isPalm：沒有接觸面資訊時不判斷為手掌', () => {
  assert.equal(isPalm(null), false);
  assert.equal(isPalm({ width: 0, height: 0 }), false);
  assert.equal(isPalm({ width: 70, height: 10 }, 60), true);
});

test('pointercancel 會移除目前這一筆；undo 與 clear', () => {
  const r = createStrokeRecorder();
  r.down(1, 0, 0);
  r.move(1, 10, 10);
  r.up(1);
  r.down(2, 5, 5);
  r.cancel(2);
  assert.equal(r.strokes.length, 1);
  assert.equal(r.undo(), true);
  assert.equal(r.isEmpty(), true);
  r.down(3, 1, 1);
  r.up(3);
  r.clear();
  assert.equal(r.isEmpty(), true);
});

test('連畫 20 筆都會記錄', () => {
  const r = createStrokeRecorder();
  for (let i = 0; i < 20; i++) {
    r.down(i, i, i);
    for (let k = 1; k <= 30; k++) r.move(i, i + k * 3, i);
    r.up(i);
  }
  assert.equal(r.strokes.length, 20);
});

test('toLogical：螢幕座標換算成 320 邏輯像素並夾在範圍內', () => {
  const rect = { left: 100, top: 50, width: 640, height: 640 };
  assert.deepEqual(toLogical(420, 370, rect), { x: 160, y: 160 });
  assert.deepEqual(toLogical(0, 2000, rect), { x: 0, y: 320 });
});
