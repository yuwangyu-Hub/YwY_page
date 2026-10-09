// 地图编辑器：128×64 瓦片格，每格引用精灵表中的 8×8 瓦片；瓦片从精灵表挑选。
import { setTile, cellIndex, cellOrigin } from '../lib/pixel-data.js';
import { PALETTE } from '../lib/palette.js';
import { el, makeScope, clearNode } from '../core/dom.js';
import { toast } from '../core/toast.js';

const MAPW = 128, MAPH = 64, CELL = 8;
const VIEW_SCALE = 2; // 画布显示 2 倍

export function mount(host, { store }) {
  const scope = makeScope();
  const { map, sprites } = store.project;

  let brush = 1;      // 画笔瓦片（精灵编号）
  let erasing = false;

  const canvas = el('canvas', { width: MAPW * CELL, height: MAPH * CELL });
  canvas.style.width = `${MAPW * CELL * VIEW_SCALE}px`;
  canvas.style.height = `${MAPH * CELL * VIEW_SCALE}px`;
  const ctx = canvas.getContext('2d');

  const picker = el('canvas', { width: 128, height: 128, class: 'tile-picker' });
  picker.style.width = picker.style.height = '256px';
  const pctx = picker.getContext('2d');

  const tileLabel = el('span', { class: 'map-label' });
  const btnErase = el('button', { class: 'btn small' }, '🧽 橡皮');
  const btnClearMap = el('button', { class: 'btn small danger' }, '清空地图');
  scope.listen(btnErase, 'click', () => {
    erasing = !erasing;
    btnErase.classList.toggle('active', erasing);
  });
  scope.listen(btnClearMap, 'click', () => {
    if (!confirm('清空整个地图？')) return;
    map.fill(0);
    render();
    store.touch();
    toast('地图已清空', 'ok');
  });

  const view = el(
    'div',
    { class: 'map-view' },
    el('div', { class: 'map-canvas-wrap' }, canvas),
    el(
      'div',
      { class: 'map-side' },
      el('h3', {}, '瓦片（从精灵表选）'),
      picker,
      tileLabel,
      el('h3', {}, '操作'),
      el('div', { class: 'btn-group' }, btnErase, btnClearMap),
      el('div', { class: 'map-label' }, '左键绘制 / 右键擦除。地图 128×64 格，每格引用一个 8×8 精灵。'),
    ),
  );
  clearNode(host);
  host.append(view);

  // ---------- 渲染 ----------
  function render() {
    ctx.clearRect(0, 0, MAPW * CELL, MAPH * CELL);
    for (let ty = 0; ty < MAPH; ty++) {
      for (let tx = 0; tx < MAPW; tx++) {
        const n = map[ty * MAPW + tx];
        if (n === 0) continue;
        const sx = (n % 16) * CELL, sy = Math.floor(n / 16) * CELL;
        ctx.drawImage(spritesCanvas, sx, sy, CELL, CELL, tx * CELL, ty * CELL, CELL, CELL);
      }
    }
    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= MAPW; x += 2) {
      ctx.beginPath(); ctx.moveTo(x * CELL + .5, 0); ctx.lineTo(x * CELL + .5, MAPH * CELL); ctx.stroke();
    }
    for (let y = 0; y <= MAPH; y += 2) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL + .5); ctx.lineTo(MAPW * CELL, y * CELL + .5); ctx.stroke();
    }
  }

  // 精灵表需要作为 drawImage 源 —— 用一个离屏 canvas
  const spritesCanvas = document.createElement('canvas');
  spritesCanvas.width = spritesCanvas.height = 128;
  const scctx = spritesCanvas.getContext('2d');

  function renderSpritesCanvas() {
    scctx.clearRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const c = sprites[y * 128 + x];
        if (c !== 0) {
          scctx.fillStyle = PALETTE[c];
          scctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  function renderPicker() {
    pctx.fillStyle = '#181820';
    pctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const c = sprites[y * 128 + x];
        if (c !== 0) {
          pctx.fillStyle = PALETTE[c];
          pctx.fillRect(x, y, 1, 1);
        }
      }
    }
    const { x: ox, y: oy } = cellOrigin(brush);
    pctx.strokeStyle = '#fff';
    pctx.strokeRect(ox + .5, oy + .5, 7, 7);
    tileLabel.innerHTML = '';
    tileLabel.append('画笔瓦片: ', el('b', {}, `#${brush}`));
  }

  // ---------- 交互 ----------
  let painting = false;

  function evtToTile(e) {
    const rect = canvas.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - rect.left) / rect.width) * MAPW);
    const ty = Math.floor(((e.clientY - rect.top) / rect.height) * MAPH);
    if (tx < 0 || tx >= MAPW || ty < 0 || ty >= MAPH) return null;
    return { tx, ty };
  }

  function paint(e) {
    const p = evtToTile(e);
    if (!p) return;
    const v = (e.buttons === 2 || erasing) ? 0 : brush;
    if (map[p.ty * MAPW + p.tx] === v) return;
    setTile(map, p.tx, p.ty, v);
    render();
    store.touch();
  }

  scope.listen(canvas, 'pointerdown', (e) => {
    painting = true;
    canvas.setPointerCapture?.(e.pointerId);
    paint(e);
  });
  scope.listen(canvas, 'pointermove', (e) => { if (painting) paint(e); });
  scope.listen(window, 'pointerup', () => { painting = false; });
  scope.listen(canvas, 'contextmenu', (e) => e.preventDefault());

  scope.listen(picker, 'pointerdown', (e) => {
    const rect = picker.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * 128);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * 128);
    if (x < 0 || x > 127 || y < 0 || y > 127) return;
    brush = cellIndex(x, y);
    erasing = false;
    btnErase.classList.remove('active');
    renderPicker();
  });

  // 订阅精灵表变化（像素画里改了精灵，回来要重画）
  const unsub = store.subscribe(() => { renderSpritesCanvas(); render(); renderPicker(); });

  renderSpritesCanvas();
  render();
  renderPicker();

  return {
    unmount() { unsub(); scope.abort(); },
  };
}
