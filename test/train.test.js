import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGas, fakeFetch } from './gas-fake.js';
import { createStore, safeStorage } from '../app/store.js';
import { createApi, nextBatch, BATCH_CHARS } from '../app/api.js';
import { FORMS, quizRound, quizScore } from '../train/quiz.js';
import { testSet, measure, testOn, toStored, guess, singleClassRun, biasRun, countsOf, sampleFromStrokes } from '../train/data.js';
import { makePack, packResult, PACK_SIZE, PACK_WRONG } from '../train/mystery.js';
import {
  TASKS,
  newPlay,
  playOf,
  recordTest,
  taskDone,
  newlyDone,
  grantTask,
  SHEETS,
  sheetCorrect,
  choiceCode,
  METAPHORS,
  paceOf,
  LABEL_CODE,
} from '../train/lessons.js';
import { makeSet, makeSample, randomParams, makeRng, SMALL, shapeStroke } from '../engine/synth.js';
import { isHex128 } from '../engine/brain.js';

function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

const CODE_RE = /^[A-Za-z0-9_.-]{1,32}$/; // 與 gas/Code.gs 相同

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function claimed(n = 3) {
  const gas = createGas();
  gas.ctx.setupSheets();
  const serials = gas.ctx.issueSerials(n);
  for (const s of serials) assert.equal(gas.post({ action: 'claimPet', serial: s }).ok, true);
  return { gas, serials };
}

const rowsOf = (gas, name) => gas.sheets.get(name).rows.slice(1).filter((r) => r.some((v) => v !== ''));

// 電腦畫的範例（存檔格式），idx 從 start 開始
const stored = (list, start = 0) => list.map((x, i) => toStored(x, start + i));

// ── 前測 ──

test('前測：A、B 版各 5 題、每題 3 個選項，正確答案與 docs/03 5.1 一致', () => {
  for (const form of ['A', 'B']) {
    assert.equal(FORMS[form].length, 5);
    for (const q of FORMS[form]) assert.equal(q.options.length, 3, q.id);
  }
  assert.deepEqual(FORMS.A.map((q) => q.answer), ['a', 'b', 'b', 'b', 'b']);
  assert.deepEqual(FORMS.B.map((q) => q.answer), ['a', 'b', 'b', 'b', 'b']);
  // 第 A1 題的 a 是正確答案
  assert.match(FORMS.A[0].options[0], /^沒有/);
});

test('完成標準：前測題目與選項順序每次不同，代碼跟著選項走', () => {
  const random = seeded(3);
  const orders = new Set();
  const optionOrders = new Set();
  for (let i = 0; i < 30; i++) {
    const r = quizRound('A', random);
    orders.add(r.map((q) => q.id).join());
    optionOrders.add(r.find((q) => q.id === 'A2').options.map((o) => o.id).join());
    for (const q of r) {
      const src = FORMS.A.find((x) => x.id === q.id);
      for (const o of q.options) assert.equal(o.text, src.options['abc'.indexOf(o.id)]);
    }
  }
  assert.ok(orders.size > 10, '題目順序要常常不同');
  assert.ok(optionOrders.size >= 4, '選項順序要常常不同');
  assert.equal(quizScore('A', FORMS.A.map((q) => ({ q: q.id, choice: q.answer }))), 5);
});

test('完成標準：submitQuiz 只記序號與選項代碼，同一題只記第一次', () => {
  const { gas, serials } = claimed(1);
  const s = serials[0];
  const answers = FORMS.A.map((q) => ({ q: q.id, choice: 'b' }));
  assert.deepEqual(gas.post({ action: 'submitQuiz', serial: s, form: 'A', answers }), { ok: true });
  assert.deepEqual(gas.post({ action: 'submitQuiz', serial: s, form: 'A', answers: [{ q: 'A1', choice: 'a' }] }), { ok: true, dup: true });
  const rows = rowsOf(gas, 'quiz');
  assert.equal(rows.length, 5);
  for (const r of rows) {
    assert.equal(r[0], s);
    assert.equal(r[1], 'A');
    assert.match(r[2], /^A[1-5]$/);
    assert.equal(r[3], 'b'); // 第二次送的 A1＝a 沒有覆蓋
  }
  // 不收自由文字、不收別版題號、不收沒領養的序號
  assert.equal(gas.post({ action: 'submitQuiz', serial: s, form: 'A', answers: [{ q: 'A1', choice: '我覺得是 a' }] }).error, 'bad_request');
  assert.equal(gas.post({ action: 'submitQuiz', serial: s, form: 'A', answers: [{ q: 'B1', choice: 'a' }] }).error, 'bad_request');
  assert.equal(gas.post({ action: 'submitQuiz', serial: s, form: 'C', answers: [{ q: 'A1', choice: 'a' }] }).error, 'bad_request');
  const other = gas.ctx.issueSerials(1)[0];
  assert.equal(gas.post({ action: 'submitQuiz', serial: other, form: 'A', answers: [{ q: 'A1', choice: 'a' }] }).error, 'not_claimed');
});

