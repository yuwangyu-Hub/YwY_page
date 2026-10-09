// desugarP8：PICO-8 复合赋值糖 → 标准 Lua
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desugarP8 } from '../runtime/desugar.js';

test('基础复合赋值', () => {
  assert.equal(desugarP8('px-=1.5'), 'px = px - 1.5');
  assert.equal(desugarP8('px+=1.5'), 'px = px + 1.5');
  assert.equal(desugarP8('x*=2'), 'x = x * 2');
  assert.equal(desugarP8('x/=2'), 'x = x / 2');
  assert.equal(desugarP8('x%=3'), 'x = x % 3');
});

test('点号与下标成员', () => {
  assert.equal(desugarP8('obj.speed+=0.2'), 'obj.speed = obj.speed + 0.2');
  assert.equal(desugarP8('t[i]+=1'), 't[i] = t[i] + 1');
  assert.equal(desugarP8('t[i+1]-=2'), 't[i+1] = t[i+1] - 2');
});

test('不误伤比较运算', () => {
  const src = 'if a==b then c>=d and e<=f or g~=h end';
  assert.equal(desugarP8(src), src);
});

test('不误伤普通赋值与负号', () => {
  assert.equal(desugarP8('x =- 1'), 'x =- 1');
  assert.equal(desugarP8('x = y - -z'), 'x = y - -z');
  assert.equal(desugarP8('for i=1,10 do end'), 'for i=1,10 do end');
});

test('保持行数不变（错误行号不漂移）', () => {
  const src = 'a=1\nb+=2\nc=3\n';
  assert.equal(desugarP8(src).split('\n').length, src.split('\n').length);
});

test('多语句混排', () => {
  assert.equal(
    desugarP8('px+=1 py+=vy vy=min(vy+0.25,4)'),
    'px = px + 1 py = py + vy vy=min(vy+0.25,4)',
  );
});

test('连接糖 ..=', () => {
  assert.equal(desugarP8('s..="x"'), 's = s .. "x"');
});
