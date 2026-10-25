// 外型參數 → SVG 字串。全部是自己畫的 Q 版小動物，不用外部圖片，也不模仿現有卡通角色。
// 參數意義見 docs/05 第 2 節：body＝物種、ears＝該物種的耳型、pattern＝花紋、eyes＝眼睛、accessory＝配件、color＝毛色。
// 輸出不寫 xmlns：直接嵌進 HTML 的 <svg> 不需要它，測試也能檢查「輸出裡沒有任何 http」。
// 只接受 isValidAppearance() 通過的參數，所有數值都來自下面的常數表，所以可以安全地組成 SVG 字串。
// 會動的部分只加 class（pet-tail 搖尾巴、pet-eyes 眨眼、pet-core AI 核心發光），動畫寫在 index.html 的 CSS。
import { isValidAppearance } from './appearance.js';

const INK = '#2a2320'; // 眼睛
const PINK = '#ffc2cc'; // 耳朵內側、鼻子
const BLUSH = '#ff8fa3';
const TECH = '#4de8f4'; // 科技元素的發光色（AI 核心、電路節點、護目鏡）
const GEAR = '#3a4256'; // 耳機

export const SPECIES = ['貓', '狗', '兔', '熊', '狐狸', '倉鼠'];

// 毛色：main 主色、shade 花紋與深色耳、light 肚子與口鼻、line 外框
export const COLORS = [
  { name: '橘子', main: '#f6a453', shade: '#d97b2b', light: '#fff1e0', line: '#7a3f12' },
  { name: '奶油', main: '#f7dca8', shade: '#e0b672', light: '#fffaf0', line: '#7a5a2a' },
  { name: '焦糖', main: '#c98a55', shade: '#9e6233', light: '#f6e3cf', line: '#4e2c12' },
  { name: '可可', main: '#8a6450', shade: '#634535', light: '#e9d6c8', line: '#33221a' },
  { name: '灰藍', main: '#9aa8bd', shade: '#6f7d94', light: '#eef2f7', line: '#333c4d' },
  { name: '炭灰', main: '#767a88', shade: '#4f525e', light: '#e4e5ea', line: '#1f2028' },
  { name: '雪白', main: '#fbfaf7', shade: '#ddd5c8', light: '#ffffff', line: '#5a5550' },
  { name: '桃粉', main: '#f7b7c3', shade: '#e48799', light: '#fff0f3', line: '#7a2f40' },
  { name: '薄荷', main: '#9fe0c9', shade: '#5fbf9f', light: '#effaf5', line: '#1f5c48' },
  { name: '天藍', main: '#a7d4f5', shade: '#6aaee0', light: '#f0f8ff', line: '#1f4b70' },
  { name: '薰衣草', main: '#c9b8f0', shade: '#9f88dc', light: '#f6f2ff', line: '#45307a' },
  { name: '檸檬', main: '#f6e37a', shade: '#d9bf3a', light: '#fffbe0', line: '#6b5a10' },
];

// 每種動物的頭形、頭頂 y、眼睛位置、頭的半寬（耳機掛的位置）
const HEADS = [
  { d: 'M100 42 C142 42 164 68 164 100 C164 130 138 148 100 148 C62 148 36 130 36 100 C36 68 58 42 100 42Z', top: 42, eye: 98, ex: 22, w: 64 },
  { d: 'M100 40 C140 40 160 66 160 98 C160 132 136 150 100 150 C64 150 40 132 40 98 C40 66 60 40 100 40Z', top: 40, eye: 96, ex: 22, w: 60 },
  { d: 'M100 44 C136 44 156 70 156 102 C156 132 134 150 100 150 C66 150 44 132 44 102 C44 70 64 44 100 44Z', top: 44, eye: 98, ex: 21, w: 56 },
  { d: 'M100 42 C144 42 166 70 166 102 C166 134 138 150 100 150 C62 150 34 134 34 102 C34 70 56 42 100 42Z', top: 42, eye: 98, ex: 23, w: 66 },
  { d: 'M100 44 C138 44 160 66 166 100 C158 124 130 146 100 148 C70 146 42 124 34 100 C40 66 62 44 100 44Z', top: 44, eye: 96, ex: 22, w: 66 },
  { d: 'M100 46 C146 46 170 76 170 108 C170 138 140 154 100 154 C60 154 30 138 30 108 C30 76 54 46 100 46Z', top: 46, eye: 102, ex: 24, w: 70 },
];

