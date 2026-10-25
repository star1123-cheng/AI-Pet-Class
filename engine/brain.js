// 寵物的「腦袋」＝訓練樣本壓縮後的樣子（docs/04 第 3 節）。不碰 DOM，可以用 node --test 測。
// 每張樣本有兩個 16×16：g＝原圖格、s＝形狀格（見 raster.js features()）。
// 每格 0–1 量化成 0–3（2-bit），兩格合成一個十六進位字，所以一個 16×16 剛好 128 字。
// GAS 的 samples 分頁也是存這種字串（docs/05 第 4 節 getBrain）。
//
// 放進 Canvas 範本的腦袋格式：{ "圓": ["g128+s128", ...], "方": [...] }，每隻寵物 ≤ 4 KB。

import { GRID } from './raster.js';

export const CELLS = GRID * GRID; // 256
export const HEX_LENGTH = CELLS / 2; // 128
export const MAX_BRAIN_BYTES = 4096;
export const CLASS_ORDER = ['圓', '方', '三角', '叉叉'];

const HEX_RE = /^[0-9a-f]{128}$/;

// 0–1 的格子 → 128 字十六進位
export function encodeGrid(grid) {
  let out = '';
  for (let i = 0; i < CELLS; i += 2) out += (q(grid[i]) * 4 + q(grid[i + 1])).toString(16);
  return out;
}

// 128 字十六進位 → Float32Array（0、1/3、2/3、1）
export function decodeGrid(hex) {
  const grid = new Float32Array(CELLS);
  for (let i = 0; i < HEX_LENGTH; i++) {
    const d = parseInt(hex[i], 16);
    grid[i * 2] = (d >> 2) / 3;
    grid[i * 2 + 1] = (d & 3) / 3;
  }
  return grid;
}

export const isHex128 = (s) => typeof s === 'string' && HEX_RE.test(s);

// 樣本統一成 { label, g, s }（十六進位）。接受遊戲內的 { label, grid, shape } 或 GAS 的 { label, g, s }
export function toHexSample(x) {
  if (!x || !CLASS_ORDER.includes(x.label)) return null;
  const g = x.g ?? (x.grid ? encodeGrid(x.grid) : null);
  const s = x.s ?? (x.shape ? encodeGrid(x.shape) : null);
  return isHex128(g) && isHex128(s) ? { label: x.label, g, s } : null;
}

// 從全部樣本挑出放得進 4 KB 的腦袋：一次多放一張（各類輪流），每類在自己的樣本裡平均分散地挑，
// 而不是只拿最前面幾張；超過 4 KB 就退回上一步
export function pickBrain(samples, maxBytes = MAX_BRAIN_BYTES) {
  const groups = new Map(CLASS_ORDER.map((l) => [l, []]));
  for (const x of samples || []) {
    const h = toHexSample(x);
    if (h) groups.get(h.label).push(h.g + h.s);
  }
  const lists = [...groups].filter(([, list]) => list.length);
  const counts = lists.map(() => 0);
  let best = {};
  for (;;) {
    // 下一張給目前張數最少、而且還有樣本可挑的類別
    let pick = -1;
    lists.forEach(([, list], i) => {
      if (counts[i] < list.length && (pick < 0 || counts[i] < counts[pick])) pick = i;
    });
    if (pick < 0) return best;
    counts[pick]++;
    const brain = {};
    lists.forEach(([label, list], i) => {
      if (counts[i]) brain[label] = evenly(list, counts[i]);
    });
    if (brainBytes(brain) > maxBytes) return best;
    best = brain;
  }
}

// 腦袋 → engine/knn.js classify() 用的樣本 [{ label, grid, shape }]；格式不對的略過
export function decodeBrain(brain) {
  const out = [];
  for (const label of CLASS_ORDER) {
    for (const gs of (brain && brain[label]) || []) {
      if (typeof gs !== 'string' || !isHex128(gs.slice(0, HEX_LENGTH)) || !isHex128(gs.slice(HEX_LENGTH))) continue;
      out.push({ label, grid: decodeGrid(gs.slice(0, HEX_LENGTH)), shape: decodeGrid(gs.slice(HEX_LENGTH)) });
    }
  }
  return out;
}

export const brainBytes = (brain) => new TextEncoder().encode(JSON.stringify(brain)).length;
export const brainSize = (brain) => CLASS_ORDER.reduce((n, l) => n + ((brain && brain[l]) || []).length, 0);

function q(v) {
  const n = Math.round((Number(v) || 0) * 3);
  return n < 0 ? 0 : n > 3 ? 3 : n;
}

// 從 list 平均分散地挑 k 張（k ≤ list.length）
function evenly(list, k) {
  return Array.from({ length: k }, (_, i) => list[Math.floor((i * list.length) / k)]);
}
