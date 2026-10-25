import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAINS, TEMPS, tempOf, applyTemperature, drawWord, isTopWord, DEFAULT_LEVEL } from '../talk/chain.js';
import { TOPICS, firstRound, talkRound, wrongCount, judgeScore } from '../talk/hallucination.js';
import { FACTS, SHELVES, factsOn, factById } from '../talk/bookshelf.js';
import { SLOTS, REASONS, phraseText, phraseCode } from '../talk/catchphrase.js';
import { createGas, fakeFetch } from './gas-fake.js';
import { createStore, safeStorage } from '../app/store.js';
import { createApi } from '../app/api.js';
import { SHEET, METAPHOR, passJudge, passFix, unlockSkill, sheetCorrect, choiceCode, talkOf, TASKS } from '../talk/lesson3.js';

// 固定種子的亂數，讓測試每次結果一樣
function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

const CODE_RE = /^[A-Za-z0-9_.-]{1,32}$/; // 與 gas/Code.gs 相同

function topShare(chain, t, n, random) {
  let hit = 0;
  for (let i = 0; i < n; i++) if (isTopWord(chain, drawWord(chain, t, random))) hit++;
  return hit / n;
}

test('接龍資料與 docs/03 4.1 一致：3 條、每條 5 個字、機率加起來 100%', () => {
  assert.equal(CHAINS.length, 3);
  for (const c of CHAINS) {
    assert.equal(c.words.length, 5);
    assert.ok(Math.abs(c.words.reduce((a, w) => a + w.p, 0) - 1) < 1e-9, c.start);
  }
  assert.deepEqual(TEMPS.map((x) => x.t), [0.1, 0.5, 1, 1.6, 2.5]);
  assert.equal(tempOf(DEFAULT_LEVEL).name, '高');
});

test('溫度 1 時機率不變；溫度越高越平均', () => {
  const p = CHAINS[0].words.map((w) => w.p);
  applyTemperature(p, 1).forEach((x, i) => assert.ok(Math.abs(x - p[i]) < 1e-9));
  const spread = (t) => {
    const q = applyTemperature(p, t);
    return Math.max(...q) - Math.min(...q);
  };
  assert.ok(spread(0.1) > spread(1) && spread(1) > spread(2.5));
});

test('低溫時最高機率字被選中 ≥ 80%；高溫時明顯下降', () => {
  const random = seeded(7);
  for (const c of CHAINS) {
    const low = topShare(c, tempOf(1).t, 2000, random);
    const high = topShare(c, tempOf(5).t, 2000, random);
    assert.ok(low >= 0.8, `${c.start} 低溫 ${low}`);
    assert.ok(high < low - 0.2, `${c.start} 高溫 ${high}`);
  }
});

test('高溫時抽得到機率最低的怪字', () => {
  const random = seeded(3);
  const c = CHAINS[0];
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(drawWord(c, tempOf(5).t, random).text);
  assert.ok(seen.has('圓'));
});

test('第一輪固定 3 對 3 錯，每次打亂順序', () => {
  const random = seeded(11);
  const a = firstRound(random);
  const b = firstRound(random);
  assert.equal(a.length, 6);
  assert.equal(wrongCount(a), 3);
  assert.deepEqual(new Set(a.map((s) => s.topic)), new Set(TOPICS.map((t) => t.id)));
  assert.ok(a.some((s) => s.text.includes('3,952')));
  assert.ok(a.some((s) => s.text === '日月潭在高雄市。'));
  assert.notDeepEqual(a.map((s) => s.code), b.map((s) => s.code));
});

test('候選句池：每題 1 對 2 錯、機率 50／30／20', () => {
  for (const t of TOPICS) {
    assert.deepEqual(t.pool.map((c) => c.truth), [true, false, false]);
    assert.deepEqual(t.pool.map((c) => c.p), [0.5, 0.3, 0.2]);
    assert.ok(factById(t.fact), t.id);
  }
});

test('溫度最低時抽 100 組，平均錯句 ≤ 1；溫度越高錯越多', () => {
  const random = seeded(42);
  const avg = (level) => {
    let sum = 0;
    for (let i = 0; i < 100; i++) sum += wrongCount(talkRound(tempOf(level).t, random));
    return sum / 100;
  };
  const low = avg(1);
  const mid = avg(3);
  const high = avg(5);
  assert.ok(low <= 1, `很低 ${low}`);
  assert.ok(mid > low && high > mid, `${low} ${mid} ${high}`);
});

test('判斷分數：按「對」＝true', () => {
  const round = firstRound(seeded(5));
  assert.equal(judgeScore(round, round.map((s) => s.truth)), 6);
  assert.equal(judgeScore(round, round.map(() => true)), 3);
  assert.equal(judgeScore(round, []), 0);
});

