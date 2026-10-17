// P1 原型頁：把 engine/* 接到畫面上。所有文字都用 textContent，不用 innerHTML。
import { CANVAS_SIZE, LINE_WIDTH, createStrokeRecorder, attachPointer } from './engine/stroke.js';
import { features, isBlank, GRID } from './engine/raster.js';
import { classify, accuracy } from './engine/knn.js';
import { checkHealth } from './engine/health.js';
import { trainingSet, biasedTrainingSet, testSets } from './engine/synth.js';

const CLASSES = ['圓', '方', '三角'];
const STORE_KEY = 'aipet.p1.samples';
const TRIAL_KEY = 'aipet.p1.trial';

const $ = (id) => document.getElementById(id);
const pad = $('pad');
const ctx = pad.getContext('2d');
const recorder = createStrokeRecorder();

let chosen = null;
let samples = load(STORE_KEY, []).map(fromStored);
let trial = load(TRIAL_KEY, { right: 0, wrong: 0 });
let lastGuess = null;

// ── 畫布 ──
let scale = 1;

function layout() {
  const portrait = window.innerHeight > window.innerWidth;
  const avail = portrait
    ? Math.min(window.innerWidth - 40, window.innerHeight * 0.5)
    : Math.min(window.innerHeight - 170, window.innerWidth * 0.5);
  const css = Math.max(240, Math.floor(avail));
  const dpr = window.devicePixelRatio || 1;
  pad.style.width = pad.style.height = css + 'px';
  pad.width = pad.height = Math.round(css * dpr);
  scale = pad.width / CANVAS_SIZE;
  redraw();
}

function setupPen() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#222';
  ctx.fillStyle = '#222';
}

function redraw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pad.width, pad.height);
  setupPen();
  for (const pts of recorder.strokes) {
    if (pts.length === 1) {
      dot(pts[0]);
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
}

function dot(p) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, LINE_WIDTH / 2, 0, Math.PI * 2);
  ctx.fill();
}

// 只補畫新線段，連畫很多筆也不會卡
attachPointer(pad, recorder, {
  onSegment(a, b) {
    setupPen();
    if (a === b) return dot(a);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  },
  onChange() {
    if (!recorder.drawing) redraw();
  },
});

window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 200));
// iOS Safari 不理 user-scalable=no，要另外擋雙指縮放
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

$('undo').onclick = () => {
  recorder.undo();
  redraw();
};
$('clear').onclick = clearPad;

function clearPad() {
  recorder.clear();
  redraw();
}

function currentFeatures() {
  if (recorder.isEmpty()) return null;
  const f = features(recorder.strokes);
  return isBlank(f.grid) ? null : f;
}

// ── 1. 餵食 ──
for (const label of CLASSES) {
  const b = document.createElement('button');
  b.className = 'label';
  b.textContent = label;
  b.setAttribute('aria-pressed', 'false');
  b.onclick = () => {
    chosen = label;
    for (const x of $('labels').children) x.setAttribute('aria-pressed', String(x.textContent === label));
  };
  $('labels').append(b);
}

$('feed').onclick = () => {
  const f = currentFeatures();
  if (!f) return say('先畫一個圖形');
  if (!chosen) return say('先選這是什麼');
  samples.push({ label: chosen, ...f, flagged: false });
  save();
  say(`餵了一張「${chosen}」`);
  clearPad();
  render();
};

// ── 2. 考考 ──
$('quiz').onclick = () => {
  const f = currentFeatures();
  if (!f) return say('先畫一個圖形讓牠猜');
  const usable = samples.filter((s) => !s.flagged);
  if (!usable.length) return say('AI 還沒學過任何範例，先餵牠');
  const r = classify(f, usable);
  lastGuess = r;
  $('guess').textContent = `我猜是「${r.label}」（信心 ${pct(r.confidence)}）`;
  const box = $('neighbors');
  box.replaceChildren();
  for (const n of r.neighbors) {
    const s = usable[n.index];
    const cell = document.createElement('div');
    cell.className = 'thumb';
    cell.append(thumb(s.grid), text(`${s.label}・像 ${pct(n.similarity)}`));
    box.append(cell);
  }
  $('whyBox').hidden = false;
  $('right').disabled = $('wrong').disabled = false;
};

function mark(ok) {
  if (!lastGuess) return;
  trial[ok ? 'right' : 'wrong']++;
  store(TRIAL_KEY, trial);
  lastGuess = null;
  $('right').disabled = $('wrong').disabled = true;
  clearPad();
  renderTrial();
}
$('right').onclick = () => mark(true);
$('wrong').onclick = () => mark(false);