// ── 範例上傳 ──

test('saveSamples：依 idx 新增或覆蓋，格式不對整筆拒收；getBrain 不回傳標錯與刪掉的', () => {
  const { gas, serials } = claimed(1);
  const s = serials[0];
  const list = stored(makeSet(['circle', 'square', 'triangle'], 6, 5));
  assert.deepEqual(gas.post({ action: 'saveSamples', serial: s, samples: list }), { ok: true });
  assert.equal(rowsOf(gas, 'samples').length, 6);
  // 補送同一批不會多出列；標錯一張、刪掉一張
  assert.deepEqual(gas.post({ action: 'saveSamples', serial: s, samples: list }), { ok: true });
  gas.post({ action: 'saveSamples', serial: s, samples: [{ ...list[0], flagged: true }, { ...list[1], flagged: 'removed' }] });
  const rows = rowsOf(gas, 'samples');
  assert.equal(rows.length, 6);
  assert.equal(rows[0][5], true);
  assert.equal(rows[1][5], 'removed');
  const brain = gas.post({ action: 'getBrain', serial: s }).brain;
  assert.equal(brain.length, 4);
  for (const b of brain) assert.ok(isHex128(b.g) && isHex128(b.s));

  const bad = (x) => gas.post({ action: 'saveSamples', serial: s, samples: [x] }).error;
  assert.equal(bad({ ...list[2], label: '星星' }), 'bad_request');
  assert.equal(bad({ ...list[2], g: 'zz' }), 'bad_request');
  assert.equal(bad({ ...list[2], idx: -1 }), 'bad_request');
  assert.equal(bad({ ...list[2], idx: 1.5 }), 'bad_request');
  assert.equal(bad({ ...list[2], flagged: 'yes' }), 'bad_request');
  assert.equal(gas.post({ action: 'saveSamples', serial: s, samples: stored(makeSet(['circle'], 21, 1)) }).error, 'bad_request');
  assert.equal(rowsOf(gas, 'samples').length, 6);
});

test('範例很大：佇列依字數分批，每批都在 GAS 的請求上限內，補送後全部寫入', async () => {
  const { gas, serials } = claimed(1);
  const s = serials[0];
  const store = createStore(safeStorage(memoryStorage()), { random: seeded(4) });
  const { fn, net } = fakeFetch(gas, { online: false, calls: 0 });
  const api = createApi({ url: 'https://gas.example/exec', store, fetchFn: fn });
  const list = stored(makeSet(['circle', 'square', 'triangle'], 60, 8));
  for (const x of list) await api.saveSamples(s, [x]); // 一張一筆，跟遊戲裡餵食一樣
  assert.equal(store.queue().length, 60);
  const batch = nextBatch(store.queue());
  assert.ok(batch.length < 60, '一批放不下 60 張');
  assert.ok(JSON.stringify({ action: 'batch', items: batch }).length <= BATCH_CHARS + 100);
  net.online = true;
  const r = await api.flush();
  assert.equal(r.left, 0);
  assert.equal(rowsOf(gas, 'samples').length, 60);
});

// ── 測試集與狀態 ──

test('內建測試集：第 1 堂 20 張圓方、混合 20 張、小圓 20 張', () => {
  const l1 = testSet('l1');
  assert.equal(l1.length, 20);
  assert.deepEqual(new Set(l1.map((x) => x.label)), new Set(['圓', '方']));
  assert.equal(testSet('mixed').length, 20);
  assert.deepEqual(new Set(testSet('mixed').map((x) => x.label)), new Set(['圓', '方', '三角']));
  assert.ok(testSet('small').every((x) => x.label === '圓'));
});

test('完成標準：準確率用內建測試集計算，門檻 70% 與 docs/03 一致', () => {
  const good = stored(makeSet(['circle', 'square', 'triangle'], 24, 9)); // 每類 8 張
  const m = measure(good, 2);
  assert.equal(m.dataCount, 24);
  assert.ok(m.accuracy >= 0.7, `平衡資料應達 70%，實際 ${m.accuracy}`);
  // 第 1 堂只有圓方：拿到第 2 堂考三類，三角全錯，過不了 70%
  const two = stored(makeSet(['circle', 'square'], 10, 5));
  assert.ok(measure(two, 1).accuracy >= 0.7);
  assert.ok(measure(two, 2).accuracy < 0.7);
  // 標錯的範例不參加比對
  const flagged = good.map((x) => ({ ...x, flagged: true }));
  assert.equal(measure(flagged, 2).accuracy, null);
  assert.equal(measure(flagged, 2).dataCount, 0);
  assert.deepEqual(countsOf(good, ['圓', '方', '三角']), { 圓: 8, 方: 8, 三角: 8 });
});

