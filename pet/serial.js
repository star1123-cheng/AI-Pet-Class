// 6 碼序號：前 5 碼隨機，第 6 碼是檢查碼（規則見 docs/05 第 2 節）。
// 檢查碼讓學生打錯一個字、或前後兩字對調時，不用連網就能發現。
// gas/Shared.gs 有同一套邏輯（GAS 不能 import），test/gas.test.js 會比對兩邊結果一致。

export const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LENGTH = 6;

// 學生輸入的字：轉大寫、去掉空白與「-」
export function normalizeSerial(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '');
}

export function checkChar(body) {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const v = CHARSET.indexOf(body[i]);
    if (v < 0) return null;
    sum += (i + 1) * v;
  }
  return CHARSET[sum % CHARSET.length];
}

// 回傳 { ok, serial, reason }；reason：'empty' | 'length' | 'char' | 'check'
export function validateSerial(input) {
  const serial = normalizeSerial(input);
  if (!serial) return { ok: false, serial, reason: 'empty' };
  if (serial.length !== LENGTH) return { ok: false, serial, reason: 'length' };
  for (const ch of serial) if (!CHARSET.includes(ch)) return { ok: false, serial, reason: 'char' };
  if (checkChar(serial.slice(0, LENGTH - 1)) !== serial[LENGTH - 1]) return { ok: false, serial, reason: 'check' };
  return { ok: true, serial, reason: null };
}

// 給測試與離線示範用；正式序號由 GAS 的選單發出
export function makeSerial(random = Math.random) {
  let body = '';
  for (let i = 0; i < LENGTH - 1; i++) body += CHARSET[Math.floor(random() * CHARSET.length)];
  return body + checkChar(body);
}
