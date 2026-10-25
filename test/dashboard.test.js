// 教師看板（gas-dashboard/）：30 個模擬序號走學生端 API 產生資料，再比對看板數字與手算結果。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGas, loadDashboard } from './gas-fake.js';
import { makeSerial } from '../pet/serial.js';
import { appearanceId } from '../pet/appearance.js';
import { FORMS } from '../train/quiz.js';
import { SHEETS as SHEETS12, choiceCode as code12 } from '../train/lessons.js';
import { SHEET as SHEET3, choiceCode as code3 } from '../talk/lesson3.js';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function setup(n = 40) {
  const gas = createGas();
  gas.ctx.setupSheets();
  const serials = gas.ctx.issueSerials(n);
  const dash = loadDashboard(gas);
  return { gas, serials, dash };
}

// 30 位學生的模擬課堂。每一段的註解寫出手算結果，下面的測試照抄這些數字
function classroom() {
  const { gas, serials, dash } = setup(40);
  const kids = serials.slice(0, 30);
  let n = 0;
  const ev = (serial, lesson, type, code, value = '') => {
    const r = gas.post({ action: 'logEvent', eid: 'ev' + String(n++).padStart(6, '0'), serial, lesson, type, code, value });
    assert.equal(r.ok, true, JSON.stringify(r));
  };
  kids.forEach((s, i) => {
    assert.equal(gas.post({ action: 'claimPet', serial: s }).ok, true);
    // 資料量＝i（0～29）；資料品質＝i×3.4（0～98.6）
    // 道具：0～9 號有計分，其中 0～4 號也有計時
    const skills = i < 5 ? ['score', 'timer'] : i < 10 ? ['score'] : [];
    gas.post({ action: 'savePet', serial: s, lesson: 1, state: { dataCount: i, dataQuality: i * 3.4, trainCount: i, accuracy: null, classes: [] }, skills, badges: [], updated: 1 });
    // 餵食：0～9 號各 3 張、10～29 號各 1 張 → 30＋20＝50
    for (let k = 0; k < (i < 10 ? 3 : 1); k++) ev(s, 1, 'feed', 'circle', k + 1);
    // 任務單 l1q1：0～19 號答 a（對）、20～29 號答 b → 20／30
    ev(s, 1, 'sheet', 'l1q1', i < 20 ? 'a' : 'b');
    // 任務單 l1q3：0～14 號答 a.b.c（對）、15～29 號答 a.b → 15／30
    ev(s, 1, 'sheet', 'l1q3', i < 15 ? 'a.b.c' : 'a.b');
    // 前測 A：A1 只有 0～11 號對、A2 全對、A3～A5 全錯 → 平均 (12＋30)／30＝1.4
    gas.post({
      action: 'submitQuiz',
      serial: s,
      form: 'A',
      answers: [
        { q: 'A1', choice: i < 12 ? 'a' : 'b' },
        { q: 'A2', choice: 'b' },
        { q: 'A3', choice: 'a' },
        { q: 'A4', choice: 'a' },
        { q: 'A5', choice: 'a' },
      ],
    });
    // 後測 B：只有 0～19 號做；B1 全對、B2 只有 0～9 號對 → 平均 (20＋10)／20＝1.5
    // 兩版都做的 20 人，A 平均 (12＋20)／20＝1.6
    if (i < 20) {
      gas.post({
        action: 'submitQuiz',
        serial: s,
        form: 'B',
        answers: [
          { q: 'B1', choice: 'a' },
          { q: 'B2', choice: i < 10 ? 'b' : 'a' },
          { q: 'B3', choice: 'a' },
          { q: 'B4', choice: 'a' },
          { q: 'B5', choice: 'a' },
        ],
      });
    }
  });
  // 0 號重做 l1q1 改答錯：只算第一次，仍是 20／30
  ev(kids[0], 1, 'sheet', 'l1q1', 'b');
  // 第 3 堂任務單 q3：0～9 號 a.b.c（對）、10～11 號 a.b.c.d → 10／12
  kids.slice(0, 12).forEach((s, i) => ev(s, 3, 'sheet', 'q3', i < 10 ? 'a.b.c' : 'a.b.c.d'));
  // 偵測偏誤：0～4 號做偏誤實驗（5）＋5～7 號標錯（3）＋8、9 號神祕資料包各找出 3 張（6）→ 14
  kids.slice(0, 5).forEach((s) => ev(s, 2, 'exp', 'bias', 40));
  kids.slice(5, 8).forEach((s) => ev(s, 2, 'clean', 'flag'));
  kids.slice(8, 10).forEach((s) => ev(s, 2, 'pack', 'p1', 3));
  // 修復成功：0～3 號修嘴巴過關（4）；4 號溫度太高、5 號錯 2 句不算
  kids.slice(0, 4).forEach((s) => ev(s, 3, 'fix', 'L1', 0));
  ev(kids[4], 3, 'fix', 'L3', 0);
  ev(kids[5], 3, 'fix', 'L2', 2);
  // ＋0、1 號達成 l2s1（2，0 號補送重複只算一次）；2 號的 l1s1 不是修復
  ev(kids[0], 2, 'task', 'l2s1');
  ev(kids[1], 2, 'task', 'l2s1');
  ev(kids[0], 2, 'task', 'l2s1');
  ev(kids[2], 1, 'task', 'l1s1');
  // ＋6 號自報 l4s2、老師確認（1）→ 4＋2＋1＝7
  // 待確認：10、11 號自報 l4s1
  assert.equal(gas.post({ action: 'reportTask', serial: kids[6], taskId: 'l4s2' }).ok, true);
  assert.equal(gas.post({ action: 'reportTask', serial: kids[10], taskId: 'l4s1' }).ok, true);
  assert.equal(gas.post({ action: 'reportTask', serial: kids[11], taskId: 'l4s1' }).ok, true);
  assert.deepEqual(dash.call('confirmTask', kids[6], 'l4s2'), { ok: true });
  return { gas, serials, kids, dash };
}

