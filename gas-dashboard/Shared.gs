// 序號與外型：跟 pet/serial.js、pet/appearance.js 是同一套規則（GAS 不能 import，只好複製一份）。
// 改這裡也要改前端那兩個檔案；test/gas.test.js 會比對兩邊結果是否一致。
// 教師看板專案用的 gas-dashboard/Shared.gs 必須跟這個檔案一模一樣（test/dashboard.test.js 會檢查）。

var SERIAL_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
var SERIAL_LENGTH = 6;
var APPEARANCE_PARTS = [['body', 6], ['color', 12], ['eyes', 5], ['accessory', 6], ['pattern', 4], ['ears', 4]];
var APPEARANCE_COMBINATIONS = 34560;

function serialCheckChar_(body) {
  var sum = 0;
  for (var i = 0; i < body.length; i++) {
    var v = SERIAL_CHARSET.indexOf(body.charAt(i));
    if (v < 0) return null;
    sum += (i + 1) * v;
  }
  return SERIAL_CHARSET.charAt(sum % SERIAL_CHARSET.length);
}

function isValidSerial_(s) {
  if (typeof s !== 'string' || s.length !== SERIAL_LENGTH) return false;
  for (var i = 0; i < s.length; i++) if (SERIAL_CHARSET.indexOf(s.charAt(i)) < 0) return false;
  return serialCheckChar_(s.slice(0, SERIAL_LENGTH - 1)) === s.charAt(SERIAL_LENGTH - 1);
}

function makeSerial_() {
  var body = '';
  for (var i = 0; i < SERIAL_LENGTH - 1; i++) body += SERIAL_CHARSET.charAt(Math.floor(Math.random() * SERIAL_CHARSET.length));
  return body + serialCheckChar_(body);
}

function hash_(str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function appearanceId_(serial) {
  return hash_(serial) % APPEARANCE_COMBINATIONS;
}

function appearanceOf_(serial) {
  var a = {};
  var n = appearanceId_(serial);
  for (var i = 0; i < APPEARANCE_PARTS.length; i++) {
    var k = APPEARANCE_PARTS[i][1];
    a[APPEARANCE_PARTS[i][0]] = n % k;
    n = Math.floor(n / k);
  }
  return a;
}