const BODY = 'M100 132 C124 132 140 146 140 162 C140 180 122 188 100 188 C78 188 60 180 60 162 C60 146 76 132 100 132Z';

const stroke = (c, w = 3.5) => `stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const mirror = (svg) => `<g transform="translate(200 0) scale(-1 1)">${svg}</g>`;

// ---------- 耳朵：每種動物 4 種，只寫左耳，右耳用鏡像 ----------
// 回傳 [左耳, 右耳]，每個是 { back, front }：back 畫在頭後面，front 畫在頭前面（例如垂耳）
function earShapes(species, kind, c) {
  const L = stroke(c.line);
  const back = (s) => ({ back: s, front: '' });
  const front = (s) => ({ back: '', front: s });
  const tri = (outer, inner, innerFill) => `<path d="${outer}" fill="${c.main}" ${L}/><path d="${inner}" fill="${innerFill}"/>`;
  const lopRabbit = front(
    `<path d="M70 52 C50 50 34 76 36 110 C38 124 52 124 54 110 C56 90 62 70 74 58Z" fill="${c.main}" ${L}/>` +
      `<path d="M64 62 C53 66 46 84 45 104 C46 112 49 111 50 104 C52 88 56 75 66 66Z" fill="${PINK}"/>`,
  );
  const upRabbit = back(
    `<ellipse cx="80" cy="30" rx="12" ry="28" transform="rotate(-10 80 30)" fill="${c.main}" ${L}/>` +
      `<ellipse cx="80" cy="33" rx="5.5" ry="19" transform="rotate(-10 80 33)" fill="${PINK}"/>`,
  );
  const table = [
    // 貓：立耳、折耳、簇毛耳、大耳
    [
      back(tri('M52 70 L60 26 L94 46Z', 'M60 62 L63 36 L84 48Z', PINK)),
      front(`<path d="M56 64 C52 48 64 38 82 44 C78 54 68 62 56 64Z" fill="${c.main}" ${L}/><path d="M62 56 C62 50 68 46 74 47" fill="none" ${stroke(c.line, 2.5)}/>`),
      back(tri('M50 72 L56 20 L94 46Z', 'M58 64 L60 34 L84 48Z', PINK) + `<path d="M56 20 L51 9 M56 20 L61 10" fill="none" ${stroke(c.line, 2.5)}/>`),
      back(tri('M42 84 L42 22 L92 44Z', 'M51 72 L51 35 L80 47Z', PINK)),
    ],
    // 狗：立耳、垂耳、長垂耳、半折耳
    [
      back(tri('M54 66 Q50 30 62 24 Q78 30 92 46Z', 'M60 58 Q59 38 64 33 Q74 39 82 48Z', c.shade)),
      front(`<path d="M60 50 C40 50 30 72 34 100 C36 113 50 113 56 100 C60 86 66 70 72 56Z" fill="${c.shade}" ${L}/>`),
      front(`<path d="M62 48 C38 48 28 80 30 122 C32 140 50 140 54 124 C58 100 64 74 74 54Z" fill="${c.shade}" ${L}/>`),
      { back: `<path d="M54 66 Q52 42 64 36 L92 46Z" fill="${c.main}" ${L}/>`, front: `<path d="M58 44 Q66 32 80 40 Q74 54 62 54Z" fill="${c.shade}" ${L}/>` },
    ],
    // 兔：立耳、垂耳、一立一垂（右耳在下面另外處理）、短耳
    [
      upRabbit,
      lopRabbit,
      upRabbit,
      back(
        `<ellipse cx="80" cy="38" rx="11" ry="18" transform="rotate(-14 80 38)" fill="${c.main}" ${L}/>` +
          `<ellipse cx="80" cy="40" rx="5" ry="11" transform="rotate(-14 80 40)" fill="${PINK}"/>`,
      ),
    ],
    // 熊：圓耳、小圓耳、大圓耳、深色圓耳
    [
      back(`<circle cx="62" cy="50" r="16" fill="${c.main}" ${L}/><circle cx="62" cy="50" r="8" fill="${c.shade}"/>`),
      back(`<circle cx="66" cy="48" r="11" fill="${c.main}" ${L}/><circle cx="66" cy="48" r="5" fill="${c.shade}"/>`),
      back(`<circle cx="58" cy="52" r="21" fill="${c.main}" ${L}/><circle cx="58" cy="52" r="11" fill="${c.shade}"/>`),
      back(`<circle cx="62" cy="50" r="16" fill="${c.shade}" ${L}/>`),
    ],
    // 狐狸：尖耳、大耳、短耳、墨尖耳
    [
      back(tri('M50 76 L56 22 L94 48Z', 'M58 66 L60 36 L84 50Z', c.light)),
      back(tri('M38 92 L40 10 L94 48Z', 'M48 80 L49 28 L82 50Z', c.light)),
      back(tri('M56 64 L64 34 L90 48Z', 'M62 58 L66 42 L82 50Z', c.light)),
      back(tri('M50 76 L56 22 L94 48Z', 'M58 66 L60 36 L84 50Z', c.light) + `<path d="M54 42 L56 22 L70 32Z" fill="${c.line}" ${stroke(c.line, 2)}/>`),
    ],
    // 倉鼠：小圓耳、半圓耳、大圓耳、垂耳
    [
      back(`<circle cx="64" cy="50" r="11" fill="${c.main}" ${L}/><circle cx="64" cy="50" r="6" fill="${PINK}"/>`),
      back(`<path d="M50 62 A15 15 0 0 1 80 50Z" fill="${c.main}" ${L}/>`),
      back(`<circle cx="60" cy="52" r="15" fill="${c.main}" ${L}/><circle cx="60" cy="52" r="8" fill="${PINK}"/>`),
      front(`<ellipse cx="50" cy="70" rx="9" ry="14" transform="rotate(32 50 70)" fill="${c.main}" ${L}/><ellipse cx="51" cy="70" rx="4" ry="8" transform="rotate(32 51 70)" fill="${PINK}"/>`),
    ],
  ];
  const left = table[species][kind];
  const right = species === 2 && kind === 2 ? lopRabbit : left;
  return [left, right];
}

// ---------- 尾巴（畫在身體後面） ----------
function tail(species, c) {
  const L = stroke(c.line);
  const t = (s) => `<g class="pet-tail">${s}</g>`;
  const curve = (d, w) => `<path d="${d}" fill="none" ${stroke(c.line, w + 7)}/><path d="${d}" fill="none" ${stroke(c.main, w)}/>`;
  if (species === 0) return t(curve('M132 172 C168 174 178 140 162 120', 7));
  if (species === 1) return t(curve('M134 160 C152 154 160 142 156 128', 8));
  if (species === 2) return t(`<circle cx="140" cy="172" r="11" fill="${c.light}" ${L}/>`);
  if (species === 3) return t(`<circle cx="138" cy="172" r="8" fill="${c.main}" ${L}/>`);
  if (species === 4) {
    return t(
      `<path d="M128 174 C172 184 194 142 172 106 C162 134 150 152 126 154Z" fill="${c.main}" ${L}/>` +
        `<path d="M172 106 C166 118 170 130 183 132 C186 122 181 112 172 106Z" fill="${c.light}" ${L}/>`,
    );
  }
  return ''; // 倉鼠的尾巴藏起來了
}

// ---------- 花紋（頭、身體各一份，會被裁切在輪廓裡） ----------
// 電路紋：深色線路＋發光節點
const nodes = (pts, c) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${TECH}" ${stroke(c.line, 1.5)}/>`).join('');