test('考考我的 AI：回傳最像的 3 張（存檔格式）與相似度', () => {
  const samples = stored(makeSet(['circle', 'square'], 10, 5));
  const q = toStored(makeSample('circle', { size: 90, cx: 160, cy: 160 }, makeRng(2)), 99);
  const r = guess(q, samples);
  assert.equal(r.label, '圓');
  assert.equal(r.neighbors.length, 3);
  for (const n of r.neighbors) {
    assert.ok(samples.includes(n.sample));
    assert.ok(n.similarity > 0 && n.similarity <= 1);
  }
  assert.equal(guess(q, []), null);
  // 手指畫的筆畫也能轉成範例；空白不算
  const s = sampleFromStrokes([shapeStroke('square', {}, makeRng(1))], '方', 7);
  assert.equal(s.idx, 7);
  assert.ok(isHex128(s.g) && isHex128(s.s));
  assert.equal(sampleFromStrokes([], '方', 8), null);
});

test('第 2 堂實驗：只看過圓什麼都猜圓；只看過大圓不認得小圓', () => {
  const run = singleClassRun([]);
  assert.equal(run.length, 20);
  assert.ok(run.every((x) => x.guess === '圓'));
  const b = biasRun();
  assert.ok(b.big >= 0.9, `大圓 ${b.big}`);
  assert.ok(b.small <= 0.2, `小圓 ${b.small}`);
});

// ── 神祕資料包 ──

test('神祕資料包：12 張、4 張標錯（每類至少 1 張），同序號同包號結果一樣', () => {
  const p = makePack('ABCDE5', 0);
  assert.equal(p.length, PACK_SIZE);
  const wrong = p.filter((x) => x.wrong);
  assert.equal(wrong.length, PACK_WRONG);
  for (const x of p) assert.equal(x.wrong, x.label !== x.truth);
  assert.equal(new Set(wrong.map((x) => x.truth)).size, 3);
  assert.deepEqual(makePack('ABCDE5', 0), p);
  assert.notDeepEqual(makePack('ABCDE5', 1), p);
  assert.notDeepEqual(makePack('HJKMN2', 0), p);
});

test('神祕資料包：移除的裡面有 3 張以上真的標錯才過關', () => {
  const p = makePack('ABCDE5', 0);
  const wrongIds = p.filter((x) => x.wrong).map((x) => x.id);
  const goodIds = p.filter((x) => !x.wrong).map((x) => x.id);
  const r = packResult(p, new Set([...wrongIds.slice(0, 3), goodIds[0]]));
  assert.deepEqual([r.found, r.mistaken, r.missed, r.kept.length, r.pass], [3, 1, 1, 8, true]);
  assert.equal(packResult(p, new Set(wrongIds.slice(0, 2))).pass, false);
  // 全部移除也只算找到 4 張
  assert.equal(packResult(p, new Set(p.map((x) => x.id))).found, 4);
});

// ── 任務 ──

test('任務資料：第 1 堂 3 個徽章、第 2 堂解鎖計分、計時、彩蛋', () => {
  assert.deepEqual(TASKS.filter((t) => t.lesson === 1).map((t) => t.badge), ['l1s1', 'l1s2', 'l1s3']);
  assert.deepEqual(TASKS.filter((t) => t.lesson === 2).map((t) => t.skill), ['score', 'timer', 'easter']);
  for (const t of TASKS) assert.ok(CODE_RE.test(t.id));
});

test('連勝：猜錯就重新算，最佳紀錄保留', () => {
  let p = newPlay();
  for (const ok of [true, true, false, true, true, true, true, false]) p = recordTest(p, ok);
  assert.equal(p.tests, 8);
  assert.equal(p.streak, 0);
  assert.equal(p.bestStreak, 4);
  assert.equal(playOf({}).tests, 0);
  assert.equal(playOf({ play: { tests: 3 } }).tests, 3);
});

