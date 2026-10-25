// 本機狀態＋待補送佇列（localStorage）。不碰 DOM，可以用 node --test 測。
// offline-first：所有變更先存在本機，再排進佇列，由 api.js 有網路時補送給 GAS。
//
// 存放的鍵：
//   aipet.serial        這台 iPad 目前記住的序號（按「換人」會清掉）
//   aipet.pet.<序號>    該序號的寵物狀態（換人後保留，同一人回來可接續）
//   aipet.queue         待補送的請求 [{ eid, action, payload }]

export const KEYS = {
  serial: 'aipet.serial',
  queue: 'aipet.queue',
  pet: (serial) => 'aipet.pet.' + serial,
};

// 佇列上限：離線太久時先丟最舊的事件紀錄，寵物狀態不丟
export const QUEUE_LIMIT = 500;

export const CLASSES_BY_LESSON = { 1: ['圓', '方'], 2: ['圓', '方', '三角'], 3: ['圓', '方', '三角'] };

export function classesFor(lesson) {
  return CLASSES_BY_LESSON[lesson] || ['圓', '方', '三角', '叉叉'];
}

export function newPet(serial, appearance, lesson = 1) {
  return {
    serial,
    appearance,
    lesson,
    state: { dataCount: 0, dataQuality: 0, trainCount: 0, accuracy: null, classes: classesFor(lesson) },
    skills: [],
    badges: [],
    updated: 0,
    rejected: false, // GAS 回報「序號不存在」時設為 true，畫面提醒去問老師
  };
}

export function newEid(now = Date.now(), random = Math.random) {
  return now.toString(36) + '-' + Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0');
}

// 私密模式或空間滿時 localStorage 會丟錯，改用記憶體（重新整理後就不見，但遊戲照常）
export function safeStorage(storage = globalThis.localStorage) {
  const memory = new Map();
  let usable = !!storage;
  return {
    get persistent() {
      return usable;
    },
    getItem(k) {
      if (usable) {
        try {
          return storage.getItem(k);
        } catch {
          usable = false;
        }
      }
      return memory.has(k) ? memory.get(k) : null;
    },
    setItem(k, v) {
      memory.set(k, v);
      if (!usable) return;
      try {
        storage.setItem(k, v);
      } catch {
        usable = false;
      }
    },
    removeItem(k) {
      memory.delete(k);
      if (!usable) return;
      try {
        storage.removeItem(k);
      } catch {
        usable = false;
      }
    },
  };
}

export function createStore(storage = safeStorage(), { now = Date.now, random = Math.random } = {}) {
  const read = (k, fallback) => {
    try {
      const v = storage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (k, v) => storage.setItem(k, JSON.stringify(v));

  return {
    getSerial: () => storage.getItem(KEYS.serial),
    setSerial: (serial) => storage.setItem(KEYS.serial, serial),
    // 換人：只忘記序號，寵物資料和待補送的請求都留著
    forgetSerial: () => storage.removeItem(KEYS.serial),

    loadPet: (serial) => read(KEYS.pet(serial), null),
    savePet(pet) {
      write(KEYS.pet(pet.serial), pet);
      return pet;
    },

    queue: () => read(KEYS.queue, []),

    // 同一個序號的 savePet 只留最新一筆（狀態是整包覆蓋，舊的送了也沒用）
    enqueue(action, payload) {
      let q = read(KEYS.queue, []);
      if (action === 'savePet') q = q.filter((x) => !(x.action === 'savePet' && x.payload.serial === payload.serial));
      const item = { eid: newEid(now(), random), action, payload };
      q.push(item);
      while (q.length > QUEUE_LIMIT) {
        const i = q.findIndex((x) => x.action === 'logEvent');
        q.splice(i < 0 ? 0 : i, 1);
      }
      write(KEYS.queue, q);
      return item;
    },

    removeFromQueue(eids) {
      const drop = new Set(eids);
      write(KEYS.queue, read(KEYS.queue, []).filter((x) => !drop.has(x.eid)));
    },
  };
}
