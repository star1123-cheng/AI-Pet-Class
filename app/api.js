// 跟 GAS 溝通。用 text/plain 送 JSON，瀏覽器就不會先送 CORS 預檢（GAS 不支援預檢）。
// 所有寫入都先進 store 的佇列，再由 flush() 一次用 batch 送出；失敗就留著下次再送。

export const BATCH_SIZE = 50;

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
      const items = store.queue().slice(0, BATCH_SIZE);
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
  };
}
