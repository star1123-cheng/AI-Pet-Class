import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, distance, similarity, accuracy } from '../engine/knn.js';

// 用 4 格的小向量測邏輯，比較好看懂
const s = (label, grid) => ({ label, grid });

test('distance：歐氏距離', () => {
  assert.equal(distance([0, 0], [3, 4]), 5);
  assert.equal(distance([1, 1], [1, 1]), 0);
});

test('similarity：距離 0 是 1，越遠越小、不會小於 0', () => {
  assert.equal(similarity(0, 256), 1);
  assert.equal(similarity(4, 256), 0.75);
  assert.equal(similarity(100, 256), 0);
});

test('沒有範例時不猜', () => {
  const r = classify([0, 0, 0, 0], []);
  assert.equal(r.label, null);
  assert.equal(r.neighbors.length, 0);
});

test('k=3：回傳猜測、信心、最像的 3 張（由近到遠）', () => {
  const train = [
    s('圓', [1, 0, 0, 0]),
    s('圓', [0.9, 0.1, 0, 0]),
    s('方', [0, 0, 1, 0]),
    s('方', [0, 0, 0.9, 0.1]),
    s('方', [0, 0, 0.8, 0.2]),
  ];
  const r = classify([0.95, 0.05, 0, 0], train);
  assert.equal(r.label, '圓');
  assert.equal(r.neighbors.length, 3);
  assert.deepEqual(r.neighbors.slice(0, 2).map((n) => n.label), ['圓', '圓']);
  assert.ok(r.neighbors[0].distance <= r.neighbors[1].distance);
  assert.ok(r.neighbors[1].distance <= r.neighbors[2].distance);
  assert.ok(r.confidence > 0.5 && r.confidence <= 1);
  for (const n of r.neighbors) assert.ok(n.similarity >= 0 && n.similarity <= 1);
  assert.equal(typeof r.neighbors[0].index, 'number');
});

test('範例少於 3 張時用現有的', () => {
  const r = classify([1, 0], [s('圓', [1, 0])]);
  assert.equal(r.label, '圓');
  assert.equal(r.confidence, 1);
  assert.equal(r.neighbors.length, 1);
});

test('只餵一類時什麼都猜那一類（第 2 堂單一類別實驗）', () => {
  const train = [s('圓', [1, 0]), s('圓', [0.8, 0.2])];
  assert.equal(classify([0, 1], train).label, '圓');
});

test('accuracy：計算答對比例', () => {
  const train = [s('a', [0, 0]), s('b', [10, 10])];
  const testSet = [s('a', [1, 0]), s('b', [9, 9]), s('a', [9, 10])];
  assert.equal(accuracy(train, testSet, 1), 2 / 3);
});
