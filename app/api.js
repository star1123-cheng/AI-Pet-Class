// 跟 GAS 溝通。用 text/plain 送 JSON，瀏覽器就不會先送 CORS 預檢（GAS 不支援預檢）。
// 所有寫入都先進 store 的佇列，再由 flush() 一次用 batch 送出；失敗就留著下次再送。

export const BATCH_SIZE = 50;
// GAS 一次請求最多收 20,000 字（docs/05 第 4 節），留一點空間給外層欄位
export const BATCH_CHARS = 18000;
export const SAMPLES_PER_CALL = 20;

// 從佇列前面拿出一批：最多 BATCH_SIZE 筆，而且合起來不超過 BATCH_CHARS 字（範例圖比較大）
export function nextBatch(queue, size = BATCH_SIZE, chars = BATCH_CHARS) {
  const out = [];
  let used = 0;
  for (const item of queue) {
    const n = JSON.stringify(item).length + 1;
    if (out.length >= size || (out.length && used + n > chars)) break;
    out.push(item);
    used += n;
  }
  return out;
}

// 這些錯誤重送也不會成功，直接移出佇列
export const PERMANENT_ERRORS = new Set(['bad_request', 'bad_serial', 'unknown_serial', 'not_claimed']);

export function createApi({ url, store, fetchFn = globalThis.fetch, timeoutMs = 8000, onRejected } = {}) {
  let flushing = null;

  async function call(action, payload = {}) {
    if (!url) throw new Error('offline');
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, action }),
        signal: ctrl?.signal,
        redirect: 'follow',
      });
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // 把佇列送出去；同時間只跑一次。回傳 { sent, left }
  function flush() {
    if (!flushing) {
      flushing = doFlush().finally(() => {
        flushing = null;
      });
    }
    return flushing;
  }

  async function doFlush() {
    let sent = 0;
    while (url) {
      const items = nextBatch(store.queue());
      if (!items.length) break;
      let res;
      try {
        res = await call('batch', { items });
      } catch {
        break; // 沒網路或逾時：留著下次再送
      }
      if (!res?.ok || !Array.isArray(res.results)) break;
      const done = [];
      for (const r of res.results) {
        if (r.ok) done.push(r.eid);
        else if (PERMANENT_ERRORS.has(r.error)) {
          done.push(r.eid);
          const item = items.find((x) => x.eid === r.eid);
          if (item) onRejected?.(item, r.error);
        }
      }
      store.removeFromQueue(done);
      sent += done.length;
      if (done.length < items.length) break; // 有暫時失敗（例如 busy），等下次
    }
    return { sent, left: store.queue().length };
  }

  return {
    call,
    flush,
    // 領養：有網路就馬上問 GAS（序號存不存在、有沒有舊資料）；沒網路就排隊，回傳 null
    async claim(serial) {
      try {
        return await call('claimPet', { serial });
      } catch {
        store.enqueue('claimPet', { serial });
        return null;
      }
    },
    savePet(pet) {
      const { serial, lesson, state, skills, badges, updated } = pet;
      store.enqueue('savePet', { serial, lesson, state, skills, badges, updated });
      return flush();
    },
    logEvent(serial, lesson, type, code, value = '') {
      store.enqueue('logEvent', { serial, lesson, type, code, value });
      return flush();
    },
    // 回到寵物畫面時問一下目前堂次與雲端存檔；沒網路回傳 null
    async getPet(serial) {
      try {
        return await call('getPet', { serial });
      } catch {
        return null;
      }
    },
    // 複製提示詞的紀錄（只有積木代碼與次數）
    logPrompt({ serial, lesson, blocks, copyCount }) {
      store.enqueue('logPrompt', { serial, lesson, blocks, copyCount });
      return flush();
    },
    // 訓練範例（{idx, label, g, s, flagged}），一次最多 20 張，多的分成好幾筆排隊
    saveSamples(serial, samples) {
      for (let i = 0; i < samples.length; i += SAMPLES_PER_CALL) {
        store.enqueue('saveSamples', { serial, samples: samples.slice(i, i + SAMPLES_PER_CALL) });
      }
      return flush();
    },
    // 前後測：answers [{q, choice}]，只有選項代碼
    submitQuiz(serial, form, answers) {
      store.enqueue('submitQuiz', { serial, form, answers });
      return flush();
    },
    // 合併夥伴：要有網路；沒網路回傳 null
    async getBrain(serial) {
      try {
        return await call('getBrain', { serial });
      } catch {
        return null;
      }
    },
  };
}
