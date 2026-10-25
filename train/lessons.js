// 第 1、2 堂的進度、任務判定、迷你任務單、比喻校準、守則、節奏（docs/02、docs/03 第 2、3、5 節）。不碰 DOM。

import { TASKS } from '../data/tasks.js';

export { TASKS };

// 第 1、2 堂開場的守則（docs/03 第 2 節；第 3 堂的在 app/lesson3.js）
export const RULES = {
  1: { title: '守則 1：保護個資', text: '不要在遊戲或 AI 裡輸入真實姓名、學校、電話、住址。' },
  2: { title: '守則 2：資料要正確、公平', text: '餵給 AI 的資料要標對，每一種都要有。你餵什麼，AI 就學什麼。' },
};

// 各活動建議時間（分鐘，docs/03 5.5）
export const PACE = {
  quiz: 5,
  feed1: 12,
  test1: 10,
  sheet1: 5,
  metaphor1: 3,
  health: 10,
  bias: 12,
  fix: 10,
  sheet2: 4,
  metaphor2: 2,
};

// 計時條：0–1 的進度，以及是否超過建議時間
export function paceOf(minutes, startedAt, now = Date.now()) {
  const p = (now - startedAt) / (minutes * 60000);
  return { progress: Math.max(0, Math.min(1, p)), over: p >= 1 };
}

export function newPlay() {
  return {
    rules: {}, // 看過哪幾堂的守則 { 1: true }
    quiz: {}, // 前後測做完沒 { A: true }
    tests: 0, // 考考我的 AI 次數（第 1 堂）
    streak: 0,
    bestStreak: 0,
    reason: null, // ★★★ 選的猜錯原因代碼
    packNo: 0, // 開到第幾包神祕資料包
    packBest: 0, // 單包最多找到幾張標錯
    predict: null, // 單一類別實驗的預測
    single: false, // 做過單一類別實驗
    bias: false, // 做過大小圓實驗
    sheets: {}, // { 1: true }
    metaphors: {},
    nextIdx: 0, // 下一張範例的編號（跟 GAS samples 的 idx 對應）
  };
}

// 舊存檔沒有 play、samples 時補上
export function playOf(pet) {
  return { ...newPlay(), ...(pet.play || {}) };
}

// 考考我的 AI 一次：更新次數與連勝
export function recordTest(play, right) {
  const streak = right ? play.streak + 1 : 0;
  return { ...play, tests: play.tests + 1, streak, bestStreak: Math.max(play.bestStreak, streak) };
}

// facts：{ counts, play, acc: { mixed, small, l1 } }
export function taskDone(task, facts) {
  const c = task.check;
  const { counts = {}, play = newPlay(), acc = {} } = facts;
  switch (c.type) {
    case 'feedAndTest':
      return Object.entries(c.counts).every(([l, n]) => (counts[l] || 0) >= n) && play.tests >= c.tests;
    case 'streak':
      return play.bestStreak >= c.n;
    case 'reason':
      return !!play.reason;
    case 'balancedAccuracy':
      return ['圓', '方', '三角'].every((l) => (counts[l] || 0) >= c.min) && (acc[c.set] ?? 0) >= c.acc;
    case 'pack':
      return play.packBest >= c.found;
    case 'setAccuracy':
      return (acc[c.set] ?? 0) >= c.acc;
    default:
      return false;
  }
}

export const tasksOf = (lesson) => TASKS.filter((t) => t.lesson === lesson);

// 還沒拿到獎勵、但已經達成的任務
export function newlyDone(pet, facts, lesson) {
  return tasksOf(lesson).filter((t) => !owned(pet, t) && taskDone(t, facts));
}

export const owned = (pet, t) => (t.skill ? (pet.skills || []).includes(t.skill) : (pet.badges || []).includes(t.badge));

// 發獎勵：寫進 pet.skills 或 pet.badges，回傳是否為新得到
export function grantTask(pet, t) {
  if (owned(pet, t)) return false;
  if (t.skill) pet.skills = [...(pet.skills || []), t.skill];
  else pet.badges = [...(pet.badges || []), t.badge];
  return true;
}

// ★★★ 猜錯原因（docs/03 5.3）
export const REASONS = [
  { id: 'r1', text: '資料太少，牠看過的範例不夠' },
  { id: 'r2', text: '我畫得不太像' },
  { id: 'r3', text: '大小或位置跟範例差很多' },
];