function headPattern(kind, c) {
  if (kind === 1) {
    // 只畫在額頭，臉頰保持乾淨
    return `<path d="M100 40 V56 H112 M84 44 V54 H76" fill="none" ${stroke(c.shade, 3.5)}/>` +
      nodes([[112, 56], [76, 54]], c);
  }
  if (kind === 2) {
    return `<path d="M100 46 V62 M86 50 Q88 57 90 63 M114 50 Q112 57 110 63 M32 94 H48 M32 104 H46 M168 94 H152 M168 104 H154" fill="none" ${stroke(c.shade, 5)}/>`;
  }
  if (kind === 3) return `<path d="M100 40 C91 58 91 74 95 88 Q100 93 105 88 C109 74 109 58 100 40Z" fill="${c.light}"/>`;
  return '';
}

function bodyPattern(kind, c) {
  if (kind === 1) {
    return `<path d="M56 154 H72 L78 160 M144 154 H128 L122 160 M60 172 H76 M140 172 H124" fill="none" ${stroke(c.shade, 3.5)}/>` +
      nodes([[78, 160], [122, 160], [76, 172], [124, 172]], c);
  }
  if (kind === 2) return `<path d="M60 154 Q70 156 72 166 M140 154 Q130 156 128 166 M60 170 Q68 172 70 180 M140 170 Q132 172 130 180" fill="none" ${stroke(c.shade, 5)}/>`;
  if (kind === 3) return `<ellipse cx="100" cy="168" rx="22" ry="16" fill="${c.light}"/>`;
  return '';
}

