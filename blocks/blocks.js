// 提示詞積木與技能片段（docs/04 1.1、2.1）。寫成 JS 而不是 JSON：舊版 iPad Safari 不能直接 import JSON。

// pick：one＝單選、many＝多選；required：沒選不能複製；defaults：一開始就選好的
export const CATEGORIES = [
  {
    id: 'what',
    name: '做什麼',
    pick: 'one',
    required: true,
    blocks: [
      { id: 'w1', text: 'AI 猜猜畫畫' },
      { id: 'w2', text: '接水果' },
      { id: 'w3', text: '記憶配對' },
      { id: 'w4', text: '問答闖關' },
    ],
  },
  {
    id: 'who',
    name: '誰玩',
    pick: 'one',
    blocks: [
      { id: 'p1', text: '10 歲同學', phrase: '給 10 歲的同學玩' },
      { id: 'p2', text: '全班一起', phrase: '讓全班一起玩' },
      { id: 'p3', text: '兩人對戰', phrase: '讓兩個人對戰玩' },
    ],
  },
  {
    id: 'rules',
    name: '規則',
    pick: 'many',
    blocks: [
      { id: 'r1', text: '30 秒一回合' },
      { id: 'r2', text: '猜對加分' },
      { id: 'r3', text: '連續猜對有獎勵' },
      { id: 'r4', text: '三次機會' },
    ],
  },
  {
    id: 'theme',
    name: '主題色',
    pick: 'one',
    blocks: [
      { id: 't1', text: '海洋' },
      { id: 't2', text: '森林' },
      { id: 't3', text: '太空' },
      { id: 't4', text: '糖果' },
    ],
  },
  {
    id: 'look',
    name: '外觀',
    pick: 'many',
    blocks: [
      { id: 'l1', text: '字要大' },
      { id: 'l2', text: '按鈕要大' },
    ],
  },
  {
    id: 'limits',
    name: '限制',
    pick: 'many',
    defaults: ['c1', 'c2', 'c3', 'c4'],
    blocks: [
      { id: 'c1', text: '單一 HTML 檔' },
      { id: 'c2', text: '適合 iPad 手指操作' },
      { id: 'c3', text: '不要載入外部圖片或檔案' },
      { id: 'c4', text: '全部用繁體中文' },
    ],
  },
];

// 技能表（docs/04 1.），順序就是提示詞裡的順序
export const SKILLS = [
  { id: 'score', name: '計分', star: 1, fragment: '請加入計分功能：AI 猜對時加 10 分，猜錯不扣分，畫面上方顯示總分。' },
  { id: 'timer', name: '計時', star: 2, fragment: '請加入倒數計時，每回合 30 秒，時間到就結束並顯示得分。' },
  { id: 'easter', name: '彩蛋', star: 3, fragment: '請加入彩蛋：連續猜對 3 次，出現一個隱藏的特別畫面。' },
  { id: 'feedback', name: '回饋話語', star: 1, fragment: '請讓寵物在猜對時說鼓勵的話，猜錯時說提示的話，每句不超過 12 個字。' },
  { id: 'sound', name: '音效', star: 2, fragment: '請加入簡單音效：猜對、猜錯、結束各一種，用瀏覽器內建的聲音功能，不要載入外部檔案。' },
  { id: 'anim', name: '角色動畫', star: 3, fragment: '請讓寵物在猜對時跳一下，猜錯時搖一搖，並顯示我設定的口頭禪氣泡。' },
  { id: 'levels', name: '關卡', star: 1, fragment: '請加入 3 個關卡，每過一關，要畫的圖形變多或時間縮短。' },
  { id: 'highscore', name: '最高分', star: 2, fragment: '請記錄這次遊玩的最高分並顯示在畫面上。' },
  { id: 'adapt', name: '難度自動調整', star: 3, fragment: '請讓遊戲依表現調整難度：連續猜對 3 次就變難，連續猜錯 2 次就變容易。' },
];

// 本堂能量（可複製次數）：第 4 堂 8 次、第 5 堂 10 次
export const ENERGY = { 4: 8, 5: 10 };
export const energyFor = (lesson) => ENERGY[lesson] ?? ENERGY[4];

// 複製前固定顯示的提醒（守則 1、4）
export const COPY_REMINDER = '🔒 不要輸入真實姓名、學校、電話、住址　🙋 用了 AI 幫忙，要誠實說';
