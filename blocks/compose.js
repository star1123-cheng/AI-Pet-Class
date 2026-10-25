// 積木 → 完整提示詞（docs/04 2.、2.1）。不碰 DOM，可以用 node --test 測。
import { CATEGORIES, SKILLS } from './blocks.js';

const ALL = CATEGORIES.flatMap((c) => c.blocks.map((b) => ({ ...b, cat: c.id })));
export const blockById = (id) => ALL.find((b) => b.id === id);

// 一開始選好的積木
export function defaultSelection() {
  return CATEGORIES.flatMap((c) => c.defaults || []);
}

// 點一下積木：單選類別換掉同類別的舊選項，多選類別切換開關
export function toggleBlock(selected, id) {
  const b = blockById(id);
  if (!b) return selected.slice();
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  const cat = CATEGORIES.find((c) => c.id === b.cat);
  const kept = cat.pick === 'one' ? selected.filter((x) => blockById(x)?.cat !== cat.id) : selected.slice();
  return [...kept, id];
}

// 依類別與表格順序排好，去掉不認得或重複的代碼（記錄與比較都用這個）
export function normalize(selected) {
  const set = new Set(selected);
  return ALL.filter((b) => set.has(b.id)).map((b) => b.id);
}

const textsOf = (selected, cat) => normalize(selected).map(blockById).filter((b) => b.cat === cat);

export function missing(selected) {
  return CATEGORIES.filter((c) => c.required && textsOf(selected, c.id).length === 0).map((c) => c.id);
}

// 自己的技能＋夥伴的技能，依技能表順序、不重複
export function mergeSkills(...lists) {
  const set = new Set(lists.flat());
  return SKILLS.filter((s) => set.has(s.id)).map((s) => s.id);
}

// 產出提示詞；「做什麼」沒選時回傳 null
export function compose(selected, skills = []) {
  if (missing(selected).length) return null;
  const join = (cat) => textsOf(selected, cat).map((b) => b.text).join('、');
  const what = join('what');
  const who = textsOf(selected, 'who')[0];
  const theme = textsOf(selected, 'theme')[0];
  const look = [theme ? '主題色用' + theme.text : '', join('look')].filter(Boolean).join('、');
  const lines = [`我要做一個「${what}」${who ? '，' + who.phrase : ''}。`];
  if (join('rules')) lines.push('規則：' + join('rules'));
  if (look) lines.push('外觀：' + look);
  if (join('limits')) lines.push('限制：' + join('limits'));
  const unlocked = new Set(skills);
  for (const s of SKILLS) if (unlocked.has(s.id)) lines.push(s.fragment);
  return lines.join('\n');
}
