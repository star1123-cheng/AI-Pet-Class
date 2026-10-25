// 外型參數 → SVG 字串。全部是自己畫的簡單形狀，不用外部圖片，也不模仿現有卡通角色。
// 輸出不寫 xmlns：直接嵌進 HTML 的 <svg> 不需要它，測試也能檢查「輸出裡沒有任何 http」。
// 只接受 isValidAppearance() 通過的參數，所有數值都來自下面的常數表，所以可以安全地組成 SVG 字串。
import { isValidAppearance } from './appearance.js';

const INK = '#2b2b2b';

// [主色, 深色]：深色用在耳朵內側、花紋
export const COLORS = [
  ['#ffb3a7', '#e0705f'],
  ['#ffd27f', '#d99a1e'],
  ['#fff08a', '#c9b52a'],
  ['#b8e986', '#6fae3a'],
  ['#8fe3c6', '#3aa883'],
  ['#9fdcf5', '#3d9cc9'],
  ['#a9bdfa', '#5a73d6'],
  ['#cdb4f5', '#8a63cf'],
  ['#f7b6e0', '#cc5fa6'],
  ['#e8c9a6', '#a87a4c'],
  ['#d5d9de', '#8a929c'],
  ['#ffc9de', '#e07aa1'],
];

// 每種身體：外框路徑、頭頂 y、眼睛 y、耳朵 y
const BODIES = [
  { d: 'M100 62 C150 62 162 100 162 122 C162 156 136 178 100 178 C64 178 38 156 38 122 C38 100 50 62 100 62Z', top: 62, eye: 108, ear: 70 },
  { d: 'M100 50 C140 50 158 110 158 132 C158 162 132 180 100 180 C68 180 42 162 42 132 C42 110 60 50 100 50Z', top: 50, eye: 110, ear: 66 },
  { d: 'M70 62 H130 Q164 62 164 96 V146 Q164 178 130 178 H70 Q36 178 36 146 V96 Q36 62 70 62Z', top: 62, eye: 108, ear: 64 },
  { d: 'M100 58 C126 58 132 84 138 100 C152 112 166 130 166 148 C166 170 138 180 100 180 C62 180 34 170 34 148 C34 130 48 112 62 100 C68 84 74 58 100 58Z', top: 58, eye: 112, ear: 74 },
  { d: 'M100 80 C150 80 172 108 172 136 C172 164 142 178 100 178 C58 178 28 164 28 136 C28 108 50 80 100 80Z', top: 80, eye: 122, ear: 86 },
  { d: 'M100 44 C118 74 160 104 160 138 C160 164 134 180 100 180 C66 180 40 164 40 138 C40 104 82 74 100 44Z', top: 44, eye: 120, ear: 92 },
];

const line = `stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;

function ears(kind, y, main, dark) {
  if (kind === 0) {
    // 貓耳
    return [-1, 1]
      .map((s) => {
        const x = 100 + s * 34;
        return `<path d="M${x - 16} ${y + 10} L${x + s * 6} ${y - 30} L${x + 16} ${y + 10}Z" fill="${main}" ${line}/>` +
          `<path d="M${x - 7} ${y + 4} L${x + s * 4} ${y - 16} L${x + 7} ${y + 4}Z" fill="${dark}"/>`;
      })
      .join('');
  }
  if (kind === 1) {
    // 長耳
    return [-1, 1]
      .map((s) => {
        const x = 100 + s * 24;
        return `<ellipse cx="${x}" cy="${y - 28}" rx="11" ry="34" fill="${main}" ${line}/>` +
          `<ellipse cx="${x}" cy="${y - 26}" rx="5" ry="24" fill="${dark}"/>`;
      })
      .join('');
  }
  if (kind === 2) {
    // 圓耳
    return [-1, 1]
      .map((s) => `<circle cx="${100 + s * 40}" cy="${y - 4}" r="18" fill="${main}" ${line}/><circle cx="${100 + s * 40}" cy="${y - 4}" r="9" fill="${dark}"/>`)
      .join('');
  }
  // 尾巴（沒有耳朵）
  return `<path d="M150 160 C178 160 186 130 174 118" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>` +
    `<path d="M150 160 C178 160 186 130 174 118" fill="none" stroke="${main}" stroke-width="7" stroke-linecap="round"/>`;
}

function pattern(kind, dark) {
  if (kind === 1) {
    return [[66, 150, 9], [136, 140, 7], [120, 168, 6], [56, 118, 6], [150, 108, 5]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${dark}" opacity="0.45"/>`)
      .join('');
  }
  if (kind === 2) {
    return [138, 156, 174].map((y) => `<rect x="0" y="${y}" width="200" height="8" fill="${dark}" opacity="0.4"/>`).join('');
  }
  if (kind === 3) return '<ellipse cx="100" cy="160" rx="40" ry="26" fill="#ffffff" opacity="0.6"/>';
  return '';
}

