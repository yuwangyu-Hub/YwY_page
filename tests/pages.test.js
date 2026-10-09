// 精灵多页 测试
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyProject, addPage, normalizePages, MAX_PAGES } from '../js/project/model.js';
import { serializeP8, deserializeP8 } from '../js/project/serializer.js';
import { bytesToBase64 } from '../js/project/storage.js';

test('新项目默认 1 页且 spritePages[0] === sprites', () => {
  const p = createEmptyProject();
  assert.equal(p.spritePages.length, 1);
  assert.equal(p.spritePages[0], p.sprites);
});

test('addPage 追加空白页，上限 8', () => {
  const p = createEmptyProject();
  for (let i = 0; i < 7; i++) {
    assert.equal(addPage(p), true);
    assert.equal(p.spritePages.length, i + 2);
  }
  assert.equal(p.spritePages.length, MAX_PAGES);
  assert.equal(addPage(p), false); // 第 9 页被拒
  assert.equal(p.spritePages.length, MAX_PAGES);
  assert.equal(p.spritePages[0], p.sprites); // 不变式保持
});

test('normalizePages 兼容旧单页项目', () => {
  const old = { version: 1, code: '', sprites: new Uint8Array(16384), map: new Uint8Array(8192), palette: 'pico8', sfx: null, music: null };
  normalizePages(old);
  assert.equal(old.spritePages.length, 1);
  assert.equal(old.spritePages[0], old.sprites);
});

test('__pages__ 随 .wy 序列化往返（页 0 走 __gfx__）', () => {
  const p = createEmptyProject();
  addPage(p); addPage(p);
  // 给页 1、页 2 写入标记像素
  p.spritePages[1][5] = 8;
  p.spritePages[2][10] = 12;
  const back = deserializeP8(serializeP8(p));
  assert.equal(back.spritePages.length, 3);
  assert.equal(back.spritePages[0], back.sprites);
  assert.equal(back.spritePages[1][5], 8);
  assert.equal(back.spritePages[2][10], 12);
});

test('单页项目导出不含 __pages__，导入仍单页', () => {
  const p = createEmptyProject();
  const text = serializeP8(p);
  assert.ok(!text.includes('__pages__'));
  const back = deserializeP8(text);
  assert.equal(back.spritePages.length, 1);
});

test('base64 页与 __gfx__ 十六进制页内容一致（页 0 双写不冲突）', () => {
  const p = createEmptyProject();
  addPage(p);
  p.sprites[0] = 15;
  const text = serializeP8(p);
  assert.ok(text.includes('__pages__'));
  assert.ok(text.includes(`P1 ${bytesToBase64(p.spritePages[1]).slice(0, 8)}`));
  const back = deserializeP8(text);
  assert.equal(back.sprites[0], 15); // __gfx__ 恢复页 0
});
