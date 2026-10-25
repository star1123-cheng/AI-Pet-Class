// 第 3 堂的進度、任務判定與迷你任務單（docs/03 第 3 節、4.2.1、4.2.2）。不碰 DOM。
// skill 在學生介面上叫「作品道具」。

export const LESSON = 3;

// 任務門檻
export const JUDGE_PASS = 5; // ★ 6 句中判斷對至少 5 句
export const FIX_MAX_LEVEL = 2; // ★★ 溫度要調到「低」或「很低」
export const FIX_MAX_WRONG = 1; // ★★ 重測錯句 ≤ 1

export const TASKS = [
  { star: 1, skill: 'feedback', name: '回饋話語', goal: '6 句裡判斷對 5 句以上' },
  { star: 2, skill: 'sound', name: '音效', goal: '調低溫度，讓牠說錯 1 句以下' },
  { star: 3, skill: 'anim', name: '角色動畫', goal: '造一句口頭禪並選理由' },
];

export function newTalk() {
  return { chain: 0, judge: null, fixed: false, phrase: null, reason: null, sheet: false, metaphor: false };
}

// 舊存檔沒有 talk 欄位時補上
export function talkOf(pet) {
  return { ...newTalk(), ...(pet.talk || {}) };
}

export const passJudge = (score) => score >= JUDGE_PASS;
export const passFix = (level, wrong) => level <= FIX_MAX_LEVEL && wrong <= FIX_MAX_WRONG;

// 解鎖技能：回傳是否為新解鎖
export function unlockSkill(pet, skill) {
  if (pet.skills.includes(skill)) return false;
  pet.skills = [...pet.skills, skill];
  return true;
}

// 迷你任務單（docs/03 第 3 堂）。multi：勾選題，answer 是所有該勾的選項
export const SHEET = [
  {
    id: 'q1',
    text: 'AI 說得很有自信，一定對嗎？',
    options: [
      { id: 'a', text: '不一定' },
      { id: 'b', text: '一定' },
      { id: 'c', text: '看顏色' },
    ],
    answer: ['a'],
  },
  {
    id: 'q2',
    text: '溫度調高會怎樣？',
    options: [
      { id: 'a', text: '更愛亂猜' },
      { id: 'b', text: '更準' },
      { id: 'c', text: '沒差' },
    ],
    answer: ['a'],
  },
  {
    id: 'q3',
    text: '怎麼查證？（可以選很多個）',
    multi: true,
    options: [
      { id: 'a', text: '查課本' },
      { id: 'b', text: '問老師' },
      { id: 'c', text: '看多個可靠來源' },
      { id: 'd', text: '再問 AI 一次就好' },
    ],
    answer: ['a', 'b', 'c'],
  },
];

export function sheetCorrect(q, chosen) {
  const a = [...chosen].sort().join('.');
  return a === [...q.answer].sort().join('.');
}

// 事件 value：選項代碼，多選用「.」連起來（符合 GAS 的 CODE_RE）
export const choiceCode = (chosen) => [...chosen].sort().join('.');

// 比喻校準（docs/03 4.2.2）
export const METAPHOR = {
  text: '「AI『知道』答案。」這句話哪裡不準？',
  options: [
    { id: 'a', text: '它是猜最可能的下一個字，不是去查資料' },
    { id: 'b', text: '它其實什麼都知道' },
    { id: 'c', text: '它會上網問老師' },
  ],
  answer: 'a',
  explain: 'AI 是從學過的文字裡猜「最可能接的字」，所以會很有自信地說錯。重要的事要查證。',
};
