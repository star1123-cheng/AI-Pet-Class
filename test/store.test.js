import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, safeStorage, newPet, newEid, QUEUE_LIMIT, KEYS } from '../app/store.js';

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
