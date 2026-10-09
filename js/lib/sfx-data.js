// 音效数据模型（纯函数）：8 个槽位 × 16 步，每步 = 音高 + 波形 + 音量。
// 音高：0-23 个半音（相对 C3 两层八度），-1 = 休止。波形 0-4，音量 0-8。
// 无 DOM 依赖，浏览器与 Node 共用（测试直测）。

export const SFX_COUNT = 8;
export const STEPS = 16;
export const WAVES = ['square', 'sine', 'sawtooth', 'triangle', 'noise'];
export const WAVE_NAMES = ['方波', '正弦', '锯齿', '三角', '噪声'];
export const WAVE_COLORS = ['#FFEC27', '#29ADFF', '#FF77A8', '#00E436', '#FFA300'];
export const BASE_MIDI = 48;  // C3
export const PITCH_ROWS = 24; // 两个八度
export const MAX_VOL = 8;
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiOf(p) { return BASE_MIDI + p; }
export function noteLabel(p) {
  if (p < 0 || p >= PITCH_ROWS) return '';
  return NOTE_NAMES[p % 12] + (3 + Math.floor(p / 12));
}

export function createBlankStep() { return { p: -1, w: 0, v: 0 }; }

export function createBlankSfx(speed = 120) {
  return { speed, steps: Array.from({ length: STEPS }, createBlankStep) };
}

export function createSfxSlots(n = SFX_COUNT) {
  return Array.from({ length: n }, () => createBlankSfx());
}

// ---------- hex 编码（.p8 __sfx__ 用）：每步 4 字符 p(2) w(1) v(1)，休止 = ff + w + 0 ----------
const HEX = '0123456789abcdef';
const h2 = (n) => HEX[(n >> 4) & 15] + HEX[n & 15];

export function sfxToHex(sfx) {
  let out = '';
  for (const s of sfx.steps) {
    out += s.p < 0 ? 'ff' + HEX[s.w & 15] + '0' : h2(s.p) + HEX[s.w & 15] + HEX[Math.min(s.v, 8) & 15];
  }
  return out;
}

export function sfxFromHex(hex, speed = 120) {
  const sfx = createBlankSfx(speed);
  for (let i = 0; i * 4 + 3 < hex.length && i < STEPS; i++) {
    const seg = hex.slice(i * 4, i * 4 + 4);
    const p = parseInt(seg.slice(0, 2), 16);
    const w = parseInt(seg[2], 16);
    if (Number.isNaN(w)) continue;
    if (p === 0xff || Number.isNaN(p)) {
      sfx.steps[i] = { p: -1, w: w % WAVES.length, v: 0 }; // 休止（保留波形）
      continue;
    }
    const v = parseInt(seg[3], 16);
    if (!Number.isNaN(v)) {
      sfx.steps[i] = { p: Math.min(p, PITCH_ROWS - 1), w: w % WAVES.length, v: Math.min(v, MAX_VOL) };
    }
  }
  return sfx;
}

// ---------- 内置音效工厂 ----------
export function createJumpSfx() {
  const sfx = createBlankSfx(70);
  const seq = [[4, 6], [8, 6], [11, 6], [16, 5]];
  seq.forEach(([p, v], i) => { sfx.steps[i] = { p, w: 0, v }; });
  return sfx;
}

export function createCoinSfx() {
  const sfx = createBlankSfx(80);
  const seq = [[19, 6], [-1, 0], [23, 6], [-1, 0], [19, 4], [-1, 0], [23, 4]];
  seq.forEach(([p, v], i) => { sfx.steps[i] = { p, w: 1, v }; });
  return sfx;
}
