// P6：Canvas 範本、腦袋格式、一鍵複製組裝、保底版
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { encodeGrid, decodeGrid, pickBrain, decodeBrain, brainBytes, brainSize, toHexSample, MAX_BRAIN_BYTES } from '../engine/brain.js';
import { features } from '../engine/raster.js';
import { classify } from '../engine/knn.js';
import { trainingSet, testSets, shapeStroke, makeRng, LABELS } from '../engine/synth.js';
import { SKILL_IDS, skillBlock, keepSkills, setData, readData, buildCanvas, buildCopy, canvasPet, fallbackCopy, byteLength, GEMINI_INTRO, MAX_TEMPLATE_BYTES } from '../canvas/build.js';
import { demoFiles, DEMO_A, DEMO_B } from '../tools/build-canvas.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const TEMPLATE = read('canvas/template.html');
const KINDS = { 圓: 'circle', 方: 'square', 三角: 'triangle' };

// ── 腦袋格式 ──
test('16×16 編成 128 字十六進位，解回來是 2-bit 量化值', () => {
  const grid = Float32Array.from({ length: 256 }, (_, i) => (i % 7) / 6);
  const hex = encodeGrid(grid);
  assert.match(hex, /^[0-9a-f]{128}$/);
  const back = decodeGrid(hex);
  for (let i = 0; i < 256; i++) assert.ok(Math.abs(back[i] - grid[i]) <= 1 / 6 + 1e-6);
  assert.equal(encodeGrid(back), hex);
});

test('樣本接受遊戲格式與 GAS 格式，格式不對的略過', () => {
  const s = trainingSet(1)[0];
  const h = toHexSample(s);
  assert.equal(h.label, '圓');
  assert.deepEqual(toHexSample({ label: '圓', g: h.g, s: h.s }), h);
  assert.equal(toHexSample({ label: '星星', g: h.g, s: h.s }), null);
  assert.equal(toHexSample({ label: '圓', g: 'xyz', s: h.s }), null);
});

test('腦袋 ≤ 4 KB：200 張樣本也只挑放得下的，各類張數平均', () => {
  const brain = pickBrain(trainingSet(67, 3));
  assert.ok(brainBytes(brain) <= MAX_BRAIN_BYTES, brainBytes(brain) + ' bytes');
  const counts = Object.values(brain).map((l) => l.length);
  assert.equal(counts.length, 3);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  assert.ok(brainSize(brain) >= 12);
  assert.equal(decodeBrain(brain).length, brainSize(brain));
});

test('樣本不多時全部放進腦袋；沒有樣本時是空腦袋', () => {
  assert.equal(brainSize(pickBrain(trainingSet(2))), 6);
  assert.deepEqual(pickBrain([]), {});
  assert.deepEqual(decodeBrain({ 圓: ['bad'] }), []);
});

