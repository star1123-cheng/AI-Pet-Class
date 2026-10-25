// 領養流程：輸入序號 → 寵物現身 → AI 狀態面板。所有文字都用 textContent。
import { GAS_URL } from '../config.js';
import { validateSerial } from '../pet/serial.js';
import { appearanceOf } from '../pet/appearance.js';
import { mountPet } from '../pet/render.js';
import { createStore, mergePet } from './store.js';
import { createApi } from './api.js';
import { createLesson3 } from './lesson3.js';
import { createPromptPage } from './prompt.js';

const FLUSH_EVERY_MS = 20000;

const $ = (id) => document.getElementById(id);
const store = createStore();
const api = createApi({ url: GAS_URL, store, onRejected });

let pet = null;

// 第 3 堂（P4）。堂次由老師在試算表 config 設定，P3 會再做完整的堂次切換
const lesson3 = createLesson3({ root: $('talk'), store, api, getPet: () => pet, onExit: showHome });
// 提示詞積木（P5，第 4 堂起）
const promptPage = createPromptPage({ root: $('prompt'), store, api, getPet: () => pet, onExit: showHome });

const ERRORS = {
  empty: () => '請輸入序號',
  length: (s) => `序號是 6 個字，你輸入了 ${s.length} 個`,
  char: () => '序號裡沒有 I、L、O、0、1，請再看一次卡片',
  check: () => '序號好像打錯了，請再對一次',
  unknown: () => '找不到這個序號，請拿序號卡問老師',
};

// ── 領養 ──
$('serial').addEventListener('input', () => ($('adoptError').textContent = ''));
$('serial').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') adopt();
});
$('adoptBtn').onclick = adopt;

async function adopt() {
  const v = validateSerial($('serial').value);
  $('serial').value = v.serial;
  if (!v.ok) {
    $('adoptError').textContent = ERRORS[v.reason](v.serial);
    return;
  }
  $('adoptBtn').disabled = true;
  $('adoptBtn').textContent = '連線中…';
  try {
    const res = await api.claim(v.serial);
    if (res && !res.ok && (res.error === 'unknown_serial' || res.error === 'bad_serial')) {
      $('adoptError').textContent = ERRORS.unknown();
      return;
    }
    if (res && !res.ok) store.enqueue('claimPet', { serial: v.serial }); // 例如 busy：之後再補
    pet = mergePet(store.loadPet(v.serial), v.serial, res && res.ok ? res : null, appearanceOf(v.serial));
    store.setSerial(pet.serial);
    store.savePet(pet);
    if (res?.ok) lastRefresh = Date.now(); // 剛問過 GAS，不用馬上再問
    api.logEvent(pet.serial, pet.lesson, 'adopt', res && res.ok ? 'online' : 'offline').then(showSync);
    $('serial').blur();
    showHome();
  } finally {
    $('adoptBtn').disabled = false;
    $('adoptBtn').textContent = '領養';
  }
}

// 這台 iPad 記得序號時，不會再經過領養，所以回到寵物畫面時另外問 GAS 目前堂次（最多每 30 秒一次）
const REFRESH_EVERY_MS = 30000;
let lastRefresh = 0;

async function refreshPet() {
  if (!pet || !GAS_URL || Date.now() - lastRefresh < REFRESH_EVERY_MS) return;
  lastRefresh = Date.now();
  const serial = pet.serial;
  const res = await api.getPet(serial);
  if (!res || pet?.serial !== serial || $('home').hidden) return; // 沒網路、換人了、或已經進到別的畫面
  if (!res.ok) {
    if (res.error === 'unknown_serial') onRejected({ action: 'claimPet', payload: { serial } }, res.error);
    return;
  }
  const before = pet.lesson;
  pet = store.savePet(mergePet(store.loadPet(serial) || pet, serial, res, appearanceOf(serial)));
  if (pet.lesson !== before || res.pet) renderHome();
}

// 補送時 GAS 說序號不存在
function onRejected(item, error) {
  if (item.action !== 'claimPet' || error !== 'unknown_serial') return;
  const p = store.loadPet(item.payload.serial);
  if (!p) return;
  p.rejected = true;
  store.savePet(p);
  if (pet?.serial === p.serial) {
    pet = p;
    renderHome();
  }
}

// ── 寵物畫面 ──
function showHome() {
  $('adopt').hidden = true;
  $('talk').hidden = true;
  $('prompt').hidden = true;
  $('home').hidden = false;
  renderHome();
  refreshPet();
}

function renderHome() {
  $('serialTag').textContent = '序號 ' + pet.serial;
  const s = pet.state;
  mountPet($('pet'), pet.appearance, { label: '我的 AI 寵物', accuracy: s.accuracy ?? null });
  $('sData').textContent = `${s.dataCount} 張`;
  $('sQuality').textContent = String(Math.round(s.dataQuality));
  $('sTrain').textContent = `${s.trainCount} 次`;
  $('sAcc').textContent = s.accuracy === null || s.accuracy === undefined ? '還沒考過' : Math.round(s.accuracy * 100) + '%';
  $('rejected').hidden = !pet.rejected;
  $('lesson3Btn').hidden = pet.lesson < 3;
  $('promptBtn').hidden = pet.lesson < 4;
  showSync();
}

$('lesson3Btn').onclick = () => {
  $('home').hidden = true;
  $('talk').hidden = false;
  lesson3.open();
};

$('promptBtn').onclick = () => {
  $('home').hidden = true;
  $('prompt').hidden = false;
  promptPage.open();
};

function showAdopt() {
  $('home').hidden = true;
  $('adopt').hidden = false;
  $('serial').value = '';
  $('adoptError').textContent = '';
}

$('switchBtn').onclick = () => {
  if (!confirm('要換下一位同學嗎？你的寵物會保留，下次輸入序號就能回來。')) return;
  store.forgetSerial();
  pet = null;
  showAdopt();
};

// ── 同步狀態 ──
function showSync() {
  const left = store.queue().length;
  let text;
  if (!GAS_URL) text = '離線模式：資料存在這台 iPad';
  else if (left === 0) text = '✓ 已存到雲端';
  else text = `還有 ${left} 筆資料，等網路恢復後會自動上傳`;
  $('sync').textContent = text;
}

async function sync() {
  await api.flush();
  if (pet) showSync();
}

window.addEventListener('online', sync);
// 從別的 App 切回來（例如下課後隔天打開）時也檢查一次
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && pet && !$('home').hidden) refreshPet();
});
setInterval(sync, FLUSH_EVERY_MS);

// iOS Safari 不理 user-scalable=no，要另外擋雙指縮放
document.addEventListener('gesturestart', (e) => e.preventDefault());

// 離線可用：只在 https 或本機註冊 service worker
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── 開始：這台 iPad 記得序號就直接回到寵物 ──
const remembered = store.getSerial();
pet = remembered && store.loadPet(remembered);
if (pet) {
  pet.appearance = appearanceOf(pet.serial);
  showHome();
  sync();
} else {
  showAdopt();
}
