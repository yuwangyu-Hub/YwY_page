// 像素画编辑器：精灵表多页（每页 128×128 = 256 个 8×8 单元，最多 8 页），六工具 + 多色板 + 快照撤销。
import { getPixel, setPixel, floodFill, cellIndex, cellOrigin } from '../lib/pixel-data.js';
import { line as drawLine, rect as drawRect } from '../lib/draw.js';
import { PALETTES, DEFAULT_PALETTE, paletteColors, paletteColorAt } from '../lib/palette.js';
import { normalizePages, addPage as addSpritePage, MAX_PAGES } from '../project/model.js';
import { el, makeScope, clearNode } from '../core/dom.js';
import { toast } from '../core/toast.js';

const CELL = 8;

export function mount(host, { store }) {
  const scope = makeScope();
  normalizePages(store.project); // 旧存档兼容

  const pages = store.project.spritePages;
  let curPage = 0;
  let sprites = pages[curPage]; // 当前页（绘制目标），切页时重绑

  let curCell = 1;          // 当前编辑的精灵编号
  let tool = 'pencil';      // pencil/eraser/pick/fill/line/rect
  let color = 8;            // 当前前景色（索引）
  let zoom = 14;

  // 调色板：项目级设置，只影响渲染映射，不改像素索引数据
  if (!PALETTES[store.project.palette]) store.project.palette = DEFAULT_PALETTE;
  let palKey = store.project.palette;
  let palColors = paletteColors(palKey);

  // 撤销栈：按精灵单元的 64 字节快照
  const undoStack = [];
  const redoStack = [];

  // ---------- DOM ----------
  const editor = el('canvas', { width: CELL * 24, height: CELL * 24 });
  const ectx = editor.getContext('2d');
  const sheet = el('canvas', { width: 128, height: 128, class: 'sheet-preview' });
  sheet.style.width = sheet.style.height = '256px';
  const sctx = sheet.getContext('2d');

  const cellLabel = el('span', { class: 'sprite-label' });

  // ---------- 精灵页导航 ----------
  const pageLabel = el('span', { class: 'sprite-label page-label' });
  const btnPrevPage = el('button', { class: 'btn small', title: '上一页' }, '◀');
  const btnNextPage = el('button', { class: 'btn small', title: '下一页' }, '▶');
  const btnAddPage = el('button', { class: 'btn small', title: '追加一页 256 个空白精灵' }, '➕ 新增页');
  scope.listen(btnPrevPage, 'click', () => gotoPage(curPage - 1));
  scope.listen(btnNextPage, 'click', () => gotoPage(curPage + 1));
  scope.listen(btnAddPage, 'click', () => {
    if (!addSpritePage(store.project)) { toast('已达 8 页上限'); return; }
    gotoPage(store.project.spritePages.length - 1);
    toast('已新增精灵页', 'ok');
  });
  const pageRow = el('div', { class: 'tool-row page-row' }, btnPrevPage, pageLabel, btnNextPage, btnAddPage);

  function updatePageUI() {
    pageLabel.textContent = `页 ${curPage + 1}/${pages.length}`;
    btnPrevPage.disabled = curPage === 0;
    btnNextPage.disabled = curPage >= pages.length - 1;
    btnAddPage.disabled = pages.length >= MAX_PAGES;
  }
  function gotoPage(i) {
    if (i < 0 || i >= pages.length) return;
    curPage = i;
    sprites = pages[curPage];
    undoStack.length = 0; redoStack.length = 0; // 撤销栈按单元快照，不跨页
    updatePageUI();
    render();
    renderSheet();
  }

  const tools = [
    ['pencil', '✏️', '铅笔'], ['eraser', '⌫', '橡皮'], ['pick', '💧', '取色'],
    ['fill', '🪣', '填充'], ['line', '╱', '直线'], ['rect', '▭', '矩形'],
  ];
  const toolBtns = {};
  const toolRow = el('div', { class: 'tool-row' },
    ...tools.map(([id, icon, title]) => {
      const b = el('button', { class: 'tool-btn', title: `${title}（${id}）` }, icon);
      toolBtns[id] = b;
      scope.listen(b, 'click', () => setTool(id));
      return b;
    }),
  );

  const palSelect = el('select', { class: 'palette-select' },
    ...Object.entries(PALETTES).map(([k, p]) => {
      const o = el('option', { value: k }, p.label);
      return o;
    }),
  );
  palSelect.value = palKey;
  scope.listen(palSelect, 'change', () => {
    palKey = palSelect.value;
    store.project.palette = palKey;
    palColors = paletteColors(palKey);
    buildPalette();
    render();
    renderSheet();
    store.touch();
  });

  const paletteEl = el('div', { class: 'palette' });
  function buildPalette() {
    paletteEl.innerHTML = '';
    palColors.forEach((c, i) => {
      const s = el('button', { class: 'swatch', 'data-c': i, style: `background:${c}`, title: `色 ${i}` });
      scope.listen(s, 'click', () => setColor(i));
      paletteEl.append(s);
    });
    if (color >= palColors.length) color = palColors.length - 1;
    setColor(color);
  }

  const btnUndo = el('button', { class: 'btn small' }, '↩ 撤销');
  const btnRedo = el('button', { class: 'btn small' }, '↪ 重做');
  const btnClear = el('button', { class: 'btn small danger' }, '清空本格');
  scope.listen(btnUndo, 'click', undo);
  scope.listen(btnRedo, 'click', redo);
  scope.listen(btnClear, 'click', clearCell);

  const view = el(
    'div',
    { class: 'sprite-view' },
    el(
      'div',
      { class: 'sprite-main' },
      el('div', { class: 'sprite-canvas-wrap' }, editor),
    ),
    el(
      'div',
      { class: 'sprite-side' },
      toolRow,
      palSelect,
      paletteEl,
      cellLabel,
      sheet,
      el('div', { class: 'btn-group' }, btnUndo, btnRedo, btnClear),
      pageRow,
    ),
  );
  clearNode(host);
  host.append(view);

  function setTool(id) {
    tool = id;
    for (const [k, b] of Object.entries(toolBtns)) b.classList.toggle('active', k === id);
  }
  function setColor(i) {
    color = i;
    [...paletteEl.children].forEach((s, j) => s.classList.toggle('active', j === i));
    if (tool === 'eraser' && i !== 0) setTool('pencil');
  }

  // ---------- 缩放自适应 ----------
  function fit() {
    const availW = host.clientWidth - 40;
    const availH = host.clientHeight - (host.clientWidth > 900 ? 120 : 240);
    zoom = Math.max(6, Math.min(Math.floor(availW / CELL), Math.floor(availH / CELL), 24));
    editor.width = CELL * zoom;
    editor.height = CELL * zoom;
    render();
  }
  scope.listen(window, 'resize', fit);

  // ---------- 渲染 ----------
  function render() {
    const { x: ox, y: oy } = cellOrigin(curCell);
    const size = CELL * zoom;

    // 透明棋盘底
    for (let cy = 0; cy < CELL; cy++) {
      for (let cx = 0; cx < CELL; cx++) {
        ectx.fillStyle = (cx + cy) % 2 ? '#2a2a38' : '#232330';
        ectx.fillRect(cx * zoom, cy * zoom, zoom, zoom);
      }
    }
    // 像素
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const c = getPixel(sprites, ox + x, oy + y);
        if (c !== 0) {
          ectx.fillStyle = paletteColorAt(palKey, c);
          ectx.fillRect(x * zoom, y * zoom, zoom, zoom);
        }
      }
    }
    // 网格
    ectx.strokeStyle = 'rgba(255,255,255,.08)';
    ectx.lineWidth = 1;
    for (let i = 1; i < CELL; i++) {
      ectx.beginPath();
      ectx.moveTo(i * zoom + .5, 0); ectx.lineTo(i * zoom + .5, size);
      ectx.moveTo(0, i * zoom + .5); ectx.lineTo(size, i * zoom + .5);
      ectx.stroke();
    }
    ectx.strokeStyle = 'rgba(255,255,255,.25)';
    ectx.strokeRect(.5, .5, size - 1, size - 1);

    cellLabel.innerHTML = '';
    cellLabel.append('当前精灵 #', el('b', {}, String(curCell)), `　（像素 ${ox},${oy} 起）`);
  }

  function renderSheet() {
    sctx.fillStyle = '#181820';
    sctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const c = sprites[y * 128 + x];
        if (c !== 0) {
          sctx.fillStyle = paletteColorAt(palKey, c);
          sctx.fillRect(x, y, 1, 1);
        }
      }
    }
    // 当前单元高亮框
    const { x: ox, y: oy } = cellOrigin(curCell);
    sctx.strokeStyle = '#fff';
    sctx.lineWidth = 1;
    sctx.strokeRect(ox + .5, oy + .5, 7, 7);
  }

  // ---------- 撤销 ----------
  function snapshot() {
    const { x: ox, y: oy } = cellOrigin(curCell);
    const snap = new Uint8Array(64);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) snap[y * 8 + x] = getPixel(sprites, ox + x, oy + y);
    undoStack.push({ cell: curCell, snap });
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
  }

  function restore(entry) {
    const { x: ox, y: oy } = cellOrigin(entry.cell);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        setPixel(sprites, ox + x, oy + y, entry.snap[y * 8 + x]);
      }
    }
    render(); renderSheet();
    store.touch();
  }

  function undo() {
    const e = undoStack.pop();
    if (!e) { toast('没有可撤销的操作'); return; }
    redoStack.push({ cell: e.cell, snap: Uint8Array.from(currentSnap(e.cell)) });
    restore(e);
  }
  function redo() {
    const e = redoStack.pop();
    if (!e) { toast('没有可重做的操作'); return; }
    undoStack.push({ cell: e.cell, snap: Uint8Array.from(currentSnap(e.cell)) });
    restore(e);
  }
  function currentSnap(cell) {
    const { x: ox, y: oy } = cellOrigin(cell);
    const snap = new Uint8Array(64);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) snap[y * 8 + x] = getPixel(sprites, ox + x, oy + y);
    return snap;
  }
  function clearCell() {
    snapshot();
    const { x: ox, y: oy } = cellOrigin(curCell);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) setPixel(sprites, ox + x, oy + y, 0);
    render(); renderSheet();
    store.touch();
  }

  // ---------- 交互 ----------
  let dragging = false;
  let startPt = null;   // line/rect 预览起点 {x,y}（单元内坐标）
  let previewPts = [];

  function evtToCell(e) {
    const rect = editor.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * CELL);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * CELL);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return { x, y };
  }

  function applyPixel(cx, cy, c) {
    const { x: ox, y: oy } = cellOrigin(curCell);
    if (getPixel(sprites, ox + cx, oy + cy) === c) return;
    setPixel(sprites, ox + cx, oy + cy, c);
  }

  function renderPreview(pts) {
    render();
    const c = tool === 'eraser' ? 0 : color;
    const { x: ox, y: oy } = cellOrigin(curCell);
    ectx.fillStyle = paletteColorAt(palKey, c);
    for (const { x, y } of pts) ectx.fillRect(x * zoom, y * zoom, zoom, zoom);
    void ox; void oy;
  }

  function onDown(e) {
    const p = evtToCell(e);
    if (!p) return;
    if (tool === 'pick') {
      const { x: ox, y: oy } = cellOrigin(curCell);
      setColor(getPixel(sprites, ox + p.x, oy + p.y));
      return;
    }
    dragging = true;
    startPt = p;
    if (tool === 'pencil' || tool === 'eraser') {
      snapshot();
      applyPixel(p.x, p.y, tool === 'eraser' ? 0 : color);
      render(); renderSheet(); store.touch();
    } else if (tool === 'fill') {
      snapshot();
      const { x: ox, y: oy } = cellOrigin(curCell);
      floodFill(sprites, ox + p.x, oy + p.y, color, { x: ox, y: oy, w: 8, h: 8 });
      render(); renderSheet(); store.touch();
    } else if (tool === 'line' || tool === 'rect') {
      previewPts = [p];
    }
  }

  function onMove(e) {
    if (!dragging) return;
    const p = evtToCell(e);
    if (!p) return;
    if (tool === 'pencil' || tool === 'eraser') {
      applyPixel(p.x, p.y, tool === 'eraser' ? 0 : color);
      render(); renderSheet(); store.touch();
    } else if (tool === 'line') {
      previewPts = [];
      drawLine(startPt.x, startPt.y, p.x, p.y, (x, y) => {
        if (x >= 0 && x < 8 && y >= 0 && y < 8) previewPts.push({ x, y });
      });
      renderPreview(previewPts);
    } else if (tool === 'rect') {
      previewPts = [];
      drawRect(startPt.x, startPt.y, p.x, p.y, (x, y) => {
        if (x >= 0 && x < 8 && y >= 0 && y < 8) previewPts.push({ x, y });
      });
      renderPreview(previewPts);
    }
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    if (tool === 'line' || tool === 'rect') {
      snapshot();
      const c = tool === 'eraser' ? 0 : color;
      const { x: ox, y: oy } = cellOrigin(curCell);
      for (const { x, y } of previewPts) setPixel(sprites, ox + x, oy + y, c);
      previewPts = [];
      render(); renderSheet(); store.touch();
    }
  }

  scope.listen(editor, 'pointerdown', onDown);
  scope.listen(editor, 'pointermove', onMove);
  scope.listen(window, 'pointerup', onUp);

  scope.listen(sheet, 'pointerdown', (e) => {
    const rect = sheet.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * 128);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * 128);
    if (x < 0 || x > 127 || y < 0 || y > 127) return;
    curCell = cellIndex(x, y);
    undoStack.length = 0; redoStack.length = 0;
    render(); renderSheet();
  });

  // 右键 = 取色
  scope.listen(editor, 'contextmenu', (e) => {
    e.preventDefault();
    const p = evtToCell(e);
    if (!p) return;
    const { x: ox, y: oy } = cellOrigin(curCell);
    setColor(getPixel(sprites, ox + p.x, oy + p.y));
  });

  setTool('pencil');
  buildPalette();
  updatePageUI();
  fit();
  renderSheet();

  return {
    unmount() { scope.abort(); },
  };
}
