// 项目数据结构工厂
import { createSprites, createMap } from '../lib/pixel-data.js';

export function createEmptyProject() {
  return {
    version: 1,
    code: '',
    sprites: createSprites(),
    map: createMap(),
    palette: 'pico8', // 调色板键（见 lib/palette.js 的 PALETTES）
    sfx: null,   // 二期：音效库
    music: null, // 二期：乐曲库
  };
}