// 每種動物本來就有的毛色分區（狐狸白下巴、倉鼠白臉頰），也會被裁切在頭形裡
function speciesMarks(species, c) {
  if (species === 4) return `<path d="M28 100 C60 110 82 118 100 138 C118 118 140 110 172 100 V160 H28Z" fill="${c.light}"/>`;
  if (species === 5) return `<ellipse cx="100" cy="136" rx="58" ry="26" fill="${c.light}"/>`;
  return '';
}

// ---------- 口鼻 ----------
function face(species, c, eyeY) {
  const L = stroke(c.line, 2.5);
  const y = eyeY + 14;
  if (species === 0) {
    return `<path d="M94 ${y - 2} H106 L100 ${y + 5}Z" fill="${BLUSH}" ${stroke(c.line, 2)}/>` +
      `<path d="M100 ${y + 5} Q100 ${y + 11} 93 ${y + 11} M100 ${y + 5} Q100 ${y + 11} 107 ${y + 11}" fill="none" ${L}/>` +
      `<path d="M58 ${y} L38 ${y - 5} M58 ${y + 6} L38 ${y + 8} M142 ${y} L162 ${y - 5} M142 ${y + 6} L162 ${y + 8}" fill="none" ${stroke(c.line, 2)} opacity="0.55"/>`;
  }
  if (species === 1) {
    return `<ellipse cx="100" cy="${y + 8}" rx="24" ry="17" fill="${c.light}" ${L}/>` +
      `<path d="M95 ${y + 15} Q100 ${y + 26} 105 ${y + 15}Z" fill="#ff7a90" ${stroke(c.line, 2)}/>` +
      `<path d="M100 ${y + 6} V${y + 12} M90 ${y + 12} Q100 ${y + 20} 110 ${y + 12}" fill="none" ${L}/>` +
      `<ellipse cx="100" cy="${y + 1}" rx="8" ry="6" fill="${c.line}"/><ellipse cx="98" cy="${y - 1}" rx="2.5" ry="1.5" fill="#fff" opacity="0.7"/>`;
  }
  if (species === 2 || species === 5) {
    return `<ellipse cx="100" cy="${y}" rx="4.5" ry="3.5" fill="${BLUSH}"/>` +
      `<rect x="96" y="${y + 7}" width="8" height="7" rx="2" fill="#fff" ${stroke(c.line, 2)}/>` +
      `<path d="M100 ${y + 3} V${y + 7} M93 ${y + 9} Q100 ${y + 12} 100 ${y + 7} Q100 ${y + 12} 107 ${y + 9}" fill="none" ${L}/>`;
  }
  if (species === 3) {
    return `<ellipse cx="100" cy="${y + 8}" rx="22" ry="16" fill="${c.light}" ${L}/>` +
      `<path d="M92 ${y} Q100 ${y - 4} 108 ${y} Q104 ${y + 8} 100 ${y + 8} Q96 ${y + 8} 92 ${y}Z" fill="${c.line}"/>` +
      `<path d="M100 ${y + 8} V${y + 12} M92 ${y + 14} Q100 ${y + 19} 108 ${y + 14}" fill="none" ${L}/>`;
  }
  return `<ellipse cx="100" cy="${y + 4}" rx="6" ry="4.5" fill="${c.line}"/>` +
    `<path d="M100 ${y + 8} Q96 ${y + 13} 92 ${y + 10} M100 ${y + 8} Q104 ${y + 13} 108 ${y + 10}" fill="none" ${L}/>`;
}