test('30 人模擬：看板數字與手算一致', () => {
  const { kids, dash } = classroom();
  const d = dash.call('getDashboard');
  assert.equal(d.lesson, 1);
  assert.equal(d.issued, 40);
  assert.equal(d.claimed, 30);

  const sheet = Object.fromEntries(d.sheets.map((x) => [x.key, [x.n, x.right]]));
  assert.deepEqual(sheet['1:l1q1'], [30, 20]);
  assert.deepEqual(sheet['1:l1q3'], [30, 15]);
  assert.deepEqual(sheet['3:q3'], [12, 10]);
  assert.deepEqual(sheet['2:l2q1'], [0, 0]);

  assert.deepEqual(d.quiz.items[0], { item: 1, a: { n: 30, right: 12 }, b: { n: 20, right: 20 } });
  assert.deepEqual(d.quiz.items[1], { item: 2, a: { n: 30, right: 30 }, b: { n: 20, right: 10 } });
  assert.deepEqual(d.quiz.items[2], { item: 3, a: { n: 30, right: 0 }, b: { n: 20, right: 0 } });
  assert.deepEqual(d.quiz.A, { n: 30, avg: 1.4 });
  assert.deepEqual(d.quiz.B, { n: 20, avg: 1.5 });
  assert.deepEqual(d.quiz.paired, { n: 20, avgA: 1.6, avgB: 1.5 });

  assert.deepEqual(d.dataCount.map((b) => b.n), [1, 9, 10, 10, 0, 0]);
  assert.deepEqual(d.dataQuality.map((b) => b.n), [6, 6, 6, 6, 6]);
  const skills = Object.fromEntries(d.skills.map((x) => [x.id, x.n]));
  assert.deepEqual(skills, { score: 10, timer: 5, easter: 0, feedback: 0, sound: 0, anim: 0, levels: 0, highscore: 0, adapt: 0 });

  assert.deepEqual(d.coop, { fed: 50, bias: 14, repaired: 7 });
  assert.deepEqual(d.pending.map((p) => [p.serial, p.taskId]), [[kids[10], 'l4s1'], [kids[11], 'l4s1']]);
});

