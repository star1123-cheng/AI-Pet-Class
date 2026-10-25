// 提示詞紀錄與能量（docs/04 2.、docs/05 prompts_log）。只記積木代碼與次數，不記任何文字。
import { energyFor } from './blocks.js';
import { normalize } from './compose.js';

// pet.prompt：{ used: { 堂次: 已複製次數 }, selected: [積木代碼], partner: { serial, skills, appearance } }
export function promptOf(pet) {
  const p = pet.prompt || {};
  return { used: { ...(p.used || {}) }, selected: p.selected || null, partner: p.partner || null };
}

export function energyLeft(prompt, lesson) {
  return Math.max(0, energyFor(lesson) - (prompt.used[lesson] || 0));
}

// 用掉 1 點能量；沒有能量時回傳 null（不改變 prompt）
export function spendEnergy(prompt, lesson) {
  if (energyLeft(prompt, lesson) <= 0) return null;
  const used = { ...prompt.used, [lesson]: (prompt.used[lesson] || 0) + 1 };
  return { ...prompt, used };
}

// 送給 GAS logPrompt 的內容
export function promptLog(serial, lesson, selected, copyCount) {
  return { serial, lesson, blocks: normalize(selected), copyCount };
}
