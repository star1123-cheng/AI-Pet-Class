// 學生端 API（Web App 的 doPost）。規格見 docs/05 第 3、4 節。
// 部署組合是 Execute as「Me」＋「Anyone」，任何拿到網址的人都能呼叫，所以：
//   - 每次都檢查序號已發出、欄位型態與長度，不收自由文字
//   - 這裡沒有任何管理功能（發號、清空都在 Admin.gs 的試算表選單）
//   - 不用 Logger 或 console 印出請求內容
// 全班同時寫入，所以整個請求包在 LockService 裡，一次只處理一個。

var SHEETS = {
  pets: ['serial', 'appearance', 'lesson', 'state', 'skills', 'badges', 'updated'],
  samples: ['serial', 'idx', 'label', 'g', 's', 'flagged', 'ts'],
  events: ['ts', 'serial', 'lesson', 'type', 'code', 'value', 'eid'],
  quiz: ['serial', 'form', 'q', 'choice', 'ts'],
  tasks: ['serial', 'taskId', 'status', 'ts'],
  prompts_log: ['serial', 'lesson', 'blocks', 'copyCount', 'ts'],
  config: ['currentLesson', 'skillOverrides'],
  serials: ['serial', 'claimed'],
};

var SKILL_IDS = ['score', 'timer', 'easter', 'feedback', 'sound', 'anim', 'levels', 'highscore', 'adapt'];
var CLASS_LABELS = ['圓', '方', '三角', '叉叉'];
var MAX_BODY = 20000;
var MAX_BATCH = 50;
var LOCK_WAIT_MS = 20000;
var CODE_RE = /^[A-Za-z0-9_.-]{1,32}$/;
var EID_RE = /^[A-Za-z0-9_-]{6,40}$/;
var BADGE_RE = /^[A-Za-z0-9_-]{1,24}$/;

function doGet() {
  return json_({ ok: true, app: 'ai-pet' });
}

