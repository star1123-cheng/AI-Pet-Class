// 提示詞積木頁（第 4、5 堂）：點選積木 → 預覽 → 複製到 Gemini Canvas；第 5 堂可以合併夥伴的技能。
// 規則與資料都在 blocks/（純函式）；這裡只管畫面。所有文字都用 textContent。
import { h } from './dom.js';
import { mountPet } from '../pet/render.js';
import { appearanceOf } from '../pet/appearance.js';
import { validateSerial } from '../pet/serial.js';
import { CATEGORIES, SKILLS, energyFor, COPY_REMINDER } from '../blocks/blocks.js';
import { compose, toggleBlock, normalize, mergeSkills, defaultSelection } from '../blocks/compose.js';
import { promptOf, energyLeft, spendEnergy, promptLog } from '../blocks/log.js';

const PARTNER_LESSON = 5;

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
      skillList.length
        ? '🧰 會放進提示詞的作品道具：' + skillList.map((id) => SKILLS.find((s) => s.id === id)).map((s) => `${s.name} ${'★'.repeat(s.star)}`).join('、')
        : '🧰 還沒有作品道具。完成任務得到道具後，會自動加進提示詞。',
    );

    const energy = h(
      'div',
      { class: 'energy', 'aria-label': `能量 ${left}／${total}` },
      h('span', { text: `⚡ 能量 ${left}／${total}` }),
      h('span', { class: 'cells' }, Array.from({ length: total }, (_, i) => h('span', { class: i < left ? 'cell full' : 'cell' }))),
    );

    let action;
    if (!text) action = h('p', { class: 'ask', text: '先選「做什麼」，才能複製' });
    else if (left === 0) action = h('p', { class: 'ask', text: '這堂的能量用完了。想一想要怎麼改提示詞，再請老師幫忙。' });
    else action = h('button', { class: 'primary', text: '📋 複製提示詞（用 1 點能量）', onclick: () => copy(text) });

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
          h('p', { class: 'rule', text: COPY_REMINDER }),
          action,
        ),
      ),
      h('button', { class: 'small', text: '← 回到我的寵物', onclick: onExit }),
    );
  }

  // ── 複製 ──
  function copy(text) {
    const next = spendEnergy(prompt, lesson());
    if (!next) return draw();
    // 剪貼簿要在點擊當下呼叫（iPad Safari 的規定），所以先寫入再存檔
    const writing = navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard'));
    prompt = next;
    save();
    const count = prompt.used[lesson()];
    api.logPrompt(promptLog(pet.serial, lesson(), selected, count));
    writing.then(
      () => {
        api.logEvent(pet.serial, lesson(), 'copy', 'ok', count);
        popup(
          h('p', { class: 'big-emoji', text: '📋' }),
          h('h2', { text: '已經複製好了！' }),
          h('p', { text: '到 Gemini Canvas，長按輸入框，選「貼上」。' }),
          h('p', { class: 'rule', text: COPY_REMINDER }),
          h('button', { class: 'primary', text: '好', onclick: closePopup }),
        );
      },
      () => {
        api.logEvent(pet.serial, lesson(), 'copy', 'fallback', count);
        showFallback(text);
      },
    );
    draw();
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
      return h('button', { text: '🤝 合併夥伴的作品道具', onclick: showPartnerForm });
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
        h('p', { text: '🤝 夥伴 ' + p.serial }),
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
      prompt.partner = { serial: v.serial, skills: mergeSkills(res.skills || []) };
      save();
      api.logEvent(pet.serial, lesson(), 'partner', 'merge', prompt.partner.skills.length);
      input.blur();
      closePopup();
      draw();
    }

    popup(
      h('h2', { text: '🤝 合併夥伴' }),
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
    },
  };
}
