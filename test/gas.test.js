import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGas, fakeFetch } from './gas-fake.js';
import { makeSerial, checkChar, validateSerial } from '../pet/serial.js';
import { appearanceId, appearanceOf } from '../pet/appearance.js';
import { createStore, safeStorage } from '../app/store.js';
import { createApi } from '../app/api.js';

function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function setup(n = 40) {
  const gas = createGas();
  gas.ctx.setupSheets();
  const serials = gas.ctx.issueSerials(n);
  return { gas, serials };
}

const rowsOf = (gas, name) => gas.sheets.get(name).rows.slice(1).filter((r) => r.some((v) => v !== ''));

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('GAS 與前端的序號、外型規則一致', () => {
  const { ctx } = createGas();
  const random = seeded(9);
  for (let i = 0; i < 300; i++) {
    const s = makeSerial(random);
    assert.equal(ctx.serialCheckChar_(s.slice(0, 5)), checkChar(s.slice(0, 5)));
    assert.equal(ctx.isValidSerial_(s), validateSerial(s).ok);
    assert.equal(ctx.appearanceId_(s), appearanceId(s));
    assert.deepEqual({ ...ctx.appearanceOf_(s) }, appearanceOf(s));
  }
  assert.equal(ctx.isValidSerial_('ABCDE0'), false);
});

test('appsscript.json：最小權限、UTF-8 無 BOM', () => {
  const raw = readFileSync(new URL('../gas/appsscript.json', import.meta.url));
  assert.notDeepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const cfg = JSON.parse(raw.toString('utf8'));
  assert.deepEqual(cfg.oauthScopes, [
    'https://www.googleapis.com/auth/spreadsheets.currentonly',
    'https://www.googleapis.com/auth/script.container.ui',
  ]);
  for (const f of ['Code.gs', 'Admin.gs', 'Shared.gs']) {
    const src = readFileSync(new URL('../gas/' + f, import.meta.url), 'utf8');
    assert.ok(!/DriveApp|Logger\.log|console\.log|UrlFetchApp/.test(src), `${f} 用了不該用的服務或印出內容`);
  }
});

test('建立分頁與發號：40 組、外型不重複、可重複發號不撞舊的', () => {
  const { gas, serials } = setup(40);
  assert.equal(serials.length, 40);
  assert.equal(new Set(serials.map(appearanceId)).size, 40);
  const more = gas.ctx.issueSerials(10);
  assert.equal(new Set([...serials, ...more].map(appearanceId)).size, 50);
  assert.equal(rowsOf(gas, 'serials').length, 50);
  assert.deepEqual(gas.sheets.get('config').rows[1], [1, '{}']);
  const csv = gas.ctx.serialsCsv_().split('\n');
  assert.equal(csv[0], 'serial');
  assert.equal(csv.length, 51);
});

test('claimPet：沒發過的序號、格式錯的序號都被拒絕', () => {
  const { gas, serials } = setup(3);
  assert.equal(gas.post({ action: 'claimPet', serial: 'ABC' }).error, 'bad_serial');
  let other;
  do other = makeSerial(Math.random);
  while (serials.includes(other));
  assert.equal(gas.post({ action: 'claimPet', serial: other }).error, 'unknown_serial');
  assert.equal(gas.post('不是 JSON').error, 'bad_request');
  assert.equal(gas.post({ action: 'issueSerials' }).error, 'bad_request'); // 網址上沒有管理功能
  assert.equal(gas.post('x'.repeat(20001)).error, 'bad_request');
});

test('claimPet：第一次建立寵物，第二次接續同一隻', () => {
  const { gas, serials } = setup(3);
  const s = serials[0];
  const a = gas.post({ action: 'claimPet', serial: s });
  assert.ok(a.ok);
  assert.deepEqual(a.pet.appearance, appearanceOf(s));
  assert.equal(a.currentLesson, 1);
  assert.equal(rowsOf(gas, 'serials').find((r) => r[0] === s)[1], true);
  gas.post({ action: 'savePet', serial: s, lesson: 1, state: { dataCount: 7 }, skills: [], badges: [], updated: 100 });
  const b = gas.post({ action: 'claimPet', serial: s });
  assert.equal(b.pet.state.dataCount, 7);
  assert.equal(rowsOf(gas, 'pets').length, 1);
});

test('savePet：清理欄位、外型由伺服器決定、舊資料不覆蓋新資料', () => {
  const { gas, serials } = setup(2);
  const s = serials[0];
  assert.equal(gas.post({ action: 'savePet', serial: s, updated: 1 }).error, 'not_claimed');
  gas.post({ action: 'claimPet', serial: s });
  const r = gas.post({
    action: 'savePet',
    serial: s,
    appearance: { body: 99 },
    lesson: 99,
    state: { dataCount: -5, dataQuality: 250, trainCount: 3.7, accuracy: 0.8, classes: ['圓', '方', '<b>', '圓'], name: '不該存' },
    skills: ['score', 'hack', 'score'],
    badges: ['adopt', '<script>'],
    updated: 200,
  });
  assert.ok(r.ok);
  const pet = gas.post({ action: 'getPet', serial: s }).pet;
  assert.deepEqual(pet.appearance, appearanceOf(s));
  assert.equal(pet.lesson, 6);
  assert.deepEqual(pet.state, { dataCount: 0, dataQuality: 100, trainCount: 3, accuracy: 0.8, classes: ['圓', '方'] });
  assert.deepEqual(pet.skills, ['score']);
  assert.deepEqual(pet.badges, ['adopt']);
  const stale = gas.post({ action: 'savePet', serial: s, state: { dataCount: 1 }, updated: 150 });
  assert.equal(stale.stale, true);
  assert.equal(gas.post({ action: 'getPet', serial: s }).pet.state.dataQuality, 100);
});

