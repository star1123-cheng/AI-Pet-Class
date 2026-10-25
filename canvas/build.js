// Canvas 範本組裝（docs/04 第 3 節）：依已解鎖的作品道具、寵物外型與腦袋，組出貼進 Gemini Canvas 的內容。
// 不碰 DOM，也不讀檔：範本文字由呼叫端傳入（瀏覽器用 fetch、測試用 fs），所以可以用 node --test 測。
import { SKILLS } from '../blocks/blocks.js';
import { renderPetSVG, SPECIES } from '../pet/render.js';
import { pickBrain, brainSize } from '../engine/brain.js';

export const SKILL_IDS = SKILLS.map((s) => s.id);
export const MAX_TEMPLATE_BYTES = 40 * 1024;

// 一鍵複製的第 1 段（固定）
export const GEMINI_INTRO = '以下是一份單檔 HTML 遊戲範本。請依我後面的要求修改，保留 SKILL 區塊標記，只輸出完整可執行的單一 HTML。';
// 保底版（不需要修改的完整頁面）貼上時的說明
export const FALLBACK_INTRO = '以下是一份單檔 HTML 小頁面。請先原樣顯示，不要修改，等我下一句話再改。';

const skillRe = (id) => new RegExp(`\\n?/\\* === SKILL:${id} === \\*/[\\s\\S]*?/\\* === END:${id} === \\*/\\n?`);
const DATA_RE = /\/\* === DATA === \*\/[\s\S]*?\/\* === END:DATA === \*\//;

export function skillBlock(template, id) {
  const m = template.match(skillRe(id));
  return m ? m[0].trim() : null;
}

// 只留下 ids 裡的技能區塊，其他整段拿掉
export function keepSkills(template, ids) {
  const keep = new Set(ids);
  let out = template;
  for (const id of SKILL_IDS) if (!keep.has(id)) out = out.replace(skillRe(id), '\n');
  return out;
}

export function readData(template) {
  const m = template.match(DATA_RE);
  if (!m) return null;
  const json = m[0].replace(/^[\s\S]*?var PET_DATA = /, '').replace(/;\s*\/\* === END:DATA === \*\/$/, '');
  return JSON.parse(json);
}

// 換掉 DATA 區塊。「</」改寫成「<\/」，SVG 放在 <script> 裡才不會提早結束。
// clipPath 的 id 改成依寵物順序編號：兩隻寵物不會撞名，同樣的輸入也永遠產生同樣的檔案
export function setData(template, data) {
  const pets = (data.pets || []).map((p, i) => ({ ...p, svg: String(p.svg || '').replace(/petclip\d+/g, 'petclip' + i) }));
  const json = JSON.stringify({ ...data, pets }).replace(/<\//g, '<\\/');
  return template.replace(DATA_RE, () => `/* === DATA === */\nvar PET_DATA = ${json};\n/* === END:DATA === */`);
}

// 一隻寵物放進範本的樣子
// appearance：外型參數；accuracy：決定 AI 核心亮度；samples：訓練樣本（{label, grid, shape} 或 {label, g, s}）
// brain：已經挑好的腦袋（例如合併夥伴時存下來的），有給就不用 samples
export function canvasPet({ appearance, accuracy, samples, brain: picked, phrase, name, lite = false }) {
  const brain = lite ? null : picked || pickBrain(samples || []);
  return {
    name: name || `AI 寵物（${SPECIES[appearance.body]}）`,
    svg: renderPetSVG(appearance, { size: 130, accuracy, label: name || 'AI 寵物' }),
    brain: brain && brainSize(brain) ? brain : null,
    phrase: phrase || '',
  };
}

// 組出完整 HTML。pets：canvasPet() 的結果（1 或 2 隻）；skills：已解鎖的技能 ID；lite：精簡版（不帶腦袋）
export function buildCanvas(template, { pets, skills = [], lite = false }) {
  const list = pets.slice(0, 2).map((p) => (lite ? { ...p, brain: null } : p));
  return setData(keepSkills(template, skills), { pets: list });
}

// 一鍵複製的完整文字：說明＋範本程式碼＋學生用積木組好的提示詞（docs/04 3.1）
export function buildCopy(template, options, promptText) {
  return [GEMINI_INTRO, '```html\n' + buildCanvas(template, options).trim() + '\n```', promptText || ''].filter(Boolean).join('\n\n');
}

// 保底版的複製內容
export function fallbackCopy(html) {
  return FALLBACK_INTRO + '\n\n```html\n' + html.trim() + '\n```';
}

export const byteLength = (text) => new TextEncoder().encode(text).length;
