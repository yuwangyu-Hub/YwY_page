// 项目数据结构工厂
import { createSprites, createMap } from '../lib/pixel-data.js';

export const MAX_PAGES = 8; // 精灵页上限（每页 128×128 索引 = 256 个 8×8 精灵）

export function createEmptyProject() {
  const page0 = createSprites();
  return {
    version: 1,
    code: '',
    sprites: page0,       // 主页（页 0），运行时/地图/PNG 兼容引用
    spritePages: [page0], // 全部精灵页；不变式：spritePages[0] === sprites
    map: createMap(),
    palette: 'pico8', // 调色板键（见 lib/palette.js 的 PALETTES）
    sfx: null,   // 二期：音效库
    music: null, // 二期：乐曲库
  };
}

// 旧存档/外部导入只有单页 sprites —— 归一化补齐 spritePages。
// 注意：仅在结构非法时才重建数组，避免调用方持有的旧引用与 project.spritePages 脱钩。
export function normalizePages(project) {
  if (!Array.isArray(project.spritePages) || project.spritePages.length === 0) {
    project.spritePages = [project.sprites];
    return project;
  }
  if (project.spritePages.length > MAX_PAGES) {
    project.spritePages = project.spritePages.slice(0, MAX_PAGES);
  }
  project.spritePages[0] = project.sprites; // 维持不变式
  return project;
}

// 追加一个空白页；返回是否成功
export function addPage(project) {
  normalizePages(project);
  if (project.spritePages.length >= MAX_PAGES) return false;
  const page = createSprites();
  project.spritePages.push(page);
  return true;
}
