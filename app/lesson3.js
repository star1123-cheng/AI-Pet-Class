// 第 3 堂「AI 怎麼說話」的畫面：機率接龍、寵物亂說話、修好牠的嘴巴、口頭禪、任務單、比喻校準。
// 規則與資料都在 talk/（純函式）；這裡只管畫面。所有文字都用 textContent。
import { mountPet } from '../pet/render.js';
import { CHAINS, TEMPS, tempOf, applyTemperature, drawWord, DEFAULT_LEVEL } from '../talk/chain.js';
import { TOPICS, firstRound, talkRound, wrongCount, judgeScore, shuffle } from '../talk/hallucination.js';
import { SHELVES, factsOn, factById } from '../talk/bookshelf.js';
import { SLOTS, REASONS, phraseText, phraseCode } from '../talk/catchphrase.js';
import { LESSON, TASKS, SHEET, METAPHOR, talkOf, passJudge, passFix, unlockSkill, sheetCorrect, choiceCode } from '../talk/lesson3.js';

// 技能效果說明（docs/04 1.）
const SKILL_INFO = {
  feedback: '你的寵物學會說鼓勵或提示的話了',
  sound: '你的作品可以加上猜對、猜錯的音效了',
  anim: '你的寵物會跳一跳，還會說出你的口頭禪',
};

const pct = (x) => Math.round(x * 100) + '%';

// 小工具：建立元素。文字一律走 textContent
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid) el.append(kid);
  return el;
}

