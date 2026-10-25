// 領養流程：輸入序號 → 寵物現身 → AI 狀態面板。所有文字都用 textContent。
import { GAS_URL } from '../config.js';
import { validateSerial } from '../pet/serial.js';
import { appearanceOf } from '../pet/appearance.js';
import { mountPet } from '../pet/render.js';
import { createStore, newPet, classesFor } from './store.js';
import { createApi } from './api.js';

const FLUSH_EVERY_MS = 20000;

const $ = (id) => document.getElementById(id);
const store = createStore();
const api = createApi({ url: GAS_URL, store, onRejected });

let pet = null;

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
    pet = mergePet(v.serial, res && res.ok ? res : null);
    store.setSerial(pet.serial);
    store.savePet(pet);
    api.logEvent(pet.serial, pet.lesson, 'adopt', res && res.ok ? 'online' : 'offline').then(showSync);
    $('serial').blur();
    showHome();
  } finally {
    $('adoptBtn').disabled = false;
    $('adoptBtn').textContent = '領養';
  }
}

// 本機與試算表都有資料時，留比較新的那份；外型一律由序號算
function mergePet(serial, res) {
  const local = store.loadPet(serial);
  const lesson = res?.currentLesson || local?.lesson || 1;
  let p = local || newPet(serial, appearanceOf(serial), lesson);
  const remote = res?.pet;
  if (remote && remote.updated > (p.updated || 0)) {
    p = { ...p, lesson: remote.lesson, state: { ...p.state, ...remote.state }, skills: remote.skills, badges: remote.badges, updated: remote.updated };
  }
  if (res) p.rejected = false;
  p.appearance = appearanceOf(serial);
  if (!p.state.classes?.length) p.state.classes = classesFor(p.lesson);
  return p;
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
  $('home').hidden = false;
  renderHome();
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
  showSync();
}

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
