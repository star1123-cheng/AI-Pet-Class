import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, SKILLS, energyFor } from '../blocks/blocks.js';
import { compose, toggleBlock, normalize, missing, mergeSkills, defaultSelection } from '../blocks/compose.js';
import { promptOf, energyLeft, spendEnergy, promptLog, applyEnergyReset } from '../blocks/log.js';
import { createGas, fakeFetch } from './gas-fake.js';
import { createStore, safeStorage } from '../app/store.js';
import { createApi } from '../app/api.js';

const BLOCK_RE = /^[a-z][0-9]{1,2}$/; // 與 gas/Code.gs 相同

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function setup() {
  const gas = createGas();
  gas.ctx.setupSheets();
  const serials = gas.ctx.issueSerials(3);
  const store = createStore(safeStorage(memoryStorage()));
  const api = createApi({ url: 'https://example.invalid/exec', store, fetchFn: fakeFetch(gas).fn });
  return { gas, serials, store, api };
}

const rowsOf = (gas, name) => gas.sheets.get(name).rows.slice(1).filter((r) => r.some((v) => v !== ''));

test('積木資料：代碼不重複、符合 GAS 格式；技能 9 個與 GAS 一致', () => {
  const ids = CATEGORIES.flatMap((c) => c.blocks.map((b) => b.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, BLOCK_RE);
  assert.deepEqual(SKILLS.map((s) => s.id), ['score', 'timer', 'easter', 'feedback', 'sound', 'anim', 'levels', 'highscore', 'adapt']);
  assert.equal(energyFor(4), 8);
  assert.equal(energyFor(5), 10);
});

test('單選換掉同類別舊選項，多選可以切換', () => {
  let s = toggleBlock([], 'w1');
  s = toggleBlock(s, 'w2');
  assert.deepEqual(s, ['w2']);
  s = toggleBlock(s, 'r1');
  s = toggleBlock(s, 'r2');
  s = toggleBlock(s, 'r1');
  assert.deepEqual(normalize(s), ['w2', 'r2']);
  assert.deepEqual(toggleBlock(s, 'zz9'), s);
});

test('沒選「做什麼」不能產出', () => {
  assert.equal(compose(defaultSelection()), null);
  assert.deepEqual(missing(defaultSelection()), ['what']);
});

test('完整提示詞格式（docs/04 2.）', () => {
  const sel = ['w2', 'p1', 'r1', 'r2', 't1', 'l1', 'l2', ...defaultSelection()];
  assert.equal(
    compose(sel),
    [
      '我要做一個「接水果」，給 10 歲的同學玩。',
      '規則：30 秒一回合、猜對加分',
      '外觀：主題色用海洋、字要大、按鈕要大',
      '限制：單一 HTML 檔、適合 iPad 手指操作、不要載入外部圖片或檔案、全部用繁體中文',
    ].join('\n'),
  );
  assert.equal(compose(['w1']), '我要做一個「AI 猜猜畫畫」。');
});

test('未解鎖技能不出現；已解鎖技能片段完整出現，依技能表順序', () => {
  const out = compose(['w1'], ['anim', 'score']);
  const lines = out.split('\n');
  assert.equal(lines[1], SKILLS.find((s) => s.id === 'score').fragment);
  assert.equal(lines[2], SKILLS.find((s) => s.id === 'anim').fragment);
  for (const s of SKILLS) if (!['score', 'anim'].includes(s.id)) assert.ok(!out.includes(s.fragment), s.id);
  assert.ok(!compose(['w1'], []).includes('請加入'));
});

test('合併夥伴技能：不重複、依技能表順序', () => {
  assert.deepEqual(mergeSkills(['sound', 'score'], ['score', 'timer', 'bogus']), ['score', 'timer', 'sound']);
});

test('能量：用完就不能再複製，每堂分開計', () => {
  let p = promptOf({});
  for (let i = 0; i < 8; i++) p = spendEnergy(p, 4);
  assert.equal(energyLeft(p, 4), 0);
  assert.equal(spendEnergy(p, 4), null);
  assert.equal(energyLeft(p, 5), 10);
});

test('老師重設能量：只歸零這堂，同一次重設不會套用兩次', () => {
  let p = promptOf({});
  for (let i = 0; i < 8; i++) p = spendEnergy(p, 4);
  p = spendEnergy(p, 5);
  assert.equal(applyEnergyReset(p, 4, 0), p); // 沒有重設紀錄
  const r = applyEnergyReset(p, 4, 1000);
  assert.equal(energyLeft(r, 4), 8);
  assert.equal(energyLeft(r, 5), 9);
  const again = applyEnergyReset(spendEnergy(r, 4), 4, 1000);
  assert.equal(energyLeft(again, 4), 7); // 已經套用過的重設不再歸零
  assert.equal(promptOf({ prompt: again }).resetAt, 1000); // 存檔後還記得
});

test('紀錄只有積木代碼與次數，沒有文字', () => {
  const log = promptLog('ABCDEF', 4, ['r2', 'w1', 'w1', 'zz'], 3);
  assert.deepEqual(log, { serial: 'ABCDEF', lesson: 4, blocks: ['w1', 'r2'], copyCount: 3 });
  for (const v of Object.values(log).flat()) assert.ok(typeof v === 'number' || /^[A-Z0-9a-z]+$/.test(v));
});

test('GAS logPrompt：寫入 prompts_log、補送重複不重寫、不收文字', async () => {
  const { gas, serials, api } = setup();
  const s = serials[0];
  await api.claim(s);
  await api.logPrompt(promptLog(s, 4, ['w1', 'r2'], 1));
  assert.equal(gas.post({ action: 'logPrompt', serial: s, lesson: 4, blocks: ['w1', 'r2'], copyCount: 1 }).dup, true);
  assert.equal(gas.post({ action: 'logPrompt', serial: s, lesson: 4, blocks: ['我要做一個遊戲'], copyCount: 2 }).error, 'bad_request');
  assert.equal(gas.post({ action: 'logPrompt', serial: s, lesson: 4, blocks: 'w1', copyCount: 2 }).error, 'bad_request');
  const rows = rowsOf(gas, 'prompts_log');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].slice(0, 4), [s, 4, '["w1","r2"]', 1]);
});

