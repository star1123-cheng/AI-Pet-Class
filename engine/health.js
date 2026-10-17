// 資料健檢：各類張數、類別平衡、各類大小分布、可疑樣本、dataQuality。
// 公式與 docs/05 第 5 節同步，改這裡要一起改那邊。

import { bbox } from './raster.js';
import { distance, featureVector } from './knn.js';

export const WEIGHTS = { balance: 0.4, diversity: 0.3, clean: 0.3 };

// 一類的面積「變異係數」（標準差÷平均）達到這個值，多樣性就算滿分
export const DIVERSITY_TARGET = 0.35;

// samples：[{ label, grid, flagged? }]，flagged=true 代表已確認標錯
// options.classes：這堂課應該有的類別，沒餵到的類別算 0 張
export function checkHealth(samples, options = {}) {
  const weights = { ...WEIGHTS, ...options.weights };
  const classes = options.classes ?? [...new Set(samples.map((s) => s.label))];

  const byClass = new Map(classes.map((c) => [c, []]));
  samples.forEach((s, index) => {
    if (!byClass.has(s.label)) byClass.set(s.label, []);
    byClass.get(s.label).push({ ...s, index });
  });

  const counts = {};
  const area = {};
  for (const [label, list] of byClass) {
    counts[label] = list.length;
    const areas = list.map((s) => bbox(s.grid)?.area ?? 0);
    area[label] = { mean: mean(areas), std: std(areas) };
  }

  const balance = balanceScore(Object.values(counts));
  const diversity = diversityScore(byClass, area);
  const flaggedCount = samples.filter((s) => s.flagged).length;
  const clean = samples.length ? 1 - flaggedCount / samples.length : 0;

  const score = samples.length
    ? weights.balance * balance + weights.diversity * diversity + weights.clean * clean
    : 0;

  return {
    total: samples.length,
    counts,
    area,
    balance,
    diversity,
    clean,
    flaggedCount,
    suspicious: findSuspicious(byClass),
    smallestClass: smallest(counts),
    dataQuality: Math.round(score * 100),
  };
}

// 類別平衡＝最少張數÷最多張數；只有一類或有類別是 0 張都會拉低
export function balanceScore(countList) {
  if (countList.length < 2) return 0;
  const max = Math.max(...countList);
  return max === 0 ? 0 : Math.min(...countList) / max;
}

// 多樣性＝各類面積變異係數÷DIVERSITY_TARGET（最多 1），再取各類平均。
// 少於 2 張的類別算 0。全部畫一樣大（例如只畫大圓）分數就會很低。
function diversityScore(byClass, area) {
  const labels = [...byClass.keys()];
  if (!labels.length) return 0;
  let sum = 0;
  for (const label of labels) {
    const { mean: m, std: sd } = area[label];
    if (byClass.get(label).length < 2 || m === 0) continue;
    sum += Math.min(1, sd / m / DIVERSITY_TARGET);
  }
  return sum / labels.length;
}

// 可疑樣本：每類（至少 3 張）離同類中心最遠的那一張。
// closerToOther=true 表示它其實更像別類的中心，很可能標錯
function findSuspicious(byClass) {
  // 跟 knn.js 用同一套特徵算距離；有樣本缺 shape 時全部只用原圖格
  const all = [...byClass.values()].flat();
  const useShape = all.length > 0 && all.every((s) => s.shape);
  for (const s of all) s.vec = useShape ? featureVector(s) : s.grid;

  const centers = new Map();
  for (const [label, list] of byClass) if (list.length) centers.set(label, centroid(list));

  const out = [];
  for (const [label, list] of byClass) {
    if (list.length < 3) continue;
    const c = centers.get(label);
    let worst = null;
    for (const s of list) {
      const d = distance(s.vec, c);
      if (!worst || d > worst.distance) worst = { index: s.index, label, distance: d, vec: s.vec };
    }
    let closerToOther = null;
    for (const [other, oc] of centers) {
      if (other === label) continue;
      if (distance(worst.vec, oc) < worst.distance) closerToOther = other;
    }
    out.push({ index: worst.index, label, distance: worst.distance, closerToOther });
  }
  return out.sort((a, b) => b.distance - a.distance);
}

function centroid(list) {
  const n = list[0].vec.length;
  const c = new Float32Array(n);
  for (const s of list) for (let i = 0; i < n; i++) c[i] += s.vec[i];
  for (let i = 0; i < n; i++) c[i] /= list.length;
  return c;
}

function smallest(counts) {
  let min = null;
  for (const [label, n] of Object.entries(counts)) if (min === null || n < counts[min]) min = label;
  return min;
}

function mean(xs) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

function std(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}
