// 手指畫布：把 engine/stroke.js 接到 <canvas>。大小跟著 CSS 走，旋轉螢幕時重畫已經畫的線。
import { CANVAS_SIZE, LINE_WIDTH, createStrokeRecorder, attachPointer } from '../engine/stroke.js';
import { h } from './dom.js';

export function createPad({ onChange } = {}) {
  const canvas = h('canvas', { class: 'pad', 'aria-label': '畫布：用手指畫一個圖形' });
  const ctx = canvas.getContext('2d');
  const recorder = createStrokeRecorder();
  let scale = 1;

  function pen() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e2140';
    ctx.fillStyle = '#1e2140';
  }

  function dot(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, LINE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function redraw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pen();
    for (const pts of recorder.strokes) {
      if (pts.length === 1) {
        dot(pts[0]);
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  // 畫布實際像素＝CSS 大小×螢幕倍率，線才不會糊
  function fit() {
    const css = canvas.getBoundingClientRect().width;
    if (!css) return;
    const px = Math.round(css * (window.devicePixelRatio || 1));
    if (canvas.width === px) return;
    canvas.width = canvas.height = px;
    scale = px / CANVAS_SIZE;
    redraw();
  }
  new ResizeObserver(fit).observe(canvas);

  // 只補畫新線段，連畫很多筆也不會卡
  attachPointer(canvas, recorder, {
    onSegment(a, b) {
      pen();
      if (a === b) return dot(a);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    },
    onChange() {
      if (!recorder.drawing) {
        redraw();
        onChange?.();
      }
    },
  });

  return {
    el: canvas,
    get strokes() {
      return recorder.strokes;
    },
    isEmpty: () => recorder.isEmpty(),
    undo() {
      recorder.undo();
      redraw();
      onChange?.();
    },
    clear() {
      recorder.clear();
      redraw();
      onChange?.();
    },
  };
}
