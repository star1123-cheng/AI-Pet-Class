// 寵物的訓練範例、內建測試集、狀態數值（docs/03 5.2、docs/05 第 3 節）。不碰 DOM。
//
// 範例在 iPad 上存成 { idx, label, g, s, flagged }：g、s 是 engine/brain.js 的 128 字十六進位，
// 跟 GAS samples 分頁同一種格式。flagged＝true 代表學生確認標錯，不參加比對。

import { features, isBlank } from '../engine/raster.js';
import { accuracy, classify } from '../engine/knn.js';
import { checkHealth } from '../engine/health.js';
import { encodeGrid, decodeGrid } from '../engine/brain.js';
import { makeSet, testSets, biasedTrainingSet } from '../engine/synth.js';

export const LESSON_CLASSES = { 1: ['圓', '方'], 2: ['圓', '方', '三角'] };
export const classesOf = (lesson) => LESSON_CLASSES[lesson >= 2 ? 2 : 1];

// 內建測試集（固定種子，每個人考一樣的題目）。第一次用到才產生
const SETS = {
  // 第 1 堂只有圓、方：方轉太斜會像圓，學生也很少畫得那麼斜，所以旋轉只到約 ±9°（docs/03 5.2）
  l1: () => makeSet(['circle', 'square'], 20, 404, { rotation: 0.15 }),
  mixed: () => testSets.mixed(),
  small: () => testSets.smallCircles(),
  big: () => testSets.bigCircles(),
};
const cache = new Map();
export function testSet(name) {
  // 轉成跟學生範例一樣的 2-bit 格子再比，兩邊才公平
  if (!cache.has(name)) cache.set(name, SETS[name]().map((x) => decode(toStored(x, 0))));
  return cache.get(name);
}
// 寵物卡上的準確率用哪一份：第 1 堂只有圓、方，之後用三類混合
export const setForLesson = (lesson) => (lesson <= 1 ? 'l1' : 'mixed');

// 筆畫 → 範例；空白回傳 null
export function sampleFromStrokes(strokes, label, idx) {
  if (!strokes.length) return null;
  const f = features(strokes);
  if (isBlank(f.grid)) return null;
  return { idx, label, g: encodeGrid(f.grid), s: encodeGrid(f.shape), flagged: false };
}

// 合成樣本（神祕資料包、實驗用）→ 範例格式
export function toStored(x, idx, label = x.label) {
  return { idx, label, g: encodeGrid(x.grid), s: encodeGrid(x.shape), flagged: false };
}

// 存檔格式 → knn 用的 { label, grid, shape }。解碼結果依字串快取，畫面重算時不會每次重解
const decoded = new Map();
export function decode(x) {
  const key = x.g + x.s;
  let d = decoded.get(key);
  if (!d) {
    d = { grid: decodeGrid(x.g), shape: decodeGrid(x.s) };
    if (decoded.size > 2000) decoded.clear();
    decoded.set(key, d);
  }
  return { label: x.label, grid: d.grid, shape: d.shape, flagged: !!x.flagged };
}

export const usable = (samples) => samples.filter((x) => !x.flagged).map(decode);

// 考一份測試集；沒有範例回傳 null
export function testOn(samples, name) {
  const train = usable(samples);
  return train.length ? accuracy(train, testSet(name)) : null;
}

// 寵物卡數值：資料量、資料品質、準確率（trainCount 由餵食時另外加）
export function measure(samples, lesson) {
  const health = checkHealth(samples.map(decode), { classes: classesOf(lesson) });
  return {
    dataCount: samples.filter((x) => !x.flagged).length,
    dataQuality: health.dataQuality,
    accuracy: testOn(samples, setForLesson(lesson)),
    health,
  };
}

export function countsOf(samples, classes) {
  const c = Object.fromEntries(classes.map((l) => [l, 0]));
  for (const x of samples) if (!x.flagged && x.label in c) c[x.label]++;
  return c;
}

// 猜猜看：回傳 { label, confidence, neighbors[{ sample(存檔格式), similarity }] }
export function guess(sample, samples) {
  const list = samples.filter((x) => !x.flagged);
  if (!list.length) return null;
  const r = classify(decode(sample), list.map(decode));
  return { ...r, neighbors: r.neighbors.map((n) => ({ sample: list[n.index], similarity: n.similarity })) };
}

// ── 第 2 堂實驗用的 AI（另外一隻，不動學生的資料）──

// 只看過圓：用學生自己的圓；不到 3 張就補電腦畫的圓
export function onlyCircles(samples) {
  const own = usable(samples).filter((x) => x.label === '圓');
  const extra = own.length >= 3 ? [] : makeSet(['circle'], 5 - own.length, 31);
  return [...own, ...extra];
}

// 單一類別實驗：只看過圓的 AI 考混合測試集，回傳每題猜什麼
export function singleClassRun(samples) {
  const train = onlyCircles(samples);
  return testSet('mixed').map((t) => ({ truth: t.label, guess: classify(t, train).label, test: t }));
}

// 大小圓實驗：只看過大圓（方、三角大小都有）的 AI 分別考大圓、小圓
export function biasRun() {
  const train = biasedTrainingSet(5, 11);
  return { big: accuracy(train, testSet('big')), small: accuracy(train, testSet('small')) };
}