function renderTrial() {
  const n = trial.right + trial.wrong;
  $('trial').textContent = n ? `試玩紀錄：${n} 次中猜對 ${trial.right} 次（${pct(trial.right / n)}）` : '試玩紀錄：還沒有';
}

// ── 3. 資料健檢 ──
function render() {
  $('dataCount').textContent = `資料量：${samples.length} 張`;
  const h = checkHealth(samples, { classes: CLASSES });
  const box = $('health');
  box.replaceChildren();

  const max = Math.max(1, ...Object.values(h.counts));
  for (const label of CLASSES) {
    const row = document.createElement('div');
    row.className = 'bar';
    const bar = document.createElement('i');
    bar.style.width = (h.counts[label] / max) * 100 + '%';
    const track = document.createElement('div');
    track.append(bar);
    row.append(text(label), track, text(String(h.counts[label])));
    box.append(row);
  }

  const score = document.createElement('p');
  score.className = 'score ' + (h.dataQuality >= 70 ? 'good' : 'warn');
  score.textContent = `資料品質 ${h.dataQuality}`;
  box.append(score);
  box.append(
    text(`類別平衡 ${pct(h.balance)}・大小多樣性 ${pct(h.diversity)}・乾淨度 ${pct(h.clean)}`, 'p', 'muted'),
  );
  if (samples.length && h.balance < 1) box.append(text(`提示：「${h.smallestClass}」最少，再多餵幾張`, 'p'));

  const sus = h.suspicious.find((x) => !samples[x.index].flagged);
  if (sus) {
    const s = samples[sus.index];
    const wrap = document.createElement('div');
    wrap.className = 'row';
    const note = sus.closerToOther ? `標「${s.label}」，但比較像「${sus.closerToOther}」` : `是「${s.label}」裡最不像的一張`;
    const flag = button('這張標錯了', () => {
      s.flagged = true;
      save();
      render();
    });
    const del = button('刪掉這張', () => {
      samples.splice(sus.index, 1);
      save();
      render();
    });
    wrap.append(thumb(s.grid), text(`可疑：這張${note}`), flag, del);
    box.append(wrap);
  }
}

// ── 老師工具 ──
$('loadMixed').onclick = () => {
  samples = trainingSet(5, Date.now() % 1000).map(strip);
  save();
  render();
  say('已載入合成資料');
};
$('loadBiased').onclick = () => {
  samples = biasedTrainingSet(5, Date.now() % 1000).map(strip);
  save();
  render();
  say('已載入偏誤資料：圓只有大圓');
};
$('runTests').onclick = () => {
  const usable = samples.filter((s) => !s.flagged);
  if (!usable.length) return say('目前沒有資料');
  const m = accuracy(usable, testSets.mixed());
  const big = accuracy(usable, testSets.bigCircles());
  const small = accuracy(usable, testSets.smallCircles());
  $('testOut').textContent = `用目前的資料測：混合 ${pct(m)}・大圓 ${pct(big)}・小圓 ${pct(small)}`;
};
$('resetTrial').onclick = () => {
  trial = { right: 0, wrong: 0 };
  store(TRIAL_KEY, trial);
  renderTrial();
};
$('wipe').onclick = () => {
  if (!confirm('確定清空所有範例？')) return;
  samples = [];
  save();
  render();
};

// ── 小工具 ──
function thumb(grid) {
  const c = document.createElement('canvas');
  c.width = c.height = GRID;
  const g = c.getContext('2d');
  const img = g.createImageData(GRID, GRID);
  for (let i = 0; i < grid.length; i++) {
    const v = 255 - Math.round(grid[i] * 220);
    img.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  return c;
}

function text(str, tag = 'span', cls) {
  const el = document.createElement(tag);
  el.textContent = str;
  if (cls) el.className = cls;
  return el;
}

function button(label, onclick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = onclick;
  return b;
}

function say(str) {
  $('msg').textContent = str;
}

const pct = (x) => Math.round(x * 100) + '%';
const strip = (s) => ({ label: s.label, grid: s.grid, shape: s.shape, flagged: false });

function save() {
  store(
    STORE_KEY,
    samples.map((s) => ({ label: s.label, g: round(s.grid), s: round(s.shape), flagged: s.flagged })),
  );
}

function fromStored(x) {
  return { label: x.label, grid: Float32Array.from(x.g), shape: x.s ? Float32Array.from(x.s) : undefined, flagged: !!x.flagged };
}

const round = (arr) => Array.from(arr, (v) => Math.round(v * 100) / 100);

// 私密模式或儲存空間滿時，localStorage 會丟錯；遊戲照常運作
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    say('（這台 iPad 無法儲存，重新整理後資料會不見）');
  }
}

// 離線可用：只在 https 或 localhost 註冊 service worker
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

layout();
render();
renderTrial();
$('right').disabled = $('wrong').disabled = true;
