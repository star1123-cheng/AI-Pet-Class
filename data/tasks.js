// 第 1、2 堂的任務（docs/03 第 3 節、5.3、5.4）。任務是資料：完成條件寫成 check，
// 由 train/lessons.js 的 taskDone() 判斷；改門檻只要改這裡（並同步 docs/03）。
// 第 1 堂得徽章（badge），第 2 堂得作品道具（skill，docs/04 第 1 節）。
// 用 JS 模組而不是 .json：舊版 iPad Safari 不能直接 import JSON，用 fetch 又要多處理離線

export const TASKS = [
  {
    id: 'l1s1',
    lesson: 1,
    star: 1,
    badge: 'l1s1',
    name: '第一次餵食',
    goal: '圓、方各餵 5 張，考考牠 6 次',
    check: { type: 'feedAndTest', counts: { 圓: 5, 方: 5 }, tests: 6 },
  },
  { id: 'l1s2', lesson: 1, star: 2, badge: 'l1s2', name: '連勝', goal: '連續猜對 4 次', check: { type: 'streak', n: 4 } },
  { id: 'l1s3', lesson: 1, star: 3, badge: 'l1s3', name: '找原因', goal: '找出一次猜錯，選出原因', check: { type: 'reason' } },
  {
    id: 'l2s1',
    lesson: 2,
    star: 1,
    skill: 'score',
    name: '計分',
    goal: '三類都補到 8 張，準確率 70% 以上',
    check: { type: 'balancedAccuracy', min: 8, set: 'mixed', acc: 0.7 },
  },
  { id: 'l2s2', lesson: 2, star: 2, skill: 'timer', name: '計時', goal: '在神祕資料包找出 3 張標錯的圖', check: { type: 'pack', found: 3 } },
  { id: 'l2s3', lesson: 2, star: 3, skill: 'easter', name: '彩蛋', goal: '小圓測驗準確率 70% 以上', check: { type: 'setAccuracy', set: 'small', acc: 0.7 } },
];