test('看板沒有個人排名；展示機只有班級合作指標、不含任何序號', () => {
  const { serials, kids, dash } = classroom();
  const d = dash.call('getDashboard');
  assert.deepEqual(Object.keys(d).sort(), ['claimed', 'coop', 'dataCount', 'dataQuality', 'issued', 'lesson', 'pending', 'quiz', 'sheets', 'skills', 'updated']);
  // 序號只出現在待確認清單
  const text = JSON.stringify({ ...d, pending: [] });
  for (const s of serials) assert.ok(!text.includes(s), `看板出現序號 ${s}`);
  const show = dash.call('getDisplay');
  assert.deepEqual(Object.keys(show).sort(), ['claimed', 'coop', 'lesson', 'updated']);
  for (const s of serials) assert.ok(!JSON.stringify(show).includes(s));
  assert.ok(kids.length === 30);

  const html = read('gas-dashboard/Dashboard.html');
  assert.ok(!/\.(innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write/.test(html), '看板頁面不可用 innerHTML');
  assert.ok(!/排名|排行|名次/.test(html));
});

test('確認任務：待確認清單減少，學生 getPet 拿得到已確認', () => {
  const { gas, kids, dash } = classroom();
  assert.deepEqual(dash.call('confirmTask', kids[10], 'l4s1'), { ok: true });
  assert.equal(dash.call('getDashboard').pending.length, 1);
  assert.deepEqual(gas.post({ action: 'getPet', serial: kids[10] }).tasks, [{ taskId: 'l4s1', status: 'confirmed' }]);
  // 已確認的再自報，不會被改回自報
  assert.equal(gas.post({ action: 'reportTask', serial: kids[10], taskId: 'l4s1' }).dup, true);
  assert.equal(dash.call('getDashboard').pending.length, 1);
  // 老師可以直接確認還沒自報的 ★★★
  assert.deepEqual(dash.call('confirmTask', kids[20], 'l4s3'), { ok: true });
  assert.equal(dash.call('confirmTask', kids[20], 'l1s1').error, 'bad_request');
  assert.equal(dash.call('confirmTask', 'ABC', 'l4s1').error, 'bad_request');
  // 學生端網址沒有任何看板的管理動作
  for (const action of ['confirmTask', 'setLesson', 'resetEnergy', 'issueSpareSerial', 'lookupSerial', 'getDashboard', 'getDisplay']) {
    assert.equal(gas.post({ action, serial: kids[0], taskId: 'l4s1' }).error, 'bad_request', action);
  }
});

test('自報任務 API：只收 Canvas 任務代碼、要先領養、可以放進 batch', () => {
  const { gas, serials } = setup(3);
  assert.equal(gas.post({ action: 'reportTask', serial: serials[0], taskId: 'l4s1' }).error, 'not_claimed');
  gas.post({ action: 'claimPet', serial: serials[0] });
  assert.equal(gas.post({ action: 'reportTask', serial: serials[0], taskId: 'l2s1' }).error, 'bad_request'); // 遊戲內自動判定的不收
  assert.equal(gas.post({ action: 'reportTask', serial: serials[0], taskId: '<b>' }).error, 'bad_request');
  const r = gas.post({ action: 'batch', items: [{ eid: 'abcdef1', action: 'reportTask', payload: { serial: serials[0], taskId: 'l5s1' } }] });
  assert.deepEqual(r.results[0], { eid: 'abcdef1', ok: true });
  assert.deepEqual(gas.post({ action: 'getPet', serial: serials[0] }).tasks, [{ taskId: 'l5s1', status: 'self' }]);
});

test('切換堂次與重設能量：學生 getPet 跟著變', () => {
  const { gas, kids, dash } = classroom();
  // 舊試算表還沒有 energy_resets 分頁時，getPet 照常
  gas.sheets.delete('energy_resets');
  assert.equal(gas.post({ action: 'getPet', serial: kids[3] }).energyReset, 0);

  assert.deepEqual(dash.call('setLesson', 4), { ok: true, lesson: 4 });
  assert.equal(gas.post({ action: 'getPet', serial: kids[3] }).currentLesson, 4);
  assert.equal(dash.call('setLesson', 7).error, 'bad_request');
  assert.equal(dash.call('setLesson', '5').error, 'bad_request');

  assert.equal(dash.call('resetEnergy', kids[3]).lesson, 4); // 會自動補建分頁
  assert.ok(gas.post({ action: 'getPet', serial: kids[3] }).energyReset > 0);
  assert.equal(gas.post({ action: 'getPet', serial: kids[4] }).energyReset, 0); // 只重設一個人
  dash.call('resetEnergy', '*');
  assert.ok(gas.post({ action: 'getPet', serial: kids[4] }).energyReset > 0); // 全班
  dash.call('setLesson', 5);
  assert.equal(gas.post({ action: 'getPet', serial: kids[4] }).energyReset, 0); // 第 4 堂的重設不影響第 5 堂
  assert.equal(dash.call('resetEnergy', 'ABC').error, 'bad_request');
});

test('重發序號：新序號外型不撞、可以領養；查序號分得出打錯、沒發過、未領養、已領養', () => {
  const { gas, serials, kids, dash } = classroom();
  const r = dash.call('issueSpareSerial');
  assert.equal(r.ok, true);
  assert.ok(!serials.includes(r.serial));
  assert.equal(new Set([...serials, r.serial].map(appearanceId)).size, 41);
  assert.equal(gas.post({ action: 'claimPet', serial: r.serial }).ok, true);

  const messy = kids[0].toLowerCase().slice(0, 3) + '-' + kids[0].slice(3);
  assert.equal(dash.call('lookupSerial', messy).status, 'claimed');
  assert.equal(dash.call('lookupSerial', serials[35]).status, 'unclaimed');
  assert.equal(dash.call('lookupSerial', 'ABCDE0').status, 'bad_serial');
  let other;
  do other = makeSerial(Math.random);
  while (serials.includes(other) || other === r.serial);
  assert.equal(dash.call('lookupSerial', other).status, 'unknown_serial');
});

test('看板與學生端的規則一致（序號、分頁、道具、答案）', () => {
  assert.equal(read('gas-dashboard/Shared.gs'), read('gas/Shared.gs'));
  const gas = createGas();
  const { ctx } = loadDashboard(gas);
  const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  same(ctx.SHEETS, gas.ctx.SHEETS);
  same(ctx.SKILL_IDS, gas.ctx.SKILL_IDS);
  same(ctx.SELF_TASKS, gas.ctx.SELF_TASKS);

  const quizKey = Object.fromEntries(['A', 'B'].flatMap((f) => FORMS[f].map((q) => [q.id, q.answer])));
  same(ctx.QUIZ_KEY, quizKey);
  const sheetKey = {};
  for (const lesson of [1, 2]) for (const q of SHEETS12[lesson]) sheetKey[`${lesson}:${q.id}`] = code12(q, q.answer);
  for (const q of SHEET3) sheetKey[`3:${q.id}`] = code3(q.answer);
  same(ctx.SHEET_KEY, sheetKey);
});

test('看板專案 appsscript.json：只有這份試算表的權限、網址只有本人能開', () => {
  const raw = readFileSync(new URL('../gas-dashboard/appsscript.json', import.meta.url));
  assert.notDeepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const cfg = JSON.parse(raw.toString('utf8'));
  assert.deepEqual(cfg.oauthScopes, ['https://www.googleapis.com/auth/spreadsheets.currentonly']);
  assert.deepEqual(cfg.webapp, { executeAs: 'USER_DEPLOYING', access: 'MYSELF' });
  for (const f of ['Dashboard.gs', 'Shared.gs', 'Dashboard.html']) {
    const src = read('gas-dashboard/' + f);
    assert.ok(!/DriveApp|Logger\.log|console\.log|UrlFetchApp/.test(src), `${f} 用了不該用的服務或印出內容`);
  }
  // 兩個專案綁同一份試算表，onOpen 只能留在學生端專案的 Admin.gs，不然選單會出現兩次
  assert.ok(!/function onOpen/.test(read('gas-dashboard/Dashboard.gs')));
});
