// 应用入口：初始化 store（有存档载存档，无存档载 demo）、接线 tab 管理器与顶栏导入导出。
import { createStore } from './core/store.js';
import { makeTabManager, currentHash } from './core/tabs.js';
import { toast } from './core/toast.js';
import { loadProject, saveProject } from './project/storage.js';
import { createDemoProject } from './project/demo.js';
import { createEmptyProject } from './project/model.js';
import { serializeP8, deserializeP8, looksLikeP8 } from './project/serializer.js';
import { downloadText, downloadCanvas, pickTextFile } from './project/download.js';
import { PALETTE } from './lib/palette.js';

// ---------- store ----------
const saved = loadProject();
const store = createStore(saved || createDemoProject(), { onPersist: saveProject });
if (!saved) toast('已载入内置 Demo · 数据存于本页会话，关闭浏览器即清空', 'ok');

// ---------- tabs ----------
const tabs = makeTabManager({
  barEl: document.querySelector('.tabbar'),
  containerEl: document.getElementById('view'),
  defs: { code: {}, sprite: {}, map: {}, run: {} },
});

// ---------- 顶栏动作 ----------
function downloadP8() {
  const name = 'pixel-studio.p8';
  downloadText(name, serializeP8(store.project), 'text/plain');
  toast('已导出 ' + name, 'ok');
}

async function importP8() {
  const text = await pickTextFile('.p8,.txt,.lua');
  if (!text) return;
  if (!looksLikeP8(text)) { toast('不是有效的 .p8 卡带文件', 'error'); return; }
  store.replaceProject(deserializeP8(text));
  toast('导入成功，正在刷新…', 'ok');
  setTimeout(() => location.reload(), 500);
}

function exportPng() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const { sprites } = store.project;
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const c = sprites[y * 128 + x];
      if (c !== 0) { ctx.fillStyle = PALETTE[c]; ctx.fillRect(x, y, 1, 1); }
    }
  }
  downloadCanvas('spritesheet.png', canvas);
  toast('已导出 spritesheet.png（色 0 为透明）', 'ok');
}

function newProject() {
  if (!confirm('新建空白项目？当前内容将丢失（请先导出 .p8 保存）。')) return;
  store.replaceProject(createEmptyProject());
  location.hash = 'code';
  location.reload();
}

document.getElementById('btn-export-p8').addEventListener('click', downloadP8);
document.getElementById('btn-import').addEventListener('click', () => importP8().catch((e) => toast(e.message || '导入失败', 'error')));
document.getElementById('btn-export-png').addEventListener('click', exportPng);
document.getElementById('btn-new').addEventListener('click', newProject);

// ---------- 启动 ----------
tabs.switchTo(currentHash());
