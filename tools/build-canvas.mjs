// 產生 Canvas 的固定檔案：改了 canvas/template.html 或 canvas/build.js 之後執行一次
//   node tools/build-canvas.mjs
// 1. template.html 的 DATA 區塊換成示範寵物＋示範腦袋（直接打開範本就能玩）
// 2. canvas/lite.html：精簡版（示範寵物、全部道具、沒有腦袋，AI 用電腦畫的假資料）
// 3. canvas/fallback/guess-draw.html：第 5 堂「AI 猜猜畫畫」完整範例成品（兩隻寵物、全部道具）
// test/canvas.test.js 會檢查這三個檔案跟這支程式產生的結果一致。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canvasPet, buildCanvas, setData, SKILL_IDS } from '../canvas/build.js';
import { trainingSet } from '../engine/synth.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const path = (p) => root + p;

// 示範寵物：外型固定、樣本用合成資料（不是任何學生的資料）
export const DEMO_A = { body: 0, color: 9, eyes: 0, accessory: 1, pattern: 0, ears: 0 };
export const DEMO_B = { body: 2, color: 7, eyes: 2, accessory: 3, pattern: 1, ears: 1 };

export function demoFiles(template) {
  const petA = canvasPet({ appearance: DEMO_A, accuracy: 0.8, samples: trainingSet(8, 7), name: '示範寵物', phrase: '我是認真學習的 AI 寵物！' });
  const petB = canvasPet({ appearance: DEMO_B, accuracy: 0.6, samples: trainingSet(8, 21), name: '夥伴寵物', phrase: '今天也是會查證的小幫手～' });
  const base = setData(template, { pets: [petA] });
  return {
    'canvas/template.html': base,
    'canvas/lite.html': buildCanvas(base, { pets: [petA], skills: SKILL_IDS, lite: true }),
    'canvas/fallback/guess-draw.html': buildCanvas(base, { pets: [petA, petB], skills: SKILL_IDS }),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = demoFiles(readFileSync(path('canvas/template.html'), 'utf8'));
  for (const [p, text] of Object.entries(files)) {
    writeFileSync(path(p), text);
    console.log(p, Buffer.byteLength(text), 'bytes');
  }
}
