# PIXEL STUDIO 技术文档

> 浏览器里的"幻想主机"——一份可以照着手动复刻的完整技术说明。
> 对应版本：六大工作台（代码/像素画/地图/音效/音乐/运行）+ 11 套色板 + 8 页精灵 + `.wy` 卡带格式。

---

## 目录

1. [项目定位与设计哲学](#1-项目定位与设计哲学)
2. [技术栈全景](#2-技术栈全景)
3. [目录结构](#3-目录结构)
4. [整体架构：五层分层](#4-整体架构五层分层)
5. [数据模型层（复刻的地基）](#5-数据模型层复刻的地基)
6. [调色板系统](#6-调色板系统)
7. [核心框架层（store / tabs / dom）](#7-核心框架层store--tabs--dom)
8. [像素画编辑器](#8-像素画编辑器)
9. [音频引擎与音乐/音效编辑器](#9-音频引擎与音乐音效编辑器)
10. [Lua 运行时](#10-lua-运行时)
11. [卡带格式 `.wy` 规范](#11-卡带格式-wy-规范)
12. [存储与文件 IO](#12-存储与文件-io)
13. [测试体系](#13-测试体系)
14. [部署](#14-部署)
15. [手动复刻路线图](#15-手动复刻路线图)

---

## 1. 项目定位与设计哲学

**一句话**：打开网页就能做游戏的像素游戏开发工作室，对标 PICO-8 教育版。

四条设计决策贯穿全项目，复刻前先理解它们：

| 决策 | 含义 | 为什么 |
|------|------|--------|
| **零构建** | 没有打包器、没有 npm 依赖安装、没有 TypeScript。原生 ES Module + `<script type="module">` 直接部署静态文件 | 学习成本归零，GitHub Pages 即开即用，任何文件都能单独读懂 |
| **索引像素** | 画布每个像素存的是**调色板索引**（一个数字），不是 RGB | 切色板零数据迁移；文件极小；天然复古 |
| **纯函数数据层** | 像素/音频数据模型是"无 DOM 依赖"的纯函数模块 | 浏览器和 Node 共用，`node --test` 直接测逻辑 |
| **薄 JS 边界** | Lua 运行时里 JS 只暴露 14 个最底层原语，其余 API 全部用 Lua 实现 | 分层清晰：性能敏感的走 JS，语义复杂的走 Lua 脚本（改起来不用碰 FFI） |

**存储语义**：数据存 `sessionStorage`（关页面即清空），长期保存靠导出 `.wy` 卡带文件。这是产品选择——零账号、零隐私负担。

---

## 2. 技术栈全景

| 技术 | 版本 | 角色 | 选型理由 |
|------|------|------|----------|
| 原生 ES Module | — | 模块系统 | `import`/`export` 浏览器原生支持，`import()` 动态加载实现按需分割 |
| Canvas 2D | — | 全部图形渲染 | 像素编辑器、tracker 网格、运行时屏幕都是 `<canvas>`，`putImageData` 是像素级呈现的最快路径 |
| WebAudio | — | 芯片音源 | `OscillatorNode`（方/正弦/锯齿/三角）+ `AudioBufferSourceNode`（白噪声）+ `GainNode` 包络，免采样合成 |
| **fengari-web** | 0.1.4 | 浏览器里的 Lua 5.3 VM | 纯 JS 实现的完整 Lua，`lua_pcall`/`lua_sethook` 等 C API 全部可用（指令预算依赖它） |
| **CodeMirror 5** | 5.65.16 | 代码编辑器 | 5.x 是 UMD 全局构建，不需要构建步骤（6.x 是 ESM 但集成更繁琐）；Lua mode + material-darker 主题 |
| Node 内置 test runner | ≥18 | 单元测试 | `node --test`，零依赖 |
| GitHub Pages | — | 托管 | 纯静态，推即上线 |

> vendor 依赖全部下载到 `vendor/` 本地提交，并在 `vendor/VERSIONS.md` 登记。**绝不引用 CDN**——离线可用，不怕链接腐烂。

---

## 3. 目录结构

```
spritely_local/
├── index.html              # 单页入口：顶栏 + tab 栏 + <main id="view">
├── package.json            # 仅 { type: "module", scripts: { test } }，无依赖
├── css/
│   ├── tokens.css          # 设计令牌（CSS 变量：颜色/字体/间距）
│   ├── base.css            # 重置与全局
│   ├── components.css      # 按钮/输入框/色板格等通用件
│   ├── layout.css          # 顶栏/tab栏/主区布局
│   └── views/*.css         # 各工作台私有样式
├── js/
│   ├── main.js             # 应用入口（~100 行）：store 初始化 + tab 接线 + 顶栏动作
│   ├── core/               # ── 核心框架层 ──
│   │   ├── store.js        # 可订阅单一数据源（32 行）
│   │   ├── tabs.js         # hash 路由 + mount/unmount 生命周期
│   │   ├── dom.js          # el() 建元素 / makeScope() 事件统一销毁 / clearNode()
│   │   └── toast.js        # 右上角轻提示
│   ├── lib/                # ── 纯函数数据层（无 DOM，Node 可测）──
│   │   ├── pixel-data.js   # 精灵表/地图的 Uint8Array + 读写/泛洪/精灵编号换算
│   │   ├── palette.js      # PALETTES 注册表（11 套）+ 取模取色
│   │   ├── draw.js         # Bresenham 直线/矩形/圆（产出像素坐标点）
│   │   ├── sfx-data.js     # 音效数据模型 + hex 编解码
│   │   └── music-data.js   # 乐曲数据模型 + hex 编解码
│   ├── ui/stepgrid.js      # 共享 tracker 网格 canvas（音效/音乐两编辑器复用）
│   ├── audio/engine.js     # WebAudio 单例引擎（playTone/playSfx/startMusic）
│   ├── views/              # ── 六个工作台，各自 mount/unmount ──
│   │   ├── code.js  sprite.js  map.js  run.js  sfx.js  music.js
│   └── project/            # ── 项目级数据 ──
│       ├── model.js        # 工厂 + spritePages 多页不变式
│       ├── storage.js      # sessionStorage 存取 + base64 编解码
│       ├── serializer.js   # .wy 卡带 序列化/反序列化
│       ├── demo.js         # 内置 demo（代码生成的平台跳跃游戏）
│       └── download.js     # 文本/图片下载、文件选择
├── runtime/                # ── Lua 运行时 ──
│   ├── api.js              # fengari 状态机 + 14 个 JS 底层原语
│   ├── prelude.lua.js      # Lua 预置 API（约 160 行 Lua 源码字符串）
│   ├── desugar.js          # PICO-8 复合赋值 → 标准 Lua（16 行正则）
│   └── loop.js             # 30fps 主循环 + 指令预算 + 屏幕呈现
├── vendor/                 # 本地化的第三方库（见 VERSIONS.md）
├── tests/                  # node --test 单测（48 个）
└── legacy/                 # 旧版工具（图片/视频转像素画），独立入口
```

---

## 4. 整体架构：五层分层

```
┌─────────────────────────────────────────────────┐
│  视图层  views/{code,sprite,map,sfx,music,run}.js │  mount/unmount 生命周期
│          ui/stepgrid.js（音效音乐共享网格）         │  只操作 DOM/canvas，不碰数据格式
├─────────────────────────────────────────────────┤
│  运行时层  runtime/{api,prelude,desugar,loop}.js  │  fengari Lua VM + 主循环
├─────────────────────────────────────────────────┤
│  音频层  audio/engine.js                          │  WebAudio 单例，三类消费方共用
├─────────────────────────────────────────────────┤
│  数据层  lib/{pixel-data,palette,sfx-data,...}.js │  纯函数、无 DOM、Node 可测
│          project/{model,serializer,storage}.js    │
├─────────────────────────────────────────────────┤
│  框架层  core/{store,tabs,dom,toast}.js + main.js │  32 行 store + hash 路由
└─────────────────────────────────────────────────┘
```

**数据流**：视图直接修改 `store.project` 里的 `Uint8Array`（就地可变，不搞不可变数据），改完调 `store.touch()` → 订阅者收到通知 + 300ms 防抖自动保存。没有虚拟 DOM、没有单向数据绑定仪式——因为每个像素都在画布上，改数据后自己重绘对应区域即可。

**依赖方向**（单向，绝不反向）：

```
views → runtime / audio / lib / core
runtime → audio / lib
lib → （无依赖，除 project/serializer 跨引 lib）
```

---

## 5. 数据模型层（复刻的地基）

### 5.1 项目对象

```js
// js/project/model.js
{
  version: 1,
  code: '…lua…',
  sprites: Uint8Array(128×128),   // 页 0
  spritePages: [page0, …],        // 最多 8 页；不变式：spritePages[0] === sprites
  map: Uint8Array(128×64),        // 瓦片索引，指向精灵编号
  palette: 'pico8',               // 调色板键名
  sfx: [ { speed, steps: [{p,w,v} ×16] } ×8 ] || null,
  music: { speed, chain: [0], patterns: [ [声部][步] ×4 ] } || null,
}
```

关键不变式：`spritePages[0] === sprites`（页 0 与旧字段是**同一个引用**），保证运行时、地图、PNG 导出等老代码只认 `sprites` 也永远正确。

`normalizePages()` 的教训值得记住：归一化**只在结构非法时才重建数组**。早期版本无条件 `slice()` 重建，导致视图闭包里缓存的 `pages` 与 `project.spritePages` 脱钩——"点新增页没反应"这种诡异 bug 的根源。

### 5.2 精灵表与坐标环绕

- 精灵表 `Uint8Array(128×128)` = 16384 字节，每字节一个调色板索引（0-31）
- 16×16 格网分出 **256 个 8×8 精灵**，精灵编号 `n` ↔ 像素坐标换算：

```js
// 编号 → 左上角像素
const sx = (n % 16) * 8, sy = Math.floor(n / 16) * 8;
// 像素 → 编号
const n = Math.floor(px / 8) + 16 * Math.floor(py / 8);
```

- **坐标环绕**（PICO-8 习惯）：`(v % m + m) % m`，越界不报错而是绕回
- 泛洪填充：栈式四连通扫描线变体，支持限定矩形（只填当前精灵格）

### 5.3 图形算法（js/lib/draw.js）

直线（Bresenham）、空心/实心矩形、空心圆（中点法八分对称）、实心圆（逐行）。统一签名 `algo(x0,y0,x1,y1, set)`——算法只**产出坐标点**，写到哪里由调用方的 `set` 决定。于是同一份算法被三处复用：像素编辑器预览、Lua prelude 的 `line/rect/circ`、测试。

---

## 6. 调色板系统

### 6.1 注册表模式

```js
// js/lib/palette.js
export const MAX_COLORS = 32;   // 像素索引上限（软件约定，非存储极限）

export const PALETTES = {
  pico8: { label: 'PICO-8', colors: [/* 16 主 + 16 隐藏色板 */] },
  tic80: { label: 'TIC-80 · Sweetie 16', colors: [/*…*/] },
  gb:    { label: 'Game Boy', colors: [/* 4 色 */] },
  gbc, c64, apple2, msx1, msx2, sms, nes, zx, // 共 11 套
};

export const DEFAULT_PALETTE = 'pico8';
```

新增色板 = 加一条数据 + 补一行测试断言，五分钟的事。**这是注册表模式的好处**：加东西不改逻辑。

### 6.2 索引 → 颜色的取模映射

小色板（GB 只有 4 色）遇到索引 5 怎么办？取模循环：

```js
export function paletteColorAt(key, i) {
  const cs = (PALETTES[key] || PALETTES.pico8).colors;
  return cs[((i % cs.length) + cs.length) % cs.length];
}
```

这就是"**切色板零数据迁移**"的实现：像素永远存 0-31 的索引，换色板只换映射表。32 色（PICO-8 全隐藏板、NES 32 色子集）刚好用满索引空间；更大的色板（如 NES 全彩 54 色）受 `MAX_COLORS=32` 约束只能取样子集——底层 `Uint8Array` 每像素 1 字节理论上支持到 256，抬上限只需改钳制值（`setPixel` 的 `min(31,…)` 与运行时的 `& 31`）。

---

## 7. 核心框架层（store / tabs / dom）

### 7.1 store.js —— 32 行的"状态管理"

```js
export function createStore(project, { onPersist } = {}) {
  const listeners = new Set();
  let timer = null;
  return {
    project,
    touch(immediate = false) {          // 改数据后必须调
      listeners.forEach((l) => l(project));
      // 300ms 防抖自动保存；immediate 立即存
    },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
    replaceProject(newProject) { /* 导入/新建时整体替换 */ },
  };
}
```

设计要点：**就地可变 + 手动通知**。不做 Proxy 劫持、不做不可变快照——像素编辑每帧改几十次数据，劫持的开销和复杂度不值得。约定俗成：谁改数据谁 `touch()`。

### 7.2 tabs.js —— hash 路由 + 严格生命周期

```js
const LOADERS = {
  sprite: () => import('../views/sprite.js'),  // 动态 import = 按需加载
  // …
};
async function switchTo(name) {
  instance?.unmount?.();          // 先卸载旧的（停 raf、停音频、解绑事件）
  location.hash = name;           // URL 可分享、可后退
  const mod = await LOADERS[name]();
  instance = mod.mount(containerEl, { store, tabs });  // 再挂新的
}
```

每个视图必须返回 `unmount()`。`hashchange` 监听让浏览器前进/后退键天然可用。

### 7.3 dom.js —— 两个消灭内存泄漏的小工具

```js
el('button', { class: 'btn', title: '…' }, '文本');  // 声明式建元素
const scope = makeScope();
scope.listen(window, 'keydown', fn);   // 注册事件
scope.abort();                          // unmount 时一次解绑所有
```

每个视图的 mount 里 `const scope = makeScope()`，unmount 里 `scope.abort()`。视图里所有 `addEventListener` 都走 `scope.listen`，切走时绝不留游离监听器。

---

## 8. 像素画编辑器

`js/views/sprite.js`（~390 行，最大的视图）。结构上是一块**双画布布局**：

- **编辑画布**：24×24 格的局部放大视图（zoom 14px/像素），只渲染当前精灵格
- **精灵表预览**：128×128 全表缩略图（CSS 放大到 256px），当前格高亮描边

### 交互管线

```
pointerdown/move → 屏幕像素 → 逆缩放 → 数据像素坐标
  → 按工具分发（pencil 写 1 像素 / line/rect 用 draw.js 预览 / fill 泛洪 / pick 读色）
  → store.touch() → render()（只重绘受影响区域）
```

直线/矩形是**拖拽预览式**：按下记起点，拖动中在"快照副本"上叠画预览，松手才写真数据。

### 撤销/重做：按格快照

不做全表快照（16384 字节 × 每笔 = 太浪费），只快照**当前精灵格的 64 字节**：

```js
function pushUndo() {
  undoStack.push(sprites.slice(cellX * 8, cellX * 8 + 8 + …)); // 64 字节
  redoStack.length = 0;
}
```

切页时清空两个栈（快照按页存储，不跨页）。

### 侧栏布局技巧

色板区固定 `height: 100px; overflow-y: auto`（约 4 行）。这样从 4 色 GB 切到 32 色 NES 时布局不跳，超出的色块滚轮查看。

---

## 9. 音频引擎与音乐/音效编辑器

### 9.1 数据模型（先于引擎设计）

```js
// 音效：8 槽位 × 16 步，每步 { p: 音高0-23|-1休止, w: 波形0-4, v: 音量0-8 }
// 乐曲：4 pattern × 2 声部（主旋律/贝斯），每步结构同上；chain 数组决定播放顺序
WAVES = ['square', 'sine', 'sawtooth', 'triangle', 'noise'];
BASE_MIDI = 48;  // C3，p=0；midiOf(p) = 48 + p
```

音效与音乐**相互独立**（PICO-8 是强绑定的，这里刻意解耦）：音效是游戏代码里的一次性短促声音 `sfx(0)`；音乐是编排好的循环曲 `music(0)` / `music(-1)`。

### 9.2 引擎：一个 OscillatorNode 就是一台芯片音源

```js
export function playTone({ wave, midi, t, dur, vol }) {
  const o = ctx.createOscillator();
  o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);  // MIDI → 频率
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(vol * 0.22, start + 0.008);  // 8ms 起音
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);   // 指数衰减
  o.connect(g).connect(ctx.destination);
}
```

噪声通道：`AudioBufferSourceNode` 循环播放 1 秒白噪声 buffer，`playbackRate` 跟音高走（`2^((midi-69)/12)/4`）——用播放速率模拟"噪声密度"，这是最省事的伪噪声音高控制。

### 9.3 乐曲循环：lookahead 调度

WebAudio 的时间轴是硬件级的，`setInterval` 直接排音符会抖。标准解法：

```js
function scheduleStep() {
  const lookahead = ctx.currentTime + 0.15;   // 提前 150ms 排音符
  while (player.nextTime < lookahead) {
    playTone({ t: player.nextTime, … });       // 全部按绝对时间精确排
    player.nextTime += stepSec;
    // 步进 → pattern 切换 → chain 轮转
  }
}
player.timer = setInterval(scheduleStep, 40);  // 每 40ms 补排一批
```

**模块级单例**：全应用共享一个 `AudioContext` 和一个乐曲播放器（编辑器试播、整曲预览、游戏运行时三方共用），`stopMusic()` 全局有效。注意浏览器自动播放策略——首次发声前必须 `ctx.resume()`（放在用户手势链路里）。

### 9.4 tracker 网格（ui/stepgrid.js）

音效和音乐编辑器共用一个 canvas 网格组件：16 步 × (24 音高行 + 波形行 + 音量行)。组件只管**渲染 + 命中检测回调**，数据读写全部通过 `getSteps` / `onEdit` 回调交给调用方——纯 UI 件不认识业务。

---

## 10. Lua 运行时

这是全项目最有含金量的部分。目标：在浏览器里安全地跑用户写的 PICO-8 风格 Lua，30fps，死循环不卡页面。

### 10.1 三层结构

```
用户 Lua 代码
    ↓ desugar（JS 正则，源码级）
标准 Lua
    ↓ loadChunk
┌──────────────────────────────────────┐
│ prelude.lua（Lua 层）：pset/spr/map/  │ ← 语义复杂但低频的 API，
│   line/rect/circ/circfill/btnp/sin…  │    纯 Lua 实现，改起来零 FFI
├──────────────────────────────────────┤
│ api.js 原语层（JS 层）：_cls _pset    │ ← 每帧百万次调用的热点，
│   _pget _rectfill _sget _sset _spr   │    直接操作 Uint8Array，最快路径
│   _mget _mset _mapdraw _btn _print   │
│   _time _sfx _music                  │
├──────────────────────────────────────┤
│ screen = Uint8Array(128×128)         │ ← 屏幕也是索引数组，非 canvas！
└──────────────────────────────────────┘
```

**关键决策：`screen` 是 `Uint8Array` 而不是 canvas**。Lua 每帧改数组（纳秒级），帧末才一次性换算成 ImageData 呈现：

```js
// loop.js present()
for (let i = 0; i < W * H; i++) {
  const [r, g, b] = RGB[screen[i] % RGB.length];  // 项目色板 → RGB
  data[i*4] = r; data[i*4+1] = g; data[i*4+2] = b; data[i*4+3] = 255;
}
ctx.putImageData(img, 0, 0);       // 一次 putImageData
ctx.drawImage(overlay, 0, 0);      // 叠加矢量文本层（print 用）
```

`print` 画在独立 overlay canvas 上（矢量 monospace 字体），present 时叠加再清空——像素画布保持纯索引语义。

### 10.2 prelude 的 PICO-8 语义细节

- **相机**：所有绘制函数加 `cam.x/cam.y` 偏移；JS 原语只收已偏移的整数坐标
- **颜色状态**：`color(c)` 设当前色，后续 `pset` 不带色参时用 `col` 变量（Lua 侧状态）
- **sin/cos 的 PICO-8 习惯**：参数以"圈"为单位（`sin(0.25)` = 90°）且方向取反：`-math.sin(x * 2 * math.pi)`
- **btnp**（边沿检测）：Lua 侧维护 `prevbtn` 表，本帧按下且上帧未按才返回 true
- **pal/palt**：占位空函数容错（未实现但不报错）

### 10.3 desugar：16 行正则补齐 PICO-8 语法

标准 Lua 5.3 **没有** `+=`，但所有 PICO-8 教程都在用。加载前做源码级转换：

```js
// px-=1.5 → px = px - 1.5 ；obj.speed+=0.2 → obj.speed = obj.speed + 0.2
const LHS = '[A-Za-z_]\\w*(?:\\s*\\.\\s*[A-Za-z_]\\w*|\\s*\\[[^\\]\\n]*\\])*';
const COMPOUND = new RegExp(`(?<!["'\\w])(${LHS})\\s*([+\\-*/%]|\\.\\.)=(?!=)`, 'g');
```

三个防误伤细节：负向 lookbehind 排除字符串字面量；`(?!=)` 排除 `==` 比较；**不改动行数**所以 Lua 报错行号仍然准确。

### 10.4 指令预算：死循环克星

fengari 完整实现了 C API 的 debug hook：

```js
const INSTRUCTION_BUDGET = 5_000_000;
const hook = (L) => lauxlib.luaL_error(L, '运行超出单帧指令预算（可能是死循环），已中止');
const armHook = () => lua.lua_sethook(L, hook, lua.LUA_MASKCOUNT, INSTRUCTION_BUDGET);
// 每帧 armHook() 重置计数 → _update/_draw 各有 500 万条指令额度
```

超预算 → `luaL_error` → `lua_pcall` 返回非 OK → 主循环 catch → 停机 + 错误显示在控制台。**用户永远写不死浏览器**。

### 10.5 fengari 加载策略

`fengari-web.js` 219KB，**懒加载**：首次点运行才动态插 `<script>`。代码编辑器页永远不背这个开销。加载后读 `window.fengari` 拿到 `{ lua, lauxlib, lualib, to_luastring, to_jsstring }`。

注意所有传入 Lua 的字符串要过 `to_luastring()`（转 UTF-8 字节数组），错误信息回来用 `to_jsstring()`。

---

## 11. 卡带格式 `.wy` 规范

`.wy` 是**文本格式**，兼容 PICO-8 的 `.p8` 布局，用自己的扩展块承载增强数据。设计原则：**官方块保持官方语义（PICO-8 能读我们的精灵/地图），自定块官方不认识会自动跳过**。

### 块清单

| 块 | 格式 | 归属 |
|----|------|------|
| 头两行 | `pico-8 cartridge // http://www.pico-8.com` + `version 41` | 官方 |
| `__lua__` | Lua 源码 | 官方 |
| `__gfx__` | 128 行 × 128 个 hex 字符（每像素 1 hex = 0-15） | 官方 |
| `__map__` | 64 行 × 128 hex（官方为 256 宽，导入取前 128） | 官方 |
| `__palette__` | 单行键名，如 `nes` | 自定 |
| `__pages__` | `P<n> <base64>`，每行一页（16384 字节 → base64） | 自定 |
| `__sfx__` | `L0 S<speed> <hex>`，每步 4 字符：`p(2)w(1)v(1)`，休止 = `ff` + 波形 + `0` | 自定 |
| `__music__` | `C <链…>` + `P<n> <hex>`（pattern：主旋律 64 字符 + 贝斯 64 字符） | 自定 |

### 高位色无损方案（精髓）

`__gfx__` 每像素 1 个 hex 字符只能表达 0-15，而我们的索引到 31。方案：

- **导出**：页 0 写官方 `__gfx__`（高位色截断为 `& 15`）；仅当页 0 含 ≥16 的色时，**追加** `__pages__ P0 <base64>` 无损承载；P1 起的扩展页无论如何都走 `__pages__`
- **导入**：先解析 `__gfx__`，若存在 `__pages__ P0` 则**用 base64 覆盖页 0**（无损数据优先）；`P1…P7` 合成完整页组
- 效果：无高位色的项目保持官方卡带兼容；有高位色的项目在 PICO-8 里打开颜色"降级但不崩"，在本站打开完全无损

### 反序列化的容错原则

导入是**容错式**的：不认识的块（`__label__`/`__gff__`/`__quilt__`…）跳过；短行跳过；非法值回落 0；页数据长度不对（≠16384）整页丢弃。**任何 .p8 文本都不会让导入崩溃**。

---

## 12. 存储与文件 IO

### sessionStorage 自动保存

```js
// key: pixel-studio.project.v1
{
  version: 1,
  code: '…',
  sprites: '<base64>',       // 页 0
  pages: ['<base64>', …],    // 全部页
  map: '<base64>',
  sfx: {...}, music: {...},  // 小对象直接 JSON
  palette: 'nes',
}
```

base64 编码用分块 `String.fromCharCode` + `btoa`（避免 apply 参数上限）。总数据 <100KB，远低于 ~5MB 配额。

### 文件下载（零依赖）

```js
function downloadText(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}
```

PNG 导出：遍历页组逐像素 `fillRect`（索引→项目色板 RGB，色 0 跳过=透明），多页纵向拼接成 128×(128×页数)。

---

## 13. 测试体系

### 分层保证可测性

**纯函数层全部 Node 直测**（48 个断言组）：`pixel-data`（环绕/泛洪）、`palette`（11 板/取模/RGB）、`draw`（直线端点）、`serializer`（.wy 往返/官方卡带兼容）、`sfx-music`（hex 编解码往返）、`pages`（多页不变式）、`desugar`（复合赋值转换）。

```bash
npm test        # node --test tests/
```

实现手段：lib/ 与 project/ 严禁 `import` 任何 DOM 依赖；DOM 只存在于 views/、ui/、core/。**测试深度是架构质量的试金石**——如果一个模块测不了，说明它混层了。

### e2e：无头 Chrome（可选但推荐）

UI 层用系统 Chrome 无头模式做冒烟（不装 playwright，避免 npm install 被环境 SIGKILL）：

```bash
python3 -m http.server 8080 &
chrome --headless=new --disable-gpu --no-sandbox --no-proxy-server \
  --virtual-time-budget=8000 --dump-dom http://localhost:8080/index.html#sprite
```

用同源 iframe 驱动页模拟点击、`--dump-dom` 断言 DOM 状态。三个血泪坑：
1. 驱动页**必须** `<meta charset="utf-8">`，否则 Chrome 按拉丁解码，中文字面量断言永远 false
2. `--virtual-time-budget` 让异步 mount 跑完再 dump
3. dump 出来的内联 style 里 hex 可能被 Chrome 规范成 `rgb()`，grep hex 匹配不到 ≠ 渲染错误

---

## 14. 部署

GitHub Pages，推 main 即上线，无 CI 无构建：

```bash
git push origin main
# 线上：https://<user>.github.io/<repo>/
```

两个运维细节：
- Pages 响应带 `max-age=600` 缓存 → 改版后用户要 **Cmd+Shift+R** 强刷才能看到
- push 后 Pages 构建有延迟 → curl 验证 404 时等 30-60s 再查一次

本地预览（ES Module 必须走 http，file:// 不行）：

```bash
python3 -m http.server 8080
```

---

## 15. 手动复刻路线图

按依赖顺序从零手写，每步结束都有可运行的东西：

1. **骨架**：`index.html` + CSS 令牌 + tab 栏（纯静态切换）。理解 `<script type="module">` 与动态 `import()`
2. **数据层**：`pixel-data.js`（Uint8Array + 环绕读写 + 精灵编号换算）+ `draw.js`（Bresenham 直线）。配套写 `node --test`——先有测试再有 UI
3. **store + dom**：32 行 store、`el()`/`makeScope()`。这是后面所有视图的地基
4. **像素编辑器**：双画布 + 指针事件管线 + 按格快照撤销。此时已经是一个可用的画图工具
5. **调色板注册表**：`palette.js` + 侧栏色板。体验"索引像素"架构的红利
6. **存储 + 导出**：sessionStorage 自动保存、`.wy` 序列化（先只做 `__lua__/__gfx__/__map__`）、Blob 下载
7. **代码工作台**：接 CodeMirror 5（UMD 全局直接用）
8. **Lua 运行时**（最大的一步，再拆）：
   a. fengari 懒加载 + `_pset/_cls/_sget/_spr` 四个原语 + `present()`（先把点画上屏幕）
   b. prelude：pset/spr/camera/color → line/rect → circ → btn/btnp
   c. desugar 正则
   d. 30fps 主循环 + 指令预算 hook
   e. `_mapdraw` + mget/mset
9. **地图编辑器**：从精灵表选瓦片 + 左绘右擦（复用 sprite.js 的事件管线思路）
10. **音频**：先写 `sfx-data.js` 纯数据模型 + hex 编解码（测试就位），再写 engine（playTone → playSfx → lookahead startMusic），最后 tracker 网格视图
11. **收尾**：`__sfx__/__music__/__palette__/__pages__` 扩展块、PNG 导出、多页精灵、内置 demo

每步的验收标准：`npm test` 全绿 + 无头 Chrome 能打开对应 tab 不报错。

---

## 附录：性能与体量参考

- 自有代码 ~2600 行 JS + ~1000 行 CSS，全项目（含 vendor）约 1.5MB
- 主循环帧预算：30fps = 33ms/帧；500 万条 Lua 指令约在预算内跑完（视代码而定）
- 精灵表 8 页 + 地图 = 139,264 字节索引数据；sessionStorage 序列化后 <100KB（base64 膨胀 4/3 后仍远小于配额）
- 内存里最贵的对象是 `Uint8Array(16384) × 8`，共 128KB——这就是索引像素的威力
