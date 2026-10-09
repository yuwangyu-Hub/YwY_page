// .p8 文本格式 序列化 / 反序列化
// 导出为本站子集格式（__lua__/__gfx__/__map__），二期扩展 __sfx__/__music__。
// 导入为容错式：认识三个块，其余块（label/ quilt 等）跳过；官方 map 行宽 256 时取前 128。

import { SHEET_W, SHEET_H, MAP_W, MAP_H } from '../lib/pixel-data.js';
import { PALETTES, DEFAULT_PALETTE } from '../lib/palette.js';
import { sfxToHex, sfxFromHex } from '../lib/sfx-data.js';
import { patternToHex, patternFromHex } from '../lib/music-data.js';
import { createEmptyProject, MAX_PAGES } from './model.js';
import { bytesToBase64, base64ToBytes } from './storage.js';

const HEX = '0123456789abcdef';

export function serializeP8(project) {
  const out = [];
  out.push('pico-8 cartridge // http://www.pico-8.com');
  out.push('version 41');
  // __palette__：本站自定块（官方卡带无此块，导入时回落 PICO-8）
  out.push('__palette__');
  out.push(PALETTES[project.palette] ? project.palette : DEFAULT_PALETTE);
  // __pages__：本站自定的扩展精灵页（页 0 已在 __gfx__；P1 起为 base64）
  const pages = Array.isArray(project.spritePages) && project.spritePages.length
    ? project.spritePages.slice(0, MAX_PAGES)
    : [project.sprites];
  if (pages.length > 1) {
    out.push('__pages__');
    pages.forEach((p, i) => { if (i > 0) out.push(`P${i} ${bytesToBase64(p)}`); });
  }

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

  // __sfx__：本站自定格式（官方 PICO-8 的 __sfx__ 为纯 hex，导入时按前缀区分互不干扰）
  if (Array.isArray(project.sfx) && project.sfx.length) {
    out.push('__sfx__');
    for (const s of project.sfx) {
      out.push(`L0 S${s.speed || 120} ${sfxToHex(s)}`);
    }
  }

  // __music__：链 + pattern 行
  if (project.music && Array.isArray(project.music.patterns)) {
    out.push('__music__');
    out.push('C ' + (project.music.chain || []).join(' '));
    project.music.patterns.forEach((pat, i) => {
      out.push(`P${i} ${patternToHex(pat)}`);
    });
  }

  out.push('');
  return out.join('\n');
}

export function deserializeP8(text) {
  const project = createEmptyProject();
  const sections = {};
  let current = null;
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^__(lua|gfx|map|sfx|music|palette|pages|label|gff|quilt|history)__\s*$/);
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

  // __pages__：`P<n> <base64>`（n≥1），与 __gfx__（页 0）合成完整页组
  const pageLines = (sections.pages || []).map((l) => l.trim()).filter((l) => /^P\d+ [A-Za-z0-9+/=]+$/.test(l));
  if (pageLines.length) {
    const nums = pageLines.map((l) => parseInt(l.slice(1), 10)).sort((a, b) => a - b);
    const max = Math.min(nums[nums.length - 1], MAX_PAGES - 1);
    if (max >= 1) {
      project.spritePages = [project.sprites];
      const byNum = {};
      for (const l of pageLines) {
        const m = l.match(/^P(\d+) ([A-Za-z0-9+/=]+)$/);
        byNum[parseInt(m[1], 10)] = m[2];
      }
      for (let i = 1; i <= max; i++) {
        const b = byNum[i] ? base64ToBytes(byNum[i]) : null;
        project.spritePages.push(b && b.length === 16384 ? b : new Uint8Array(16384));
      }
    }
  }

  // __palette__：单行键名；官方卡带无此块，保持默认
  if (sections.palette && sections.palette.length) {
    const key = sections.palette[0].trim();
    if (PALETTES[key]) project.palette = key;
  }

  // __sfx__：`L0 S<speed> <hex…>`；官方纯 hex 行不匹配前缀，自动跳过
  const sfxLines = (sections.sfx || []).map((l) => l.trim()).filter((l) => /^L\d S\d+ [0-9a-f]+$/.test(l));
  if (sfxLines.length) {
    project.sfx = sfxLines.map((l) => {
      const m = l.match(/^L\d S(\d+) ([0-9a-f]+)$/);
      return sfxFromHex(m[2], parseInt(m[1], 10) || 120);
    });
  }

  // __music__：`C <链>` + `P<n> <hex…>`
  const musicLines = (sections.music || []).map((l) => l.trim());
  const chainLine = musicLines.find((l) => /^C [\d -]*\d/.test(l));
  const patLines = musicLines.filter((l) => /^P\d+ [0-9a-f]+$/.test(l));
  if (chainLine || patLines.length) {
    const music = { speed: 140, chain: [0], patterns: [] };
    if (chainLine) {
      const chain = chainLine.slice(2).trim().split(/\s+/).map(Number).filter((n) => !Number.isNaN(n) && n >= 0);
      if (chain.length) music.chain = chain;
    }
    for (const l of patLines) {
      const m = l.match(/^P(\d+) ([0-9a-f]+)$/);
      music.patterns[parseInt(m[1], 10)] = patternFromHex(m[2]);
    }
    for (let i = 0; i < music.patterns.length; i++) {
      if (!music.patterns[i]) music.patterns[i] = patternFromHex('');
    }
    project.music = music;
  }

  return project;
}

// 粗校验：是否像 .p8 文本
export function looksLikeP8(text) {
  return /__gfx__/.test(String(text)) || /pico-8 cartridge/.test(String(text));
}