// ── 範本裡的引擎要跟 engine/ 一致 ──
function engineContext() {
  const code = TEMPLATE.match(/\/\* === ENGINE === \*\/([\s\S]*?)\/\* === END:ENGINE === \*\//)[1];
  const ctx = vm.createContext({});
  vm.runInContext(code, ctx);
  return ctx;
}

test('範本引擎的 16×16 特徵跟 engine/raster.js 一樣', () => {
  const T = engineContext();
  for (const s of testSets.mixed(12, 41)) {
    const strokes = [shapeStroke(s.kind, s.params, makeRng(5))];
    const a = features(strokes);
    const b = T.features(strokes);
    for (let i = 0; i < 256; i++) {
      assert.ok(Math.abs(a.grid[i] - b.grid[i]) < 1e-6);
      assert.ok(Math.abs(a.shape[i] - b.shape[i]) < 1e-6);
    }
  }
});

test('範本引擎的猜測跟 engine/knn.js 一樣（同一個腦袋）', () => {
  const T = engineContext();
  const brain = pickBrain(trainingSet(8, 7));
  const mine = decodeBrain(brain);
  const theirs = T.decodeBrain(JSON.parse(JSON.stringify(brain)));
  for (const q of [...testSets.mixed(30, 99), ...testSets.smallCircles(10)]) {
    const a = classify(q, mine);
    const b = T.classify(q, theirs);
    assert.equal(b.label, a.label);
    assert.ok(Math.abs(b.confidence - a.confidence) < 1e-6);
  }
});

test('精簡版的假資料也猜得出標準圖形', () => {
  const T = engineContext();
  const demo = T.demoSamples();
  assert.equal(demo.length, 15);
  let ok = 0;
  const set = testSets.mixed(30, 7);
  for (const q of set) if (T.classify(q, demo).label === q.label) ok++;
  assert.ok(ok / set.length >= 0.7, `假資料準確率 ${ok}/${set.length}`);
});

// ── 範本檔案 ──
test('範本 ≤ 40 KB、沒有外部連結，9 個技能都有標記且每個 ≤ 30 行', () => {
  assert.ok(byteLength(TEMPLATE) <= MAX_TEMPLATE_BYTES, byteLength(TEMPLATE) + ' bytes');
  assert.doesNotMatch(TEMPLATE, /https?:\/\//);
  assert.doesNotMatch(TEMPLATE, /<(link|img|iframe)\b|src=/i);
  for (const id of SKILL_IDS) {
    const block = skillBlock(TEMPLATE, id);
    assert.ok(block, id);
    assert.match(block, new RegExp(`window\\.PetSkills\\.${id} = \\{`));
    assert.ok(block.split('\n').length - 2 <= 30, `${id} 有 ${block.split('\n').length - 2} 行`);
  }
});

test('範本、精簡版、完整範例跟 tools/build-canvas.mjs 產生的一致', () => {
  for (const [path, text] of Object.entries(demoFiles(TEMPLATE))) assert.equal(read(path), text, `${path} 過期了，請執行 node tools/build-canvas.mjs`);
});

// ── 組裝 ──
test('keepSkills 只留下指定的技能區塊', () => {
  const out = keepSkills(TEMPLATE, ['score', 'anim']);
  for (const id of SKILL_IDS) assert.equal(Boolean(skillBlock(out, id)), id === 'score' || id === 'anim', id);
  assert.match(out, /=== ENGINE ===/);
  assert.match(out, /=== GAME ===/);
});

test('寵物 SVG 放進 <script> 不會提早結束，讀得回來', () => {
  const pet = canvasPet({ appearance: DEMO_A, samples: trainingSet(3) });
  const html = setData(TEMPLATE, { pets: [pet] });
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  assert.doesNotMatch(script, /<\/(svg|script)/);
  const data = readData(html);
  assert.equal(data.pets[0].name, 'AI 寵物（貓）');
  assert.match(data.pets[0].svg, /^<svg/);
  assert.equal(brainSize(data.pets[0].brain), 9);
});

test('精簡版不帶腦袋；一鍵複製＝說明＋範本＋提示詞', () => {
  const pet = canvasPet({ appearance: DEMO_A, samples: trainingSet(3) });
  const lite = buildCanvas(TEMPLATE, { pets: [pet], skills: ['score'], lite: true });
  assert.equal(readData(lite).pets[0].brain, null);
  const copy = buildCopy(TEMPLATE, { pets: [pet], skills: ['score'] }, '我要做一個「AI 猜猜畫畫」。');
  assert.ok(copy.startsWith(GEMINI_INTRO + '\n\n```html\n<!doctype html>'));
  assert.ok(copy.endsWith('</html>\n```\n\n我要做一個「AI 猜猜畫畫」。'));
  assert.ok(fallbackCopy('<p>x</p>').endsWith('```html\n<p>x</p>\n```'));
});

test('沒有樣本的寵物不帶腦袋（遊戲裡會改用假資料）', () => {
  assert.equal(canvasPet({ appearance: DEMO_B, samples: [] }).brain, null);
});

// ── 實際跑範本：最小的假 DOM ──
function fakeElement(tag, doc) {
  const kids = [];
  const classes = new Set();
  const el = {
    tagName: tag.toUpperCase(),
    hidden: false,
    textContent: '',
    innerHTML: '',
    onclick: null,
    width: 640,
    height: 640,
    offsetWidth: 100,
    style: {},
    listeners: {},
    children: kids,
    append: (...n) => kids.push(...n),
    addEventListener: (t, fn) => (el.listeners[t] = fn),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 320 }),
    setPointerCapture() {},
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)), contains: (c) => classes.has(c) },
    getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => ((o[k] = v), true) }),
  };
  Object.defineProperty(el, 'className', { get: () => [...classes].join(' '), set: (v) => (classes.clear(), String(v).split(/\s+/).filter(Boolean).forEach((c) => classes.add(c))) });
  doc.all.push(el);
  return el;
}

