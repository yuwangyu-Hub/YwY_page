import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSprites, getPixel, setPixel, floodFill,
  cellIndex, cellOrigin, getTile, setTile, createMap,
} from '../js/lib/pixel-data.js';

test('set/get 像素基本读写', () => {
  const s = createSprites();
  setPixel(s, 3, 4, 8);
  assert.equal(getPixel(s, 3, 4), 8);
});

test('坐标环绕（与 PICO-8 一致）', () => {
  const s = createSprites();
  setPixel(s, 0, 0, 5);
  assert.equal(getPixel(s, 128, 128), 5); // 环绕回原点
  setPixel(s, -1, -1, 7);
  assert.equal(getPixel(s, 127, 127), 7);
});

test('颜色被钳制到 0-15', () => {
  const s = createSprites();
  setPixel(s, 0, 0, 99);
  assert.equal(getPixel(s, 0, 0), 15);
  setPixel(s, 0, 0, -3);
  assert.equal(getPixel(s, 0, 0), 0); // 负数钳制为 0
});

test('cellIndex / cellOrigin 互逆', () => {
  assert.equal(cellIndex(8, 0), 1);
  assert.equal(cellIndex(0, 8), 16);
  assert.equal(cellIndex(72, 16), 41); // x=72→cell 9, y=16→第2行 → 9+32
  assert.deepEqual(cellOrigin(1), { x: 8, y: 0 });
  assert.deepEqual(cellOrigin(35), { x: 24, y: 16 });
});

test('floodFill 只填同色连通区域', () => {
  const s = createSprites();
  // 全 0 背景，画一个 3x3 的 5 色方块
  for (let y = 4; y < 7; y++) for (let x = 4; x < 7; x++) setPixel(s, x, y, 5);
  const n = floodFill(s, 0, 0, 9, { x: 0, y: 0, w: 8, h: 8 });
  assert.equal(n, 64 - 9); // 背景都被填成 9，方块保留
  assert.equal(getPixel(s, 5, 5), 5);
  assert.equal(getPixel(s, 0, 0), 9);
});

test('floodFill 遇到同色目标直接返回 0', () => {
  const s = createSprites();
  assert.equal(floodFill(s, 0, 0, 0, { x: 0, y: 0, w: 8, h: 8 }), 0);
});

test('floodFill 限制在矩形内', () => {
  const s = createSprites();
  floodFill(s, 0, 0, 1, { x: 0, y: 0, w: 4, h: 4 });
  assert.equal(getPixel(s, 3, 3), 1);
  assert.equal(getPixel(s, 4, 4), 0);
});

test('地图 tile 读写与环绕', () => {
  const m = createMap();
  setTile(m, 0, 0, 3);
  assert.equal(getTile(m, 128, 64), 3);
  setTile(m, 10, 14, 2);
  assert.equal(getTile(m, 10, 14), 2);
});
