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
  // MSX1（TMS9918，gamma 校正值，比 MSX2 鲜艳；色 0 透明以黑表示）
  msx1: {
    label: 'MSX1',
    colors: [
      '#000000', '#000000', '#0AAD1E', '#34C84C',
      '#2B2DE3', '#514BFB', '#BD2925', '#1EE2EF',
      '#FB2C2B', '#FF5F4C', '#BDA22B', '#D7B454',
      '#0A8C18', '#AF329A', '#B2B2B2', '#FFFFFF',
    ],
  },
  // MSX2（V9938 出厂默认色板，色 0/1 均为黑）
  msx2: {
    label: 'MSX2',
    colors: [
      '#000000', '#000000', '#21C842', '#5EDC78',
      '#5455EC', '#7D76FC', '#D4524D', '#42EBF5',
      '#FC5554', '#FF7978', '#D4C154', '#E6CE80',
      '#21B03B', '#C95BBA', '#CCCCCC', '#FFFFFF',
    ],
  },
  // Sega Master System（Mode 4 标准 16 色：TMS9918 色在 00BBGGRR 6-bit 空间的官方近似）
  sms: {
    label: 'Master System',
    colors: [
      '#000000', '#000000', '#00AA00', '#00FF00',
      '#000055', '#0000FF', '#550000', '#00FFFF',
      '#AA0000', '#FF0000', '#555500', '#FFFF00',
      '#005500', '#FF00FF', '#555555', '#FFFFFF',
    ],
  },
  // NES（2C02 主色板通用 16 色子集，NTSC）
  nes: {
    label: 'NES',
    colors: [
      '#7C7C7C', '#0000FC', '#0000BC', '#4428BC',
      '#940084', '#A82020', '#A81000', '#881400',
      '#503000', '#007800', '#006800', '#005800',
      '#004058', '#000000', '#BCBCBC', '#FCFCFC',
    ],
  },
  // ZX Spectrum（15 色 + bright 变体：正常亮度 #D7 系 / 高亮 #FF 系）
  zx: {
    label: 'ZX Spectrum',
    colors: [
      '#000000', '#0000D7', '#D70000', '#D700D7',
      '#00D700', '#00D7D7', '#D7D700', '#D7D7D7',
      '#000000', '#0000FF', '#FF0000', '#FF00FF',
      '#00FF00', '#00FFFF', '#FFFF00', '#FFFFFF',
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
