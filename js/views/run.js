// 运行视图：128×128 逻辑画布、键盘 + 移动端虚拟按键、启动/停止、错误控制台。
import { startRuntime } from '../../runtime/loop.js';
import { el, makeScope, clearNode } from '../core/dom.js';
import { toast } from '../core/toast.js';

// PICO-8 键位：0← 1→ 2↑ 3↓ 4○(Z/C) 5✕(X/V)
const KEYMAP = {
  ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3,
  KeyZ: 4, KeyC: 4, KeyX: 5, KeyV: 5,
};

export function mount(host, params) {
  const { store, tabs, runNow: autoRun } = params;
  const scope = makeScope();
  const keys = [false, false, false, false, false, false];

  // 画布尺寸：整数倍缩放，适配可用空间
  const stage = el('div', { class: 'run-stage' });
  const canvas = el('canvas', { width: 128, height: 128 });
  const overlay = el('canvas', { width: 128, height: 128 });
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
  stage.append(canvas, overlay);

  function fitCanvas() {
    const availW = Math.min(host.clientWidth - 32, 640);
    const availH = host.clientHeight - 170;
    const scale = Math.max(1, Math.min(Math.floor(availW / 128), Math.floor(Math.max(availH, 128) / 128), 5));
    canvas.style.width = overlay.style.width = `${128 * scale}px`;
    canvas.style.height = overlay.style.height = `${128 * scale}px`;
  }

  const consoleEl = el('div', { class: 'run-console' }, '点击「运行」启动游戏（或从代码页按 Ctrl/Cmd+Enter）');

  const btnRun = el('button', { class: 'btn primary' }, '▶ 运行');
  const btnStop = el('button', { class: 'btn', disabled: '' }, '■ 停止');

  const vpad = buildVpad(keys);

  const view = el(
    'div',
    { class: 'run-view' },
    el('div', { class: 'btn-group' }, btnRun, btnStop),
    stage,
    consoleEl,
    vpad,
  );
  clearNode(host);
  host.append(view);
  fitCanvas();
  scope.listen(window, 'resize', fitCanvas);

  // ---------- 键盘 ----------
  scope.listen(window, 'keydown', (e) => {
    const b = KEYMAP[e.code];
    if (b !== undefined) {
      keys[b] = true;
      if (e.code.startsWith('Arrow')) e.preventDefault();
    }
  });
  scope.listen(window, 'keyup', (e) => {
    const b = KEYMAP[e.code];
    if (b !== undefined) keys[b] = false;
  });

  // ---------- 运行控制 ----------
  let runtime = null;

  function setRunning(on) {
    btnRun.disabled = on;
    btnStop.disabled = !on;
  }

  async function run() {
    if (runtime) runtime.stop();
    consoleEl.className = 'run-console';
    consoleEl.textContent = '启动中…';
    for (let i = 0; i < 6; i++) keys[i] = false;
    try {
      runtime = await startRuntime({
        project: store.project,
        canvas,
        overlay,
        keys,
        onError: (msg) => {
          consoleEl.className = 'run-console error';
          consoleEl.textContent = '⛔ ' + msg;
        },
        onStatus: (msg) => {
          if (msg === '运行中') {
            consoleEl.className = 'run-console ok';
            consoleEl.textContent = '✓ 运行中（30fps · 单帧指令预算 ' + '5M）';
          } else {
            consoleEl.textContent = msg;
          }
        },
      });
      setRunning(true);
    } catch (e) {
      consoleEl.className = 'run-console error';
      consoleEl.textContent = '⛔ ' + (e.message || e);
      toast('运行失败', 'error');
    }
  }

  function stop() {
    runtime?.stop();
    runtime = null;
    setRunning(false);
    consoleEl.className = 'run-console';
    consoleEl.textContent = '已停止。点「运行」重新启动。';
  }

  scope.listen(btnRun, 'click', run);
  scope.listen(btnStop, 'click', stop);

  if (autoRun) setTimeout(run, 60); // 从代码页 Ctrl+Enter 跳过来时自动启动

  return {
    api: { rerun: run },
    unmount() {
      stop();
      scope.abort();
    },
  };
}

function buildVpad(keys) {
  const mk = (label, idx) => {
    const b = el('button', {}, label);
    const on = (e) => { e.preventDefault(); keys[idx] = true; };
    const off = (e) => { e.preventDefault(); keys[idx] = false; };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
    return b;
  };
  return el(
    'div',
    { class: 'vpad' },
    el(
      'div',
      { class: 'dpad' },
      mk('↑', 2), mk('←', 0), mk('↓', 3), mk('→', 1),
    ),
    el(
      'div',
      { class: 'acts' },
      mk('Z', 4),
      mk('X', 5),
    ),
  );
}
