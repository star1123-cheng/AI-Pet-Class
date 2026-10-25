// 老師用的試算表選單「AI 寵物」。只有打開這份試算表的人（你）能按，不會出現在 Web App 網址上。
// 對照表「班級代號＋座號 ↔ 序號」請另外保存，不要貼進這份試算表。

var ISSUE_COUNT = 40; // 30 人＋10 備用

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AI 寵物')
    .addItem('1. 建立分頁', 'setupSheets')
    .addItem('2. 發 ' + ISSUE_COUNT + ' 組序號', 'issueSerialsMenu')
    .addItem('3. 匯出序號卡（CSV）', 'exportSerialsMenu')
    .addSeparator()
    .addItem('清空測試資料…', 'clearTestDataMenu')
    .addToUi();
}

// 缺少的分頁補上並寫好標題列；已存在的不動
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(SHEETS[name]);
  });
  var config = ss.getSheetByName('config');
  if (config.getLastRow() < 2) config.appendRow([1, '{}']);
}

// 發 n 組新序號：格式正確、不跟舊序號重複、外型編號也不跟任何舊序號撞到
function issueSerials(n) {
  setupSheets();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('serials');
  var last = sh.getLastRow();
  var existing = last < 2 ? [] : sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) {
    return String(r[0]);
  });
  var usedSerial = {};
  var usedLook = {};
  existing.forEach(function (s) {
    usedSerial[s] = true;
    usedLook[appearanceId_(s)] = true;
  });
  var out = [];
  var tries = 0;
  while (out.length < n && tries < n * 1000) {
    tries++;
    var s = makeSerial_();
    var look = appearanceId_(s);
    if (usedSerial[s] || usedLook[look]) continue;
    usedSerial[s] = true;
    usedLook[look] = true;
    out.push(s);
  }
  if (out.length) {
    sh.getRange(sh.getLastRow() + 1, 1, out.length, 2).setValues(out.map(function (s) {
      return [s, false];
    }));
  }
  return out;
}

function issueSerialsMenu() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('發序號', '要新增 ' + ISSUE_COUNT + ' 組序號嗎？（舊序號會保留）', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  var list = issueSerials(ISSUE_COUNT);
  ui.alert('完成', '已新增 ' + list.length + ' 組序號，在「serials」分頁。', ui.ButtonSet.OK);
}

// 只含序號的 CSV（不含任何姓名或座號）
function serialsCsv_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('serials');
  var last = sh ? sh.getLastRow() : 0;
  var list = last < 2 ? [] : sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) {
    return String(r[0]);
  });
  return ['serial'].concat(list.filter(isValidSerial_)).join('\n');
}

function exportSerialsMenu() {
  var csv = serialsCsv_();
  // 序號只含英數字，仍以 JSON 字串放進頁面、用 textContent 顯示，避免任何 HTML 注入
  var html =
    '<div style="font:16px sans-serif">' +
    '<p>複製下面的內容，或按「下載」存成 serials.csv。</p>' +
    '<textarea id="t" rows="14" style="width:100%" readonly></textarea>' +
    '<p><button id="d">下載 serials.csv</button></p></div>' +
    '<script>var csv=' + JSON.stringify(csv).replace(/</g, '\\u003c') + ';' +
    'document.getElementById("t").value=csv;' +
    'document.getElementById("d").onclick=function(){var a=document.createElement("a");' +
    'a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="serials.csv";a.click();};</script>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(360).setHeight(420), '序號卡');
}

// 課前測試完用：清掉 pets 與 events，序號改回未領養（序號本身保留）
function clearTestDataMenu() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert(
    '清空測試資料',
    '會刪除「pets」「events」分頁的所有資料，並把序號改回未領養。正式上課後請不要使用。確定嗎？',
    ui.ButtonSet.YES_NO
  );
  if (ok !== ui.Button.YES) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['pets', 'events'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, SHEETS[name].length).clearContent();
  });
  var serials = ss.getSheetByName('serials');
  if (serials && serials.getLastRow() > 1) {
    var n = serials.getLastRow() - 1;
    serials.getRange(2, 2, n, 1).setValues(Array.apply(null, Array(n)).map(function () {
      return [false];
    }));
  }
  ui.alert('完成', '測試資料已清空。', ui.ButtonSet.OK);
}
