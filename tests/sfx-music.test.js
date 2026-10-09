// sfx/music 数据模型测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankSfx, sfxToHex, sfxFromHex, createJumpSfx, STEPS } from '../js/lib/sfx-data.js';
import { createBlankMusic, createBlankPattern, patternToHex, patternFromHex } from '../js/lib/music-data.js';

test('空白音效 hex 编解码往返', () => {
  const a = createBlankSfx(99);
  const b = sfxFromHex(sfxToHex(a), 99);
  assert.equal(b.speed, 99);
  assert.deepEqual(b.steps, a.steps);
});

test('带内容音效 hex 往返', () => {
  const a = createBlankSfx();
  a.steps[0] = { p: 12, w: 3, v: 7 };
  a.steps[5] = { p: 23, w: 4, v: 8 };
  const b = sfxFromHex(sfxToHex(a));
  assert.deepEqual(b.steps, a.steps);
});

test('休止编码为 ff00', () => {
  assert.match(sfxToHex(createBlankSfx()), /^(ff00){16}$/);
});

test('音高越界钳制', () => {
  const b = sfxFromHex('zz00'); // NaN 音高 → 休止
  assert.equal(b.steps[0].p, -1);
});

test('跳跃音效工厂有音符', () => {
  const s = createJumpSfx();
  assert.equal(s.steps.length, STEPS);
  assert.ok(s.steps.some((st) => st.p >= 0));
});

test('pattern hex 往返（含两声部）', () => {
  const a = createBlankPattern();
  a[0][2] = { p: 5, w: 1, v: 6 };
  a[1][15] = { p: 0, w: 0, v: 8 };
  const b = patternFromHex(patternToHex(a));
  assert.deepEqual(b, a);
});

test('空白 pattern hex 长度 = 128', () => {
  assert.equal(patternToHex(createBlankPattern()).length, 128);
});

test('空白乐曲结构', () => {
  const m = createBlankMusic();
  assert.deepEqual(m.chain, [0]);
  assert.equal(m.patterns.length, 4);
  assert.equal(m.patterns[0].length, 2); // 两声部
});