export function createLesson3({ root, store, api, getPet, onExit }) {
  const body = root.querySelector('.talk-body');
  const overlay = root.querySelector('.talk-overlay');
  let pet;
  let talk;

  function save({ sync = false } = {}) {
    pet.talk = talk;
    pet.updated = Date.now();
    store.savePet(pet);
    if (sync) api.savePet(pet);
  }

  const log = (type, code, value = '') => api.logEvent(pet.serial, LESSON, type, code, value);

  // 寵物＋對話泡泡
  function petSays(text, extra = '') {
    const box = h('div', { class: 'pet small' });
    mountPet(box, pet.appearance, { label: '我的 AI 寵物', accuracy: pet.state.accuracy ?? null });
    return h('div', { class: 'talker ' + extra }, box, h('p', { class: 'bubble', text }));
  }

  function screen(title, ...kids) {
    body.replaceChildren(h('h2', { class: 'talk-title', text: title }), ...kids);
    body.scrollTop = 0;
  }

  const backBtn = () => h('button', { class: 'small', text: '← 回到第 3 堂', onclick: showHub });

  // ── 彈窗 ──
  function popup(...kids) {
    overlay.replaceChildren(h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, ...kids));
    overlay.hidden = false;
  }
  const closePopup = () => {
    overlay.hidden = true;
    overlay.replaceChildren();
  };

  function showRule(then) {
    popup(
      h('p', { class: 'big-emoji', text: '🔍' }),
      h('h2', { text: '守則 3：AI 說的要查證' }),
      h('p', { text: 'AI 說得很有自信，也可能是錯的。重要的事，要用可靠的來源再查一次。' }),
      h('button', {
        class: 'primary',
        text: '我知道了',
        onclick: () => {
          talk.ruleSeen = true;
          save();
          closePopup();
          then();
        },
      }),
    );
  }

  function showUnlock(skill, then) {
    const t = TASKS.find((x) => x.skill === skill);
    popup(
      h('p', { class: 'big-emoji pop-in', text: '🎉' }),
      h('h2', { text: `解鎖技能：${t.name} ${'★'.repeat(t.star)}` }),
      h('p', { text: SKILL_INFO[skill] }),
      h('button', { class: 'primary', text: '太好了', onclick: () => (closePopup(), then()) }),
    );
  }

  // 解鎖技能：寫進 pet.skills 並排進雲端佇列
  function grant(skill, then) {
    if (!unlockSkill(pet, skill)) return then();
    save({ sync: true });
    log('skill', skill);
    showUnlock(skill, then);
  }

  function showShelf(fromCode) {
    log('shelf', fromCode || 'open');
    let shelf = 'all';
    const list = h('div', { class: 'facts' });
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    function draw() {
      tabs.replaceChildren(
        ...SHELVES.map((s) =>
          h('button', {
            class: 'small' + (s.id === shelf ? ' on' : ''),
            role: 'tab',
            'aria-selected': String(s.id === shelf),
            text: s.name,
            onclick: () => ((shelf = s.id), draw()),
          }),
        ),
      );
      list.replaceChildren(...factsOn(shelf).map((f) => h('p', { class: 'fact', text: f.text })));
    }
    draw();
    popup(
      h('h2', { text: '📚 查證小書櫃' }),
      h('p', { class: 'muted', text: '這些是從課本與可靠網站整理的事實。找找看，跟寵物說的一樣嗎？' }),
      tabs,
      list,
      h('button', { class: 'primary', text: '關掉書櫃', onclick: closePopup }),
    );
  }

  // ── 第 3 堂首頁 ──
  function showHub() {
    const has = (s) => pet.skills.includes(s);
    const cards = [
      { icon: '🎲', name: '機率接龍', note: 'AI 怎麼猜下一個字', done: talk.chain >= CHAINS.length, go: () => showChain(0) },
      { icon: '🗣️', name: '寵物亂說話', note: '★ 判斷對 5 句 → 回饋話語', done: has('feedback'), go: () => startJudge('first') },
      { icon: '🔧', name: '修好牠的嘴巴', note: '★★ 調低溫度 → 音效', done: has('sound'), go: showFix, locked: talk.judge === null },
      { icon: '💬', name: '口頭禪積木', note: '★★★ 造一句口頭禪 → 角色動畫', done: has('anim'), go: showPhrase },
      { icon: '📝', name: '迷你任務單', note: '3 題', done: talk.sheet, go: () => showSheet(shuffle(SHEET), 0) },
      { icon: '🤔', name: '這個比喻哪裡不準？', note: '下課前想一想', done: talk.metaphor, go: showMetaphor },
    ];
    screen(
      '第 3 堂：AI 怎麼說話',
      h('p', { class: 'rule', text: '守則 3：🔍 AI 說的要查證' }),
      h(
        'div',
        { class: 'cards' },
        cards.map((c) =>
          h(
            'button',
            { class: 'card' + (c.done ? ' done' : ''), disabled: c.locked, onclick: c.go },
            h('span', { class: 'card-icon', text: c.icon }),
            h('span', { class: 'card-name', text: c.name }),
            h('span', { class: 'card-note', text: c.locked ? '先玩「寵物亂說話」' : c.note }),
            c.done ? h('span', { class: 'card-done', text: '✓ 完成' }) : null,
          ),
        ),
      ),
      h('button', { class: 'small', text: '← 回到我的寵物', onclick: onExit }),
    );
  }

  // ── 溫度滑桿（接龍與修嘴巴共用）──
  function tempSlider(level, onchange) {
    const name = h('strong', { text: tempOf(level).name });
    const input = h('input', { type: 'range', min: 1, max: TEMPS.length, step: 1, value: level, 'aria-label': '溫度' });
    input.addEventListener('input', () => {
      const lv = Number(input.value);
      name.textContent = tempOf(lv).name;
      onchange(lv);
    });
    return h(
      'div',
      { class: 'temp' },
      h('p', {}, '🌡️ 溫度：', name),
      input,
      h('div', { class: 'temp-ends' }, h('span', { text: '低＝保守' }), h('span', { text: '高＝愛亂猜' })),
    );
  }

  // ── 1. 機率接龍 ──
  function showChain(i) {
    const chain = CHAINS[i];
    let level = talk.level ?? DEFAULT_LEVEL;
    let picked = null;
    const tally = new Map();
    const talker = petSays(chain.start + '＿＿');
    const bubble = talker.querySelector('.bubble');
    const rows = h('div', { class: 'words' });
    const after = h('div', { class: 'row' });

    function drawRows() {
      const q = applyTemperature(chain.words.map((w) => w.p), tempOf(level).t);
      rows.replaceChildren(
        ...chain.words.map((w, k) =>
          h(
            'button',
            { class: 'word' + (picked === w ? ' on' : ''), onclick: () => choose(w, 'pick') },
            h('span', { class: 'w-text', text: w.text }),
            h('span', { class: 'bar' }, h('span', { style: `width:${(q[k] * 100).toFixed(1)}%` })),
            h('span', { class: 'w-pct', text: pct(q[k]) }),
            h('span', { class: 'w-tally', text: tally.get(w) ? `抽到 ${tally.get(w)} 次` : '' }),
          ),
        ),
      );
    }

    function choose(w, how) {
      picked = w;
      bubble.textContent = chain.start + w.text + '。';
      log('chain', chain.id + '.' + w.id, how === 'pick' ? 'pick' : level);
      if (talk.chain < i + 1) {
        talk.chain = i + 1;
        save();
      }
      drawRows();
      showNext();
    }

    function drawMany(n) {
      let last;
      for (let k = 0; k < n; k++) {
        last = drawWord(chain, tempOf(level).t);
        tally.set(last, (tally.get(last) || 0) + 1);
      }
      choose(last, 'draw');
    }

    function showNext() {
      const last = i === CHAINS.length - 1;
      after.replaceChildren(
        h('button', {
          class: 'primary',
          text: last ? '完成接龍 ✓' : '下一條 →',
          onclick: () => (last ? showHub() : showChain(i + 1)),
        }),
      );
    }

    drawRows();
    if (talk.chain > i) showNext();
    screen(
      `機率接龍（${i + 1}／${CHAINS.length}）`,
      h(
        'div',
        { class: 'split' },
        h(
          'div',
          { class: 'col' },
          talker,
          tempSlider(level, (lv) => {
            level = lv;
            talk.level = lv;
            save();
            tally.clear();
            drawRows();
          }),
          h('p', { class: 'hint', text: '溫度低：幾乎都選機率最高的字。溫度高：比較容易抽到奇怪的字。' }),
        ),
        h(
          'div',
          { class: 'col' },
          h('p', { class: 'muted', text: '點一個字接下去，或讓電腦依機率抽：' }),
          rows,
          h(
            'div',
            { class: 'row' },
            h('button', { text: '🎲 電腦抽 1 次', onclick: () => drawMany(1) }),
            h('button', { text: '🎲 抽 10 次', onclick: () => drawMany(10) }),
          ),
          after,
        ),
      ),
      backBtn(),
    );
  }

  // ── 2、3. 判斷對錯（第一輪與重測共用）──
  function startJudge(kind) {
    const level = talk.level ?? DEFAULT_LEVEL;
    const round = kind === 'first' ? firstRound() : talkRound(tempOf(level).t);
    showJudge({ kind, level, round, answers: [] });
  }

  function showJudge(r) {
    const i = r.answers.length;
    if (i === r.round.length) return showJudgeResult(r);
    const s = r.round[i];
    const answer = (v) => {
      log('judge', s.code, v ? 'yes' : 'no');
      r.answers.push(v);
      showJudge(r);
    };
    screen(
      r.kind === 'first' ? `寵物亂說話（第 ${i + 1}／6 句）` : `再聽牠說（第 ${i + 1}／6 句）`,
      h(
        'div',
        { class: 'split' },
        petSays(s.text, 'big'),
        h(
          'div',
          { class: 'col' },
          h('p', { class: 'muted', text: '牠說的對嗎？不確定就查小書櫃。' }),
          h(
            'div',
            { class: 'row' },
            h('button', { class: 'yes', text: '⭕ 對', onclick: () => answer(true) }),
            h('button', { class: 'no', text: '❌ 錯', onclick: () => answer(false) }),
          ),
          h('button', { class: 'shelf-btn', text: '📚 用小書櫃查證', onclick: () => showShelf(s.code) }),
        ),
      ),
      backBtn(),
    );
  }

  function showJudgeResult(r) {
    const score = judgeScore(r.round, r.answers);
    const wrong = wrongCount(r.round);
    const list = h(
      'ul',
      { class: 'review' },
      r.round.map((s, k) => {
        const ok = r.answers[k] === s.truth;
        return h(
          'li',
          { class: ok ? 'ok' : 'bad' },
          h('p', { text: `${ok ? '✓' : '✗'} 「${s.text}」 ${s.truth ? '這句是對的' : '這句是錯的'}` }),
          s.truth ? null : h('p', { class: 'muted', text: '📚 ' + factById(s.fact).text }),
        );
      }),
    );

    if (r.kind === 'first') {
      talk.judge = Math.max(talk.judge ?? 0, score);
      save();
      log('round', 'first', score);
      const pass = passJudge(score);
      screen(
        `你判斷對了 ${score}／6 句`,
        h('p', { class: 'ask', text: '🤔 為什麼牠說得這麼有自信，卻說錯了？' }),
        h('p', { text: '牠是從學過的文字裡，猜「最可能接的字」。牠不會自己去查，所以錯了也不知道。' }),
        list,
        h(
          'div',
          { class: 'row' },
          pass
            ? h('button', { class: 'primary', text: '去修好牠的嘴巴 →', onclick: showFix })
            : h('button', { class: 'primary', text: '再試一次', onclick: () => startJudge('first') }),
          h('button', { class: 'small', text: '回到第 3 堂', onclick: showHub }),
        ),
      );
      if (pass) grant('feedback', () => {});
      return;
    }

    const pass = passFix(r.level, wrong);
    log('round', 'fix', wrong);
    log('fix', 'L' + r.level, wrong);
    if (pass && !talk.fixed) {
      talk.fixed = true;
      save();
    }
    let msg;
    if (pass) msg = '溫度低，牠就選最可能的話說，比較不會亂說了！';
    else if (r.level > 2) msg = '溫度還太高，牠還是很愛亂猜。把溫度調低再試試。';
    else msg = '還是說錯好幾句。溫度再調低一點試試看。';
    screen(
      `這次牠說錯了 ${wrong} 句（溫度：${tempOf(r.level).name}）`,
      h('p', { class: pass ? 'good' : 'ask', text: msg }),
      h('p', { class: 'muted', text: `你判斷對了 ${score}／6 句` }),
      list,
      h(
        'div',
        { class: 'row' },
        pass
          ? h('button', { class: 'primary', text: '回到第 3 堂', onclick: showHub })
          : h('button', { class: 'primary', text: '調整溫度再試', onclick: showFix }),
      ),
    );
    if (pass) grant('sound', () => {});
  }

  // ── 3. 修好牠的嘴巴 ──
  function showFix() {
    let level = talk.level ?? DEFAULT_LEVEL;
    const chance = h('p', { class: 'chance' });
    const drawChance = () => {
      const q = applyTemperature(TOPICS[0].pool.map((c) => c.p), tempOf(level).t);
      chance.textContent = `這個溫度，牠每句說錯的機會：約 ${pct(1 - q[0])}`;
    };
    drawChance();
    screen(
      '修好牠的嘴巴',
      h(
        'div',
        { class: 'split' },
        petSays('我的嘴巴怪怪的，常常亂說話……可以幫我調一下溫度嗎？'),
        h(
          'div',
          { class: 'col' },
          tempSlider(level, (lv) => {
            level = lv;
            talk.level = lv;
            save();
            drawChance();
          }),
          chance,
          h('button', { class: 'primary', text: '讓牠再說 6 句', onclick: () => startJudge('fix') }),
        ),
      ),
      backBtn(),
    );
  }

  // ── 4. 口頭禪積木 ──
  function showPhrase() {
    const ids = talk.phrase ? talk.phrase.slice() : SLOTS.map(() => null);
    let reason = talk.reason;
    const talker = petSays('');
    const bubble = talker.querySelector('.bubble');
    const slots = h('div', { class: 'slots' });
    const reasons = h('div', { class: 'reasons' });
    const done = h('div', { class: 'row' });

    function draw() {
      const text = phraseText(ids);
      bubble.textContent = text || ids.map((id, k) => (id ? SLOTS[k].words.find((w) => w.id === id).text : '＿＿')).join('');
      slots.replaceChildren(
        ...SLOTS.map((slot, k) =>
          h(
            'div',
            { class: 'slot' },
            h('p', { class: 'muted', text: `${k + 1}. ${slot.name}` }),
            h(
              'div',
              { class: 'row' },
              slot.words.map((w) =>
                h(
                  'button',
                  { class: 'small' + (ids[k] === w.id ? ' on' : ''), onclick: () => ((ids[k] = w.id), draw()) },
                  h('span', { text: w.text }),
                  h('span', { class: 'w-pct', text: ' ' + pct(w.p) }),
                ),
              ),
            ),
          ),
        ),
      );
      reasons.replaceChildren(
        ...(text
          ? [
              h('p', { class: 'muted', text: '你為什麼選這句？' }),
              ...REASONS.map((r) =>
                h('button', { class: 'small reason' + (reason === r.id ? ' on' : ''), text: r.text, onclick: () => ((reason = r.id), draw()) }),
              ),
            ]
          : []),
      );
      done.replaceChildren(
        text && reason
          ? h('button', {
              class: 'primary',
              text: '就用這句！',
              onclick: () => {
                talk.phrase = ids.slice();
                talk.reason = reason;
                save();
                log('phrase', phraseCode(ids), reason);
                grant('anim', showHub);
              },
            })
          : null,
      );
    }
    draw();
    screen(
      '口頭禪積木 ★★★',
      h(
        'div',
        { class: 'split' },
        h('div', { class: 'col' }, talker, h('p', { class: 'hint', text: '每個詞旁邊是「寵物覺得的機率」。你要選最常見的，還是特別的？' })),
        h('div', { class: 'col' }, slots, reasons, done),
      ),
      backBtn(),
    );
  }

  // ── 5. 迷你任務單 ──
  function showSheet(questions, i) {
    if (i === questions.length) {
      talk.sheet = true;
      save();
      return showHub();
    }
    const q = questions[i];
    const chosen = new Set();
    const options = shuffle(q.options);
    const box = h('div', { class: 'options' });
    const foot = h('div', { class: 'row' });

    function draw(answered) {
      box.replaceChildren(
        ...options.map((o) => {
          let cls = 'option' + (chosen.has(o.id) ? ' on' : '');
          if (answered) cls += q.answer.includes(o.id) ? ' right' : chosen.has(o.id) ? ' wrong' : '';
          return h('button', {
            class: cls,
            disabled: answered,
            text: (q.multi ? (chosen.has(o.id) ? '☑ ' : '☐ ') : '') + o.text,
            onclick: () => {
              if (q.multi) {
                chosen.has(o.id) ? chosen.delete(o.id) : chosen.add(o.id);
                draw(false);
              } else {
                chosen.add(o.id);
                submit();
              }
            },
          });
        }),
      );
      if (answered) {
        const ok = sheetCorrect(q, chosen);
        foot.replaceChildren(
          h('p', { class: ok ? 'good' : 'ask', text: ok ? '✓ 答對了！' : '再看看綠色的答案' }),
          h('button', { class: 'primary', text: i === questions.length - 1 ? '完成任務單 ✓' : '下一題 →', onclick: () => showSheet(questions, i + 1) }),
        );
      } else if (q.multi) {
        foot.replaceChildren(h('button', { class: 'primary', text: '送出', disabled: chosen.size === 0, onclick: submit }));
      } else foot.replaceChildren();
    }
    function submit() {
      log('sheet', q.id, choiceCode(chosen));
      draw(true);
    }
    draw(false);
    screen(`迷你任務單（${i + 1}／${questions.length}）`, h('p', { class: 'question', text: q.text }), box, foot, backBtn());
  }

  // ── 6. 比喻校準 ──
  function showMetaphor() {
    const box = h('div', { class: 'options' });
    const foot = h('div', { class: 'col' });
    const options = shuffle(METAPHOR.options);
    function draw(chosen) {
      box.replaceChildren(
        ...options.map((o) =>
          h('button', {
            class: 'option' + (chosen ? (o.id === METAPHOR.answer ? ' right' : o.id === chosen ? ' wrong' : '') : ''),
            disabled: !!chosen,
            text: o.text,
            onclick: () => {
              log('metaphor', 'm3', o.id);
              talk.metaphor = true;
              save();
              draw(o.id);
            },
          }),
        ),
      );
      foot.replaceChildren(
        ...(chosen ? [h('p', { class: 'good', text: METAPHOR.explain }), h('button', { class: 'primary', text: '回到第 3 堂', onclick: showHub })] : []),
      );
    }
    draw(null);
    screen('這個比喻哪裡不準？', h('p', { class: 'question', text: METAPHOR.text }), box, foot, backBtn());
  }

  return {
    open() {
      pet = getPet();
      if (!Array.isArray(pet.skills)) pet.skills = [];
      talk = talkOf(pet);
      closePopup();
      showHub();
      if (!talk.ruleSeen) showRule(() => {});
    },
  };
}
