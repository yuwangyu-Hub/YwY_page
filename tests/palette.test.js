// 调色板注册表与映射 测试
import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, DEFAULT_PALETTE, paletteColors, paletteColorAt, paletteRgb, PALETTE } from '../js/lib/palette.js';
import { serializeP8, deserializeP8 } from '../js/project/serializer.js';

test('注册十一个色板且颜色均为合法 hex', () => {
  const keys = Object.keys(PALETTES);
  for (const k of ['pico8', 'tic80', 'gb', 'gbc', 'c64', 'apple2', 'msx1', 'msx2', 'sms', 'nes', 'zx']) {
    assert.ok(keys.includes(k), `缺少色板 ${k}`);
    for (const c of PALETTES[k].colors) assert.match(c, /^#[0-9a-fA-F]{6}$/);
  }
});

test('各色板颜色数：pico8 32 色（含隐藏色板），其余 16 或 4（GB）', () => {
  assert.equal(PALETTES.pico8.colors.length, 32);
  assert.equal(PALETTES.tic80.colors.length, 16);
  assert.equal(PALETTES.gb.colors.length, 4);
  assert.equal(PALETTES.gbc.colors.length, 16);
  assert.equal(PALETTES.c64.colors.length, 16);
  assert.equal(PALETTES.apple2.colors.length, 16);
  assert.equal(PALETTES.nes.colors.length, 32);
  // 16-31 为 PICO-8 隐藏色板
  assert.equal(PALETTES.pico8.colors[16], '#291814');
  assert.equal(PALETTES.pico8.colors[31], '#FF9D81');
});

test('paletteColorAt 小色板取模，0-15 全有定义', () => {
  for (let i = 0; i < 16; i++) {
    assert.match(paletteColorAt('gb', i), /^#/);
  }
  // GB 4 色取模：索引 4 回到色 0
  assert.equal(paletteColorAt('gb', 4), paletteColorAt('gb', 0));
  assert.equal(paletteColorAt('gb', 5), paletteColorAt('gb', 1));
  // 未知色板回落 PICO-8
  assert.equal(paletteColorAt('不存在', 3), PALETTE[3]);
  assert.equal(paletteColors('不存在'), PALETTE);
});

test('paletteRgb 输出 [r,g,b] 数值', () => {
  const rgb = paletteRgb('pico8');
  assert.equal(rgb.length, 32);
  assert.deepEqual(rgb[0], [0, 0, 0]);
  assert.deepEqual(rgb[16], [0x29, 0x18, 0x14]);
  const rgbGb = paletteRgb('gb');
  assert.equal(rgbGb.length, 4);
  assert.deepEqual(rgbGb[0], [0x0f, 0x38, 0x0f]);
});

test('palette 字段随 .wy 序列化往返', () => {
  const p = { version: 1, code: '', sprites: new Uint8Array(128 * 128), map: new Uint8Array(128 * 64), palette: 'gb', sfx: null, music: null };
  const back = deserializeP8(serializeP8(p));
  assert.equal(back.palette, 'gb');
  // 官方卡带（无 __palette__ 块）回落 pico8
  const plain = 'pico-8 cartridge\nversion 41\n__lua__\n\n__gfx__\n' + '0'.repeat(128) + '\n'.repeat(127) + '__map__\n';
  assert.equal(deserializeP8(plain).palette, DEFAULT_PALETTE);
});

test('≥16 高位色经 __pages__ P0 无损往返；纯低位色不写 P0', () => {
  const mk = () => ({ version: 1, code: '', sprites: new Uint8Array(128 * 128), map: new Uint8Array(128 * 64), palette: 'pico8', sfx: null, music: null });
  const p = mk();
  p.sprites[0] = 20;
  p.sprites[16383] = 31;
  const text = serializeP8(p);
  assert.match(text, /__pages__/);
  assert.match(text, /^P0 /m);
  const back = deserializeP8(text);
  assert.equal(back.sprites[0], 20);
  assert.equal(back.sprites[16383], 31);
  // 无高位色：不产生 P0（保持官方卡带兼容）
  const p2 = mk();
  p2.sprites[5] = 9;
  assert.doesNotMatch(serializeP8(p2), /^P0 /m);
});
