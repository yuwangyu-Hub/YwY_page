// PICO-8 标准 16 色调色板（索引 0 = 透明/黑）
// 纯数据，无 DOM 依赖，可 Node 直测。

export const PALETTE = [
  '#000000', // 0  黑
  '#1D2B53', // 1  深蓝
  '#7E2553', // 2  深紫
  '#008751', // 3  深绿
  '#AB5236', // 4  棕
  '#5F574F', // 5  深灰
  '#C2C3C7', // 6  浅灰
  '#FFF1E8', // 7  白
  '#FF004D', // 8  红
  '#FFA300', // 9  橙
  '#FFEC27', // 10 黄
  '#00E436', // 11 绿
  '#29ADFF', // 12 蓝
  '#83769C', // 13 靛
  '#FF77A8', // 14 粉
  '#FFCCAA', // 15 肤
];

// CSS 变量注入用：--pal-0 .. --pal-15
export function paletteCssVars() {
  return PALETTE.map((c, i) => `--pal-${i}: ${c};`).join('\n');
}
