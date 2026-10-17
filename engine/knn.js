// k 近鄰：新圖跟每一張範例算距離，取最近的 k 張投票。
// 這就是給學生看的「我是因為跟這幾張最像」。
//
// 每張圖有兩種特徵（見 raster.js features()）：
//   shape：形狀格（裁切放大後的 16×16）
//   grid ：原圖格（保留大小與位置的 16×16）
// 距離＝把「形狀格」和「原圖格×SIZE_WEIGHT」接在一起算歐氏距離。
// SIZE_WEIGHT 越大，AI 越在意畫多大、畫在哪；0.8 是 P1 實驗兼顧準確率與偏誤實驗的值。
// 沒有 shape 的樣本（例如舊資料）只用 grid 比對。

export const K = 3;
export const SIZE_WEIGHT = 0.8;

export function distance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// 把樣本轉成一條數字（給 health.js 算中心也用同一套）
export function featureVector(sample, sizeWeight = SIZE_WEIGHT) {
  const { grid, shape } = asSample(sample);
  if (!shape) return grid;
  const v = new Float32Array(shape.length + grid.length);
  v.set(shape, 0);
  for (let i = 0; i < grid.length; i++) v[shape.length + i] = grid[i] * sizeWeight;
  return v;
}

// 距離換成 0–1 的相似度，給學生看「像 85%」。
// 以「每一格都完全不同」當 0%
export function similarity(d, dims = 256, sizeWeight = 0) {
  const zero = Math.sqrt(dims * (1 + sizeWeight * sizeWeight));
  return Math.max(0, 1 - d / zero);
}

// query：{ grid, shape? } 或直接一個數字陣列（只有 grid）
// samples：[{ label, grid, shape? }]
// 回傳 { label, confidence, neighbors: [{ index, label, similarity, distance }] }
// 沒有範例時 label 為 null
export function classify(query, samples, options = {}) {
  const { k, sizeWeight } = opts(options);
  if (!samples.length) return { label: null, confidence: 0, neighbors: [] };

  const q = asSample(query);
  const useShape = Boolean(q.shape) && samples.every((s) => s.shape);
  const w = useShape ? sizeWeight : 0;
  const qv = useShape ? featureVector(q, w) : q.grid;

  const scored = samples.map((s, index) => ({
    index,
    label: s.label,
    distance: distance(qv, useShape ? featureVector(s, w) : s.grid),
  }));
  scored.sort((a, b) => a.distance - b.distance);
  const top = scored.slice(0, Math.min(k, scored.length));

  // 距離越近票越重；票數相同時，最近那張的類別贏
  const votes = new Map();
  for (const n of top) {
    const vw = 1 / (n.distance + 1e-6);
    votes.set(n.label, (votes.get(n.label) || 0) + vw);
  }
  let label = top[0].label;
  let best = votes.get(label);
  for (const [l, vw] of votes) {
    if (vw > best + 1e-9) {
      label = l;
      best = vw;
    }
  }
  const total = [...votes.values()].reduce((s, vw) => s + vw, 0);
  const dims = q.grid.length;

  return {
    label,
    confidence: best / total,
    neighbors: top.map((n) => ({ ...n, similarity: useShape ? similarity(n.distance, dims, w) : similarity(n.distance, dims) })),
  };
}

// 用訓練集預測測試集，回傳準確率 0–1
export function accuracy(train, testSet, options = {}) {
  if (!testSet.length) return 0;
  let ok = 0;
  for (const t of testSet) if (classify(t, train, options).label === t.label) ok++;
  return ok / testSet.length;
}

function asSample(x) {
  return ArrayBuffer.isView(x) || Array.isArray(x) ? { grid: x } : x;
}

// 相容舊寫法：第三個參數直接給 k
function opts(o) {
  if (typeof o === 'number') return { k: o, sizeWeight: SIZE_WEIGHT };
  return { k: o.k ?? K, sizeWeight: o.sizeWeight ?? SIZE_WEIGHT };
}
