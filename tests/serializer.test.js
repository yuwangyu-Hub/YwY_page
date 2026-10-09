import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeP8, deserializeP8 } from '../js/project/serializer.js';
import { createEmptyProject } from '../js/project/model.js';
import { setPixel, setTile, getPixel, getTile } from '../js/lib/pixel-data.js';
import { bytesToBase64, base64ToBytes } from '../js/project/storage.js';

test('.p8 往返：code/sprites/map 完整还原', () => {
  const p = createEmptyProject();
  p.code = 'function _draw() cls(1) end\n';
  setPixel(p.sprites, 0, 0, 8);
  setPixel(p.sprites, 127, 127, 15);
  setPixel(p.sprites, 8, 0, 12); // 精灵 1 的第一个像素
  setTile(p.map, 5, 14, 3);
  setTile(p.map, 127, 63, 9);

  const text = serializeP8(p);
  assert.match(text, /__lua__/);
  assert.match(text, /__gfx__/);
  assert.match(text, /__map__/);

  const q = deserializeP8(text);
  assert.equal(q.code, p.code);
  assert.equal(getPixel(q.sprites, 0, 0), 8);
  assert.equal(getPixel(q.sprites, 127, 127), 15);
  assert.equal(getPixel(q.sprites, 8, 0), 12);
  assert.equal(getTile(q.map, 5, 14), 3);
  assert.equal(getTile(q.map, 127, 63), 9);
});

test('导入容错：未知块跳过、缺块补零', () => {
  const text = [
    'pico-8 cartridge',
    'version 41',
    '__label__',
    'xxxx',
    '__lua__',
    'print("hi")',
    '__gfx__',
    // 只给一行合法数据 + 一行非法短行
    '8'.repeat(128),
    'short line',
    '__map__',
    '3'.repeat(128),
  ].join('\n');
  const p = deserializeP8(text);
  assert.equal(p.code, 'print("hi")\n');
  assert.equal(getPixel(p.sprites, 0, 0), 8);
  assert.equal(getPixel(p.sprites, 1, 1), 0); // 短行被跳过
  assert.equal(getTile(p.map, 0, 0), 3);
  assert.equal(getTile(p.map, 0, 1), 0);
});

test('官方 256 宽 map 行取前 128 列', () => {
  const line256 = '3'.repeat(120) + '5'.repeat(136);
  const p = deserializeP8(`__map__\n${line256}\n`);
  assert.equal(getTile(p.map, 119, 0), 3);
  assert.equal(getTile(p.map, 120, 0), 5); // 第 129 列被舍弃后的内容
  assert.equal(getTile(p.map, 127, 0), 5);
});

test('空项目序列化仍可解析', () => {
  const p = deserializeP8(serializeP8(createEmptyProject()));
  assert.equal(p.code, '');
  assert.equal(p.sprites.length, 16384);
});

test('base64 编解码往返', () => {
  const bytes = new Uint8Array(1000);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i & 255;
  const back = base64ToBytes(bytesToBase64(bytes));
  assert.deepEqual([...back], [...bytes]);
});

test('base64 非法输入返回 null', () => {
  assert.equal(base64ToBytes('!!!!'), null);
  assert.equal(base64ToBytes(42), null);
});