function doPost(e) {
  var req;
  try {
    var body = (e && e.postData && e.postData.contents) || '';
    if (body.length > MAX_BODY) return json_({ ok: false, error: 'bad_request' });
    req = JSON.parse(body);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (!req || typeof req !== 'object') return json_({ ok: false, error: 'bad_request' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return json_({ ok: false, error: 'busy' });
  try {
    var ctx = newCtx_(SpreadsheetApp.getActiveSpreadsheet());
    var out = req.action === 'batch' ? batch_(ctx, req.items) : handle_(ctx, req.action, req, req.eid);
    ctx.commit();
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ── 讀寫試算表：每個請求只讀需要的分頁一次，事件最後一次寫入 ──
function newCtx_(ss) {
  var cache = {};
  var newEvents = [];

  function sheet(name) {
    var sh = ss.getSheetByName(name);
    if (!sh) throw new Error('缺少分頁 ' + name + '，請先執行選單「建立分頁」');
    return sh;
  }

  function rows(name) {
    if (!cache[name]) {
      var sh = sheet(name);
      var last = sh.getLastRow();
      cache[name] = last < 2 ? [] : sh.getRange(2, 1, last - 1, SHEETS[name].length).getValues();
    }
    return cache[name];
  }

  // 序號 → 試算表列號（從 2 開始）
  function indexOf(name) {
    var key = name + ':index';
    if (!cache[key]) {
      var map = {};
      rows(name).forEach(function (r, i) {
        map[String(r[0])] = i + 2;
      });
      cache[key] = map;
    }
    return cache[key];
  }

  return {
    serialRow: function (serial) {
      return indexOf('serials')[serial] || 0;
    },
    setClaimed: function (row) {
      sheet('serials').getRange(row, 2).setValue(true);
    },
    petRow: function (serial) {
      return indexOf('pets')[serial] || 0;
    },
    readPet: function (row) {
      return rows('pets')[row - 2];
    },
    writePet: function (row, values) {
      sheet('pets').getRange(row, 1, 1, values.length).setValues([values]);
      rows('pets')[row - 2] = values;
    },
    appendPet: function (values) {
      var sh = sheet('pets');
      sh.appendRow(values);
      var row = sh.getLastRow();
      rows('pets')[row - 2] = values;
      indexOf('pets')[values[0]] = row;
      return row;
    },
    currentLesson: function () {
      var r = rows('config')[0];
      var n = r ? Number(r[0]) : 1;
      return n >= 1 && n <= 6 ? Math.floor(n) : 1;
    },
    hasEvent: function (eid) {
      if (!cache.eids) {
        var set = {};
        rows('events').forEach(function (r) {
          set[String(r[6])] = true;
        });
        cache.eids = set;
      }
      return !!cache.eids[eid];
    },
    addEvent: function (values) {
      newEvents.push(values);
      cache.eids[values[6]] = true;
    },
    commit: function () {
      if (!newEvents.length) return;
      var sh = sheet('events');
      sh.getRange(sh.getLastRow() + 1, 1, newEvents.length, SHEETS.events.length).setValues(newEvents);
      newEvents = [];
    },
  };
}

// ── 動作 ──
function batch_(ctx, items) {
  if (!Array.isArray(items) || items.length > MAX_BATCH) return { ok: false, error: 'bad_request' };
  var results = items.map(function (it) {
    var eid = it && typeof it.eid === 'string' && EID_RE.test(it.eid) ? it.eid : '';
    if (!eid || !it.payload || typeof it.payload !== 'object' || ['claimPet', 'savePet', 'logEvent'].indexOf(it.action) < 0) {
      return { eid: eid, ok: false, error: 'bad_request' };
    }
    var r = handle_(ctx, it.action, it.payload, eid);
    return { eid: eid, ok: r.ok, error: r.error };
  });
  return { ok: true, results: results };
}

function handle_(ctx, action, p, eid) {
  if (action === 'claimPet') return claimPet_(ctx, p);
  if (action === 'getPet') return getPet_(ctx, p);
  if (action === 'savePet') return savePet_(ctx, p);
  if (action === 'logEvent') return logEvent_(ctx, p, eid);
  return { ok: false, error: 'bad_request' };
}

function checkSerial_(ctx, serial) {
  if (!isValidSerial_(serial)) return 'bad_serial';
  if (!ctx.serialRow(serial)) return 'unknown_serial';
  return null;
}

function claimPet_(ctx, p) {
  var err = checkSerial_(ctx, p.serial);
  if (err) return { ok: false, error: err };
  var row = ctx.petRow(p.serial);
  if (!row) {
    var lesson = ctx.currentLesson();
    var state = { dataCount: 0, dataQuality: 0, trainCount: 0, accuracy: null, classes: [] };
    row = ctx.appendPet([p.serial, JSON.stringify(appearanceOf_(p.serial)), lesson, JSON.stringify(state), '[]', '[]', 0]);
    ctx.setClaimed(ctx.serialRow(p.serial));
  }
  return { ok: true, pet: rowToPet_(ctx.readPet(row)), currentLesson: ctx.currentLesson() };
}

function getPet_(ctx, p) {
  var err = checkSerial_(ctx, p.serial);
  if (err) return { ok: false, error: err };
  var row = ctx.petRow(p.serial);
  return { ok: true, pet: row ? rowToPet_(ctx.readPet(row)) : null, currentLesson: ctx.currentLesson() };
}

function savePet_(ctx, p) {
  var err = checkSerial_(ctx, p.serial);
  if (err) return { ok: false, error: err };
  var row = ctx.petRow(p.serial);
  if (!row) return { ok: false, error: 'not_claimed' };
  var updated = num_(p.updated, 0, 1e15, 0);
  var old = ctx.readPet(row);
  if (updated < Number(old[6] || 0)) return { ok: true, stale: true };
  ctx.writePet(row, [
    p.serial,
    JSON.stringify(appearanceOf_(p.serial)), // 外型一律由序號重算，不信任前端
    int_(p.lesson, 1, 6, 1),
    JSON.stringify(cleanState_(p.state)),
    JSON.stringify(cleanList_(p.skills, function (s) {
      return SKILL_IDS.indexOf(s) >= 0;
    }, SKILL_IDS.length)),
    JSON.stringify(cleanList_(p.badges, function (s) {
      return BADGE_RE.test(s);
    }, 20)),
    updated,
  ]);
  return { ok: true };
}

function logEvent_(ctx, p, eid) {
  var err = checkSerial_(ctx, p.serial);
  if (err) return { ok: false, error: err };
  if (!ctx.petRow(p.serial)) return { ok: false, error: 'not_claimed' };
  if (!eid || !EID_RE.test(eid) || !CODE_RE.test(String(p.type)) || !CODE_RE.test(String(p.code))) {
    return { ok: false, error: 'bad_request' };
  }
  var value = p.value;
  if (value === undefined || value === null) value = '';
  if (typeof value === 'number') {
    if (!isFinite(value)) return { ok: false, error: 'bad_request' };
  } else if (value !== '' && !(typeof value === 'string' && CODE_RE.test(value))) {
    return { ok: false, error: 'bad_request' };
  }
  if (ctx.hasEvent(eid)) return { ok: true, dup: true };
  ctx.addEvent([new Date(), p.serial, int_(p.lesson, 1, 6, 1), String(p.type), String(p.code), value, eid]);
  return { ok: true };
}

// ── 欄位清理 ──
function num_(v, lo, hi, fallback) {
  var n = Number(v);
  if (typeof v !== 'number' || !isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function int_(v, lo, hi, fallback) {
  return Math.floor(num_(v, lo, hi, fallback));
}

function cleanState_(s) {
  s = s && typeof s === 'object' ? s : {};
  return {
    dataCount: int_(s.dataCount, 0, 10000, 0),
    dataQuality: num_(s.dataQuality, 0, 100, 0),
    trainCount: int_(s.trainCount, 0, 100000, 0),
    accuracy: s.accuracy === null || s.accuracy === undefined ? null : num_(s.accuracy, 0, 1, null),
    classes: cleanList_(s.classes, function (c) {
      return CLASS_LABELS.indexOf(c) >= 0;
    }, CLASS_LABELS.length),
  };
}

// 只留符合規則、不重複的字串，最多 max 個
function cleanList_(list, ok, max) {
  if (!Array.isArray(list)) return [];
  var out = [];
  for (var i = 0; i < list.length && out.length < max; i++) {
    if (typeof list[i] === 'string' && ok(list[i]) && out.indexOf(list[i]) < 0) out.push(list[i]);
  }
  return out;
}

function parse_(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return fallback;
  }
}

function rowToPet_(r) {
  return {
    serial: String(r[0]),
    appearance: parse_(r[1], null),
    lesson: Number(r[2]) || 1,
    state: parse_(r[3], {}),
    skills: parse_(r[4], []),
    badges: parse_(r[5], []),
    updated: Number(r[6]) || 0,
  };
}
