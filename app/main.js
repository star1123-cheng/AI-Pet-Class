// 領養流程：輸入序號 → 寵物現身 → AI 狀態面板。所有文字都用 textContent。
import { GAS_URL } from '../config.js';
import { validateSerial } from '../pet/serial.js';
import { appearanceOf } from '../pet/appearance.js';
import { mountPet, coreLevel } from '../pet/render.js';
import { createStore, mergePet } from './store.js';
import { createApi } from './api.js';
import { createLesson3 } from './lesson3.js';
import { createLessons12 } from './lessons12.js';
import { createPromptPage } from './prompt.js';
import { h } from './dom.js';
import { icon, stars } from './icons.js';
import { SKILLS } from '../blocks/blocks.js';
import { promptOf, applyEnergyReset } from '../blocks/log.js';
import { measure } from '../train/data.js';

const FLUSH_EVERY_MS = 20000;

const $ = (id) => document.getElementById(id);
const store = createStore();
const api = createApi({ url: GAS_URL, store, onRejected });

let pet = null;

// 堂次由老師在試算表 config 設定（currentLesson）；首頁依堂次決定能進哪些活動
// 第 1、2 堂（P3）
const lessons12 = createLessons12({ root: $('train'), store, api, getPet: () => pet, onExit: showHome });
// 第 3 堂（P4）
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
  pet = mergePet(store.loadPet(serial) || pet, serial, res, appearanceOf(serial));
  pet.prompt = applyEnergyReset(promptOf(pet), pet.lesson, res.energyReset); // 老師在看板重設了這堂能量
  pet = store.savePet(pet);
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
  lessons12.close();
  $('train').hidden = true;
  $('talk').hidden = true;
  $('prompt').hidden = true;
  $('home').hidden = false;
  renderHome();
  refreshPet();
}

function renderHome() {
  $('serialTag').textContent = '序號 ' + pet.serial;
  $('cardSerial').textContent = pet.serial;
  $('lessonTag').textContent = `第 ${pet.lesson} 堂`;
  // 老師換堂次後類別與測試集會變（第 2 堂多了三角），所以數值依目前堂次重算
  if (pet.samples?.length) {
    const m = measure(pet.samples, pet.lesson);
    pet.state = { ...pet.state, dataCount: m.dataCount, dataQuality: m.dataQuality, accuracy: m.accuracy };
  }
  const s = pet.state;
  // 寵物只在換人或核心亮度改變時重畫，不然背景更新堂次時牠會再跳出來一次
  const petKey = pet.serial + '|' + coreLevel(s.accuracy ?? null);
  if ($('pet').dataset.key !== petKey) {
    mountPet($('pet'), pet.appearance, { label: '我的 AI 寵物', accuracy: s.accuracy ?? null });
    $('pet').dataset.key = petKey;
  }
  $('sData').textContent = `${s.dataCount} 張`;
  $('sQuality').textContent = String(Math.round(s.dataQuality));
  $('sQualityBar').style.width = Math.max(0, Math.min(100, s.dataQuality)) + '%';
  $('sTrain').textContent = `${s.trainCount} 次`;
  $('sAcc').textContent = s.accuracy === null || s.accuracy === undefined ? '還沒考過' : Math.round(s.accuracy * 100) + '%';
  renderItems();
  $('rejected').hidden = !pet.rejected;
  renderActions();
  showSync();
}

// 各堂入口：from＝從第幾堂開始可以進去（第 4～6 堂都是提示詞積木）
const ENTRIES = [
  { from: 1, name: '第 1 堂：領養 AI', short: '第 1 堂', screen: 'train', open: () => lessons12.open(1) },
  { from: 2, name: '第 2 堂：餵對與餵錯', short: '第 2 堂', screen: 'train', open: () => lessons12.open(2) },
  { from: 3, name: '第 3 堂：AI 怎麼說話', short: '第 3 堂', screen: 'talk', open: () => lesson3.open() },
  { from: 4, name: '提示詞積木', short: '積木', screen: 'prompt', open: () => promptPage.open() },
];

// 一屏一個主要動作：本堂的入口是藍色大按鈕，之前堂次的入口排成一列小按鈕
function renderActions() {
  const open = ENTRIES.filter((e) => e.from <= pet.lesson);
  const now = open[open.length - 1];
  const go = (e) => () => {
    $('home').hidden = true;
    $(e.screen).hidden = false;
    e.open();
  };
  const past = open.slice(0, -1).map((e) => h('button', { class: 'small', text: e.short, onclick: go(e) }));
  $('actions').replaceChildren(
    ...(past.length ? [h('div', { class: 'past', role: 'group', 'aria-label': '之前的堂次' }, past)] : []),
    h('button', { class: 'primary', onclick: go(now) }, now.name, icon('next')),
  );
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
  let mark = 'cloud';
  if (!GAS_URL) text = '離線模式：資料存在這台 iPad';
  else if (left === 0) {
    text = '已存到雲端';
    mark = 'check';
  } else text = `還有 ${left} 筆資料，等網路恢復後會自動上傳`;
  $('sync').replaceChildren(icon(mark), text);
}

// 作品道具卡：9 格，得到的依稀有度換框，沒得到的是虛線問號
function renderItems() {
  const owned = new Set(pet.skills || []);
  $('itemCount').textContent = `${SKILLS.filter((s) => owned.has(s.id)).length}／${SKILLS.length}`;
  $('items').replaceChildren(
    ...SKILLS.map((s) =>
      owned.has(s.id)
        ? h(
            'div',
            { class: `item t${s.star}` },
            h('div', { class: 'in' }, h('span', { text: s.name }), stars(s.star, '18px')),
          )
        : h('div', { class: 'item locked', 'aria-label': '還沒得到' }, h('div', { class: 'in' }, icon('question', { size: '30px' }))),
    ),
  );
}

// 靜態畫面上的圖示（HTML 裡不放 emoji）
$('adoptSlot').append(icon('cards', { size: '56px' }));
$('rule1').prepend(icon('shield', { size: '26px' }));

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