function eyes(kind, y) {
  const both = (f) => f(78) + f(122);
  if (kind === 0) return both((x) => `<circle cx="${x}" cy="${y}" r="6" fill="${INK}"/><circle cx="${x + 2}" cy="${y - 2}" r="2" fill="#fff"/>`);
  if (kind === 1) {
    return both((x) => `<circle cx="${x}" cy="${y}" r="11" fill="#fff" ${line}/><circle cx="${x + 1}" cy="${y + 1}" r="6" fill="${INK}"/><circle cx="${x + 3}" cy="${y - 2}" r="2" fill="#fff"/>`);
  }
  if (kind === 2) return both((x) => `<path d="M${x - 8} ${y + 3} Q${x} ${y - 8} ${x + 8} ${y + 3}" fill="none" ${line}/>`);
  if (kind === 3) return both((x) => `<path d="M${x - 8} ${y} Q${x} ${y + 7} ${x + 8} ${y}" fill="none" ${line}/>`);
  return both((x) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="9" fill="${INK}"/><circle cx="${x + 1}" cy="${y - 4}" r="2" fill="#fff"/>`);
}

function accessory(kind, top, eyeY) {
  if (kind === 1) {
    // 蝴蝶結
    const x = 132;
    const y = top + 14;
    return `<path d="M${x} ${y} L${x - 18} ${y - 10} L${x - 18} ${y + 10}Z M${x} ${y} L${x + 18} ${y - 10} L${x + 18} ${y + 10}Z" fill="#ff5d73" ${line}/><circle cx="${x}" cy="${y}" r="5" fill="#ff5d73" ${line}/>`;
  }
  if (kind === 2) {
    // 小帽子
    return `<rect x="72" y="${top - 6}" width="56" height="8" rx="4" fill="#3b4a6b" ${line}/><rect x="82" y="${top - 30}" width="36" height="26" rx="5" fill="#3b4a6b" ${line}/>`;
  }
  if (kind === 3) {
    // 眼鏡
    return `<circle cx="78" cy="${eyeY}" r="15" fill="none" ${line}/><circle cx="122" cy="${eyeY}" r="15" fill="none" ${line}/><path d="M93 ${eyeY} H107" ${line}/>`;
  }
  if (kind === 4) {
    // 天線
    return `<path d="M100 ${top} V${top - 24}" ${line}/><circle cx="100" cy="${top - 30}" r="7" fill="#ffd400" ${line}/>`;
  }
  if (kind === 5) {
    // 小芽
    return `<path d="M100 ${top} V${top - 16}" ${line}/><path d="M100 ${top - 14} C88 ${top - 30} 76 ${top - 20} 80 ${top - 12} C88 ${top - 8} 96 ${top - 10} 100 ${top - 14}Z" fill="#6fcf5a" ${line}/>` +
      `<path d="M100 ${top - 12} C112 ${top - 28} 124 ${top - 18} 120 ${top - 10} C112 ${top - 6} 104 ${top - 8} 100 ${top - 12}Z" fill="#6fcf5a" ${line}/>`;
  }
  return '';
}

let uid = 0;

// opts.size：寬高（px）；opts.label：無障礙說明
export function renderPetSVG(a, opts = {}) {
  if (!isValidAppearance(a)) throw new Error('外型參數不正確');
  const size = Number(opts.size) || 200;
  const body = BODIES[a.body];
  const [main, dark] = COLORS[a.color];
  const clip = `petclip${++uid}`;
  const label = opts.label === undefined ? 'AI 寵物' : String(opts.label).replace(/[<>&"]/g, '');
  const behind = ears(a.ears, body.ear, main, dark); // 畫在身體後面
  return (
    `<svg viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${label}">` +
    `<defs><clipPath id="${clip}"><path d="${body.d}"/></clipPath></defs>` +
    `<ellipse cx="100" cy="186" rx="56" ry="7" fill="#000" opacity="0.08"/>` +
    behind +
    `<path d="${body.d}" fill="${main}"/>` +
    `<g clip-path="url(#${clip})">${pattern(a.pattern, dark)}</g>` +
    `<path d="${body.d}" fill="none" ${line}/>` +
    `<circle cx="64" cy="${body.eye + 16}" r="7" fill="#ff7a8a" opacity="0.35"/><circle cx="136" cy="${body.eye + 16}" r="7" fill="#ff7a8a" opacity="0.35"/>` +
    eyes(a.eyes, body.eye) +
    `<path d="M92 ${body.eye + 18} Q100 ${body.eye + 25} 108 ${body.eye + 18}" fill="none" ${line}/>` +
    accessory(a.accessory, body.top, body.eye) +
    `</svg>`
  );
}

// 瀏覽器用：把 SVG 放進容器。內容全部來自上面的常數表，不含使用者輸入。
export function mountPet(container, a, opts) {
  const t = document.createElement('template');
  t.innerHTML = renderPetSVG(a, opts);
  container.replaceChildren(t.content);
}