// ---------- 眼睛 ----------
function eyes(kind, y, ex) {
  const both = (f) => f(100 - ex) + f(100 + ex);
  const open = (s) => `<g class="pet-eyes">${s}</g>`;
  if (kind === 0) return open(both((x) => `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="7.5" fill="${INK}"/><circle cx="${x + 2}" cy="${y - 3}" r="2.4" fill="#fff"/>`));
  if (kind === 1) {
    return open(both((x) =>
      `<ellipse cx="${x}" cy="${y}" rx="9" ry="11" fill="${INK}"/><ellipse cx="${x}" cy="${y + 5}" rx="6" ry="4" fill="#7fb2ff" opacity="0.6"/>` +
      `<circle cx="${x + 3}" cy="${y - 4}" r="3.6" fill="#fff"/><circle cx="${x - 3}" cy="${y + 4}" r="1.6" fill="#fff"/>`));
  }
  if (kind === 2) return both((x) => `<path d="M${x - 8} ${y + 3} Q${x} ${y - 8} ${x + 8} ${y + 3}" fill="none" ${stroke(INK, 4)}/>`);
  if (kind === 3) {
    // 像素眼：方塊螢幕＋方形白色反光
    return open(both((x) =>
      `<rect x="${x - 8}" y="${y - 9}" width="16" height="18" rx="4" fill="${INK}"/>` +
      `<rect x="${x - 3}" y="${y - 5}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y}" width="3" height="3" fill="#fff" opacity="0.6"/>`));
  }
  return open(both((x) =>
    `<ellipse cx="${x}" cy="${y}" rx="9" ry="10" fill="#cfe36b" ${stroke(INK, 2.5)}/><ellipse cx="${x}" cy="${y}" rx="2.6" ry="7.5" fill="${INK}"/>` +
    `<circle cx="${x + 3}" cy="${y - 4}" r="2" fill="#fff"/>`));
}

