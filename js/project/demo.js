// 内置 demo 项目：无存档时载入，兼作教程。
// 精灵/地图数据用代码生成；Lua 代码演示 btn/btnp/mget 碰撞/spr/map/print。

import { createEmptyProject } from './model.js';
import { setPixel, setTile } from '../lib/pixel-data.js';

// 色号速记
const G = 11, DG = 3, BR = 4, PU = 2, GR = 5, DK = 1, RD = 8, WH = 7;

// 每个精灵 8 行 × 8 字符，'.' = 透明
function drawSprite(sprites, n, rows, legend) {
  const ox = (n % 16) * 8, oy = Math.floor(n / 16) * 8;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.') setPixel(sprites, ox + x, oy + y, legend[ch]);
    });
  });
}

export function createDemoProject() {
  const project = createEmptyProject();

  // 精灵 1：小方块角色（描边 1 / 身体 8 / 眼嘴 7）
  drawSprite(project.sprites, 1, [
    '..AAAA..',
    '.ABBBBA.',
    'ABBBBBBA',
    'ABABBABA',
    'ABBBBBBA',
    'ABBAABBA',
    '.ABBBBA.',
    '..AAAA..',
  ], { A: DK, B: RD, '.': 0 });
  // 修正：眼睛/嘴应为深色而非白——按行重画更直观：
  project.sprites.fill(0);
  drawSprite(project.sprites, 1, [
    '..AAAA..',
    '.ABBBBA.',
    'ABBBBBBA',
    'ABABBABA',
    'ABBBBBBA',
    'ABBCCBBA',
    '.ABBBBA.',
    '..AAAA..',
  ], { A: DK, B: RD, C: WH });

  // 精灵 2：草地地面（顶层绿 11，深绿点缀 3，土棕 4，深紫石粒 2）
  drawSprite(project.sprites, 2, [
    'GGGGGGGG',
    'GDGGDGGD',
    'OOOOOOOO',
    'OOXOOOOO',
    'OOOOOXOO',
    'OXOOOOOO',
    'OOOOXOOO',
    'OOOOOOXO',
  ], { G, D: DG, O: BR, X: PU });

  // 精灵 3：砖块平台（砖体 2 深紫，缝 5 深灰）
  drawSprite(project.sprites, 3, [
    'MMMMIMMM',
    'MMMMIMMM',
    'IIIIIIII',
    'MMIMMMMM',
    'MMIMMMMM',
    'IIIIIIII',
    'MMMMIMMM',
    'MMMMIMMM',
  ], { M: PU, I: GR });

  // 地图：底部两行地面 + 三块砖平台
  for (let x = 0; x < 128; x++) {
    setTile(project.map, x, 14, 2);
    setTile(project.map, x, 15, 2);
  }
  for (let x = 9; x <= 12; x++) setTile(project.map, x, 11, 3);
  for (let x = 16; x <= 19; x++) setTile(project.map, x, 9, 3);
  for (let x = 24; x <= 27; x++) setTile(project.map, x, 11, 3);

  project.code = DEMO_LUA;
  return project;
}

const DEMO_LUA = `-- ★ PIXEL STUDIO DEMO ★
-- 方向键移动，Z / C 跳跃。
-- 去「像素画」改角色，回这里点运行看效果！

px=16  py=104  vy=0
grounded=false
moved=false

function _update()
  if btn(0) or btn(1) then moved=true end
  if btn(0) then px-=1.5 end
  if btn(1) then px+=1.5 end

  if grounded and btnp(4) then
    vy=-3.8
    grounded=false
  end

  vy=min(vy+0.25,4)
  py+=vy

  -- 与地图做脚底碰撞
  grounded=false
  if vy>=0 then
    local ty=flr((py+8)/8)
    local tx0=flr(px/8)
    local tx1=flr((px+7)/8)
    for tx=tx0,tx1 do
      if mget(tx,ty)>0 then
        py=ty*8-8
        vy=0
        grounded=true
      end
    end
  end

  px=mid(0,px,120)
  if py>112 then py=112 vy=0 grounded=true end
end

function _draw()
  cls(12)                     -- 天空蓝
  circfill(24,20,7,7)         -- 云
  circfill(33,16,5,7)
  circfill(102,28,8,7)

  map(0,0,0,0,16,16)          -- 地面与平台
  spr(1,px,py)                -- 角色

  print("pixel studio demo",4,2,7)
  if not moved then
    print("<> move  Z jump",20,52,7)
  end
end
`;