test('GAS getBrain：回傳夥伴外型、技能、沒標錯的樣本；沒領養或亂打的序號被拒', async () => {
  const { gas, serials, api } = setup();
  const [a, b, c] = serials;
  await api.claim(b);
  await api.savePet({ serial: b, lesson: 5, state: {}, skills: ['score', 'sound'], badges: [], updated: 1 });
  const hex = '0'.repeat(127) + 'f';
  const samples = gas.sheets.get('samples');
  samples.appendRow([b, 0, '圓', hex, hex, false, 1]);
  samples.appendRow([b, 1, '方', hex, hex, true, 1]);
  samples.appendRow([b, 2, '方', 'xyz', hex, false, 1]);
  const r = await api.getBrain(b);
  assert.equal(r.ok, true);
  assert.deepEqual(r.skills, ['score', 'sound']);
  assert.equal(r.appearance.body, gas.post({ action: 'getPet', serial: b }).pet.appearance.body);
  assert.deepEqual(r.brain, [{ label: '圓', g: hex, s: hex }]);
  assert.equal((await api.getBrain(c)).error, 'not_claimed');
  assert.equal((await api.getBrain('ABCDE0')).error, 'bad_serial');
  assert.equal(rowsOf(gas, 'events').length, 0);
  void a;
});

test('沒網路時 getBrain 回傳 null', async () => {
  const store = createStore(safeStorage(memoryStorage()));
  const api = createApi({ url: 'https://example.invalid/exec', store, fetchFn: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(await api.getBrain('ABCDEF'), null);
});
