// 在 node 裡假裝成 Google Apps Script：載入 gas/*.gs，用記憶體裡的表格代替試算表。
// 只實作 gas/ 程式碼用到的那幾個方法。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class FakeRange {
  constructor(sheet, row, col, nr, nc) {
    Object.assign(this, { sheet, row, col, nr, nc });
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.nr; r++) {
      const src = this.sheet.rows[this.row - 1 + r] || [];
      const line = [];
      for (let c = 0; c < this.nc; c++) line.push(src[this.col - 1 + c] ?? '');
      out.push(line);
    }
    return out;
  }
  setValues(values) {
    if (values.length !== this.nr || values.some((v) => v.length !== this.nc)) throw new Error('setValues 大小不符');
    values.forEach((line, r) => {
      const i = this.row - 1 + r;
      while (this.sheet.rows.length <= i) this.sheet.rows.push([]);
      line.forEach((v, c) => (this.sheet.rows[i][this.col - 1 + c] = v));
    });
  }
  setValue(v) {
    this.setValues([[v]]);
  }
  clearContent() {
    this.setValues(Array.from({ length: this.nr }, () => Array(this.nc).fill('')));
  }
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.rows = [];
  }
  getName() {
    return this.name;
  }
  getLastRow() {
    let n = this.rows.length;
    while (n > 0 && this.rows[n - 1].every((v) => v === '' || v === undefined)) n--;
    return n;
  }
  getRange(row, col, nr = 1, nc = 1) {
    return new FakeRange(this, row, col, nr, nc);
  }
  appendRow(values) {
    const i = this.getLastRow();
    this.rows.length = i;
    this.rows.push([...values]);
  }
}

export function createGas() {
  const sheets = new Map();
  const ss = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => {
      const sh = new FakeSheet(n);
      sheets.set(n, sh);
      return sh;
    },
  };
  const alerts = [];
  const lock = { held: false };
  const ctx = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      getUi: () => ({
        alert: (...a) => (alerts.push(a), 'YES'),
        Button: { YES: 'YES' },
        ButtonSet: { YES_NO: 'YES_NO', OK: 'OK' },
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => (lock.held ? false : (lock.held = true)),
        releaseLock: () => (lock.held = false),
      }),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    Math,
    JSON,
    Date,
  };
  vm.createContext(ctx);
  for (const f of ['Shared.gs', 'Code.gs', 'Admin.gs']) {
    vm.runInContext(readFileSync(new URL('../gas/' + f, import.meta.url), 'utf8'), ctx, { filename: f });
  }
  // 模擬一次 HTTP POST
  const post = (body) => JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text);
  return { ctx, ss, sheets, post, alerts, lock };
}

// 給 app/api.js 用的假 fetch：online 為 false 時像斷網一樣丟錯
export function fakeFetch(gas, net = { online: true, calls: 0 }) {
  const fn = async (url, init) => {
    net.calls++;
    if (!net.online) throw new TypeError('Failed to fetch');
    const data = gas.post(init.body);
    return { ok: true, status: 200, json: async () => data };
  };
  return { fn, net };
}

// 教師看板專案（gas-dashboard/）：跟學生端共用同一份假試算表，但鎖是自己的（不同專案）
export function loadDashboard(gas) {
  const lock = { held: false };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => gas.ss },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => (lock.held ? false : (lock.held = true)),
        releaseLock: () => (lock.held = false),
      }),
    },
    Math,
    JSON,
    Date,
  };
  vm.createContext(ctx);
  for (const f of ['Shared.gs', 'Dashboard.gs']) {
    vm.runInContext(readFileSync(new URL('../gas-dashboard/' + f, import.meta.url), 'utf8'), ctx, { filename: f });
  }
  // vm 裡建立的物件原型不同，轉一次 JSON 再比對（也順便確認 google.script.run 傳得過去）
  const call = (name, ...args) => JSON.parse(JSON.stringify(ctx[name](...args)));
  return { ctx, call, lock };
}
