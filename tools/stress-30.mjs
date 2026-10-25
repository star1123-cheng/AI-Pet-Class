// 課前壓力測試：模擬 30 位學生「同時」存檔，確認試算表沒有漏資料。
//
// 用法（在專案資料夾執行）：
//   node tools/stress-30.mjs <GAS 網址> <serials.csv>
//
// serials.csv 是試算表選單「匯出序號卡」下載的檔案。會用前 30 組序號領養並存檔，
// 測完請到試算表選單按「清空測試資料…」。
// 只會印出成功／失敗數量，不會印出網址或其他內容。
import { readFileSync } from 'node:fs';

const [url, csvPath] = process.argv.slice(2);
if (!url || !csvPath) {
  console.error('用法：node tools/stress-30.mjs <GAS 網址> <serials.csv>');
  process.exit(1);
}

const serials = readFileSync(csvPath, 'utf8')
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter((s) => /^[A-Z2-9]{6}$/.test(s))
  .slice(0, 30);
if (serials.length < 30) {
  console.error(`serials.csv 只有 ${serials.length} 組序號，需要 30 組`);
  process.exit(1);
}

async function post(body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  return res.json();
}

// 跟前端一樣：busy 或網路錯誤就等一下再試（最多 5 次）
async function withRetry(body) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await post(body);
      if (r.ok || r.error !== 'busy') return r;
    } catch {
      // 網路錯誤，重試
    }
    await new Promise((ok) => setTimeout(ok, 1000 * (i + 1)));
  }
  return { ok: false, error: 'gave_up' };
}

const stamp = Date.now();
console.log('1/3 領養 30 隻（同時送出）…');
let t = Date.now();
const claims = await Promise.all(serials.map((serial) => withRetry({ action: 'claimPet', serial })));
console.log(`   成功 ${claims.filter((r) => r.ok).length}／30，耗時 ${((Date.now() - t) / 1000).toFixed(1)} 秒`);

console.log('2/3 存檔 30 隻（同時送出）…');
t = Date.now();
const saves = await Promise.all(
  serials.map((serial, i) =>
    withRetry({ action: 'savePet', serial, lesson: 1, state: { dataCount: i + 1, dataQuality: 50, trainCount: 1, accuracy: null, classes: ['圓', '方'] }, skills: [], badges: [], updated: stamp }),
  ),
);
console.log(`   成功 ${saves.filter((r) => r.ok).length}／30，耗時 ${((Date.now() - t) / 1000).toFixed(1)} 秒`);

console.log('3/3 讀回來核對…');
let match = 0;
for (const [i, serial] of serials.entries()) {
  const r = await withRetry({ action: 'getPet', serial });
  if (r.ok && r.pet && r.pet.state.dataCount === i + 1 && r.pet.updated === stamp) match++;
}
console.log(`   資料正確 ${match}／30`);
console.log(match === 30 ? '結果：通過' : '結果：不通過，請把以上數字回報給 Claude Code');
