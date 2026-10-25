// 第 1 堂「領養 AI」、第 2 堂「餵對與餵錯」的畫面（docs/02、docs/03 第 3 節與 5.x）。
// 規則與資料都在 train/、data/（純函式）；這裡只管畫面。所有文字都用 textContent。
import { mountPet } from '../pet/render.js';
import { h } from './dom.js';
import { icon, stars as starRow } from './icons.js';
import { createPad } from './pad.js';
import { decode, classesOf, sampleFromStrokes, measure, countsOf, testOn, testSet, guess, singleClassRun, biasRun } from '../train/data.js';
import { quizRound, shuffle } from '../train/quiz.js';
import { makePack, packResult, PACK_WRONG, PACK_PASS } from '../train/mystery.js';
import {
  RULES,
  PACE,
  paceOf,
  playOf,
  recordTest,
  tasksOf,
  newlyDone,
  grantTask,
  owned,
  REASONS,
  SHEETS,
  sheetCorrect,
  choiceCode,
  PREDICT,
  METAPHORS,
  LABEL_CODE,
} from '../train/lessons.js';

const TITLES = { 1: '第 1 堂：領養 AI', 2: '第 2 堂：餵對與餵錯' };
const FEED_GOAL = { 1: 5, 2: 8 }; // 每類要餵到幾張（docs/03 第 3 節）
const L1_TESTS = 6;
const ACC_PASS = 0.7;

// 第 2 堂作品道具的效果說明（docs/04 1.）
const SKILL_INFO = {
  score: '做作品時，可以加上計分：AI 猜對就加分',
  timer: '做作品時，可以加上倒數計時',
  easter: '做作品時，可以藏一個彩蛋：連續猜對 3 次出現特別畫面',
};

// replaceChildren 會把 null 印成文字，所以先濾掉空的（條件不成立的區塊）
const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter(Boolean));

const pct = (x) => (x === null || x === undefined ? '—' : Math.round(x * 100) + '%');
const sheetIcon = (name, tone = '') => h('div', { class: 'sheet-icon ' + tone }, icon(name));

