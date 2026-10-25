import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARSET, normalizeSerial, validateSerial, checkChar, makeSerial } from '../pet/serial.js';
import { COMBINATIONS, appearanceId, appearanceOf, appearanceFromId, isValidAppearance, PARTS } from '../pet/appearance.js';
import { renderPetSVG, coreLevel } from '../pet/render.js';

// 固定種子的亂數，讓測試每次結果一樣
function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// 模擬 gas/Admin.gs 的發號：跳過格式重複或外型撞到的序號
function issue(n, random) {
  const serials = [];
  const used = new Set();
  while (serials.length < n) {
    const s = makeSerial(random);
    const id = appearanceId(s);
    if (used.has(id) || serials.includes(s)) continue;
    used.add(id);
    serials.push(s);
  }
  return serials;
}

test('字元集 31 個字，沒有 I、L、O、0、1', () => {
  assert.equal(CHARSET.length, 31);
  for (const ch of 'ILO01') assert.ok(!CHARSET.includes(ch));
});

test('normalizeSerial：轉大寫、去空白與 -', () => {
  assert.equal(normalizeSerial(' ab c-de2 '), 'ABCDE2');
  assert.equal(normalizeSerial(null), '');
});

test('validateSerial：格式、長度、字元、檢查碼', () => {
  const good = 'ABCDE' + checkChar('ABCDE');
  assert.deepEqual(validateSerial(good.toLowerCase()), { ok: true, serial: good, reason: null });
  assert.equal(validateSerial('').reason, 'empty');
  assert.equal(validateSerial('ABC').reason, 'length');
  assert.equal(validateSerial('ABCDE0').reason, 'char');
  const wrongCheck = 'ABCDE' + (good[5] === 'A' ? 'B' : 'A');
  assert.equal(validateSerial(wrongCheck).reason, 'check');
});

test('檢查碼抓得到「打錯一個字」與「前後兩字對調」', () => {
  const random = seeded(3);
  for (let n = 0; n < 200; n++) {
    const s = makeSerial(random);
    assert.ok(validateSerial(s).ok);
    // 打錯一個字（只改前 5 碼）
    const i = n % 5;
    const other = CHARSET[(CHARSET.indexOf(s[i]) + 1 + (n % 30)) % 31];
    assert.equal(validateSerial(s.slice(0, i) + other + s.slice(i + 1)).ok, false);
    // 前後兩字對調（兩字不同時）
    if (s[i] !== s[i + 1]) {
      const swapped = s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
      assert.equal(validateSerial(swapped).ok, false);
    }
  }
});

test('外型組合數 34,560，拆解與編號一對一', () => {
  assert.equal(COMBINATIONS, 34560);
  const seen = new Set();
  for (let id = 0; id < COMBINATIONS; id += 97) {
    const a = appearanceFromId(id);
    assert.ok(isValidAppearance(a));
    const key = PARTS.map(([k]) => a[k]).join(',');
    assert.ok(!seen.has(key));
    seen.add(key);
  }
});

test('同一個序號永遠得到同一隻寵物', () => {
  assert.deepEqual(appearanceOf('ABCDEF'), appearanceOf('ABCDEF'));
});

test('完成標準：發出的 40 組序號，外型參數兩兩不同', () => {
  const serials = issue(40, seeded(42));
  assert.equal(new Set(serials).size, 40);
  const keys = serials.map((s) => JSON.stringify(appearanceOf(s)));
  assert.equal(new Set(keys).size, 40);
  for (const s of serials) assert.ok(validateSerial(s).ok);
});

test('isValidAppearance 擋掉不合法的參數', () => {
  assert.equal(isValidAppearance(null), false);
  assert.equal(isValidAppearance({ ...appearanceFromId(0), color: 12 }), false);
  assert.equal(isValidAppearance({ ...appearanceFromId(0), body: 1.5 }), false);
  assert.throws(() => renderPetSVG({ body: '<script>' }));
});

test('完成標準：外型渲染不依賴外部資源（每種參數的輸出都沒有 http）', () => {
  // 每個參數的每個選項至少出現一次
  for (const [name, k] of PARTS) {
    for (let v = 0; v < k; v++) {
      const svg = renderPetSVG({ ...appearanceFromId(0), [name]: v });
      assert.ok(svg.startsWith('<svg'));
      assert.ok(!/http|href|<image|@import|url\((?!#)/i.test(svg), `${name}=${v} 有外部資源`);
    }
  }
});

test('6 種動物 × 4 種耳型都畫得出來，而且畫出來都不一樣', () => {
  const seen = new Set();
  for (let body = 0; body < 6; body++) {
    for (let ears = 0; ears < 4; ears++) {
      const svg = renderPetSVG({ ...appearanceFromId(0), body, ears }).replace(/petclip\d+/g, '');
      assert.ok(!/http|href|<image|@import|url\((?!#)|undefined|NaN/i.test(svg), `body=${body} ears=${ears}`);
      seen.add(svg);
    }
  }
  assert.equal(seen.size, 24);
});

test('AI 核心亮度跟著準確率：還沒考過熄燈，70% 以上全亮', () => {
  assert.equal(coreLevel(null), 0);
  assert.equal(coreLevel(undefined), 0);
  assert.equal(coreLevel(NaN), 0);
  assert.equal(coreLevel(0), 1);
  assert.equal(coreLevel(0.39), 1);
  assert.equal(coreLevel(0.4), 2);
  assert.equal(coreLevel(0.69), 2);
  assert.equal(coreLevel(0.7), 3);
  assert.equal(coreLevel(1), 3);
  const a = appearanceFromId(0);
  assert.ok(!renderPetSVG(a, { accuracy: null }).includes('pet-core'), '還沒考過不發光、不閃');
  assert.ok(renderPetSVG(a, { accuracy: 0.2 }).includes('pet-core-1'));
  assert.ok(renderPetSVG(a, { accuracy: 0.85 }).includes('pet-core-3'));
  assert.ok(renderPetSVG(a).includes('pet-core-2'), '沒傳準確率時畫成「亮」');
});

test('同一頁放兩隻寵物，clipPath id 不衝突', () => {
  const a = renderPetSVG(appearanceFromId(1)).match(/clipPath id="([^"]+)"/)[1];
  const b = renderPetSVG(appearanceFromId(1)).match(/clipPath id="([^"]+)"/)[1];
  assert.notEqual(a, b);
});
