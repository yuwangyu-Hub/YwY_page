// 像素数据模型：精灵表（128×128 调色板索引）与地图（128×64 瓦片索引）
// 纯函数、无 DOM 依赖，浏览器与 Node 共用（测试直测）。

export const SHEET_W = 128;
export const SHEET_H = 128;
export const MAP_W = 128;
export const MAP_H = 64;
export const CELL = 8; // 一个精灵单元 8×8

export function createSprites() {
  return new Uint8Array(SHEET_W * SHEET_H);
}

export function createMap() {
  return new Uint8Array(MAP_W * MAP_H);
}

const wrap = (v, m) => ((v % m) + m) % m;

// ---------- 精灵表 ----------
// 坐标环绕（与 PICO-8 一致）
export function getPixel(sprites, x, y) {
  return sprites[wrap(y, SHEET_H) * SHEET_W + wrap(x, SHEET_W)];
}

export function setPixel(sprites, x, y, c) {
  c = Math.max(0, Math.min(31, c | 0));
  sprites[wrap(y, SHEET_H) * SHEET_W + wrap(x, SHEET_W)] = c;
}

// 当前精灵单元的像素坐标 → 精灵编号（0-255）
export function cellIndex(px, py) {
  return wrap(Math.floor(px / CELL), SHEET_W / CELL) +
    16 * wrap(Math.floor(py / CELL), SHEET_H / CELL);
}

// 精灵编号 → 单元左上角像素坐标
export function cellOrigin(n) {
  return { x: (n % 16) * CELL, y: Math.floor(n / 16) * CELL };
}

// 在矩形区域内泛洪填充（只影响 rect 内、与起点同色的连通像素）
export function floodFill(sprites, x, y, c, rect) {
  x = wrap(Math.floor(x), SHEET_W);
  y = wrap(Math.floor(y), SHEET_H);
  c = Math.max(0, Math.min(31, c | 0));
  const x0 = rect ? rect.x : 0, y0 = rect ? rect.y : 0;
  const x1 = rect ? rect.x + rect.w - 1 : SHEET_W - 1;
  const y1 = rect ? rect.y + rect.h - 1 : SHEET_H - 1;
  const target = sprites[y * SHEET_W + x];
  if (target === c) return 0;
  const stack = [[x, y]];
  let count = 0;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
    if (sprites[cy * SHEET_W + cx] !== target) continue;
    sprites[cy * SHEET_W + cx] = c;
    count++;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return count;
}

// ---------- 地图 ----------
export function getTile(map, x, y) {
  return map[wrap(y, MAP_H) * MAP_W + wrap(x, MAP_W)];
}

export function setTile(map, x, y, v) {
  v &= 255;
  map[wrap(y, MAP_H) * MAP_W + wrap(x, MAP_W)] = v;
}
