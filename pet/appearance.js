// 序號 → 外型參數。同一個序號永遠得到同一隻寵物，換 iPad 也一樣。
// 做法：序號雜湊（FNV-1a 32 位元）mod 34,560，再拆成 6 個參數（像把數字拆成個位、十位…）。
// 不同序號可能撞到同一組外型，所以發號時（gas/Admin.gs）會跳過撞到的序號，保證全班每人不同。
// gas/Shared.gs 有同一套邏輯，test/gas.test.js 會比對兩邊結果一致。

export const PARTS = [
  ['body', 6],
  ['color', 12],
  ['eyes', 5],
  ['accessory', 6],
  ['pattern', 4],
  ['ears', 4],
];

export const COMBINATIONS = PARTS.reduce((n, [, k]) => n * k, 1); // 34,560

export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 外型編號 0–34,559，發號時用它檢查有沒有重複
export function appearanceId(serial) {
  return hash(serial) % COMBINATIONS;
}

export function appearanceFromId(id) {
  const a = {};
  let n = id;
  for (const [name, k] of PARTS) {
    a[name] = n % k;
    n = Math.floor(n / k);
  }
  return a;
}

export function appearanceOf(serial) {
  return appearanceFromId(appearanceId(serial));
}

// 檢查外型參數都是範圍內的整數（render.js 只接受這種輸入）
export function isValidAppearance(a) {
  return !!a && PARTS.every(([name, k]) => Number.isInteger(a[name]) && a[name] >= 0 && a[name] < k);
}
