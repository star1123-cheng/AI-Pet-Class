// 前後測（docs/03 第 1 節、5.1）。不碰 DOM。
// 選項代碼依文件表格順序編成 a、b、c；畫面上題目與選項都打亂，代碼不變。只記代碼，不記文字。

export const FORMS = {
  A: [
    {
      id: 'A1',
      text: '聊天機器人說「我好開心認識你」，牠真的有開心的感覺嗎？',
      options: ['沒有，牠是根據學到的文字規律，猜出適合的話', '有，跟人一樣', '只有晚上有'],
      answer: 'a',
    },
    {
      id: 'A2',
      text: 'AI 為什麼會認出貓的照片？',
      options: ['工程師一條一條寫「貓有尖耳朵」', '牠看過很多很多貓的例子，從裡面找規律', '牠會自己上網問人'],
      answer: 'b',
    },
    {
      id: 'A3',
      text: '要訓練 AI 認識水果，哪一份資料最好？',
      options: ['100 張都是蘋果', '各種水果、各種角度，每種幾十張', '只要 1 張最漂亮的'],
      answer: 'b',
    },
    {
      id: 'A4',
      text: 'AI 很有自信地說了你不知道的知識，你該怎麼辦？',
      options: ['相信，因為它語氣很肯定', '查課本或可靠來源確認', '它是電腦，一定對'],
      answer: 'b',
    },
    {
      id: 'A5',
      text: '想請 AI 做遊戲，哪個說法容易得到想要的結果？',
      options: ['做一個遊戲', '做一個給 10 歲小孩玩的接水果遊戲，手指左右移動，接到加 1 分，30 秒結束', '做一個很酷的'],
      answer: 'b',
    },
  ],
  B: [
    { id: 'B1', text: 'AI 說「我很難過」，牠真的難過嗎？', options: ['沒有，牠是根據學到的規律產生這句話', '有，跟人一樣', '看天氣'], answer: 'a' },
    { id: 'B2', text: 'AI 為什麼能分辨垃圾郵件？', options: ['有人手寫所有壞詞', '牠看過很多垃圾與正常郵件的例子，找出規律', '牠會讀心'], answer: 'b' },
    {
      id: 'B3',
      text: '訓練 AI 分辨圓和方，哪一份資料最好？',
      options: ['只有 50 張大圓', '圓和方都有，大小、位置不同，標籤正確', '只要 1 張最標準的'],
      answer: 'b',
    },
    { id: 'B4', text: 'AI 非常肯定地告訴你一個你不認識的年份，你該？', options: ['直接寫進作業', '用可靠來源再查一次', '再問 AI 一次就好'], answer: 'b' },
    {
      id: 'B5',
      text: '請 AI 幫你寫故事，哪個說法比較好？',
      options: ['寫故事', '寫一個 200 字、主角是貓、結局很開心的故事，給 10 歲小孩看', '寫一個很棒的'],
      answer: 'b',
    },
  ],
};

const CODES = ['a', 'b', 'c'];

export function shuffle(list, random = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 這次要考的題目：題目順序、選項順序都打亂。選項帶著原本的代碼
export function quizRound(form, random = Math.random) {
  return shuffle(FORMS[form], random).map((q) => ({
    id: q.id,
    text: q.text,
    options: shuffle(
      q.options.map((text, i) => ({ id: CODES[i], text })),
      random,
    ),
  }));
}

// 答對幾題（給老師看板與第 6 堂比較用）
export function quizScore(form, answers) {
  const key = new Map(FORMS[form].map((q) => [q.id, q.answer]));
  return answers.filter((a) => key.get(a.q) === a.choice).length;
}
