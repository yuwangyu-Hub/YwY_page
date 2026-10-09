// 运行时主循环：30fps、_init/_update/_draw 调度、单帧指令预算防死循环、
// 屏幕呈现（palette 索引 → ImageData，一次 putImageData + overlay 叠加）。

import { createLuaState, loadFengari, RGB } from './api.js';
import { PRELUDE } from './prelude.lua.js';
import { desugarP8 } from './desugar.js';
import { stopMusic } from '../js/audio/engine.js';

const W = 128, H = 128;
const FRAME_MS = 1000 / 30;
const INSTRUCTION_BUDGET = 5_000_000; // 每帧 Lua 指令预算

export async function startRuntime({ project, canvas, overlay, keys, onError, onStatus }) {
  const fengari = await loadFengari();
  const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;

  const ctx = canvas.getContext('2d');
  const octx = overlay.getContext('2d');
  const screen = new Uint8Array(W * H);
  const t0 = performance.now();

  let L;
  try {
    L = createLuaState({ project, screen, keys, printCtx: octx, t0 });
  } catch (e) {
    onError?.('初始化失败: ' + e.message);
    return { stop() {} };
  }

  // ---------- 加载代码（带指令预算） ----------
  const hook = (L2) => {
    lauxlib.luaL_error(L2, to_luastring('运行超出单帧指令预算（可能是死循环），已中止'));
  };
  const armHook = () => lua.lua_sethook(L, hook, lua.LUA_MASKCOUNT, INSTRUCTION_BUDGET);

  function loadChunk(code, name) {
    if (lauxlib.luaL_loadbuffer(L, to_luastring(code), code.length, to_luastring(name)) !== lua.LUA_OK) {
      throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
    }
    armHook();
    if (lua.lua_pcall(L, 0, 0, 0) !== lua.LUA_OK) {
      throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
    }
  }

  function callGlobal(name) {
    lua.lua_getglobal(L, to_luastring(name));
    if (lua.lua_isnil(L, -1)) { lua.lua_pop(L, 1); return false; }
    if (lua.lua_pcall(L, 0, 0, 0) !== lua.LUA_OK) {
      throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
    }
    return true;
  }

  // ---------- 呈现 ----------
  const img = ctx.createImageData(W, H);
  const data = img.data;
  function present() {
    for (let i = 0; i < W * H; i++) {
      const [r, g, b] = RGB[screen[i]];
      const o = i * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.drawImage(overlay, 0, 0);
    octx.clearRect(0, 0, W, H);
  }

  // ---------- 主循环 ----------
  let raf = 0;
  let stopped = false;
  let last = -Infinity;
  let hasUpdate = false, hasDraw = false;

  function frame(ts) {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (ts - last < FRAME_MS - 1) return;
    last = ts;
    try {
      armHook(); // 每帧重置指令预算
      if (hasUpdate) callGlobal('_update');
      if (hasDraw) callGlobal('_draw');
      present();
    } catch (e) {
      stop();
      onError?.(String(e.message || e));
    }
  }

  function stop() {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lua.lua_sethook(L, () => {}, 0, 0);
    stopMusic(); // 游戏停了，背景音乐也要停
  }

  // ---------- 启动 ----------
  onStatus?.('启动中…');
  try {
    loadChunk(PRELUDE, '=prelude');
    if (project.code.trim() === '') throw new Error('没有代码：去「代码」页写点 Lua，或先载入 demo');
    loadChunk(desugarP8(project.code), '=user code'); // PICO-8 复合赋值糖 → 标准 Lua
    // _init 存在则调用一次；探测 _update/_draw 是否定义
    lua.lua_getglobal(L, to_luastring('_init'));
    const hasInit = !lua.lua_isnil(L, -1);
    lua.lua_pop(L, 1);
    if (hasInit) callGlobal('_init');
    hasUpdate = globalIsFunction(L, fengari, '_update');
    hasDraw = globalIsFunction(L, fengari, '_draw');
  } catch (e) {
    stop();
    onError?.(String(e.message || e));
    return { stop() {} };
  }

  raf = requestAnimationFrame(frame);
  onStatus?.('运行中');

  return { stop };
}

function globalIsFunction(L, fengari, name) {
  fengari.lua.lua_getglobal(L, fengari.to_luastring(name));
  const isFn = fengari.lua.lua_type(L, -1) === fengari.lua.LUA_TFUNCTION;
  fengari.lua.lua_pop(L, 1);
  return isFn;
}
