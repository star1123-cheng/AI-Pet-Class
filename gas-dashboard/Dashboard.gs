// 教師看板：跟學生端分開的第二個 Apps Script 專案，綁在同一份試算表。規格見 docs/05 第 6 節。
// 部署組合是 Execute as「Me」＋ Who has access「Only myself」：別人打開網址會被 Google 擋下，
// 所以這裡才放管理功能（確認任務、重設能量、切換堂次、發新序號）；學生端 gas/ 的網址完全沒有。
// 看板只顯示整班數字，沒有任何個人排名；只有「待確認清單」與序號工具會出現序號。
// 不用 Logger 或 console 印出內容。

// 分頁欄位：跟 gas/Code.gs 的 SHEETS 一樣（test/dashboard.test.js 會比對）
var SHEETS = {
  pets: ['serial', 'appearance', 'lesson', 'state', 'skills', 'badges', 'updated'],
  samples: ['serial', 'idx', 'label', 'g', 's', 'flagged', 'ts'],
  events: ['ts', 'serial', 'lesson', 'type', 'code', 'value', 'eid'],
  quiz: ['serial', 'form', 'q', 'choice', 'ts'],
  tasks: ['serial', 'taskId', 'status', 'ts'],
  prompts_log: ['serial', 'lesson', 'blocks', 'copyCount', 'ts'],
  config: ['currentLesson', 'skillOverrides'],
  serials: ['serial', 'claimed'],
  energy_resets: ['serial', 'lesson', 'ts'],
};

var SKILL_IDS = ['score', 'timer', 'easter', 'feedback', 'sound', 'anim', 'levels', 'highscore', 'adapt'];
var SELF_TASKS = ['l4s1', 'l4s2', 'l4s3', 'l5s1', 'l5s2'];
var LOCK_WAIT_MS = 20000;

// 前後測正確答案（docs/03 5.1）；A、B 版同題號是平行題
var QUIZ_KEY = { A1: 'a', A2: 'b', A3: 'b', A4: 'b', A5: 'b', B1: 'a', B2: 'b', B3: 'b', B4: 'b', B5: 'b' };
var QUIZ_ITEMS = 5;

// 迷你任務單正確答案：鍵是「堂:題目代碼」，值是事件 value 的格式（勾選題排序後用「.」連起來，排序題照順序）
var SHEET_KEY = {
  '1:l1q1': 'a',
  '1:l1q2': 'a.b.c.d',
  '1:l1q3': 'a.b.c',
  '2:l2q1': 'a',
  '2:l2q2': 'a.b.c',
  '2:l2q3': 'a',
  '3:q1': 'a',
  '3:q2': 'a',
  '3:q3': 'a.b.c',
};

// 班級合作指標的定義（docs/05 第 6 節）
var REPAIR_TASK_EVENTS = ['l2s1', 'l2s3']; // 第 2 堂「修好我的 AI」後達成的任務
var REPAIR_SELF_TASKS = ['l4s2']; // 第 4 堂修好壞掉的保底版（老師確認後才算）
var FIX_MAX_LEVEL = 2; // 第 3 堂修嘴巴：溫度調到低或很低
var FIX_MAX_WRONG = 1; // 而且重測錯句 ≤ 1

// 直方圖分組：[下限, 上限]（含），上限 null 代表以上
var DATA_BINS = [[0, 0], [1, 9], [10, 19], [20, 29], [30, 39], [40, null]];
var QUALITY_BINS = [[0, 19], [20, 39], [40, 59], [60, 79], [80, 100]];

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Dashboard');
  t.view = e && e.parameter && e.parameter.view === 'display' ? 'display' : 'teacher';
  t.url = ScriptApp.getService().getUrl();
  return t
    .evaluate()
    .setTitle('AI 寵物 教師看板')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ── 給頁面呼叫（google.script.run）。結尾沒有底線的函式頁面才叫得到 ──

function getDashboard() {
  return buildDashboard_(readAll_(), Date.now());
}

// 展示機只拿班級合作指標
function getDisplay() {
  return displayOf_(buildDashboard_(readAll_(), Date.now()));
}

// 確認自報任務；老師也可以直接確認學生還沒自報的任務（例如 ★★★ 由老師看作品後確認）
function confirmTask(serial, taskId) {
  if (!isValidSerial_(serial) || SELF_TASKS.indexOf(taskId) < 0) return { ok: false, error: 'bad_request' };
  return withLock_(function () {
    if (!serialRow_(serial)) return { ok: false, error: 'unknown_serial' };
    var sh = sheet_('tasks');
    var list = rowsOf_('tasks');
    for (var i = 0; i < list.length; i++) {
      if (String(list[i][0]) === serial && String(list[i][1]) === taskId) {
        sh.getRange(i + 2, 3).setValue('confirmed');
        return { ok: true };
      }
    }
    sh.appendRow([serial, taskId, 'confirmed', new Date()]);
    return { ok: true };
  });
}