test('事件代碼都符合 GAS 格式', () => {
  for (const s of talkRound(1, seeded(9))) assert.match(s.code, CODE_RE);
  for (const s of firstRound(seeded(9))) assert.match(s.code, CODE_RE);
  assert.match(phraseCode(['a3', 'b3', 'c3']), CODE_RE);
  assert.match(choiceCode(new Set(['c', 'a', 'b'])), CODE_RE);
});

test('小書櫃：8 條、分類篩選、每條都有分類', () => {
  assert.equal(FACTS.length, 8);
  assert.equal(factsOn('all').length, 8);
  const ids = SHELVES.map((s) => s.id).filter((id) => id !== 'all');
  for (const f of FACTS) assert.ok(ids.includes(f.shelf));
  assert.equal(ids.reduce((n, id) => n + factsOn(id).length, 0), 8);
  assert.ok(factsOn('animal').every((f) => f.shelf === 'animal'));
});

test('口頭禪：三格都選才成句，格子對錯會檢查', () => {
  assert.equal(phraseText(['a1', 'b2', 'c1']), '我是會查證的 AI 寵物！');
  assert.equal(phraseText(['a1', 'b2']), null);
  assert.equal(phraseText(['b1', 'a2', 'c1']), null);
  assert.equal(phraseText(null), null);
  for (const s of SLOTS) assert.ok(Math.abs(s.words.reduce((a, w) => a + w.p, 0) - 1) < 1e-9);
  assert.equal(REASONS.length, 3);
});

test('任務判定與技能解鎖', () => {
  assert.equal(passJudge(5), true);
  assert.equal(passJudge(4), false);
  assert.equal(passFix(1, 1), true);
  assert.equal(passFix(2, 0), true);
  assert.equal(passFix(3, 0), false); // 沒把溫度調低不算
  assert.equal(passFix(1, 2), false);
  assert.deepEqual(TASKS.map((t) => t.skill), ['feedback', 'sound', 'anim']);
  const pet = { skills: ['score'] };
  assert.equal(unlockSkill(pet, 'feedback'), true);
  assert.equal(unlockSkill(pet, 'feedback'), false);
  assert.deepEqual(pet.skills, ['score', 'feedback']);
});

test('任務單與比喻：答案判定', () => {
  assert.equal(SHEET.length, 3);
  assert.equal(sheetCorrect(SHEET[2], new Set(['c', 'a', 'b'])), true);
  assert.equal(sheetCorrect(SHEET[2], new Set(['a', 'b', 'c', 'd'])), false);
  assert.equal(sheetCorrect(SHEET[0], ['a']), true);
  assert.ok(METAPHOR.options.some((o) => o.id === METAPHOR.answer));
});

test('舊存檔沒有第 3 堂進度時補上預設值', () => {
  const t = talkOf({ skills: [] });
  assert.equal(t.judge, null);
  assert.equal(t.fixed, false);
  assert.equal(talkOf({ talk: { fixed: true } }).fixed, true);
});

test('第 3 堂的事件與技能都能通過 GAS 的格式檢查並寫入', async () => {
  const gas = createGas();
  gas.ctx.setupSheets();
  const [s] = gas.ctx.issueSerials(1);
  const m = new Map();
  const store = createStore(safeStorage({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }));
  const api = createApi({ url: 'https://example.invalid/exec', store, fetchFn: fakeFetch(gas).fn });
  await api.claim(s);
  // 與 app/lesson3.js 送出的事件同樣的 type／code／value 形狀
  const events = [
    ['chain', 'weather.w1', 'pick'],
    ['chain', 'class.w5', 5],
    ['judge', 'bee.f1', 'no'],
    ['shelf', 'lake.f1', ''],
    ['round', 'first', 6],
    ['round', 'fix', 0],
    ['fix', 'L1', 0],
    ['skill', 'feedback', ''],
    ['phrase', 'a3.b2.c1', 'r3'],
    ['sheet', 'q3', 'a.b.c'],
    ['metaphor', 'm3', 'a'],
  ];
  for (const [type, code, value] of events) await api.logEvent(s, 3, type, code, value);
  await api.savePet({ serial: s, lesson: 3, state: {}, skills: ['score', 'feedback', 'sound', 'anim'], badges: [], updated: 1 });
  assert.equal(store.queue().length, 0);
  const rows = gas.sheets.get('events').rows.slice(1).filter((r) => r.some((v) => v !== ''));
  assert.equal(rows.length, events.length);
  assert.deepEqual(gas.post({ action: 'getPet', serial: s }).pet.skills, ['score', 'feedback', 'sound', 'anim']);
});
