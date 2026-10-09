import test from 'node:test';
import assert from 'node:assert/strict';
import { line, rect, rectfill, circfill } from '../js/lib/draw.js';

function collect(fn) {
  const pts = new Set();
  fn((x, y) => pts.add(`${x},${y}`));
  return pts;
}

test('line 水平/垂直/斜线', () => {
  const h = collect((set) => line(0, 0, 3, 0, set));
  assert.deepEqual([...h], ['0,0', '1,0', '2,0', '3,0']);

  const v = collect((set) => line(2, 1, 2, 4, set));
  assert.equal(v.size, 4);

  const d = collect((set) => line(0, 0, 2, 2, set));
  assert.ok(d.has('0,0') && d.has('1,1') && d.has('2,2'));
});

test('line 反向端点也成立', () => {
  const pts = collect((set) => line(5, 5, 0, 0, set));
  assert.ok(pts.has('5,5') && pts.has('0,0') && pts.size === 6);
});

test('rect 空心：只有边框', () => {
  const pts = collect((set) => rect(0, 0, 3, 3, set));
  assert.equal(pts.size, 12); // 4+4+4 corners counted once → 3+3+3+3
  assert.ok(pts.has('0,0') && pts.has('3,3') && !pts.has('1,1'));
});

test('rectfill 实心面积正确', () => {
  const pts = collect((set) => rectfill(0, 0, 3, 2, set));
  assert.equal(pts.size, 12);
});

test('circfill 半径1 = 十字5点', () => {
  const pts = collect((set) => circfill(5, 5, 1, set));
  assert.equal(pts.size, 5);
  assert.ok(pts.has('5,5') && pts.has('4,5') && pts.has('6,5') && pts.has('5,4') && pts.has('5,6'));
});