// 重設這堂的能量：target 是序號，或「*」代表全班。學生 iPad 下次回到寵物畫面時歸零
function resetEnergy(target) {
  if (target !== '*' && !isValidSerial_(target)) return { ok: false, error: 'bad_request' };
  return withLock_(function () {
    if (target !== '*' && !serialRow_(target)) return { ok: false, error: 'unknown_serial' };
    var lesson = currentLesson_(rowsOf_('config'));
    sheet_('energy_resets').appendRow([target, lesson, Date.now()]);
    return { ok: true, lesson: lesson };
  });
}

function setLesson(n) {
  if (typeof n !== 'number' || n !== Math.floor(n) || n < 1 || n > 6) return { ok: false, error: 'bad_request' };
  return withLock_(function () {
    var sh = sheet_('config');
    if (sh.getLastRow() < 2) sh.getRange(2, 1, 1, 2).setValues([[n, '{}']]);
    else sh.getRange(2, 1).setValue(n);
    return { ok: true, lesson: n };
  });
}

// 重發序號：發一組新的備用序號（外型不跟任何舊序號撞到），舊序號保留
function issueSpareSerial() {
  return withLock_(function () {
    var usedSerial = {};
    var usedLook = {};
    rowsOf_('serials').forEach(function (r) {
      usedSerial[String(r[0])] = true;
      usedLook[appearanceId_(String(r[0]))] = true;
    });
    for (var tries = 0; tries < 1000; tries++) {
      var s = makeSerial_();
      if (usedSerial[s] || usedLook[appearanceId_(s)]) continue;
      sheet_('serials').appendRow([s, false]);
      return { ok: true, serial: s };
    }
    return { ok: false, error: 'busy' };
  });
}

// 查序號狀態（學生說序號輸入失敗時用）：bad_serial 打錯字／unknown_serial 沒發過／unclaimed 還沒領養／claimed 已領養
function lookupSerial(input) {
  var s = String(input || '').toUpperCase().replace(/[\s-]/g, '');
  if (!isValidSerial_(s)) return { ok: true, serial: s, status: 'bad_serial' };
  if (!serialRow_(s)) return { ok: true, serial: s, status: 'unknown_serial' };
  var pet = rowsOf_('pets').some(function (r) {
    return String(r[0]) === s;
  });
  return { ok: true, serial: s, status: pet ? 'claimed' : 'unclaimed' };
}

// ── 彙整（純函式，不碰試算表；test/dashboard.test.js 用模擬資料驗算） ──

// t：各分頁的資料列（不含標題列）。回傳的都是數字、字串、陣列與物件（google.script.run 不能傳 Date）
function buildDashboard_(t, now) {
  var pets = t.pets.map(function (r) {
    return { serial: String(r[0]), state: parse_(r[3], {}) || {}, skills: parse_(r[4], []) || [] };
  });
  return {
    lesson: currentLesson_(t.config),
    updated: now,
    issued: t.serials.length,
    claimed: pets.length,
    sheets: sheetRates_(t.events),
    quiz: quizCompare_(t.quiz),
    dataCount: histogram_(pets.map(function (p) {
      return Number(p.state.dataCount) || 0;
    }), DATA_BINS),
    dataQuality: histogram_(pets.map(function (p) {
      return Math.round(Number(p.state.dataQuality) || 0);
    }), QUALITY_BINS),
    skills: SKILL_IDS.map(function (id) {
      return {
        id: id,
        n: pets.filter(function (p) {
          return Array.isArray(p.skills) && p.skills.indexOf(id) >= 0;
        }).length,
      };
    }),
    coop: coopOf_(t.events, t.tasks),
    pending: t.tasks
      .filter(function (r) {
        return String(r[2]) === 'self';
      })
      .map(function (r) {
        return { serial: String(r[0]), taskId: String(r[1]), ts: time_(r[3]) };
      })
      .sort(function (a, b) {
        return a.ts - b.ts;
      }),
  };
}

function displayOf_(d) {
  return { lesson: d.lesson, updated: d.updated, claimed: d.claimed, coop: d.coop };
}

// 迷你任務單各題答對率：同一序號同一題只算第一次作答
function sheetRates_(events) {
  var stat = {};
  Object.keys(SHEET_KEY).forEach(function (k) {
    stat[k] = { key: k, lesson: Number(k.split(':')[0]), q: k.split(':')[1], n: 0, right: 0 };
  });
  var seen = {};
  events.forEach(function (r) {
    if (String(r[3]) !== 'sheet') return;
    var k = Number(r[2]) + ':' + String(r[4]);
    if (!stat[k] || seen[r[1] + '|' + k]) return;
    seen[r[1] + '|' + k] = true;
    stat[k].n++;
    if (String(r[5]) === SHEET_KEY[k]) stat[k].right++;
  });
  return Object.keys(SHEET_KEY).map(function (k) {
    return stat[k];
  });
}