// 迷你任務單。kind：one 單選、multi 勾選、order 排序（依序點）
export const SHEETS = {
  1: [
    {
      id: 'l1q1',
      kind: 'one',
      text: 'AI 猜「方」，是因為？',
      options: [
        { id: 'a', text: '跟牠最像的幾張範例很像' },
        { id: 'b', text: '牠偷看了答案' },
        { id: 'c', text: '牠看到我的臉' },
      ],
      answer: ['a'],
    },
    {
      id: 'l1q2',
      kind: 'order',
      text: '教 AI 的步驟，依順序點一點',
      options: [
        { id: 'a', text: '畫圖' },
        { id: 'b', text: '選標籤' },
        { id: 'c', text: '餵給 AI' },
        { id: 'd', text: '考考牠' },
      ],
      answer: ['a', 'b', 'c', 'd'],
    },
    {
      id: 'l1q3',
      kind: 'multi',
      text: '哪些會讓 AI 學得更好？（可以選很多個）',
      options: [
        { id: 'a', text: '多畫幾張' },
        { id: 'b', text: '大小、位置不一樣' },
        { id: 'c', text: '標籤標對' },
        { id: 'd', text: '全部畫得一模一樣' },
      ],
      answer: ['a', 'b', 'c'],
    },
  ],
  2: [
    {
      id: 'l2q1',
      kind: 'one',
      text: '只餵圓給 AI，牠會怎樣？',
      options: [
        { id: 'a', text: '什麼都猜圓' },
        { id: 'b', text: '變聰明' },
        { id: 'c', text: '拒絕回答' },
      ],
      answer: ['a'],
    },
    {
      id: 'l2q2',
      kind: 'multi',
      text: '哪些是好資料？（可以選很多個）',
      options: [
        { id: 'a', text: '每一類差不多多' },
        { id: 'b', text: '大小、位置不一樣' },
        { id: 'c', text: '標籤正確' },
        { id: 'd', text: '只留最漂亮的' },
      ],
      answer: ['a', 'b', 'c'],
    },
    {
      id: 'l2q3',
      kind: 'one',
      text: 'AI 不認得小圓，主要原因是？',
      options: [
        { id: 'a', text: '牠沒看過小圓的例子' },
        { id: 'b', text: '牠不喜歡小圓' },
        { id: 'c', text: '螢幕壞了' },
      ],
      answer: ['a'],
    },
  ],
};

// chosen：單選、勾選是 Set；排序是依點選順序的陣列
export function sheetCorrect(q, chosen) {
  if (q.kind === 'order') return chosen.join('.') === q.answer.join('.');
  return [...chosen].sort().join('.') === [...q.answer].sort().join('.');
}

// 事件 value：排序保留順序，其他排序後用「.」連起來（符合 GAS 的 CODE_RE）
export const choiceCode = (q, chosen) => (q.kind === 'order' ? chosen.join('.') : [...chosen].sort().join('.'));

// 單一類別實驗的預測（選項同任務單 l2q1）
export const PREDICT = SHEETS[2][0];

// 比喻校準（docs/03 5.3、5.4）
export const METAPHORS = {
  1: {
    id: 'm1',
    text: '「說 AI『學會』了，就像小孩學習。」這句話哪裡不準？',
    options: [
      { id: 'a', text: 'AI 沒有真的懂，只是把範例變成數字，找最像的' },
      { id: 'b', text: 'AI 跟小孩一模一樣，會自己想' },
      { id: 'c', text: 'AI 學得比小孩還慢' },
    ],
    answer: 'a',
    explain: 'AI 把你畫的圖變成一格一格的數字，再找「最像的幾張範例」。牠不知道圓是什麼，只是在比數字。',
  },
  2: {
    id: 'm2',
    text: '「餵資料，就像餵寵物吃飯。」這句話哪裡不準？',
    options: [
      { id: 'a', text: 'AI 不會餓也不會挑食，壞資料牠也照單全收' },
      { id: 'b', text: 'AI 吃太多資料會變胖' },
      { id: 'c', text: 'AI 只吃牠喜歡的資料' },
    ],
    answer: 'a',
    explain: 'AI 不會分辨資料好壞，你餵什麼牠就學什麼。所以要由我們檢查資料是不是正確、公平。',
  },
};

// 範例標籤 → 事件代碼（GAS 的 code 只收英數）
export const LABEL_CODE = { 圓: 'circle', 方: 'square', 三角: 'triangle', 叉叉: 'cross' };
