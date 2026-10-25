// 介面圖示：自繪 SVG，同一種線寬（24×24、線寬 2.2、圓角端點），顏色跟著文字（currentColor）。
// 用 createElementNS 建立，不經過 innerHTML。

const PATHS = {
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z|c8.5,8.5|c15.5,15.5|c15.5,8.5|c8.5,15.5|c12,12',
  speech: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z|M8 9h8|M8 12.5h5',
  wrench: 'M14.5 4.5a4.5 4.5 0 0 0-4.3 5.8L4.6 16a2 2 0 0 0 2.8 2.8l5.7-5.6a4.5 4.5 0 0 0 5.8-4.3l-2.6 2.6-2.8-.6-.6-2.8z',
  chat: 'M5 5h14v10H9l-4 4z|M9 10h.01|M12 10h.01|M15 10h.01',
  sheet: 'M7 4h10a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z|M9 3h6v3H9z|M9 11l1.8 1.8L14.5 9|M9 16.5h6',
  bulb: 'M9 18h6|M10 21h4|M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
  book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z|M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z',
  search: 'c11,11,6|M15.5 15.5L20 20',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  cross: 'M6 6l12 12|M18 6L6 18',
  ring: 'c12,12,7.5',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  copy: 'M9 9h10v11H9z|M15 9V4H5v11h4',
  bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1|M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  cards: 'M8 4h11a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z|M4 7v12a2 2 0 0 0 2 2h10',
  thermo: 'M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z|M12 9v7',
  brain: 'M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3 3 0 0 0 7 17.5 3 3 0 0 0 12 19V5.5A2.5 2.5 0 0 0 9 4.5z|M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3 3 0 0 1-3 4.8A3 3 0 0 1 12 19|M8 10h2|M14 13h2',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z|M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  shield: 'M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z|M9 12l2 2 4-4',
  hand: 'M8 11V5.5a1.5 1.5 0 0 1 3 0V10|M11 9.5V4.5a1.5 1.5 0 0 1 3 0V10|M14 10V6a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.8-2.4L3.5 15a1.5 1.5 0 0 1 2.3-1.9L8 15V9',
  cloud: 'M7 18a4.5 4.5 0 0 1-.7-8.9A6 6 0 0 1 17.8 10 4 4 0 0 1 17 18z',
  question: 'c12,12,9|M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6|M12 17h.01',
};

const NS = 'http://www.w3.org/2000/svg';

// ★ 數：一排實心星形，給螢幕閱讀器念「n 星」
export function stars(n, size = '20px') {
  const box = document.createElement('span');
  box.className = 'stars';
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', `${n} 星`);
  for (let i = 0; i < n; i++) box.append(icon('star', { size }));
  return box;
}

// icon('book')：回傳 <svg>；size 預設 1em（跟著字的大小）
export function icon(name, { size = '1.1em', label } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('class', 'icon');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else svg.setAttribute('aria-hidden', 'true');
  for (const part of (PATHS[name] || PATHS.question).split('|')) {
    let el;
    if (part.startsWith('c')) {
      // c 圓心x,圓心y[,半徑]；沒寫半徑就是實心小點（骰子點）
      const [cx, cy, r] = part.slice(1).split(',').map(Number);
      el = document.createElementNS(NS, 'circle');
      el.setAttribute('cx', cx);
      el.setAttribute('cy', cy);
      el.setAttribute('r', r || 1.3);
      if (!r) el.setAttribute('fill', 'currentColor');
    } else {
      el = document.createElementNS(NS, 'path');
      el.setAttribute('d', part);
    }
    svg.append(el);
  }
  return svg;
}
