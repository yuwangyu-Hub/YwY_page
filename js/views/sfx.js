// 音效编辑器：8 个槽位 × 16 步 tracker 网格，波形 5 种、音量 8 级，即时试播。
import { el, makeScope, clearNode } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { createSfxSlots, createBlankSfx, SFX_COUNT, WAVE_NAMES } from '../lib/sfx-data.js';
import { playSfx, stopMusic } from '../audio/engine.js';
import { createStepGrid } from '../ui/stepgrid.js';

export function mount(host, { store }) {
  const scope = makeScope();

  // 槽位归一化：首次进入（无 sfx）或槽位不足（如 demo 只带 2 个）都补齐到 8 个
  if (!Array.isArray(store.project.sfx) || store.project.sfx.length < SFX_COUNT) {
    const slots = createSfxSlots();
    (store.project.sfx || []).forEach((s, i) => { if (i < SFX_COUNT && s) slots[i] = s; });
    store.project.sfx = slots;
    store.touch();
  }

  let cur = 0;

  // ---------- DOM ----------
  const slotBtns = [];
  const slotRow = el('div', { class: 'slot-row' },
    ...store.project.sfx.map((_, i) => {
      const b = el('button', { class: 'btn small slot-btn', title: `音效 ${i}（点击编辑 / 双击试播）` }, String(i));
      slotBtns.push(b);
      scope.listen(b, 'click', () => select(i));
      scope.listen(b, 'dblclick', () => { select(i); preview(); });
      return b;
    }),
  );

  const speedLabel = el('span', { class: 'hint' });
  const speed = el('input', { type: 'range', min: '60', max: '240', value: '120', class: 'speed-slider' });
  scope.listen(speed, 'input', () => {
    curSfx().speed = +speed.value;
    speedLabel.textContent = `${speed.value}ms/步`;
    store.touch();
  });

  const btnPlay = el('button', { class: 'btn primary' }, '▶ 试播');
  const btnStop = el('button', { class: 'btn' }, '■ 停止乐曲');
  const btnClear = el('button', { class: 'btn small danger' }, '清空本音效');
  scope.listen(btnPlay, 'click', preview);
  scope.listen(btnStop, 'click', () => stopMusic());
  scope.listen(btnClear, 'click', () => {
    if (!confirm(`清空音效 ${cur}？`)) return;
    store.project.sfx[cur] = createBlankSfx(+speed.value);
    grid.render();
    store.touch();
    toast(`音效 ${cur} 已清空`, 'ok');
  });

  const info = el('div', { class: 'hint', id: 'sfx-info' });

  const grid = createStepGrid({
    getSteps: () => store.project.sfx[cur].steps,
    onEdit: (immediate) => { updateInfo(); store.touch(immediate); },
    onCommit: () => store.touch(),
  });

  const view = el(
    'div',
    { class: 'sfx-view audio-view' },
    el('div', { class: 'audio-side' },
      el('h3', {}, '音效槽位'),
      slotRow,
      el('h3', {}, '速度'),
      el('div', { class: 'speed-row' }, speed, speedLabel),
      el('h3', {}, '操作'),
      el('div', { class: 'btn-group' }, btnPlay, btnStop, btnClear),
      el('div', { class: 'hint' },
        '点格子写音符（再点一下切休止）· 拖动连续画 · 波形行点选换音色 · 音量行点选调大小'),
    ),
    el('div', { class: 'audio-main' },
      el('h3', {}, '步进编辑'),
      grid.el,
      info,
    ),
  );
  clearNode(host);
  host.append(view);

  // ---------- 逻辑 ----------
  function curSfx() { return store.project.sfx[cur]; }

  function select(i) {
    cur = i;
    slotBtns.forEach((b, j) => b.classList.toggle('active', j === i));
    speed.value = curSfx().speed || 120;
    speedLabel.textContent = `${speed.value}ms/步`;
    grid.render();
    updateInfo();
  }

  function preview() {
    playSfx(curSfx());
    toast(`▶ 播放音效 ${cur}`, 'ok');
  }

  function updateInfo() {
    const notes = curSfx().steps.filter((s) => s.p >= 0).length;
    info.textContent = `音效 ${cur} · ${notes}/${16} 步有音符 · 波形可用：${WAVE_NAMES.join(' ')}`;
  }

  select(0);

  return { unmount() { scope.abort(); } };
}
