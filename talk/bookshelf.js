// 查證小書櫃（docs/03 4.3）：8 條事實，用分類按鈕篩選，不連外部網站、離線可用。

export const SHELVES = [
  { id: 'all', name: '全部' },
  { id: 'animal', name: '動物' },
  { id: 'place', name: '台灣地理' },
  { id: 'science', name: '自然科學' },
];

export const FACTS = [
  { id: 1, shelf: 'place', text: '玉山主峰海拔約 3,952 公尺，是台灣最高峰。' },
  { id: 2, shelf: 'animal', text: '蜜蜂是昆蟲，有 6 隻腳。' },
  { id: 3, shelf: 'animal', text: '鯨魚是哺乳類，用肺呼吸，不是魚。' },
  { id: 4, shelf: 'science', text: '太陽系有 8 顆行星。' },
  { id: 5, shelf: 'place', text: '日月潭位於南投縣。' },
  { id: 6, shelf: 'science', text: '植物行光合作用：用陽光、水、二氧化碳製造養分，並釋出氧氣。' },
  { id: 7, shelf: 'science', text: '水在一般氣壓下，約 100 °C 沸騰。' },
  { id: 8, shelf: 'animal', text: '螃蟹有 10 隻腳（含螯）。' },
];

export function factsOn(shelf) {
  return shelf === 'all' ? FACTS.slice() : FACTS.filter((f) => f.shelf === shelf);
}

export const factById = (id) => FACTS.find((f) => f.id === id);
