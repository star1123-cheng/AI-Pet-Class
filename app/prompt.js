// 提示詞積木頁（第 4、5 堂）：點選積木 → 預覽 → 複製到 Gemini Canvas；第 5 堂可以合併夥伴的技能。
// 規則與資料都在 blocks/（純函式）；這裡只管畫面。所有文字都用 textContent。
import { h } from './dom.js';
import { icon, stars } from './icons.js';
import { mountPet } from '../pet/render.js';
import { appearanceOf } from '../pet/appearance.js';
import { validateSerial } from '../pet/serial.js';
import { CATEGORIES, SKILLS, energyFor, COPY_REMINDER } from '../blocks/blocks.js';
import { compose, toggleBlock, normalize, mergeSkills, defaultSelection } from '../blocks/compose.js';
import { promptOf, energyLeft, spendEnergy, promptLog } from '../blocks/log.js';
import { canvasPet, buildCopy, fallbackCopy } from '../canvas/build.js';
import { pickBrain } from '../engine/brain.js';
import { phraseText } from '../talk/catchphrase.js';

const PARTNER_LESSON = 5;
const CANVAS_LESSON = 5; // 第 5 堂起，主要按鈕改成「一鍵複製範本＋提示詞」

// 保底版（docs/04 第 4 節）：複製不用能量
const FALLBACKS = [
  { id: 'button', lesson: 4, file: 'canvas/fallback/button-score.html', name: '按鈕變色＋計分（完整版）', note: '卡住時直接貼上就能用' },
  { id: 'broken', lesson: 4, file: 'canvas/fallback/button-broken.html', name: '壞掉的版本', note: '修復練習：貼上後，用修復句型請 Gemini 修好' },
  { id: 'example', lesson: 5, file: 'canvas/fallback/guess-draw.html', name: 'AI 猜猜畫畫（完整範例）', note: '先讓作品跑起來，再慢慢改' },
];
const TEMPLATE_FILE = 'canvas/template.html';

// 範本和保底版先載入好：iPad Safari 只准在點擊的當下寫剪貼簿，不能點了才去下載
const files = {};
function loadFiles() {
  const list = [TEMPLATE_FILE, ...FALLBACKS.map((f) => f.file)];
  for (const file of list) {
    if (files[file]) continue;
    files[file] = fetch(file)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
      .then((text) => (files[file] = text))
      .catch(() => delete files[file]); // 下次打開這頁再試
  }
  return Promise.all(list.map((file) => files[file]));
}
const ready = (file) => (typeof files[file] === 'string' ? files[file] : null);

const SERIAL_ERRORS = {
  empty: '請輸入夥伴的序號',
  length: '序號是 6 個字',
  char: '序號裡沒有 I、L、O、0、1，請再看一次卡片',
  check: '序號好像打錯了，請再對一次',
  self: '這是你自己的序號，請輸入夥伴的',
  offline: '連不上網路，等一下再試',
  unknown_serial: '找不到這個序號，請拿序號卡問老師',
  bad_serial: '序號好像打錯了，請再對一次',
  not_claimed: '這位夥伴還沒領養寵物',
};

