// 图形算法：直线 / 矩形 / 圆 —— 产出像素坐标点，配合 pixel-data 的 set 使用。
// 纯函数、无 DOM 依赖。

// Bresenham 直线：对每个点调用 set(x, y)
export function line(x0, y0, x1, y1, set) {
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  x1 = Math.floor(x1); y1 = Math.floor(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    set(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// 空心矩形（四条边）
export function rect(x0, y0, x1, y1, set) {
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  x1 = Math.floor(x1); y1 = Math.floor(y1);
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
    set(x, y0); set(x, y1);
  }
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    set(x0, y); set(x1, y);
  }
}

// 实心矩形：遍历行，由调用方给 set
export function rectfill(x0, y0, x1, y1, set) {
  for (let y = Math.floor(Math.min(y0, y1)); y <= Math.floor(Math.max(y0, y1)); y++) {
    for (let x = Math.floor(Math.min(x0, x1)); x <= Math.floor(Math.max(x0, x1)); x++) {
      set(x, y);
    }
  }
}

// 实心圆（逐行）
export function circfill(cx, cy, r, set) {
  cx = Math.floor(cx); cy = Math.floor(cy); r = Math.floor(r);
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let x = cx - dx; x <= cx + dx; x++) set(x, cy + dy);
  }
}

// 空心圆（中点法）
export function circ(cx, cy, r, set) {
  cx = Math.floor(cx); cy = Math.floor(cy); r = Math.floor(r);
  if (r <= 0) { set(cx, cy); return; }
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    set(cx + x, cy + y); set(cx - x, cy + y);
    set(cx + x, cy - y); set(cx - x, cy - y);
    set(cx + y, cy + x); set(cx - y, cy + x);
    set(cx + y, cy - x); set(cx - y, cy - x);
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}
