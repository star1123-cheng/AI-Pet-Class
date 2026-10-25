// 寵物亂說話（docs/03 4.2）。第一輪固定 3 對 3 錯；重測時每個主題依溫度從候選句池抽 1 句。
import { pickByTemperature } from './chain.js';

// 每個主題：1 句對（50%）、2 句錯（30%、20%）。fact 指向小書櫃的條目
export const TOPICS = [
  {
    id: 'yushan',
    fact: 1,
    pool: [
      { id: 't', text: '玉山是台灣最高的山，大約 3,952 公尺高。', truth: true, p: 0.5 },
      { id: 'f1', text: '雪山是台灣最高的山。', truth: false, p: 0.3 },
      { id: 'f2', text: '玉山大約 1,952 公尺高。', truth: false, p: 0.2 },
    ],
  },
  {
    id: 'bee',
    fact: 2,
    pool: [
      { id: 't', text: '蜜蜂有 6 隻腳，是昆蟲。', truth: true, p: 0.5 },
      { id: 'f1', text: '蜜蜂有 8 隻腳，所以不是昆蟲。', truth: false, p: 0.3 },
      { id: 'f2', text: '蜜蜂和螃蟹一樣有 10 隻腳。', truth: false, p: 0.2 },
    ],
  },
  {
    id: 'whale',
    fact: 3,
    pool: [
      { id: 't', text: '鯨魚是哺乳類，用肺呼吸。', truth: true, p: 0.5 },
      { id: 'f1', text: '鯨魚是魚類，用鰓呼吸。', truth: false, p: 0.3 },
      { id: 'f2', text: '鯨魚住在海裡，所以是魚。', truth: false, p: 0.2 },
    ],
  },
  {
    id: 'planet',
    fact: 4,
    pool: [
      { id: 't', text: '太陽系有 8 顆大行星。', truth: true, p: 0.5 },
      { id: 'f1', text: '太陽系有 12 顆大行星。', truth: false, p: 0.3 },
      { id: 'f2', text: '太陽系只有 3 顆大行星。', truth: false, p: 0.2 },
    ],
  },
  {
    id: 'lake',
    fact: 5,
    pool: [
      { id: 't', text: '日月潭在南投縣。', truth: true, p: 0.5 },
      { id: 'f1', text: '日月潭在高雄市。', truth: false, p: 0.3 },
      { id: 'f2', text: '日月潭在台北市。', truth: false, p: 0.2 },
    ],
  },
  {
    id: 'plant',
    fact: 6,
    pool: [
      { id: 't', text: '植物用陽光、水和二氧化碳製造養分。', truth: true, p: 0.5 },
      { id: 'f1', text: '植物製造養分時會放出二氧化碳。', truth: false, p: 0.3 },
      { id: 'f2', text: '植物不用陽光，只靠吃土長大。', truth: false, p: 0.2 },
    ],
  },
];

// 第一輪固定說的句子（docs/03 4.2 的 1～6）
const FIRST_ROUND = { yushan: 't', bee: 'f1', whale: 'f1', planet: 't', lake: 'f1', plant: 't' };

export function shuffle(list, random = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 一句話：{ code: 'bee.f1', topic, fact, text, truth }。code 是事件裡記的代碼
function sentence(topic, cand) {
  return { code: topic.id + '.' + cand.id, topic: topic.id, fact: topic.fact, text: cand.text, truth: cand.truth };
}

export function firstRound(random = Math.random) {
  return shuffle(
    TOPICS.map((tp) => sentence(tp, tp.pool.find((c) => c.id === FIRST_ROUND[tp.id]))),
    random,
  );
}

// 重測：每個主題依溫度抽 1 句，再打亂順序
export function talkRound(t, random = Math.random) {
  return shuffle(
    TOPICS.map((tp) => sentence(tp, pickByTemperature(tp.pool, t, random))),
    random,
  );
}

export const wrongCount = (round) => round.filter((s) => !s.truth).length;

// answers：與 round 同順序的 true／false（學生按「對」＝true）
export function judgeScore(round, answers) {
  return round.reduce((n, s, i) => n + (answers[i] === s.truth ? 1 : 0), 0);
}
