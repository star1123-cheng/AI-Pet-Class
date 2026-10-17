// 筆畫蒐集：把手指的 Pointer Events 轉成「筆畫＝點的陣列」。
// 核心 createStrokeRecorder() 不碰 DOM，可以用 node --test 測；
// attachPointer() 才負責綁定畫布事件。

export const CANVAS_SIZE = 320; // 邏輯像素（畫布一律換算成 320×320）
export const LINE_WIDTH = 14;

const DEFAULTS = {
  size: CANVAS_SIZE,
  minDistance: 1.5, // 兩點距離小於這個值就不記，減少點數讓連畫不卡
  palmSize: 60, // 觸控接觸面（CSS px）大於這個值視為手掌
  maxStrokes: 40,
};

// 把螢幕座標換算成 0–size 的邏輯座標，並夾在畫布範圍內
export function toLogical(clientX, clientY, rect, size = CANVAS_SIZE) {
  const x = ((clientX - rect.left) / rect.width) * size;
  const y = ((clientY - rect.top) / rect.height) * size;
  return { x: clamp(x, 0, size), y: clamp(y, 0, size) };
}

// 判斷這次觸控是不是手掌：只有瀏覽器有回報接觸面大小時才判斷
export function isPalm(contact, palmSize = DEFAULTS.palmSize) {
  if (!contact) return false;
  const w = contact.width || 0;
  const h = contact.height || 0;
  return Math.max(w, h) > palmSize;
}

export function createStrokeRecorder(options = {}) {
  const opt = { ...DEFAULTS, ...options };
  const strokes = [];
  let active = null; // { id, points }

  function down(id, x, y, contact) {
    // 一次只畫一筆：第二根手指或手掌一律忽略
    if (active) return false;
    if (isPalm(contact, opt.palmSize)) return false;
    if (strokes.length >= opt.maxStrokes) return false;
    active = { id, points: [{ x, y }] };
    strokes.push(active.points);
    return true;
  }

  // 回傳新增的線段 [前一點, 新點]，讓畫面只補畫這一小段
  function move(id, x, y, contact) {
    if (!active || active.id !== id) return null;
    if (isPalm(contact, opt.palmSize)) {
      // 畫到一半才發現是手掌：整筆作廢
      cancel(id);
      return null;
    }
    const pts = active.points;
    const last = pts[pts.length - 1];
    if (Math.hypot(x - last.x, y - last.y) < opt.minDistance) return null;
    const p = { x, y };
    pts.push(p);
    return [last, p];
  }

  function up(id) {
    if (!active || active.id !== id) return false;
    active = null;
    return true;
  }

  function cancel(id) {
    if (!active || (id !== undefined && active.id !== id)) return false;
    const i = strokes.indexOf(active.points);
    if (i >= 0) strokes.splice(i, 1);
    active = null;
    return true;
  }

  function undo() {
    if (active) return false;
    return strokes.pop() !== undefined;
  }

  function clear() {
    strokes.length = 0;
    active = null;
  }

  return {
    down,
    move,
    up,
    cancel,
    undo,
    clear,
    get strokes() {
      return strokes;
    },
    get drawing() {
      return active !== null;
    },
    isEmpty() {
      return strokes.length === 0;
    },
  };
}

// 綁定畫布事件（只在瀏覽器使用）
// callbacks.onSegment(a, b)：有新線段時呼叫；callbacks.onChange()：筆畫增減時呼叫
export function attachPointer(el, recorder, callbacks = {}) {
  const size = CANVAS_SIZE;
  const contactOf = (e) =>
    e.pointerType === 'touch' ? { width: e.width, height: e.height } : null;

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const r = el.getBoundingClientRect();
    const p = toLogical(e.clientX, e.clientY, r, size);
    if (!recorder.down(e.pointerId, p.x, p.y, contactOf(e))) return;
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // 某些瀏覽器在指標已離開時會丟錯，忽略即可
    }
    callbacks.onSegment?.(p, p);
    callbacks.onChange?.();
  }

  function onMove(e) {
    if (!recorder.drawing) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    // getCoalescedEvents 可以拿到兩個畫面之間的所有點，線條比較順
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    const events = list.length ? list : [e];
    for (const ev of events) {
      const p = toLogical(ev.clientX, ev.clientY, r, size);
      const seg = recorder.move(e.pointerId, p.x, p.y, contactOf(e));
      if (seg) callbacks.onSegment?.(seg[0], seg[1]);
      else if (!recorder.drawing) {
        callbacks.onChange?.(); // 被判定為手掌、整筆作廢
        return;
      }
    }
  }

  function onUp(e) {
    if (recorder.up(e.pointerId)) callbacks.onChange?.();
  }

  function onCancel(e) {
    if (recorder.cancel(e.pointerId)) callbacks.onChange?.();
  }

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  // 雙保險：iOS Safari 有時仍會用 touch 事件捲動或縮放
  const stop = (e) => e.preventDefault();
  el.addEventListener('touchstart', stop, { passive: false });
  el.addEventListener('touchmove', stop, { passive: false });

  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onCancel);
    el.removeEventListener('touchstart', stop);
    el.removeEventListener('touchmove', stop);
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