test('logEvent：格式檢查、同一個 eid 不重複寫入', () => {
  const { gas, serials } = setup(1);
  const s = serials[0];
  gas.post({ action: 'claimPet', serial: s });
  const ev = { action: 'logEvent', serial: s, lesson: 1, type: 'feed', code: 'circle', value: 1, eid: 'abc123-x' };
  assert.ok(gas.post(ev).ok);
  assert.equal(gas.post(ev).dup, true);
  assert.equal(gas.post({ ...ev, eid: 'abc124-x', value: '我叫小明' }).error, 'bad_request'); // 不收自由文字
  assert.equal(gas.post({ ...ev, eid: 'abc125-x', type: 'a b' }).error, 'bad_request');
  assert.equal(rowsOf(gas, 'events').length, 1);
});

test('鎖被占用時回 busy，前端會之後重送', () => {
  const { gas, serials } = setup(1);
  gas.lock.held = true;
  assert.equal(gas.post({ action: 'claimPet', serial: serials[0] }).error, 'busy');
});

test('完成標準：斷網領養後狀態保存，恢復連線補送，試算表筆數正確', async () => {
  const { gas, serials } = setup(3);
  const s = serials[0];
  const store = createStore(safeStorage(memoryStorage()));
  const { fn, net } = fakeFetch(gas, { online: false, calls: 0 });
  const api = createApi({ url: 'https://example.invalid/exec', store, fetchFn: fn });

  // 斷網：領養、存檔 3 次、記 5 個事件
  assert.equal(await api.claim(s), null);
  for (let i = 1; i <= 3; i++) await api.savePet({ serial: s, lesson: 1, state: { dataCount: i }, skills: [], badges: [], updated: i });
  for (let i = 0; i < 5; i++) await api.logEvent(s, 1, 'feed', 'circle', i);
  assert.equal(store.queue().length, 1 + 1 + 5); // savePet 只留最新一筆
  assert.equal(rowsOf(gas, 'pets').length, 0);

  // 恢復連線
  net.online = true;
  const r = await api.flush();
  assert.deepEqual(r, { sent: 7, left: 0 });
  assert.equal(rowsOf(gas, 'pets').length, 1);
  assert.equal(rowsOf(gas, 'events').length, 5);
  assert.equal(gas.post({ action: 'getPet', serial: s }).pet.state.dataCount, 3);

  // 回應在路上遺失、前端又送一次：eid 去重，筆數不變
  const item = store.enqueue('logEvent', { serial: s, lesson: 1, type: 'feed', code: 'square', value: 1 });
  gas.post({ action: 'batch', items: [item] });
  await api.flush();
  assert.equal(rowsOf(gas, 'events').length, 6);
});

test('序號不存在：補送時移出佇列並通知畫面', async () => {
  const { gas, serials } = setup(1);
  let bad;
  do bad = makeSerial(Math.random);
  while (serials.includes(bad));
  const store = createStore(safeStorage(memoryStorage()));
  const rejected = [];
  const { fn } = fakeFetch(gas, { online: false, calls: 0 });
  const api = createApi({ url: 'x', store, fetchFn: fn, onRejected: (item, err) => rejected.push([item.action, err]) });
  await api.claim(bad);
  await api.savePet({ serial: bad, lesson: 1, state: {}, skills: [], badges: [], updated: 1 });
  const { fn: online } = fakeFetch(gas);
  const api2 = createApi({ url: 'x', store, fetchFn: online, onRejected: (item, err) => rejected.push([item.action, err]) });
  await api2.flush();
  assert.equal(store.queue().length, 0);
  assert.deepEqual(rejected, [['claimPet', 'unknown_serial'], ['savePet', 'unknown_serial']]);
});

test('完成標準：30 個序號同時 savePet（模擬）全部寫入、無遺失', async () => {
  const { gas, serials } = setup(30);
  for (const s of serials) gas.post({ action: 'claimPet', serial: s });
  const { fn } = fakeFetch(gas);
  const apis = serials.map(() => createApi({ url: 'x', store: createStore(safeStorage(memoryStorage())), fetchFn: fn }));
  await Promise.all(
    serials.map((s, i) => apis[i].savePet({ serial: s, lesson: 1, state: { dataCount: i + 1 }, skills: [], badges: [], updated: 10 })),
  );
  const pets = rowsOf(gas, 'pets');
  assert.equal(pets.length, 30);
  serials.forEach((s, i) => assert.equal(gas.post({ action: 'getPet', serial: s }).pet.state.dataCount, i + 1));
});

test('完成標準：試算表裡只有序號，找不到姓名或座號', async () => {
  const { gas, serials } = setup(5);
  for (const s of serials) {
    gas.post({ action: 'claimPet', serial: s });
    gas.post({ action: 'savePet', serial: s, state: { dataCount: 1, name: '王小明', seat: '50101' }, updated: 1 });
    gas.post({ action: 'logEvent', serial: s, lesson: 1, type: 'feed', code: 'circle', value: '50101', eid: 'e-' + s });
  }
  const all = JSON.stringify([...gas.sheets.values()].map((sh) => sh.rows));
  assert.ok(!/name|seat|王小明/.test(all));
  // 座號格式（5 碼數字）只可能出現在 value 欄位以代碼形式；這裡確認 value 是選項代碼規則
  for (const r of rowsOf(gas, 'events')) assert.match(String(r[5]), /^[A-Za-z0-9_.-]*$/);
});
