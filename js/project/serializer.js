// .p8 文本格式 序列化 / 反序列化
// 导出为本站子集格式（__lua__/__gfx__/__map__），二期扩展 __sfx__/__music__。
// 导入为容错式：认识三个块，其余块（label/ quilt 等）跳过；官方 map 行宽 256 时取前 128。

import { SHEET_W, SHEET_H, MAP_W, MAP_H } from '../lib/pixel-data.js';
import { createEmptyProject } from './model.js';

const HEX = '0123456789abcdef';

export function serializeP8(project) {
  const out = [];
  out.push('pico-8 cartridge // http://www.pico-8.com');
  out.push('version 41');
  out.push('__lua__');
  out.push(project.code.endsWith('\n') || project.code === '' ? project.code : project.code + '\n');

  out.push('__gfx__');
  for (let y = 0; y < SHEET_H; y++) {
    let row = '';
    for (let x = 0; x < SHEET_W; x++) row += HEX[project.sprites[y * SHEET_W + x] & 15];
    out.push(row);
  }

  out.push('__map__');
  for (let y = 0; y < MAP_H; y++) {
    let row = '';
    for (let x = 0; x < MAP_W; x++) row += HEX[project.map[y * MAP_W + x] & 15];
    out.push(row);
  }
  out.push('');
  return out.join('\n');
}

export function deserializeP8(text) {
  const project = createEmptyProject();
  const sections = {};
  let current = null;
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^__(lua|gfx|map|sfx|music|label|gff|quilt|history)__\s*$/);
    if (m) { current = m[1]; sections[current] = []; continue; }
    if (current && !line.startsWith('pico-8 cartridge') && !/^version \d+\s*$/.test(line)) {
      sections[current].push(line);
    }
  }

  // __lua__
  if (sections.lua) {
    let code = sections.lua.join('\n');
    code = code.replace(/\n+$/, '');
    if (code !== '') code += '\n';
    project.code = code;
  }

  // __gfx__：每行 128 个 hex 字符（兼容 64 位宽的老格式按两行？不做，容错跳过短行）
  const gfx = sections.gfx || [];
  let gy = 0;
  for (const line of gfx) {
    if (gy >= SHEET_H) break;
    const s = line.trim().toLowerCase();
    if (s.length < SHEET_W) continue; // 容错：跳过不完整行
    for (let x = 0; x < SHEET_W; x++) {
      const v = HEX.indexOf(s[x]);
      project.sprites[gy * SHEET_W + x] = v >= 0 ? v : 0;
    }
    gy++;
  }

  // __map__：本站每行 128 字符；官方为 256，取前 128
  const mapSec = sections.map || [];
  let my = 0;
  for (const line of mapSec) {
    if (my >= MAP_H) break;
    const s = line.trim().toLowerCase();
    if (s.length < MAP_W) continue;
    for (let x = 0; x < MAP_W; x++) {
      const v = HEX.indexOf(s[x]);
      project.map[my * MAP_W + x] = v >= 0 ? v : 0;
    }
    my++;
  }

  return project;
}

// 粗校验：是否像 .p8 文本
export function looksLikeP8(text) {
  return /__gfx__/.test(String(text)) || /pico-8 cartridge/.test(String(text));
}