function runPage(html, seed = 1) {
  const doc = { all: [], byId: {} };
  const timers = [];
  const errors = [];
  const rng = makeRng(seed);
  const document = {
    getElementById: (id) => doc.byId[id] || (doc.byId[id] = fakeElement('div', doc)),
    createElement: (tag) => fakeElement(tag, doc),
    createTextNode: (t) => ({ textContent: t }),
  };
  const math = Object.create(Math);
  math.random = rng;
  const ctx = vm.createContext({
    document,
    console: { log() {}, error: (...a) => errors.push(a.map(String).join(' ')) },
    Math: math,
    setInterval: (fn) => timers.push(fn) - 1,
    clearInterval: (id) => id != null && (timers[id] = null),
    setTimeout: () => 0,
    clearTimeout() {},
  });
  ctx.window = ctx;
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], ctx);
  const tick = (n) => {
    for (let i = 0; i < n; i++) timers.forEach((fn) => fn && fn());
  };
  return { game: ctx.Game, $: document.getElementById, errors, tick };
}

// 依題目畫一個標準圖形（跟範例很像，AI 應該猜得對）
function drawTarget(game, rng, wrong = false) {
  const label = wrong ? (game.state.target === '圓' ? '方' : '圓') : game.state.target;
  return [shapeStroke(KINDS[label], { size: 90 + rng() * 40, cx: 150 + rng() * 20, cy: 150 + rng() * 20, rotation: 0, jitter: 2 }, rng)];
}

function playToEnd(page, rng) {
  const { game, $ } = page;
  for (let i = 0; i < 40 && game.state.playing; i++) {
    const r = game.guess(drawTarget(game, rng, rng() < 0.25));
    assert.ok(r, '每題都要能猜');
    game.next();
  }
  assert.equal(game.state.playing, false, '一局要能結束');
  assert.equal($('overlay').hidden, false);
  assert.match($('sheet-text').textContent, /^答對 \d+／\d+ 題/);
}

function petsFor(n) {
  const a = canvasPet({ appearance: DEMO_A, samples: trainingSet(8, 7), phrase: '我是 AI 寵物！' });
  const b = canvasPet({ appearance: DEMO_B, samples: trainingSet(8, 21) });
  return n === 2 ? [a, b] : [a];
}

test('沒有任何技能、只有一隻寵物時可以玩完一局', () => {
  const page = runPage(buildCanvas(TEMPLATE, { pets: petsFor(1), skills: [] }));
  assert.equal(page.game.state.total, 5);
  playToEnd(page, makeRng(3));
  assert.deepEqual(page.errors, []);
});

test('隨機 20 組技能組合（1 或 2 隻寵物）都能玩完一局、沒有錯誤', () => {
  const rng = makeRng(2026);
  const seen = new Set();
  while (seen.size < 20) {
    const mask = Math.floor(rng() * 512);
    if (seen.has(mask)) continue;
    seen.add(mask);
    const skills = SKILL_IDS.filter((_, i) => mask & (1 << i));
    const page = runPage(buildCanvas(TEMPLATE, { pets: petsFor(1 + (mask % 2)), skills }), mask + 1);
    playToEnd(page, makeRng(mask));
    page.game.start(); // 再玩一次也正常
    playToEnd(page, makeRng(mask + 7));
    assert.deepEqual(page.errors, [], `組合 ${skills.join(',')}`);
  }
});

test('每個技能單獨啟用都能玩完一局', () => {
  for (const id of SKILL_IDS) {
    const page = runPage(buildCanvas(TEMPLATE, { pets: petsFor(1), skills: [id] }));
    playToEnd(page, makeRng(11));
    assert.deepEqual(page.errors, [], id);
  }
});

test('精簡版（沒有腦袋）也能玩，AI 用假資料猜', () => {
  const page = runPage(read('canvas/lite.html'));
  assert.equal(page.game.pets[0].samples.length, 15);
  playToEnd(page, makeRng(5));
  assert.deepEqual(page.errors, []);
});

test('完整範例成品有兩隻寵物、9 個技能，可以玩完', () => {
  const html = read('canvas/fallback/guess-draw.html');
  for (const id of SKILL_IDS) assert.ok(skillBlock(html, id), id);
  const page = runPage(html);
  assert.equal(page.game.pets.length, 2);
  playToEnd(page, makeRng(8));
  assert.deepEqual(page.errors, []);
});

// ── 個別技能的效果 ──
function playOne(page, rng, wrong = false) {
  const r = page.game.guess(drawTarget(page.game, rng, wrong));
  page.game.next();
  return r;
}