// 前後測：每題 A、B 版的作答人數與答對人數，加上兩版平均答對題數；
// paired 只算兩版都有做的學生，前後才比得公平
function quizCompare_(quiz) {
  var ans = {}; // serial → { A1: 'a', ... }，同一題只取第一次
  quiz.forEach(function (r) {
    var s = String(r[0]);
    var q = String(r[2]);
    if (!QUIZ_KEY[q]) return;
    ans[s] = ans[s] || {};
    if (!(q in ans[s])) ans[s][q] = String(r[3]);
  });
  var items = [];
  for (var i = 1; i <= QUIZ_ITEMS; i++) items.push({ item: i, a: { n: 0, right: 0 }, b: { n: 0, right: 0 } });
  var sum = { A: { n: 0, score: 0 }, B: { n: 0, score: 0 }, pairedA: 0, pairedB: 0, paired: 0 };
  Object.keys(ans).forEach(function (s) {
    var score = { A: 0, B: 0 };
    var did = { A: false, B: false };
    Object.keys(ans[s]).forEach(function (q) {
      var form = q.charAt(0);
      var slot = items[Number(q.charAt(1)) - 1][form === 'A' ? 'a' : 'b'];
      var right = ans[s][q] === QUIZ_KEY[q];
      slot.n++;
      if (right) slot.right++;
      if (right) score[form]++;
      did[form] = true;
    });
    ['A', 'B'].forEach(function (f) {
      if (!did[f]) return;
      sum[f].n++;
      sum[f].score += score[f];
    });
    if (did.A && did.B) {
      sum.paired++;
      sum.pairedA += score.A;
      sum.pairedB += score.B;
    }
  });
  return {
    items: items,
    A: { n: sum.A.n, avg: avg_(sum.A.score, sum.A.n) },
    B: { n: sum.B.n, avg: avg_(sum.B.score, sum.B.n) },
    paired: { n: sum.paired, avgA: avg_(sum.pairedA, sum.paired), avgB: avg_(sum.pairedB, sum.paired) },
  };
}

// 班級合作指標：
// fed 全班累積餵食張數＝feed 事件數（每餵一張記一筆）
// bias 偵測偏誤次數＝大小圓偏誤實驗（exp）＋資料健檢標錯或刪掉（clean）＋神祕資料包找出的標錯張數（pack 的 value）
// repaired 修復成功次數＝第 3 堂修嘴巴過關（fix）＋第 2 堂修好 AI 後達成的任務（task l2s1、l2s3，每人每任務算一次）
//                     ＋第 4 堂修好保底版（tasks 分頁 l4s2，老師確認後才算）
function coopOf_(events, tasks) {
  var c = { fed: 0, bias: 0, repaired: 0 };
  var taskSeen = {};
  events.forEach(function (r) {
    var type = String(r[3]);
    var code = String(r[4]);
    var value = Number(r[5]) || 0;
    if (type === 'feed') c.fed++;
    else if (type === 'exp' || type === 'clean') c.bias++;
    else if (type === 'pack') c.bias += Math.max(0, Math.floor(value));
    else if (type === 'fix') {
      var level = Number(code.replace(/^L/, ''));
      if (level <= FIX_MAX_LEVEL && value <= FIX_MAX_WRONG) c.repaired++;
    } else if (type === 'task' && REPAIR_TASK_EVENTS.indexOf(code) >= 0 && !taskSeen[r[1] + '|' + code]) {
      taskSeen[r[1] + '|' + code] = true;
      c.repaired++;
    }
  });
  tasks.forEach(function (r) {
    if (String(r[2]) === 'confirmed' && REPAIR_SELF_TASKS.indexOf(String(r[1])) >= 0) c.repaired++;
  });
  return c;
}

function histogram_(values, bins) {
  return bins.map(function (b) {
    return {
      lo: b[0],
      hi: b[1],
      n: values.filter(function (v) {
        return v >= b[0] && (b[1] === null || v <= b[1]);
      }).length,
    };
  });
}

// ── 小工具 ──

function avg_(sum, n) {
  return n ? Math.round((sum / n) * 100) / 100 : null;
}

function time_(v) {
  if (v && typeof v.getTime === 'function') return v.getTime();
  return Number(v) || 0;
}

function parse_(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return fallback;
  }
}

function currentLesson_(config) {
  var n = config[0] ? Number(config[0][0]) : 1;
  return n >= 1 && n <= 6 ? Math.floor(n) : 1;
}

// 缺少的分頁（例如 P7 新增的 energy_resets）自動建立
function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(SHEETS[name]);
  }
  return sh;
}

function rowsOf_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  var last = sh ? sh.getLastRow() : 0;
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, SHEETS[name].length).getValues();
}

// 看板用不到 samples（圖格很大）與 prompts_log，不讀
function readAll_() {
  return {
    pets: rowsOf_('pets'),
    events: rowsOf_('events'),
    quiz: rowsOf_('quiz'),
    tasks: rowsOf_('tasks'),
    config: rowsOf_('config'),
    serials: rowsOf_('serials'),
  };
}

function serialRow_(serial) {
  var list = rowsOf_('serials');
  for (var i = 0; i < list.length; i++) if (String(list[i][0]) === serial) return i + 2;
  return 0;
}

// 看板自己的鎖（學生端是另一個專案，鎖不共用；兩邊寫的是不同的格子或各自新增一列）
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return { ok: false, error: 'busy' };
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
