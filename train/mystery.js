// 神祕資料包（docs/03 5.4）：電腦畫的 12 張圖，其中 4 張標錯，學生要找出來移除。不碰 DOM。
// 依序號與包號產生：每人不同、同一包重新整理還是一樣。

import { hash } from '../pet/appearance.js';
import { makeRng, makeSample, randomParams, SHAPES, LABELS } from '../engine/synth.js';
import { encodeGrid } from '../engine/brain.js';

export const PACK_SIZE = 12; // 三類各 4 張
export const PACK_WRONG = 4;
export const PACK_PASS = 3; // ★★：移除的圖裡至少 3 張真的標錯

// 回傳 [{ id, label(包上寫的), truth(其實是), wrong, g, s }]
export function makePack(serial, packNo = 0) {
  const rng = makeRng(hash(serial + '#' + packNo));
  const items = [];
  for (let i = 0; i < PACK_SIZE; i++) {
    const kind = SHAPES[i % SHAPES.length];
    const x = makeSample(kind, randomParams(rng), rng);
    items.push({ truth: LABELS[kind], g: encodeGrid(x.grid), s: encodeGrid(x.shape) });
  }
  // 洗牌，讓同類不會排在一起
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  // 挑 4 張標錯：每類至少 1 張，標成另外兩類之一
  const wrong = new Set();
  for (const kind of SHAPES) wrong.add(items.findIndex((x, k) => x.truth === LABELS[kind] && !wrong.has(k)));
  while (wrong.size < PACK_WRONG) wrong.add(Math.floor(rng() * items.length));
  return items.map((x, k) => {
    const others = SHAPES.map((s) => LABELS[s]).filter((l) => l !== x.truth);
    const label = wrong.has(k) ? others[Math.floor(rng() * others.length)] : x.truth;
    return { id: k, label, truth: x.truth, wrong: wrong.has(k), g: x.g, s: x.s };
  });
}

// removed：學生選要移除的 id。回傳 { found(移除裡真的標錯), mistaken(移除了正確的), missed(標錯卻留著), kept }
export function packResult(pack, removed) {
  const out = { found: 0, mistaken: 0, missed: 0, kept: [] };
  for (const x of pack) {
    if (removed.has(x.id)) x.wrong ? out.found++ : out.mistaken++;
    else {
      if (x.wrong) out.missed++;
      out.kept.push(x);
    }
  }
  out.pass = out.found >= PACK_PASS;
  return out;
}