// 一張範例的縮圖：AI 看到的 16×16 格子。x 可以是存檔格式 {g, s} 或解碼後的 {grid}
function thumb(x, size = 64) {
  const c = h('canvas', { class: 'thumb', width: 16, height: 16, style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true' });
  const g = c.getContext('2d');
  const img = g.createImageData(16, 16);
  const grid = x.grid ?? decode(x).grid;
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    // 奶白卡面 → 深靛墨
    img.data.set([255 - v * 225, 251 - v * 218, 234 - v * 170, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function createLessons12({ root, store, api, getPet, onExit }) {
  const body = root.querySelector('.talk-body');
  const overlay = root.querySelector('.talk-overlay');
  let pet;
  let play;
  let lesson = 1;
  let paceTimer = null;
  const started = {}; // 這次開啟遊戲後，每個活動第一次進去的時間（計時條用）

  // ── 存檔 ──
  function save({ sync = false } = {}) {
    pet.play = play;
    pet.updated = Date.now();
    store.savePet(pet);
    if (sync) api.savePet(pet);
  }

  const log = (type, code, value = '') => api.logEvent(pet.serial, lesson, type, code, value);

  // 範例變動後重算寵物卡數值
  function refresh() {
    const m = measure(pet.samples, pet.lesson);
    pet.state = { ...pet.state, dataCount: m.dataCount, dataQuality: m.dataQuality, accuracy: m.accuracy };
    return m;
  }

  function facts() {
    const acc = lesson === 2 ? { mixed: testOn(pet.samples, 'mixed'), small: testOn(pet.samples, 'small') } : {};
    return { counts: countsOf(pet.samples, ['圓', '方', '三角']), play, acc };
  }

  // 新的範例：存在 iPad，也排進雲端佇列
  function addSamples(list) {
    pet.samples.push(...list);
    pet.state.trainCount = (pet.state.trainCount || 0) + 1;
    refresh();
    save({ sync: true });
    api.saveSamples(pet.serial, list);
  }

  function updateSample(x, flagged) {
    if (flagged === 'removed') pet.samples = pet.samples.filter((s) => s !== x);
    else x.flagged = flagged;
    refresh();
    save({ sync: true });
    api.saveSamples(pet.serial, [{ ...x, flagged }]);
  }

  // 有新達成的任務就發獎勵，一張一張翻出來
  function checkTasks(then = () => {}) {
    const list = newlyDone(pet, facts(), lesson);
    if (!list.length) return then();
    list.forEach((t) => grantTask(pet, t));
    save({ sync: true });
    list.forEach((t) => log('task', t.id));
    const next = (i) => (i < list.length ? reveal(list[i], () => next(i + 1)) : then());
    next(0);
  }

  // ── 畫面骨架 ──
  function screen(title, activity, ...kids) {
    clearInterval(paceTimer);
    fill(body, h('h2', { class: 'talk-title', text: title }), activity ? paceBar(activity) : null, ...kids);
    body.scrollTop = 0;
  }

  // 計時條：依建議時間慢慢填滿，時間到只提醒，不會結束活動
  function paceBar(activity) {
    const minutes = PACE[activity];
    started[activity] ??= Date.now();
    const fill = h('i');
    const note = h('span');
    const bar = h('div', { class: 'pace' }, icon('clock'), h('span', { class: 'pace-track' }, fill), note);
    const tick = () => {
      const p = paceOf(minutes, started[activity]);
      fill.style.width = (p.progress * 100).toFixed(1) + '%';
      bar.classList.toggle('over', p.over);
      note.textContent = p.over ? '時間差不多了，準備下一個活動' : `建議 ${minutes} 分鐘`;
    };
    tick();
    paceTimer = setInterval(tick, 10000);
    return bar;
  }

  function petSays(text, extra = '') {
    const box = h('div', { class: 'pet small' });
    mountPet(box, pet.appearance, { label: '我的 AI 寵物', accuracy: pet.state.accuracy ?? null });
    return h('div', { class: 'talker ' + extra }, box, h('p', { class: 'bubble', text }));
  }

  const backBtn = () => h('button', { class: 'small', onclick: showHub }, icon('back'), `回到第 ${lesson} 堂`);

  function popup(...kids) {
    fill(overlay, h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, ...kids));
    overlay.hidden = false;
  }
  const closePopup = () => {
    overlay.hidden = true;
    overlay.replaceChildren();
  };

  function showRule(then) {
    const r = RULES[lesson];
    popup(
      sheetIcon('shield', 'gold'),
      h('h2', { text: r.title }),
      h('p', { text: r.text }),
      h('button', {
        class: 'primary',
        text: '我知道了',
        onclick: () => {
          play.rules = { ...play.rules, [lesson]: true };
          save();
          closePopup();
          then();
        },
      }),
    );
  }

  // 得到徽章或作品道具：卡從背面翻到正面（跟第 3 堂同一個簽名動作）
  function reveal(t, then) {
    const name = t.skill ? `得到作品道具：${t.name}` : `得到徽章：${t.name}`;
    popup(
      h('div', { class: 'reveal' }, h('div', { class: `item t${t.star}` }, h('div', { class: 'in' }, icon(t.skill ? 'sparkle' : 'medal', { size: '64px' }), h('span', { text: t.name }), starRow(t.star, '22px')))),
      h('h2', { class: 'with-stars' }, name, starRow(t.star, '24px')),
      h('p', { text: t.skill ? SKILL_INFO[t.skill] : t.goal + '，完成了！' }),
      h('button', { class: 'primary', text: '太好了', onclick: () => (closePopup(), then()) }),
    );
  }

  // 統計列：標籤＋進度條＋數字
  function meterRow(name, value, max, text, ok) {
    return h(
      'div',
      { class: 'mrow' + (ok ? ' ok' : '') },
      h('span', { class: 'mrow-name', text: name }),
      h('span', { class: 'meter' }, h('i', { style: `width:${Math.min(100, (value / max) * 100).toFixed(1)}%` })),
      h('span', { class: 'mrow-num' }, ok ? icon('check', { label: '達成' }) : null, text),
    );
  }

  // ── 首頁 ──
  function showHub() {
    const counts = countsOf(pet.samples, ['圓', '方', '三角']);
    const has = (id) => owned(pet, tasksOf(lesson).find((t) => t.id === id));
    const cards =
      lesson === 1
        ? [
            { icon: 'sheet', name: '前測', note: '5 題，選你覺得對的', done: play.quiz.A, go: play.quiz.A ? quizDone : startQuiz },
            { icon: 'pencil', name: '第一次餵食', note: '畫圓、畫方，各 5 張', done: counts['圓'] >= 5 && counts['方'] >= 5, go: showFeed, locked: !play.quiz.A && '先做前測' },
            { icon: 'target', name: '考考我的 AI', note: `畫給牠猜 ${L1_TESTS} 次`, done: play.tests >= L1_TESTS, go: showTest, locked: !pet.samples.some((x) => !x.flagged) && '先餵牠幾張' },
            { icon: 'sheet', name: '迷你任務單', note: '3 題', done: play.sheets[1], go: () => showSheet(shuffle(SHEETS[1]), 0) },
            { icon: 'bulb', name: '這個比喻哪裡不準？', note: '下課前想一想', done: play.metaphors[1], go: showMetaphor },
          ]
        : [
            { icon: 'chart', name: '資料健檢', note: '你的資料健康嗎？', done: play.health, go: showHealth },
            { icon: 'flask', name: '只餵圓會怎樣？', note: '先預測，再實驗', done: play.single, go: showSingle },
            { icon: 'flask', name: '大圓小圓實驗', note: '只看過大圓的 AI', done: play.bias, go: showBias },
            { icon: 'box', name: '神祕資料包', note: '找出標錯的圖', done: has('l2s2'), go: showPack },
            { icon: 'wrench', name: '修好我的 AI', note: '補資料，準確率過 70%', done: has('l2s1'), go: showFeed },
            { icon: 'sheet', name: '迷你任務單', note: '3 題', done: play.sheets[2], go: () => showSheet(shuffle(SHEETS[2]), 0) },
            { icon: 'bulb', name: '這個比喻哪裡不準？', note: '下課前想一想', done: play.metaphors[2], go: showMetaphor },
          ];
    const tasks = h(
      'ul',
      { class: 'tasks', 'aria-label': '本堂任務' },
      tasksOf(lesson).map((t) =>
        h(
          'li',
          { class: owned(pet, t) ? 'done' : '' },
          starRow(t.star, '18px'),
          h('span', { class: 'task-goal', text: t.goal }),
          h('span', { class: 'task-reward' }, icon(t.skill ? 'sparkle' : 'medal'), t.skill ? `作品道具：${t.name}` : '徽章'),
          owned(pet, t) ? h('span', { class: 'card-done' }, icon('check'), '完成') : null,
        ),
      ),
    );
    screen(
      TITLES[lesson],
      null,
      h('p', { class: 'rule' }, icon('shield', { size: '26px' }), RULES[lesson].title),
      tasks,
      h(
        'div',
        { class: 'cards' },
        cards.map((c, n) =>
          h(
            'button',
            { class: 'card' + (c.done ? ' done' : ''), disabled: !!c.locked, onclick: c.go },
            h('span', { class: 'card-art' }, icon(c.locked ? 'question' : c.icon), h('span', { class: 'card-step', text: String(n + 1), 'aria-hidden': 'true' })),
            h('span', { class: 'card-name', text: c.name }),
            h('span', { class: 'card-note', text: c.locked || c.note }),
            c.done ? h('span', { class: 'card-done' }, icon('check'), '已完成') : null,
          ),
        ),
      ),
      h('button', { class: 'small', onclick: onExit }, icon('back'), '回到我的寵物'),
    );
  }

  // ── 第 1 堂：前測 ──
  function quizDone() {
    popup(sheetIcon('check'), h('h2', { text: '前測已經做完了' }), h('p', { text: '前測只做一次。第 6 堂還有一次，到時候看看自己學到多少！' }), h('button', { class: 'primary', text: '好', onclick: closePopup }));
  }

  function startQuiz() {
    showQuiz(quizRound('A'), 0, []);
  }

  // 一題一頁，不顯示對錯（前測要看「學之前」的想法）
  function showQuiz(round, i, answers) {
    if (i === round.length) {
      play.quiz = { ...play.quiz, A: true };
      save();
      api.submitQuiz(pet.serial, 'A', answers);
      log('quiz', 'A', answers.length);
      popup(
        sheetIcon('check'),
        h('h2', { text: '前測完成！' }),
        h('p', { text: '謝謝你。這些題目沒有分數，是想知道你現在怎麼想。' }),
        h('button', { class: 'primary', text: '開始第一次餵食', onclick: () => (closePopup(), showFeed()) }),
      );
      return showHub();
    }
    const q = round[i];
    screen(
      `前測（${i + 1}／${round.length}）`,
      'quiz',
      h('p', { class: 'question', text: q.text }),
      h(
        'div',
        { class: 'options' },
        q.options.map((o) => h('button', { class: 'option', text: o.text, onclick: () => showQuiz(round, i + 1, [...answers, { q: q.id, choice: o.id }]) })),
      ),
      h('p', { class: 'hint', text: '選你覺得最對的一個。不會也沒關係，選你的直覺。' }),
      backBtn(),
    );
  }

  // ── 餵食（第 1 堂第一次餵食、第 2 堂修好我的 AI）──
  function showFeed() {
    const classes = classesOf(lesson);
    const goal = FEED_GOAL[lesson];
    let label = null;
    const pad = createPad();
    const talker = petSays(lesson === 1 ? '畫一個圖形，告訴我它是什麼，我就會記住！' : '幫我補資料：每一種都要有，大小、位置也要不一樣喔！');
    const bubble = talker.querySelector('.bubble');
    const labels = h('div', { class: 'row labels', role: 'group', 'aria-label': '這是什麼' });
    const stats = h('div', { class: 'stats' });
    const next = h('div', { class: 'row' });

    function drawLabels() {
      fill(labels, 
        ...classes.map((l) => h('button', { class: 'label' + (label === l ? ' on' : ''), 'aria-pressed': String(label === l), text: l, onclick: () => ((label = l), drawLabels()) })),
      );
    }

    function drawStats() {
      const counts = countsOf(pet.samples, classes);
      const rows = classes.map((l) => meterRow(l, counts[l], goal, `${counts[l]}／${goal} 張`, counts[l] >= goal));
      if (lesson === 2) {
        const f = facts();
        rows.push(meterRow('準確率', f.acc.mixed ?? 0, 1, pct(f.acc.mixed), (f.acc.mixed ?? 0) >= ACC_PASS));
        rows.push(meterRow('小圓測驗', f.acc.small ?? 0, 1, pct(f.acc.small), (f.acc.small ?? 0) >= ACC_PASS));
        const least = classes.reduce((a, b) => (counts[b] < counts[a] ? b : a));
        if (counts[least] < goal) rows.push(h('p', { class: 'ask' }, icon('bulb'), `「${least}」最少，先補這一類`));
        else if ((f.acc.small ?? 0) < ACC_PASS) rows.push(h('p', { class: 'ask' }, icon('bulb'), '小圓測驗還沒過：畫幾個小小的圓，位置也換一換'));
      }
      fill(stats, ...rows);
      const counted = classes.every((l) => counts[l] >= goal);
      fill(next, lesson === 1 && counted ? h('button', { onclick: showTest }, '去考考我的 AI', icon('next')) : null);
    }

    function feed() {
      if (pad.isEmpty()) return (bubble.textContent = '先在畫布上畫一個圖形');
      if (!label) return (bubble.textContent = '這是什麼？先選一個標籤');
      const x = sampleFromStrokes(pad.strokes, label, play.nextIdx);
      if (!x) return (bubble.textContent = '畫得太小了，我看不到，畫大一點');
      play.nextIdx++;
      addSamples([x]);
      log('feed', LABEL_CODE[label], countsOf(pet.samples, [label])[label]);
      bubble.textContent = `我記住了，這是「${label}」！`;
      label = null;
      pad.clear();
      drawLabels();
      drawStats();
      checkTasks();
    }

    drawLabels();
    drawStats();
    screen(
      lesson === 1 ? '第一次餵食' : '修好我的 AI',
      lesson === 1 ? 'feed1' : 'fix',
      h(
        'div',
        { class: 'split' },
        h(
          'div',
          { class: 'col pad-col' },
          pad.el,
          h('div', { class: 'row' }, h('button', { class: 'small', onclick: pad.undo }, icon('undo'), '復原一筆'), h('button', { class: 'small', onclick: pad.clear }, icon('trash'), '清除')),
        ),
        h(
          'div',
          { class: 'col' },
          talker,
          h('p', { class: 'muted', text: '這是什麼？' }),
          labels,
          h('button', { class: 'primary', onclick: feed }, icon('pencil'), '餵給 AI'),
          stats,
          next,
        ),
      ),
      backBtn(),
    );
  }

  // ── 第 1 堂：考考我的 AI ──
  function showTest() {
    const classes = classesOf(lesson);
    let label = null;
    const pad = createPad();
    const talker = petSays('畫一個圖形，選你畫的是什麼，再考考我！');
    const bubble = talker.querySelector('.bubble');
    const labels = h('div', { class: 'row labels', role: 'group', 'aria-label': '我畫的是' });
    const out = h('div', { class: 'col result' });
    const progress = h('p', { class: 'muted' });

    function drawLabels() {
      fill(labels, 
        ...classes.map((l) => h('button', { class: 'label' + (label === l ? ' on' : ''), 'aria-pressed': String(label === l), text: l, onclick: () => ((label = l), drawLabels()) })),
      );
    }
    const drawProgress = () => (progress.textContent = `考了 ${play.tests} 次（目標 ${L1_TESTS} 次）・連續猜對 ${play.streak} 次（最高 ${play.bestStreak} 次）`);

    function again() {
      label = null;
      pad.clear();
      fill(out, );
      bubble.textContent = '再畫一個考考我！';
      drawLabels();
    }

    function ask() {
      if (pad.isEmpty()) return (bubble.textContent = '先在畫布上畫一個圖形');
      if (!label) return (bubble.textContent = '你畫的是什麼？先選一個');
      const q = sampleFromStrokes(pad.strokes, label, 0);
      if (!q) return (bubble.textContent = '畫得太小了，我看不到，畫大一點');
      const r = guess(q, pet.samples);
      const right = r.label === label;
      play = recordTest(play, right);
      save();
      log('test', LABEL_CODE[label], right ? 'right' : 'wrong');
      bubble.textContent = `我猜是「${r.label}」！`;
      drawProgress();
      fill(out, 
        h('p', { class: right ? 'good' : 'ask' }, icon(right ? 'check' : 'cross'), right ? '猜對了！' : `猜錯了，你畫的是「${label}」`),
        h('p', { text: '我會這樣猜，是因為你畫的跟這 3 張最像：' }),
        h(
          'div',
          { class: 'neighbors' },
          r.neighbors.map((n) => h('figure', { class: 'nb' }, thumb(n.sample, 88), h('figcaption', { text: `${n.sample.label}・像 ${pct(n.similarity)}` }))),
        ),
        !right && !play.reason ? reasonPicker() : null,
        h('button', { onclick: again }, icon('pencil'), '再考一次'), // 主要動作還是上面的「考考牠」
      );
      checkTasks();
    }

    // ★★★：猜錯時選原因（只要選一次）
    function reasonPicker() {
      const box = h(
        'div',
        { class: 'reasons' },
        h('p', { class: 'ask' }, icon('bulb'), '你覺得牠為什麼猜錯？和旁邊的同學討論一下'),
        REASONS.map((r) =>
          h('button', {
            class: 'small reason',
            text: r.text,
            onclick: () => {
              play.reason = r.id;
              save();
              log('reason', r.id);
              fill(box, h('p', { class: 'good' }, icon('check'), '想得好！看看最像的那 3 張，是不是跟你畫的不太一樣？'));
              checkTasks();
            },
          }),
        ),
      );
      return box;
    }

    drawLabels();
    drawProgress();
    screen(
      '考考我的 AI',
      'test1',
      h(
        'div',
        { class: 'split' },
        h(
          'div',
          { class: 'col pad-col' },
          pad.el,
          h('div', { class: 'row' }, h('button', { class: 'small', onclick: pad.undo }, icon('undo'), '復原一筆'), h('button', { class: 'small', onclick: pad.clear }, icon('trash'), '清除')),
        ),
        h('div', { class: 'col' }, talker, h('p', { class: 'muted', text: '我畫的是：' }), labels, h('button', { class: 'primary', onclick: ask }, icon('target'), '考考牠'), progress, out),
      ),
      backBtn(),
    );
  }

  // ── 第 2 堂：資料健檢 ──
  function showHealth() {
    const classes = classesOf(2);
    const hl = refresh().health;
    play.health = true;
    save();
    const counts = countsOf(pet.samples, classes);
    const max = Math.max(1, ...Object.values(counts));
    const acc = testOn(pet.samples, 'mixed');

    const sus = hl.suspicious.find((s) => !pet.samples[s.index].flagged);
    let susBox = null;
    if (sus) {
      const x = pet.samples[sus.index];
      susBox = h(
        'div',
        { class: 'suspect' },
        thumb(x, 88),
        h(
          'div',
          { class: 'col' },
          h('p', { class: 'ask' }, icon('search'), sus.closerToOther ? `這張標「${x.label}」，但看起來比較像「${sus.closerToOther}」` : `這張是「${x.label}」裡最不像的一張`),
          h(
            'div',
            { class: 'row' },
            h('button', { class: 'small', onclick: () => (updateSample(x, true), log('clean', 'flag'), showHealth()) }, icon('flag'), '這張標錯了'),
            h('button', { class: 'small', onclick: () => (updateSample(x, 'removed'), log('clean', 'delete'), showHealth()) }, icon('trash'), '刪掉這張'),
          ),
        ),
      );
    }

    screen(
      '資料健檢',
      'health',
      h(
        'div',
        { class: 'split' },
        h(
          'div',
          { class: 'col' },
          h('h3', { class: 'sub', text: `每一類有幾張（共 ${hl.total - hl.flaggedCount} 張）` }),
          ...classes.map((l) => meterRow(l, counts[l], max, `${counts[l]} 張`, false)),
          hl.total && hl.balance < 1 ? h('p', { class: 'ask' }, icon('bulb'), `「${hl.smallestClass}」最少，先補這一類`) : null,
          h('h3', { class: 'sub', text: `資料品質 ${hl.dataQuality} 分` }),
          meterRow('類別平衡', hl.balance, 1, pct(hl.balance), hl.balance >= 0.8),
          meterRow('大小多樣', hl.diversity, 1, pct(hl.diversity), hl.diversity >= 0.8),
          meterRow('乾淨度', hl.clean, 1, pct(hl.clean), hl.total > 0 && hl.clean === 1),
          h('p', { class: 'hint', text: '類別平衡：每一類差不多多。大小多樣：有大有小。乾淨度：沒有標錯的。' }),
        ),
        h(
          'div',
          { class: 'col' },
          h('p', { class: 'chance', text: `準確率（考 20 張混合題）：${pct(acc)}` }),
          susBox || h('p', { class: 'muted', text: hl.total < 9 ? '每一類有 3 張以上，健檢才會幫你找可疑的圖。' : '沒有找到可疑的圖。' }),
          h('h3', { class: 'sub', text: '全部的範例（點一張可以處理）' }),
          gallery(classes),
          h('button', { class: 'primary', onclick: showFeed }, icon('wrench'), '去補資料'),
        ),
      ),
      backBtn(),
    );
  }

  function gallery(classes) {
    return h(
      'div',
      { class: 'gallery' },
      classes.map((l) =>
        h(
          'div',
          { class: 'gal-row' },
          h('span', { class: 'gal-name', text: l }),
          h(
            'div',
            { class: 'gal-items' },
            pet.samples
              .filter((x) => x.label === l)
              .map((x) =>
                h('button', { class: 'gal-item' + (x.flagged ? ' flagged' : ''), 'aria-label': `${l} 的範例${x.flagged ? '（已標成標錯）' : ''}`, onclick: () => manageSample(x) }, thumb(x, 48), x.flagged ? icon('flag') : null),
              ),
          ),
        ),
      ),
    );
  }

  function manageSample(x) {
    const done = (flagged, code) => {
      updateSample(x, flagged);
      log('clean', code);
      closePopup();
      showHealth();
    };
    popup(
      thumb(x, 160),
      h('h2', { text: `標籤：${x.label}${x.flagged ? '（已標成標錯）' : ''}` }),
      h('p', { class: 'muted', text: '標錯的範例不會拿來比對。刪掉就不見了。' }),
      h(
        'div',
        { class: 'row' },
        x.flagged ? h('button', { onclick: () => done(false, 'unflag') }, icon('check'), '其實沒標錯') : h('button', { onclick: () => done(true, 'flag') }, icon('flag'), '這張標錯了'),
        h('button', { onclick: () => done('removed', 'delete') }, icon('trash'), '刪掉'),
      ),
      h('button', { class: 'primary', text: '不用改', onclick: closePopup }),
    );
  }

  // ── 第 2 堂：只餵圓會怎樣？ ──
  function showSingle() {
    const options = shuffle(PREDICT.options);
    screen(
      '只餵圓會怎樣？',
      'health',
      petSays('如果我只看過「圓」，再拿圓、方、三角給我猜，你覺得我會怎樣？', 'big'),
      h('p', { class: 'muted', text: '先預測：' }),
      h(
        'div',
        { class: 'options' },
        options.map((o) =>
          h('button', {
            class: 'option',
            text: o.text,
            onclick: () => {
              play.predict = o.id;
              save();
              log('predict', 'single', o.id);
              singleResult(o);
            },
          }),
        ),
      ),
      backBtn(),
    );
  }

  function singleResult(predicted) {
    const run = singleClassRun(pet.samples);
    const circles = run.filter((x) => x.guess === '圓').length;
    play.single = true;
    save();
    const right = predicted.id === PREDICT.answer[0];
    screen(
      `20 張裡，牠猜「圓」${circles} 次`,
      'health',
      h('p', { class: right ? 'good' : 'ask' }, icon(right ? 'check' : 'bulb'), right ? '你預測對了！' : `你預測「${predicted.text}」，結果跟你想的不一樣`),
      h('p', { text: '牠只看過圓，所以不管看到什麼，最像的都是圓。資料只有一種，AI 就只會一種答案。' }),
      h(
        'div',
        { class: 'tests' },
        run.map((x) => h('figure', { class: 'nb' + (x.guess === x.truth ? '' : ' miss') }, thumb(x.test, 56), h('figcaption', { text: `猜${x.guess}` }))),
      ),
      h('button', { class: 'primary', onclick: showHub }, '回到第 2 堂', icon('next')),
    );
  }

  // ── 第 2 堂：大圓小圓實驗 ──
  function showBias() {
    const b = biasRun();
    const shown = new Set();
    const box = h('div', { class: 'col' });
    const own = h('div', { class: 'col' });

    function draw() {
      const row = (key, name, value) =>
        shown.has(key)
          ? h('p', { class: 'chance' }, `考${name}：答對 ${pct(value)}`)
          : h('button', { onclick: () => (shown.add(key), draw()) }, icon('target'), `用${name}考牠`);
      fill(box, 
        h('div', { class: 'row' }, h('span', { class: 'muted', text: '大圓：' }), ...testSet('big').slice(0, 4).map((x) => thumb(x, 48))),
        row('big', '大圓', b.big),
        h('div', { class: 'row' }, h('span', { class: 'muted', text: '小圓：' }), ...testSet('small').slice(0, 4).map((x) => thumb(x, 48))),
        row('small', '小圓', b.small),
        shown.size === 2 ? h('p', { class: 'ask' }, icon('bulb'), 'AI 不認得小圓，是牠笨，還是我們沒教牠？') : null,
        shown.size === 2 ? h('p', { text: '牠沒看過小圓的例子。小圓跟牠記得的大圓不像，所以認不出來。不是 AI 笨，是資料不夠多樣。' }) : null,
      );
      fill(own, ...(shown.size === 2 ? ownPart() : []));
    }

    function ownPart() {
      if (!play.bias) return [h('button', { class: 'primary', onclick: testOwn }, icon('target'), '用小圓考我的 AI')];
      const acc = testOn(pet.samples, 'small');
      const pass = (acc ?? 0) >= ACC_PASS;
      return [
        h('p', { class: 'chance', text: `你的 AI 考小圓：答對 ${pct(acc)}` }),
        h('p', { class: pass ? 'good' : 'ask', text: pass ? '你的 AI 認得小圓！資料夠多樣。' : '還不認得小圓。到「修好我的 AI」畫幾個小小的圓，位置也換一換。' }),
        pass ? h('button', { class: 'primary', onclick: showHub }, '回到第 2 堂', icon('next')) : h('button', { class: 'primary', onclick: showFeed }, icon('wrench'), '去補小圓'),
      ];
    }

    function testOwn() {
      play.bias = true;
      save();
      log('exp', 'bias', Math.round((testOn(pet.samples, 'small') ?? 0) * 100));
      draw();
      checkTasks();
    }

    if (play.bias) ['big', 'small'].forEach((k) => shown.add(k)); // 做過了：直接顯示結果
    draw();
    screen(
      '大圓小圓實驗',
      'bias',
      h('div', { class: 'split' }, h('div', { class: 'col' }, petSays('這是一隻實驗 AI。牠的圓全部都是大圓，方和三角大大小小都有。'), box), own),
      backBtn(),
    );
  }

  // ── 第 2 堂：神祕資料包 ──
  function showPack() {
    const pack = makePack(pet.serial, play.packNo);
    const removed = new Set();
    const grid = h('div', { class: 'pack' });
    const foot = h('div', { class: 'row' });

    function draw() {
      fill(grid, 
        ...pack.map((x) =>
          h(
            'button',
            {
              class: 'pack-item' + (removed.has(x.id) ? ' out' : ''),
              'aria-pressed': String(removed.has(x.id)),
              'aria-label': `標籤 ${x.label}`,
              onclick: () => (removed.has(x.id) ? removed.delete(x.id) : removed.add(x.id), draw()),
            },
            thumb(x, 96),
            h('span', { class: 'tag', text: x.label }),
            removed.has(x.id) ? h('span', { class: 'out-mark' }, icon('cross'), '移除') : null,
          ),
        ),
      );
      fill(foot, h('button', { class: 'primary', disabled: removed.size === 0, onclick: submit }, icon('trash'), `移除選起來的 ${removed.size} 張`));
    }

    function submit() {
      const r = packResult(pack, removed);
      play.packBest = Math.max(play.packBest, r.found);
      play.packNo++;
      const kept = r.kept.map((x) => ({ idx: play.nextIdx++, label: x.label, g: x.g, s: x.s, flagged: false }));
      addSamples(kept);
      log('pack', 'p' + play.packNo, r.found);
      packResultScreen(pack, removed, r);
      checkTasks();
    }

    draw();
    screen(
      `神祕資料包（第 ${play.packNo + 1} 包）`,
      'bias',
      h('p', { text: `這包有 12 張圖，上面寫著標籤。其中 ${PACK_WRONG} 張標錯了！點選你覺得標錯的圖，再按移除。剩下的會加進你的資料。` }),
      grid,
      foot,
      backBtn(),
    );
  }

  function packResultScreen(pack, removed, r) {
    const note = (x) => {
      if (x.wrong && removed.has(x.id)) return { cls: 'ok', text: `找到了！標「${x.label}」，其實是「${x.truth}」` };
      if (x.wrong) return { cls: 'bad', text: `標「${x.label}」，其實是「${x.truth}」，被留下來了` };
      if (removed.has(x.id)) return { cls: 'bad', text: `這張「${x.label}」其實沒標錯` };
      return null;
    };
    const list = pack.map((x) => ({ x, n: note(x) })).filter((y) => y.n);
    screen(
      `你找到 ${r.found}／${PACK_WRONG} 張標錯的圖`,
      'bias',
      h('p', { class: r.pass ? 'good' : 'ask' }, icon(r.pass ? 'check' : 'bulb'), r.pass ? '眼力真好！壞資料清掉，AI 才不會學錯。' : `要找到 ${PACK_PASS} 張以上才過關。再開一包試試看！`),
      h('ul', { class: 'review' }, list.map(({ x, n }) => h('li', { class: n.cls }, icon(n.cls === 'ok' ? 'check' : 'cross'), h('div', { class: 'row' }, thumb(x, 56), h('span', { text: n.text }))))),
      r.missed ? h('p', { class: 'muted', text: `沒找到的 ${r.missed} 張已經加進你的資料了，可以到「資料健檢」找找看。` }) : null,
      h('div', { class: 'row' }, r.pass ? h('button', { class: 'primary', onclick: showHub }, '回到第 2 堂', icon('next')) : h('button', { class: 'primary', onclick: showPack }, icon('box'), '再開一包'), r.pass ? null : backBtn()),
    );
  }

  // ── 迷你任務單（單選、勾選、排序）──
  function showSheet(questions, i) {
    if (i === questions.length) {
      play.sheets = { ...play.sheets, [lesson]: true };
      save();
      return showHub();
    }
    const q = questions[i];
    const order = []; // 排序題：依點的順序
    const chosen = new Set();
    const options = shuffle(q.options);
    const box = h('div', { class: 'options' });
    const foot = h('div', { class: 'row' });
    const picked = () => (q.kind === 'order' ? order : chosen);

    function draw(answered) {
      fill(box, 
        ...options.map((o) => {
          const on = q.kind === 'order' ? order.includes(o.id) : chosen.has(o.id);
          let cls = 'option' + (on ? ' on' : '');
          if (answered && q.kind !== 'order') cls += q.answer.includes(o.id) ? ' right' : on ? ' wrong' : '';
          const mark = q.kind === 'order' ? h('span', { class: 'box' }, on ? String(order.indexOf(o.id) + 1) : null) : q.kind === 'multi' ? h('span', { class: 'box' }, on ? icon('check') : null) : null;
          return h(
            'button',
            {
              class: cls,
              disabled: answered,
              'aria-pressed': q.kind === 'one' ? null : String(on),
              onclick: () => {
                if (q.kind === 'order') {
                  if (on) return; // 點過的不能再點；要改順序按「重排」
                  order.push(o.id);
                  draw(false);
                } else if (q.kind === 'multi') {
                  on ? chosen.delete(o.id) : chosen.add(o.id);
                  draw(false);
                } else {
                  chosen.add(o.id);
                  submit();
                }
              },
            },
            mark,
            o.text,
          );
        }),
      );
      if (answered) {
        const ok = sheetCorrect(q, picked());
        const last = i === questions.length - 1;
        const answerText = q.kind === 'order' ? '正確順序：' + q.answer.map((id) => q.options.find((o) => o.id === id).text).join(' → ') : '再看看綠色的答案';
        fill(foot, 
          h('p', { class: ok ? 'good' : 'ask' }, icon(ok ? 'check' : 'bulb'), ok ? '答對了！' : answerText),
          h('button', { class: 'primary', onclick: () => showSheet(questions, i + 1) }, last ? '完成任務單' : '下一題', icon(last ? 'check' : 'next')),
        );
      } else if (q.kind === 'order') {
        fill(foot, 
          order.length ? h('button', { class: 'small', onclick: () => (order.length = 0, draw(false)) }, icon('undo'), '重排') : null,
          h('button', { class: 'primary', text: '送出', disabled: order.length < options.length, onclick: submit }),
        );
      } else if (q.kind === 'multi') fill(foot, h('button', { class: 'primary', text: '送出', disabled: chosen.size === 0, onclick: submit }));
      else fill(foot, );
    }
    function submit() {
      log('sheet', q.id, choiceCode(q, picked()));
      draw(true);
    }
    draw(false);
    screen(`迷你任務單（${i + 1}／${questions.length}）`, 'sheet' + lesson, h('p', { class: 'question', text: q.text }), box, foot, backBtn());
  }

  // ── 比喻校準 ──
  function showMetaphor() {
    const m = METAPHORS[lesson];
    const box = h('div', { class: 'options' });
    const foot = h('div', { class: 'col' });
    const options = shuffle(m.options);
    function draw(chosen) {
      fill(box, 
        ...options.map((o) =>
          h('button', {
            class: 'option' + (chosen ? (o.id === m.answer ? ' right' : o.id === chosen ? ' wrong' : '') : ''),
            disabled: !!chosen,
            text: o.text,
            onclick: () => {
              log('metaphor', m.id, o.id);
              play.metaphors = { ...play.metaphors, [lesson]: true };
              save();
              draw(o.id);
            },
          }),
        ),
      );
      fill(foot, ...(chosen ? [h('p', { class: 'good', text: m.explain }), h('button', { class: 'primary', text: `回到第 ${lesson} 堂`, onclick: showHub })] : []));
    }
    draw(null);
    screen('這個比喻哪裡不準？', 'metaphor' + lesson, h('p', { class: 'question', text: m.text }), box, foot, backBtn());
  }

  return {
    open(n) {
      lesson = n;
      pet = getPet();
      if (!Array.isArray(pet.skills)) pet.skills = [];
      if (!Array.isArray(pet.badges)) pet.badges = [];
      if (!Array.isArray(pet.samples)) pet.samples = [];
      play = playOf(pet);
      refresh();
      closePopup();
      showHub();
      if (!play.rules[lesson]) showRule(() => {});
    },
    close() {
      clearInterval(paceTimer);
    },
  };
}