// ---------- 配件 ----------
function accessory(kind, head, c) {
  const L = stroke(c.line, 3);
  if (kind === 1) {
    // 蝴蝶結
    const x = 134;
    const y = head.top + 16;
    return `<g transform="rotate(14 ${x} ${y})"><path d="M${x} ${y} L${x - 18} ${y - 11} L${x - 18} ${y + 11}Z M${x} ${y} L${x + 18} ${y - 11} L${x + 18} ${y + 11}Z" fill="#ff5d73" ${L}/>` +
      `<circle cx="${x}" cy="${y}" r="5" fill="#ff5d73" ${L}/></g>`;
  }
  if (kind === 2) {
    // 耳機：頭帶跨過頭頂，兩側耳罩有發光環
    const l = 100 - head.w;
    const r = 100 + head.w;
    const y = head.eye + 2;
    const cup = (x) => `<rect x="${x - 9}" y="${y - 15}" width="18" height="30" rx="8" fill="${GEAR}" ${stroke(INK, 2.5)}/><circle cx="${x}" cy="${y}" r="5" fill="${TECH}"/>`;
    return `<path d="M${l + 3} ${y - 8} C${l + 3} ${head.top - 22} ${r - 3} ${head.top - 22} ${r - 3} ${y - 8}" fill="none" ${stroke(INK, 8)}/>` +
      `<path d="M${l + 3} ${y - 8} C${l + 3} ${head.top - 22} ${r - 3} ${head.top - 22} ${r - 3} ${y - 8}" fill="none" ${stroke(GEAR, 4)}/>` +
      cup(l) + cup(r);
  }
  if (kind === 3) {
    // 智慧護目鏡：半透明螢幕蓋住雙眼，上面有一條反光和兩個顯示點
    const y = head.eye;
    const x = 100 - head.ex - 18;
    const w = head.ex * 2 + 36;
    return `<rect x="${x}" y="${y - 13}" width="${w}" height="26" rx="13" fill="${TECH}" fill-opacity="0.35" ${stroke(INK, 3)}/>` +
      `<path d="M${x + 10} ${y - 6} H${x + 24}" fill="none" ${stroke('#fff', 3)} opacity="0.8"/>` +
      `<circle cx="${x + w - 12}" cy="${y + 5}" r="2" fill="#fff"/><circle cx="${x + w - 19}" cy="${y + 5}" r="2" fill="#fff" opacity="0.6"/>`;
  }
  if (kind === 4) {
    // AI 天線
    const t = head.top;
    return `<path d="M100 ${t + 2} V${t - 22}" fill="none" ${L}/><circle cx="100" cy="${t - 28}" r="12" fill="#5ce1e6" opacity="0.3"/>` +
      `<circle cx="100" cy="${t - 28}" r="7" fill="#5ce1e6" ${L}/><circle cx="98" cy="${t - 30}" r="2" fill="#fff"/>`;
  }
  if (kind === 5) {
    // 領巾
    return `<path d="M62 140 Q100 154 138 140 Q122 158 100 178 Q78 158 62 140Z" fill="#e5484d" ${L}/>` +
      `<circle cx="88" cy="152" r="2.5" fill="#fff"/><circle cx="110" cy="154" r="2.5" fill="#fff"/><circle cx="100" cy="166" r="2.5" fill="#fff"/>`;
  }
  return '';
}

// ---------- AI 核心：每隻都有，在胸前；戴領巾時改別在領巾上 ----------
// 亮度跟著準確率（docs/05 第 2 節）：0 熄燈（還沒考過）、1 微光、2 亮、3 全亮（≥ 70%，第 2 堂解鎖門檻）
export function coreLevel(accuracy) {
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy)) return 0;
  if (accuracy >= 0.7) return 3;
  if (accuracy >= 0.4) return 2;
  return 1;
}

function core(y, c, level) {
  const hex = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const t = (Math.PI / 3) * i - Math.PI / 2;
      return `${(100 + 7 * Math.cos(t)).toFixed(1)} ${(y + 7 * Math.sin(t)).toFixed(1)}`;
    })
    .join(' L');
  if (level === 0) return `<path d="M${hex}Z" fill="#b8bcc6" ${stroke(c.line, 2)}/>`;
  // 光暈先鋪一層白光再疊藍綠，在橘色、棕色毛上才不會混成灰綠色
  const white = [0, 0.3, 0.5, 0.7][level];
  const glow = [0, 0.2, 0.3, 0.4][level];
  const r = [0, 10, 12, 17][level];
  const sparkle = (x, sy, s) => `<path d="M${x} ${sy - s} L${x + s * 0.3} ${sy - s * 0.3} L${x + s} ${sy} L${x + s * 0.3} ${sy + s * 0.3} L${x} ${sy + s} L${x - s * 0.3} ${sy + s * 0.3} L${x - s} ${sy} L${x - s * 0.3} ${sy - s * 0.3}Z" fill="#fff" ${stroke(TECH, 1.5)}/>`;
  return `<g class="pet-core pet-core-${level}"><circle cx="100" cy="${y}" r="${r}" fill="#fff" opacity="${white}"/><circle cx="100" cy="${y}" r="${r}" fill="${TECH}" opacity="${glow}"/>` +
    `<path d="M${hex}Z" fill="${TECH}" fill-opacity="${level === 1 ? 0.5 : 1}" ${stroke(c.line, 2)}/><circle cx="100" cy="${y}" r="2.5" fill="#fff" opacity="${level === 1 ? 0.5 : 1}"/>` +
    (level === 3 ? sparkle(84, y - 12, 5) + sparkle(117, y - 9, 4) : '') +
    `</g>`;
}