export function createPromptPage({ root, store, api, getPet, onExit }) {
  const body = root.querySelector('.talk-body');
  const overlay = root.querySelector('.talk-overlay');
  let pet;
  let prompt;
  let selected;

  const lesson = () => pet.lesson;
  const skills = () => mergeSkills(pet.skills || [], prompt.partner?.skills || []);

  function save() {
    prompt.selected = normalize(selected);
    pet.prompt = prompt;
    pet.updated = Date.now();
    store.savePet(pet);
  }

  function popup(...kids) {
    overlay.replaceChildren(h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, ...kids));
    overlay.hidden = false;
  }
  const closePopup = () => {
    overlay.hidden = true;
    overlay.replaceChildren();
  };

  // ── 主畫面 ──
  function draw() {
    const text = compose(selected, skills());
    const left = energyLeft(prompt, lesson());
    const total = energyFor(lesson());

    const blocks = CATEGORIES.map((cat) =>
      h(
        'div',
        { class: 'slot' },
        h('p', { class: 'muted', text: cat.name + (cat.pick === 'many' ? '（可以選很多個）' : '') + (cat.required ? '　一定要選' : '') }),
        h(
          'div',
          { class: 'row' },
          cat.blocks.map((b) =>
            h('button', {
              class: 'small' + (selected.includes(b.id) ? ' on' : ''),
              'aria-pressed': String(selected.includes(b.id)),
              text: b.text,
              onclick: () => {
                selected = toggleBlock(selected, b.id);
                save();
                draw();
              },
            }),
          ),
        ),
      ),
    );

    const skillList = skills();
    const skillLine = h(
      'p',
      { class: 'muted' },
      icon('cards'),
      ' ',
      ...(skillList.length
        ? ['會放進提示詞的作品道具：', ...skillList.map((id) => SKILLS.find((s) => s.id === id)).flatMap((s, i) => [i ? '、' : '', h('span', { class: 'nowrap' }, s.name, stars(s.star, '16px'))])]
        : ['還沒有作品道具。完成任務得到道具後，會自動加進提示詞。']),
    );

    const energy = h(
      'div',
      { class: 'energy', 'aria-label': `能量 ${left}／${total}` },
      h('span', {}, icon('bolt'), ` 能量 ${left}／${total}`),
      h('span', { class: 'cells' }, Array.from({ length: total }, (_, i) => h('span', { class: i < left ? 'cell full' : 'cell' }))),
    );

    const canvas = lesson() >= CANVAS_LESSON;
    let action;
    if (!text) action = h('p', { class: 'ask', text: '先選「做什麼」，才能複製' });
    else if (left === 0) action = h('p', { class: 'ask', text: '這堂的能量用完了。想一想要怎麼改提示詞，再請老師幫忙。' });
    else if (!canvas) action = h('button', { class: 'primary', onclick: () => copy(text) }, icon('copy'), '複製提示詞（用 1 點能量）');
    else if (!ready(TEMPLATE_FILE)) action = h('button', { class: 'primary', disabled: true }, icon('copy'), '範本準備中…');
    else
      action = h(
        'div',
        { class: 'col' },
        h('button', { class: 'primary', onclick: () => copy(canvasText(text, false), 'full') }, icon('copy'), '一鍵複製範本＋提示詞（用 1 點能量）'),
        h('button', { class: 'small ghost', onclick: () => copyFree(canvasText(text, true), 'canvas', 'lite') }, '貼不上？改複製精簡版'),
      );
    const fallbacks = FALLBACKS.filter((f) => f.lesson === lesson());

    body.replaceChildren(
      h('h2', { class: 'talk-title', text: `提示詞積木（第 ${lesson()} 堂）` }),
      h(
        'div',
        { class: 'split' },
        h('div', { class: 'col' }, blocks),
        h(
          'div',
          { class: 'col' },
          h('pre', { class: 'prompt-preview', text: text || '（選好積木，這裡會出現提示詞）' }),
          skillLine,
          lesson() >= PARTNER_LESSON ? partnerBox() : null,
          energy,
          h('p', { class: 'rule' }, icon('shield', { size: '26px' }), COPY_REMINDER),
          action,
          fallbacks.length ? h('button', { class: 'small', onclick: showFallbacks }, icon('cards'), '保底版') : null,
        ),
      ),
      h('button', { class: 'small', onclick: onExit }, icon('back'), '回到我的寵物'),
    );
  }

  // 一鍵複製的內容：自己（＋夥伴）的寵物外型、腦袋、作品道具，加上積木組好的提示詞（docs/04 3.1）
  // 自己的腦袋來自 pet.samples（P3 存的訓練範例，標成標錯的不放）；還沒有範例時範本會改用假資料
  function canvasText(text, lite) {
    const pets = [
      canvasPet({ appearance: pet.appearance, accuracy: pet.state?.accuracy, samples: (pet.samples || []).filter((x) => !x.flagged), phrase: phraseText(pet.talk?.phrase), name: '我的 AI 寵物', lite }),
    ];
    const p = prompt.partner;
    if (p) pets.push(canvasPet({ appearance: appearanceOf(p.serial), brain: p.brain, name: '夥伴的 AI 寵物', lite }));
    return buildCopy(ready(TEMPLATE_FILE), { pets, skills: skills(), lite }, text);
  }

  // ── 複製 ──
  // 剪貼簿要在點擊當下呼叫（iPad Safari 的規定），所以先寫入再存檔
  function writeClipboard(text) {
    return navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard'));
  }

  function copied() {
    popup(
      h('div', { class: 'sheet-icon' }, icon('copy')),
      h('h2', { text: '已經複製好了！' }),
      h('p', { text: '到 Gemini Canvas，長按輸入框，選「貼上」。' }),
      h('p', { class: 'rule' }, icon('shield', { size: '26px' }), COPY_REMINDER),
      h('button', { class: 'primary', text: '好', onclick: closePopup }),
    );
  }

  // kind：prompt＝只有提示詞、full＝範本＋提示詞
  function copy(text, kind = 'prompt') {
    const next = spendEnergy(prompt, lesson());
    if (!next) return draw();
    const writing = writeClipboard(text);
    prompt = next;
    save();
    const count = prompt.used[lesson()];
    api.logPrompt(promptLog(pet.serial, lesson(), selected, count));
    if (kind === 'full') api.logEvent(pet.serial, lesson(), 'canvas', 'full', count);
    writing.then(
      () => {
        api.logEvent(pet.serial, lesson(), 'copy', 'ok', count);
        copied();
      },
      () => {
        api.logEvent(pet.serial, lesson(), 'copy', 'fallback', count);
        showFallback(text);
      },
    );
    draw();
  }

  // 不用能量的複製：精簡版（貼上失敗時）與保底版
  function copyFree(text, type, code) {
    const writing = writeClipboard(text);
    api.logEvent(pet.serial, lesson(), type, code, 0);
    writing.then(copied, () => showFallback(text));
  }

  function showFallbacks() {
    const list = FALLBACKS.filter((f) => f.lesson === lesson());
    popup(
      h('div', { class: 'sheet-icon' }, icon('cards')),
      h('h2', { text: '保底版' }),
      h('p', { text: '複製後貼進 Gemini Canvas。保底版不用能量。' }),
      ...list.map((f) =>
        h(
          'div',
          { class: 'partner' },
          h('div', { class: 'col' }, h('p', {}, h('b', { text: f.name })), h('p', { class: 'muted', text: f.note })),
          ready(f.file)
            ? h('button', { class: 'small', onclick: () => copyFree(fallbackCopy(ready(f.file)), 'fallback', f.id) }, icon('copy'), '複製')
            : h('button', { class: 'small', disabled: true, text: '準備中…' }),
        ),
      ),
      h('button', { class: 'small', text: '關閉', onclick: closePopup }),
    );
  }

  // 剪貼簿不能用時：文字框全選，請學生長按「拷貝」
  function showFallback(text) {
    const box = h('textarea', { class: 'copy-box', readonly: true, 'aria-label': '提示詞' });
    box.value = text;
    popup(
      h('h2', { text: '請自己拷貝一次' }),
      h('p', { text: '長按下面的文字，選「全選」，再選「拷貝」。' }),
      box,
      h('button', { class: 'small', text: '幫我全選', onclick: () => (box.focus(), box.setSelectionRange(0, box.value.length)) }),
      h('button', { class: 'primary', text: '拷貝好了', onclick: closePopup }),
    );
    box.focus();
    box.setSelectionRange(0, box.value.length);
  }

  // ── 合併夥伴（第 5 堂）──
  function partnerBox() {
    const p = prompt.partner;
    if (!p) {
      return h('button', { onclick: showPartnerForm }, icon('link'), '合併夥伴的作品道具');
    }
    const face = h('div', { class: 'pet small' });
    mountPet(face, appearanceOf(p.serial), { label: '夥伴的 AI 寵物' });
    const names = p.skills.map((id) => SKILLS.find((s) => s.id === id)?.name).filter(Boolean);
    return h(
      'div',
      { class: 'partner' },
      face,
      h(
        'div',
        { class: 'col' },
        h('p', {}, icon('link'), ' 夥伴 ' + p.serial),
        h('p', { class: 'muted', text: names.length ? '夥伴的道具：' + names.join('、') : '夥伴還沒有作品道具' }),
        h('button', {
          class: 'small',
          text: '取消合併',
          onclick: () => {
            prompt.partner = null;
            save();
            draw();
          },
        }),
      ),
    );
  }

  function showPartnerForm() {
    const input = h('input', {
      class: 'serial-input',
      maxlength: 8,
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'characters',
      spellcheck: 'false',
      enterkeyhint: 'go',
      'aria-label': '夥伴的序號',
    });
    const error = h('p', { class: 'error', role: 'alert' });
    const go = h('button', { class: 'primary', text: '合併' });
    input.addEventListener('input', () => (error.textContent = ''));
    input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    go.addEventListener('click', submit);

    async function submit() {
      const v = validateSerial(input.value);
      input.value = v.serial;
      if (!v.ok) return (error.textContent = SERIAL_ERRORS[v.reason]);
      if (v.serial === pet.serial) return (error.textContent = SERIAL_ERRORS.self);
      go.disabled = true;
      go.textContent = '連線中…';
      const res = await api.getBrain(v.serial);
      go.disabled = false;
      go.textContent = '合併';
      if (!res) return (error.textContent = SERIAL_ERRORS.offline);
      if (!res.ok) return (error.textContent = SERIAL_ERRORS[res.error] || SERIAL_ERRORS.offline);
      // 夥伴的腦袋只存挑好的那份（≤ 4 KB），一鍵複製時放進範本
      prompt.partner = { serial: v.serial, skills: mergeSkills(res.skills || []), brain: pickBrain(res.brain || []) };
      save();
      api.logEvent(pet.serial, lesson(), 'partner', 'merge', prompt.partner.skills.length);
      input.blur();
      closePopup();
      draw();
    }

    popup(
      h('div', { class: 'sheet-icon' }, icon('link')),
      h('h2', { text: '合併夥伴' }),
      h('p', { text: '輸入夥伴序號卡上的 6 個字。合併後，夥伴的作品道具也會放進提示詞。' }),
      input,
      error,
      h('div', { class: 'row' }, go, h('button', { class: 'small', text: '取消', onclick: () => (input.blur(), closePopup()) })),
    );
    input.focus();
  }

  return {
    open() {
      pet = getPet();
      prompt = promptOf(pet);
      selected = prompt.selected || defaultSelection();
      closePopup();
      draw();
      loadFiles().then(() => !root.hidden && draw());
    },
  };
}
