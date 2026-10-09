// 乐曲数据模型（纯函数）：4 个 pattern × 2 声部（主旋律/贝斯），乐曲链决定播放顺序。
// 每步结构与音效一致（音高/波形/音量），复用 sfx-data 的常量与编解码。

import { STEPS, sfxFromHex, sfxToHex, createBlankStep, PITCH_ROWS, WAVES, MAX_VOL } from './sfx-data.js';

export const PATTERNS = 4;
export const CHANNELS = 2;
export const CHANNEL_NAMES = ['主旋律', '贝斯'];

export function createBlankPattern() {
  return Array.from({ length: CHANNELS }, () =>
    Array.from({ length: STEPS }, createBlankStep));
}

export function createBlankMusic(speed = 140) {
  return {
    speed,
    chain: [0],           // 播放顺序（pattern 下标），循环
    patterns: Array.from({ length: PATTERNS }, createBlankPattern),
  };
}

// ---------- 编解码（.p8 __music__ 用） ----------
// pattern 行：2 声部 × 16 步 × 4 字符 = 128 字符；前 64 = 主旋律，后 64 = 贝斯
// 休止 = ff + 波形 + 0（与 sfx-data 一致）
const HEX = '0123456789abcdef';
const encStep = (s) => s.p < 0
  ? 'ff' + HEX[s.w & 15] + '0'
  : s.p.toString(16).padStart(2, '0') + HEX[s.w & 15] + Math.min(s.v, 8).toString(16);

export function patternToHex(pat) {
  return pat.map((ch) => ch.map(encStep).join('')).join('');
}

export function patternFromHex(hex) {
  const pat = createBlankPattern();
  for (let ch = 0; ch < CHANNELS; ch++) {
    const part = hex.slice(ch * STEPS * 4, (ch + 1) * STEPS * 4);
    for (let i = 0; i < STEPS && i * 4 + 3 < part.length; i++) {
      const seg = part.slice(i * 4, i * 4 + 4);
      const p = parseInt(seg.slice(0, 2), 16);
      const w = parseInt(seg[2], 16);
      if (Number.isNaN(w)) continue;
      if (p === 0xff || Number.isNaN(p)) {
        pat[ch][i] = { p: -1, w: w % WAVES.length, v: 0 };
        continue;
      }
      const v = parseInt(seg[3], 16);
      if (!Number.isNaN(v)) {
        pat[ch][i] = { p: Math.min(p, PITCH_ROWS - 1), w: w % WAVES.length, v: Math.min(v, MAX_VOL) };
      }
    }
  }
  return pat;
}

// re-export 供视图统一取用
export { sfxFromHex, sfxToHex };
