import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, safeStorage, newPet, newEid, mergePet, QUEUE_LIMIT, KEYS } from '../app/store.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test('記住序號、換人只忘記序號，寵物資料留著', () => {
  const store = createStore(safeStorage(memoryStorage()));
  store.setSerial('ABCDEF');
  store.savePet(newPet('ABCDEF', { body: 0 }));
  store.enqueue('claimPet', { serial: 'ABCDEF' });
  store.forgetSerial();
  assert.equal(store.getSerial(), null);
  assert.equal(store.loadPet('ABCDEF').serial, 'ABCDEF');
  assert.equal(store.queue().length, 1);
});

test('新寵物：第 1 堂只有圓、方；狀態用 AI 詞彙', () => {
  const p = newPet('ABCDEF', {}, 1);
  assert.deepEqual(Object.keys(p.state), ['dataCount', 'dataQuality', 'trainCount', 'accuracy', 'classes']);
  assert.deepEqual(p.state.classes, ['圓', '方']);
});

test('eid 符合 GAS 的格式規則', () => {
  for (let i = 0; i < 50; i++) assert.match(newEid(), /^[A-Za-z0-9_-]{6,40}$/);
});

test('佇列超過上限時先丟最舊的事件，寵物狀態不丟', () => {
  const store = createStore(safeStorage(memoryStorage()));
  store.enqueue('savePet', { serial: 'ABCDEF' });
  for (let i = 0; i < QUEUE_LIMIT + 5; i++) store.enqueue('logEvent', { serial: 'ABCDEF', value: i });
  const q = store.queue();
  assert.equal(q.length, QUEUE_LIMIT);
  assert.equal(q[0].action, 'savePet');
  assert.equal(q[1].payload.value, 6);
});

test('localStorage 不能用（私密模式）時改存記憶體，不會當掉', () => {
  const broken = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota');
    },
    removeItem() {
      throw new Error('denied');
    },
  };
  const s = safeStorage(broken);
  const store = createStore(s);
  store.setSerial('ABCDEF');
  assert.equal(store.getSerial(), 'ABCDEF');
  assert.equal(s.persistent, false);
});

test('壞掉的 JSON 不會讓遊戲當掉', () => {
  const mem = memoryStorage();
  mem.setItem(KEYS.queue, '{壞掉');
  assert.deepEqual(createStore(safeStorage(mem)).queue(), []);
});

test('合併：堂次跟老師的 currentLesson 走，本機較新的進度不被舊雲端蓋掉', () => {
  const local = { ...newPet('ABCDEF', { body: 0 }, 2), skills: ['score'], talk: { chain: 3 }, updated: 50 };
  const p = mergePet(local, 'ABCDEF', { ok: true, currentLesson: 3, pet: { lesson: 2, state: {}, skills: [], badges: [], updated: 10 } }, { body: 1 });
  assert.equal(p.lesson, 3);
  assert.deepEqual(p.skills, ['score']);
  assert.deepEqual(p.talk, { chain: 3 });
  assert.deepEqual(p.appearance, { body: 1 });
});

test('合併：雲端較新時採用雲端技能；沒網路時保留本機堂次', () => {
  const local = { ...newPet('ABCDEF', {}, 3), updated: 5 };
  const p = mergePet(local, 'ABCDEF', { ok: true, currentLesson: 4, pet: { state: { dataCount: 9 }, skills: ['sound'], badges: [], updated: 99 } }, {});
  assert.equal(p.lesson, 4);
  assert.deepEqual(p.skills, ['sound']);
  assert.equal(p.state.dataCount, 9);
  assert.equal(mergePet(local, 'ABCDEF', null, {}).lesson, 3);
  assert.equal(mergePet(null, 'ABCDEF', { ok: true, currentLesson: 2, pet: null }, {}).lesson, 2);
});