test('完成標準：第 1、2 堂所有 ★／★★／★★★ 任務都能達成，獎勵正確寫入', () => {
  const pet = { skills: [], badges: [] };
  let play = newPlay();
  // 第 1 堂：圓方各 5 張、考 6 次（有一次連對 4 次）、猜錯選原因
  let samples = stored(makeSet(['circle', 'square'], 10, 5));
  for (const ok of [true, true, true, true, false, true]) play = recordTest(play, ok);
  play.reason = 'r3';
  let facts = { counts: countsOf(samples, ['圓', '方', '三角']), play, acc: {} };
  const l1 = newlyDone(pet, facts, 1);
  assert.deepEqual(l1.map((t) => t.id), ['l1s1', 'l1s2', 'l1s3']);
  l1.forEach((t) => assert.equal(grantTask(pet, t), true));
  assert.deepEqual(pet.badges, ['l1s1', 'l1s2', 'l1s3']);
  assert.deepEqual(pet.skills, []);
  assert.equal(newlyDone(pet, facts, 1).length, 0, '拿過的不會再給');

  // 第 2 堂一開始：還沒有三角，什麼都沒過
  facts = { counts: countsOf(samples, ['圓', '方', '三角']), play, acc: { mixed: testOn(samples, 'mixed'), small: testOn(samples, 'small') } };
  assert.equal(newlyDone(pet, facts, 2).length, 0);

  // 補三角、各類補到 8 張 → ★；資料包找出 3 張 → ★★；補小圓 → ★★★
  samples = stored(makeSet(['circle', 'square', 'triangle'], 24, 9));
  const rng = makeRng(77);
  const small = Array.from({ length: 6 }, () => makeSample('circle', randomParams(rng, SMALL), rng));
  samples = [...samples, ...stored(small, 100)];
  const pack = makePack('ABCDE5', 0);
  play.packBest = packResult(pack, new Set(pack.filter((x) => x.wrong).map((x) => x.id))).found;
  facts = { counts: countsOf(samples, ['圓', '方', '三角']), play, acc: { mixed: testOn(samples, 'mixed'), small: testOn(samples, 'small') } };
  assert.ok(facts.acc.mixed >= 0.7 && facts.acc.small >= 0.7, JSON.stringify(facts.acc));
  const l2 = newlyDone(pet, facts, 2);
  assert.deepEqual(l2.map((t) => t.id), ['l2s1', 'l2s2', 'l2s3']);
  l2.forEach((t) => grantTask(pet, t));
  assert.deepEqual(pet.skills, ['score', 'timer', 'easter']);
});

test('★ 門檻：有一類不到 8 張、或準確率不到 70%，都不算', () => {
  const t = TASKS.find((x) => x.id === 'l2s1');
  const play = newPlay();
  assert.equal(taskDone(t, { counts: { 圓: 8, 方: 8, 三角: 7 }, play, acc: { mixed: 0.9 } }), false);
  assert.equal(taskDone(t, { counts: { 圓: 8, 方: 8, 三角: 8 }, play, acc: { mixed: 0.65 } }), false);
  assert.equal(taskDone(t, { counts: { 圓: 8, 方: 8, 三角: 8 }, play, acc: { mixed: 0.7 } }), true);
});

// ── 任務單、比喻、節奏 ──

test('任務單：單選、勾選、排序的判定與事件代碼', () => {
  for (const lesson of [1, 2]) {
    assert.equal(SHEETS[lesson].length, 3);
    for (const q of SHEETS[lesson]) {
      assert.ok(CODE_RE.test(q.id));
      assert.equal(sheetCorrect(q, q.kind === 'order' ? q.answer.slice() : new Set(q.answer)), true, q.id);
    }
  }
  const order = SHEETS[1][1];
  assert.equal(sheetCorrect(order, ['a', 'c', 'b', 'd']), false);
  assert.equal(choiceCode(order, ['d', 'c', 'b', 'a']), 'd.c.b.a'); // 排序保留順序
  const multi = SHEETS[1][2];
  assert.equal(sheetCorrect(multi, new Set(['a', 'b'])), false);
  assert.equal(choiceCode(multi, new Set(['c', 'a'])), 'a.c');
  assert.ok(CODE_RE.test(choiceCode(multi, new Set(['a', 'b', 'c', 'd']))));
  for (const l of [1, 2]) assert.ok(METAPHORS[l].options.some((o) => o.id === METAPHORS[l].answer));
  for (const c of Object.values(LABEL_CODE)) assert.ok(CODE_RE.test(c));
});

test('計時條：到建議時間填滿並提醒，不會超過 100%', () => {
  const start = 0;
  assert.deepEqual(paceOf(10, start, 5 * 60000), { progress: 0.5, over: false });
  assert.deepEqual(paceOf(10, start, 10 * 60000), { progress: 1, over: true });
  assert.equal(paceOf(10, start, 99 * 60000).progress, 1);
});
