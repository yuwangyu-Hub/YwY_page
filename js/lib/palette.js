// 调色板注册表（纯数据，无 DOM 依赖，可 Node 直测）。
// 像素数据存 0-31 的索引；色板可定义最多 32 色（MAX_COLORS），
// 少于 32 色的色板按索引取模映射（小色板如 GB 4 色循环使用）。
// 切换色板只改渲染观感，不改底层数据。

export const MAX_COLORS = 32;

export const PALETTES = {
  pico8: {
    label: 'PICO-8',
    colors: [
      '#000000', '#1D2B53', '#7E2553', '#008751',
      '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
      '#FF004D', '#FFA300', '#FFEC27', '#00E436',
      '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA',
      // PICO-8 隐藏色板（secret palette，pal(_,1) 可访问的 16 色）
      '#291814', '#111D35', '#422136', '#125359',
      '#742F29', '#49333B', '#A28879', '#F3EF7D',
      '#BE1250', '#FF6C24', '#A8E72E', '#00B543',
      '#065AB5', '#754665', '#FF6E59', '#FF9D81',
    ],
  },
  // TIC-80 出厂默认色板与 PICO-8 相同，故采用其内置的招牌替代色板 Sweetie-16
  tic80: {
    label: 'TIC-80 · Sweetie 16',
    colors: [
      '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57',
      '#ffcd75', '#a7f070', '#38b764', '#257179',
      '#29366f', '#3b5dc9', '#41a6f6', '#73eff7',
      '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
    ],
  },
  gb: {
    label: 'Game Boy',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  },
  // GBC 硬件无官方固定色板（每格 4 色自 32768 色取），此为 GBC 时代游戏风格的代表色集
  gbc: {
    label: 'Game Boy Color',
    colors: [
      '#181818', '#3c2c74', '#6038b8', '#2e63c4',
      '#3aa0d8', '#73eff7', '#35c8a0', '#4bd45c',
      '#93d300', '#e8d900', '#f8a800', '#f86048',
      '#e83060', '#a0389c', '#5c5c74', '#ffffff',
    ],
  },
  c64: {
    label: 'Commodore 64',
    colors: [
      '#000000', '#FFFFFF', '#68372B', '#70A4B2',
      '#6F3D86', '#588D43', '#352879', '#B8C76F',
      '#6F4F25', '#433900', '#9A6759', '#444444',
      '#6C6C6C', '#9AD284', '#6C5EB5', '#959595',
    ],
  },
  // Apple II Lo-Res 16 色（IIGS 兼容模式 Mega II 芯片的 12-bit 官方色值）
  apple2: {
    label: 'Apple II',
    colors: [
      '#000000', '#DD0033', '#000099', '#DD22DD',
      '#007722', '#555555', '#2222FF', '#66AAFF',
      '#885500', '#FF6600', '#AAAAAA', '#FF9988',
      '#11DD00', '#FFFF00', '#44FF99', '#FFFFFF',
    ],
  },
};

export const DEFAULT_PALETTE = 'pico8';

// 旧引用兼容（PICO-8 16 色）
export const PALETTE = PALETTES.pico8.colors;

export function paletteColors(key) {
  return (PALETTES[key] || PALETTES.pico8).colors;
}

// 索引 → 颜色：少于 32 色的色板取模循环，保证 0-31 都有定义
export function paletteColorAt(key, i) {
  const cs = paletteColors(key);
  return cs[((i % cs.length) + cs.length) % cs.length];
}

// 预解析为 [[r,g,b],…]（运行时 ImageData 用）
export function paletteRgb(key) {
  return paletteColors(key).map((hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]);
}

// CSS 变量注入用：--pal-0 .. --pal-15（PICO-8 默认）
export function paletteCssVars() {
  return PALETTE.map((c, i) => `--pal-${i}: ${c};`).join('\n');
}
