// 共享 tracker 步进网格（canvas）：16 步 × 24 音高行 + 波形行 + 音量行。
// 交互：点音高格 = 写入/切休止；拖动连续画；点波形格循环波形；点音量格循环 0-8。
// 纯渲染 + 命中回调，数据读写交给调用方。

import { PITCH_ROWS, STEPS, WAVE_COLORS } from '../lib/sfx-data.js';
import { el, makeScope } from '../core/dom.js';

const CELL_W = 22, CELL_H = 14, LABEL_W = 34;
const ROWS = PITCH_ROWS + 2; // + 波形行 + 音量行

export function createStepGrid({ getSteps, onEdit, onCommit }) {
  const scope = makeScope();
  const w = LABEL_W + STEPS * CELL_W;
  const h = ROWS * CELL_H;
  const canvas = el('canvas', { width: w, height: h, class: 'step-grid' });
  const ctx = canvas.getContext('2d');

  // 行号(0=顶部) ↔ 音高：顶部是最高音
  const pitchOfRow = (r) => PITCH_ROWS - 1 - r;

  function render() {
    const steps = getSteps();
    ctx.clearRect(0, 0, w, h);
    ctx.textBaseline = 'middle';
    ctx.font = '9px ' + getComputedStyle(document.documentElement).getPropertyValue('--font-mono');

    for (let r = 0; r < ROWS; r++) {
      const y = r * CELL_H;
      if (r < PITCH_ROWS) {
        const p = pitchOfRow(r);
        const inScale = [0, 2, 4, 5, 7, 9, 11].includes(p % 12);
        // 音名标签
        if (p % 12 === 0) {
          ctx.fillStyle = '#8a8aa8';
          ctx.fillText(['C3', 'C4'][Math.floor(p / 12) - 0] || 'C' + (3 + Math.floor(p / 12)), 2, y + CELL_H / 2);
        }
        for (let c = 0; c < STEPS; c++) {
          const x = LABEL_W + c * CELL_W;
          ctx.fillStyle = (c % 4 === 3) ? (inScale ? '#232331' : '#1c1c28')
                        : inScale ? '#20202e' : '#1a1a26';
          ctx.fillRect(x, y, CELL_W - 1, CELL_H - 1);
          const s = steps[c];
          if (s && s.p === p) {
            ctx.fillStyle = WAVE_COLORS[s.w] || '#fff';
            ctx.fillRect(x + 1, y + 2, CELL_W - 3, CELL_H - 5);
          }
        }
      } else {
        // 波形行 / 音量行
        const isWave = r === PITCH_ROWS;
        ctx.fillStyle = '#15151f';
        ctx.fillRect(0, y, w, CELL_H);
        for (let c = 0; c < STEPS; c++) {
          const x = LABEL_W + c * CELL_W;
          const s = steps[c];
          if (isWave) {
            ctx.fillStyle = (s && s.p >= 0) ? WAVE_COLORS[s.w] + '66' : '#232330';
          } else {
            const v = (s && s.v) || 0;
            ctx.fillStyle = v > 0 ? `rgba(102, 126, 234, ${0.15 + (v / 8) * 0.85})` : '#232330';
          }
          ctx.fillRect(x, y + 1, CELL_W - 1, CELL_H - 3);
        }
      }
    }
    // 分隔线
    ctx.fillStyle = '#3a3a52';
    ctx.fillRect(0, PITCH_ROWS * CELL_H - 1, w, 1);
    ctx.fillRect(0, (PITCH_ROWS + 1) * CELL_H - 1, w, 1);
  }

  function hit(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const y = ((e.clientY - rect.top) / rect.height) * h;
    const col = Math.floor((x - LABEL_W) / CELL_W);
    const row = Math.floor(y / CELL_H);
    if (col < 0 || col >= STEPS || row < 0 || row >= ROWS) return null;
    return { col, row };
  }

  function editAt(col, row, drag) {
    const steps = getSteps();
    const s = steps[col];
    if (!s) return;
    if (row < PITCH_ROWS) {
      const p = pitchOfRow(row);
      if (!drag && s.p === p) { s.p = -1; s.v = 0; }        // 单击同音高 = 切休止
      else { s.p = p; if (s.v === 0) s.v = 5; }
      onEdit();
    } else if (!drag) {
      if (row === PITCH_ROWS) s.w = (s.w + 1) % 5;
      else s.v = ((s.v || 0) + 1) % 9;
      onEdit(true); // 波形/音量改动即时生效，不需要重新触发试播
    }
    render();
  }

  let down = false;
  scope.listen(canvas, 'pointerdown', (e) => {
    const c = hit(e);
    if (!c) return;
    down = true;
    canvas.setPointerCapture?.(e.pointerId);
    editAt(c.col, c.row, false);
  });
  scope.listen(canvas, 'pointermove', (e) => {
    if (!down) return;
    const c = hit(e);
    if (c) editAt(c.col, c.row, true); // 拖动只画音高
  });
  scope.listen(window, 'pointerup', () => {
    if (down) { down = false; onCommit?.(); }
  });

  render();
  return { el: canvas, render, destroy: () => scope.abort() };
}