test('計分：猜對加 10 分，結束時顯示得分', () => {
  const page = runPage(buildCanvas(TEMPLATE, { pets: petsFor(1), skills: ['score'] }));
  const rng = makeRng(1);
  let right = 0;
  for (let i = 0; i < 5; i++) if (playOne(page, rng).correct) right++;
  assert.equal(page.game.state.score, right * 10);
  assert.match(page.$('sheet-text').textContent, new RegExp(`得分：${right * 10} 分`));
});

test('計時：30 秒沒畫完就結束', () => {
  const page = runPage(buildCanvas(TEMPLATE, { pets: petsFor(1), skills: ['timer'] }));
  page.tick(29);
  assert.equal(page.game.state.playing, true);
  page.tick(1);
  assert.equal(page.game.state.playing, false);
  assert.match(page.$('sheet-text').textContent, /時間到了！/);
});

test('彩蛋：連續猜對 3 次出現隱藏畫面', () => {
  const page = runPage(buildCanvas(TEMPLATE, { pets: petsFor(1), skills: ['easter'] }));
  const rng = makeRng(4);
  for (let i = 0; i < 3; i++) assert.equal(playOne(page, rng).correct, true);
  assert.equal(page.$('sheet-title').textContent, '隱藏關卡出現了！');
  assert.match(page.$('sheet').className, /holo/);
});

test('關卡：一開始 2 類，猜對 2 次過關變 3 類；一局 9 題', () => {
  const page = runPage(buildCanvas(TEMPLATE, { pets: petsFor(1), skills: ['levels', 'timer'] }));
  assert.equal(page.game.state.total, 9);
  assert.deepEqual([...page.game.state.classes], ['圓', '方']);
  const rng = makeRng(6);
  playOne(page, rng);
  playOne(page, rng);
  assert.deepEqual([...page.game.state.classes], ['圓', '方', '三角']);
  assert.equal(page.game.state.roundTime, 25);
});

test('難度自動調整：連對 3 次變難、連錯 2 次變容易', () => {
  const page = runPage(buildCanvas(TEMPLATE, { pets: petsFor(1), skills: ['adapt'] }));
  const rng = makeRng(9);
  for (let i = 0; i < 3; i++) playOne(page, rng);
  assert.equal(page.game.state.strict, 1);
  playOne(page, rng, true);
  playOne(page, rng, true);
  assert.equal(page.game.state.strict, 0);
});

test('最高分：記在頁面裡，比上一局高才更新', () => {
  const page = runPage(buildCanvas(TEMPLATE, { pets: petsFor(1), skills: ['score', 'highscore'] }));
  playToEnd(page, makeRng(1));
  assert.match(page.$('sheet-text').textContent, /新的最高分！/);
});

test('回饋話語與角色動畫：寵物說話、跳一下或搖一搖', () => {
  const page = runPage(buildCanvas(TEMPLATE, { pets: petsFor(2), skills: ['feedback', 'anim'] }));
  const pet = page.game.pets[0];
  assert.equal(pet.sayEl.textContent, '我是 AI 寵物！');
  const r = page.game.guess(drawTarget(page.game, makeRng(2)));
  assert.ok(pet.sayEl.textContent.length > 0 && pet.sayEl.textContent.length <= 12);
  assert.equal(pet.art.classList.contains(r.correct ? 'jump' : 'shake'), true);
});

test('空白畫布不能猜', () => {
  const page = runPage(buildCanvas(TEMPLATE, { pets: petsFor(1), skills: [] }));
  assert.equal(page.game.guess([]), null);
  assert.match(page.$('result').textContent, /先畫一個/);
});

// ── 保底版 ──
test('保底版：完整版會變色加分，壞掉的版本剛好壞兩處', () => {
  const good = read('canvas/fallback/button-score.html');
  const broken = read('canvas/fallback/button-broken.html');
  assert.match(good, /addEventListener\('click'/);
  assert.match(good, /score = score \+ 1;/);
  assert.match(broken, /addEventListener\('clik'/);
  assert.match(broken, /\n\s+score \+ 1;/);
  const diff = good.split('\n').filter((line, i) => line !== broken.split('\n')[i]);
  assert.equal(diff.length, 2);
  for (const html of [good, broken]) assert.doesNotMatch(html, /https?:\/\//);
});

test('LABELS 與範本題目一致', () => {
  assert.deepEqual(Object.values(LABELS), Object.keys(KINDS));
});
