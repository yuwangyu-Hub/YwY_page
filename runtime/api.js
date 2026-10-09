// Lua 状态机工厂：注册 JS 底层原语。
// fengari-web 通过 <script> 懒加载（见 views/run.js 的 loadFengari），这里读全局 fengari。
// 原语清单（薄边界，快路径）：_cls/_pset/_pget/_rectfill/_sget/_sset/_spr/
// _mget/_mset/_mapdraw/_btn/_print/_time/_sfx/_music

import { paletteColors } from '../js/lib/palette.js';
import { playSfx, startMusic, stopMusic } from '../js/audio/engine.js';

// 预解析调色板为 RGB 字节：按项目色板在 createLuaState 内计算
const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const W = 128, H = 128;

const wrap = (v, m) => ((v % m) + m) % m;

export function loadFengari() {
  if (window.fengari) return Promise.resolve(window.fengari);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './vendor/fengari-web.js';
    s.onload = () => resolve(window.fengari);
    s.onerror = () => reject(new Error('fengari 加载失败'));
    document.head.append(s);
  });
}

export function createLuaState({ project, screen, keys, printCtx, t0 }) {
  const { lua, lauxlib, lualib, to_luastring } = window.fengari;

  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  const reg = (name, fn) => {
    lua.lua_pushcfunction(L, fn);
    lua.lua_setglobal(L, to_luastring(name));
  };
  const chk = (n) => lauxlib.luaL_checkinteger(L, n);
  const opt = (n, d) => (lua.lua_isnoneornil(L, n) ? d : lua.lua_tointeger(L, n));
  const push = (v) => lua.lua_pushinteger(L, v);

  const { sprites, map } = project;
  const colors = paletteColors(project.palette); // 项目调色板（小色板由调用方取模）

  reg('_cls', (L2) => {
    screen.fill(opt(1, 0) & 15);
    return 0;
  });

  reg('_pset', (L2) => {
    const x = chk(1), y = chk(2), c = chk(3) & 15;
    screen[wrap(y, H) * W + wrap(x, W)] = c;
    return 0;
  });

  reg('_pget', (L2) => {
    push(screen[wrap(chk(2), H) * W + wrap(chk(1), W)]);
    return 1;
  });

  reg('_rectfill', (L2) => {
    const x0 = chk(1), y0 = chk(2), x1 = chk(3), y1 = chk(4), c = chk(5) & 15;
    const ax = Math.max(0, Math.min(x0, x1)), bx = Math.min(127, Math.max(x0, x1));
    const ay = Math.max(0, Math.min(y0, y1)), by = Math.min(127, Math.max(y0, y1));
    for (let y = ay; y <= by; y++) {
      screen.fill(c, y * W + ax, y * W + bx + 1);
    }
    return 0;
  });

  reg('_sget', (L2) => {
    push(sprites[wrap(chk(2), H) * W + wrap(chk(1), W)]);
    return 1;
  });

  reg('_sset', (L2) => {
    sprites[wrap(chk(2), H) * W + wrap(chk(1), W)] = chk(3) & 15;
    return 0;
  });

  // w/h 以精灵单元为单位（8×8 px）
  reg('_spr', (L2) => {
    const n = chk(1), x = chk(2), y = chk(3);
    const w = opt(4, 1), h = opt(5, 1);
    const sx = (n % 16) * 8, sy = Math.floor(n / 16) * 8;
    for (let row = 0; row < h * 8; row++) {
      const py = y + row;
      if (py < 0 || py >= H) continue;
      for (let col = 0; col < w * 8; col++) {
        const px = x + col;
        if (px < 0 || px >= W) continue;
        const c = sprites[(sy + row) * W + sx + col];
        if (c !== 0) screen[py * W + px] = c;
      }
    }
    return 0;
  });

  reg('_mget', (L2) => {
    push(map[wrap(chk(2), 64) * W + wrap(chk(1), 128)]);
    return 1;
  });

  reg('_mset', (L2) => {
    map[wrap(chk(2), 64) * W + wrap(chk(1), 128)] = chk(3) & 255;
    return 0;
  });

  // (celx, cely, sx, sy, celw, celh)：把地图区域画到屏幕，跳过 tile 0
  reg('_mapdraw', (L2) => {
    const celx = chk(1), cely = chk(2), sx = chk(3), sy = chk(4);
    const celw = opt(5, 16), celh = opt(6, 16);
    for (let ty = 0; ty < celh; ty++) {
      for (let tx = 0; tx < celw; tx++) {
        const n = map[wrap(cely + ty, 64) * W + wrap(celx + tx, 128)];
        if (n === 0) continue;
        const ssx = (n % 16) * 8, ssy = Math.floor(n / 16) * 8;
        const dpx = sx + tx * 8, dpy = sy + ty * 8;
        for (let row = 0; row < 8; row++) {
          const py = dpy + row;
          if (py < 0 || py >= H) continue;
          for (let col = 0; col < 8; col++) {
            const px = dpx + col;
            if (px < 0 || px >= W) continue;
            const c = sprites[(ssy + row) * W + ssx + col];
            if (c !== 0) screen[py * W + px] = c;
          }
        }
      }
    }
    return 0;
  });

  reg('_btn', (L2) => {
    lua.lua_pushboolean(L, keys[chk(1) & 7] ? 1 : 0);
    return 1;
  });

  // 文本画在 overlay canvas 上（矢量字），present 时叠加到像素画面
  reg('_print', (L2) => {
    const s = lua.lua_tojsstring ? lua.lua_tojsstring(L2, 1) : '';
    const x = chk(2), y = chk(3), c = chk(4) & 15;
    if (printCtx) {
      printCtx.fillStyle = colors[((c % colors.length) + colors.length) % colors.length];
      printCtx.font = '6px monospace';
      printCtx.textBaseline = 'top';
      printCtx.fillText(s, Math.max(0, Math.min(x, 126)), Math.max(-2, Math.min(y, 122)));
    }
    return 0;
  });

  reg('_time', (L2) => {
    lua.lua_pushnumber(L, (performance.now() - t0) / 1000);
    return 1;
  });

  // 音频：n 为槽位下标；music(n<0) 停止
  reg('_sfx', (L2) => {
    const n = chk(1);
    const s = project.sfx && project.sfx[n];
    if (s) { try { playSfx(s); } catch { /* 音频不可用时静默 */ } }
    return 0;
  });

  reg('_music', (L2) => {
    const n = opt(1, -1);
    if (n < 0) { stopMusic(); }
    else if (project.music) { try { startMusic(project.music); } catch { /* 同上 */ } }
    return 0;
  });

  return L;
}