let uid = 0;

// opts.size：寬高（px）；opts.label：無障礙說明
// opts.accuracy：0–1 或 null（還沒考過），決定 AI 核心亮度；不傳時核心畫成「亮」（例如序號卡、展示用）
export function renderPetSVG(a, opts = {}) {
  if (!isValidAppearance(a)) throw new Error('外型參數不正確');
  const size = Number(opts.size) || 200;
  const head = HEADS[a.body];
  const c = COLORS[a.color];
  const id = ++uid;
  const headClip = `petclip${id}h`;
  const bodyClip = `petclip${id}b`;
  const label = opts.label === undefined ? `AI 寵物（${SPECIES[a.body]}）` : String(opts.label).replace(/[<>&"]/g, '');
  const [earL, earR] = earShapes(a.body, a.ears, c);
  const L = stroke(c.line);
  const blushY = head.eye + 18;
  const blushX = head.ex + 16;
  return (
    `<svg viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${label}">` +
    `<defs><clipPath id="${headClip}"><path d="${head.d}"/></clipPath><clipPath id="${bodyClip}"><path d="${BODY}"/></clipPath></defs>` +
    `<ellipse cx="100" cy="191" rx="50" ry="6" fill="#000" opacity="0.08"/>` +
    tail(a.body, c) +
    earL.back + mirror(earR.back) +
    `<path d="${BODY}" fill="${c.main}"/>` +
    `<g clip-path="url(#${bodyClip})">${a.body === 5 ? bodyPattern(3, c) : ''}${bodyPattern(a.pattern, c)}</g>` +
    `<path d="${BODY}" fill="none" ${L}/>` +
    `<ellipse cx="84" cy="185" rx="10" ry="7" fill="${c.main}" ${L}/><ellipse cx="116" cy="185" rx="10" ry="7" fill="${c.main}" ${L}/>` +
    `<path d="${head.d}" fill="${c.main}"/>` +
    `<g clip-path="url(#${headClip})">${speciesMarks(a.body, c)}${headPattern(a.pattern, c)}</g>` +
    `<path d="${head.d}" fill="none" ${L}/>` +
    earL.front + mirror(earR.front) +
    `<ellipse cx="${100 - blushX}" cy="${blushY}" rx="8" ry="5" fill="${BLUSH}" opacity="0.45"/><ellipse cx="${100 + blushX}" cy="${blushY}" rx="8" ry="5" fill="${BLUSH}" opacity="0.45"/>` +
    eyes(a.eyes, head.eye, head.ex) +
    face(a.body, c, head.eye) +
    accessory(a.accessory, head, c) +
    core(a.accessory === 5 ? 154 : 168, c, opts.accuracy === undefined ? 2 : coreLevel(opts.accuracy)) +
    `</svg>`
  );
}

// 瀏覽器用：把 SVG 放進容器。內容全部來自上面的常數表，不含使用者輸入。
export function mountPet(container, a, opts) {
  const t = document.createElement('template');
  t.innerHTML = renderPetSVG(a, opts);
  container.replaceChildren(t.content);
}
