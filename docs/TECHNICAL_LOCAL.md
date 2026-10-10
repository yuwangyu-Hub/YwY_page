# PIXEL STUDIO 技术文档 · 本地原生应用版（TECHNICAL_LOCAL）

> 与浏览器版（`TECHNICAL.md`）同一产品形态：六大工作台（代码/像素画/地图/音效/音乐/运行）、
> 索引像素、11 套色板、8 页精灵、`.wy` 卡带格式、Lua 脚本运行时。
> 区别只有一个：**不跑在浏览器里，是本地原生桌面应用**。
>
> 技术路线：**C++17 + SDL2 + Dear ImGui + Lua 5.4（C API）**。
> 这正是真实幻想主机的经典配方——PICO-8 本身就是 C + Lua 写的。
> 阅读本文前建议先读浏览器版，数据模型与 `.wy` 格式两章完全通用，本文聚焦"原生替换"。

---

## 目录

1. [原生版与浏览器版的本质差异](#1-原生版与浏览器版的本质差异)
2. [技术栈映射表：浏览器 → 原生](#2-技术栈映射表浏览器--原生)
3. [为什么选 SDL2 + ImGui + Lua C API](#3-为什么选-sdl2--imgui--lua-c-api)
4. [目录结构](#4-目录结构)
5. [整体架构：五层分层 + 双线程](#5-整体架构五层分层--双线程)
6. [数据模型层（与浏览器版完全相同）](#6-数据模型层与浏览器版完全相同)
7. [平台层：SDL2 窗口、主循环与像素呈现](#7-平台层sdl2-窗口主循环与像素呈现)
8. [UI 层：Dear ImGui 实现六大工作台](#8-ui-层dear-imgui-实现六大工作台)
9. [音频层：SDL2 音频回调实现芯片音源](#9-音频层sdl2-音频回调实现芯片音源)
10. [Lua 运行时：原生 C API 与 fengari 的对应关系](#10-lua-运行时原生-c-api-与-fengari-的对应关系)
11. [卡带格式 `.wy`：一字不改](#11-卡带格式-wy一字不改)
12. [存储：sessionStorage → 本地文件](#12-存储sessionstorage--本地文件)
13. [文件 IO：原生打开/保存对话框](#13-文件-io原生打开保存对话框)
14. [测试体系](#14-测试体系)
15. [构建与分发：CMake](#15-构建与分发cmake)
16. [手动复刻路线图](#16-手动复刻路线图)
17. [低门槛替代技术栈](#17-低门槛替代技术栈)

---

## 1. 原生版与浏览器版的本质差异

浏览器版受四条枷锁，原生版全部打开：

| 枷锁 | 浏览器版 | 原生版 |
|------|---------|--------|
| 无文件系统 | sessionStorage，关页即清，导出靠 Blob 下载 | 直接读写磁盘文件，自动保存就是写一个 `.wy` |
| 无持久进程 | 关标签页一切归零 | 应用常驻，最近文件列表、多项目、崩溃恢复都顺理成章 |
| 音频要"解锁" | AudioContext 必须等用户手势 resume | 打开应用即可发声，SDL 音频设备直接 open |
| 单线程为主 | 主循环 + WebWorker 有限 | 天然多线程：渲染线程 / 音频回调线程 / Lua 各就各位 |

同时，浏览器版的两大核心设计在原生版**原样保留**，因为它们与技术栈无关：

- **索引像素**：每像素存调色板索引（0-31），切色板零迁移
- **薄边界 + prelude 分层**：JS 原语层变成 C 函数原语层，prelude.lua 一字不改

---

## 2. 技术栈映射表：浏览器 → 原生

| 能力 | 浏览器版 | 原生版 | 说明 |
|------|---------|--------|------|
| 语言 | JavaScript (ESM) | **C++17** | 数据层代码几乎是逐行直译 |
| 窗口/输入/渲染 | Canvas 2D + DOM | **SDL2** | `SDL_Renderer` + 流纹理 |
| UI 组件 | 手写 DOM + CSS | **Dear ImGui** | 即时模式 UI，工具类软件标配 |
| 代码编辑器 | CodeMirror 5 | **ImGui InputTextMultiline**（初版）/ Scintilla（进阶） | 语法高亮可后补 |
| Lua 虚拟机 | fengari-web（JS 实现的 Lua 5.3） | **Lua 5.4 官方 C 库** | C API 几乎与 fengari 同名同用法 |
| 音频 | WebAudio（OscillatorNode） | **SDL2 音频回调**（手写波形合成） | 见 §9，与 fengari→C API 同级平滑 |
| 存储自动保存 | sessionStorage + 防抖 | **直接写文件** + 防抖 | §12 |
| 打开/保存文件 | `<input type=file>` + Blob | **nfd**（原生文件对话框） | §13 |
| 序列化 | 自研 `.wy` 文本格式 | **同一格式，零改动** | §11 |
| 单元测试 | `node --test` | **doctest**（单头文件） | §14 |
| 构建 | 无（静态文件） | **CMake** + FetchContent | §15 |
| 分发 | GitHub Pages | 二进制 / 源码编译 | 无服务器 |

第三方依赖全部**单头文件或系统库**：SDL2（系统包管理器装）、Dear ImGui（几个源文件）、Lua 5.4（十几个 C 文件）、nlohmann/json（单头）、doctest（单头）、nfd（小库）。依然贯彻"依赖本地化、绝无隐藏魔法"。

---

## 3. 为什么选 SDL2 + ImGui + Lua C API

1. **Lua C API 与 fengari 无缝对译**。fengari 本来就是照着 C API 实现的：
   `luaL_newstate` / `luaL_openlibs` / `lua_pushcfunction` / `lua_setglobal` / `lua_pcall` / `lua_sethook` ——同名同参。浏览器版 `api.js` 的 14 个原语逐个抄成 C 函数即可，**指令预算防死循环的 hook 机制原样成立**。
2. **SDL2 是像素级渲染的最短路径**：128×128 逻辑屏 → 一张流纹理（streaming texture），每帧 `SDL_LockTexture` 写 ARGB 字节 → `SDL_RenderCopy` + `SDL_RenderSetLogicalSize` 整数倍缩放。这就是 Canvas `putImageData` 的原生对偶。
3. **ImGui 是"工具软件 UI"的标准答案**：停靠面板、色块按钮、拖拽条全是现成的，写一个色板格只要三行。它非常适合复刻本项目的工具型界面，而不适合复刻"网站感"的界面——正好我们不需要网站感。
4. **教学价值最大**：这套组合让你亲手触及音频线程、双缓冲纹理、C 互操作、固定步长主循环——全是浏览器帮你隐藏掉的核心工程课题。

---

## 4. 目录结构

```
pixel-studio-native/
├── CMakeLists.txt
├── external/                  # FetchContent 拉取：lua, imgui, nlohmann/json, doctest, nfd
├── src/
│   ├── main.cpp               # SDL init + 主循环 + 线程编排（~150 行）
│   ├── core/
│   │   ├── project.h/.cpp     # Project 结构体工厂（对应 model.js）
│   │   ├── palette.h/.cpp     # PALETTES 注册表 + 取模取色（直译 palette.js）
│   │   ├── pixel_data.h/.cpp  # 精灵表/地图读写、泛洪、精灵编号换算
│   │   ├── draw.h/.cpp        # Bresenham 直线/矩形/圆（模板参数 set 回调）
│   │   ├── sfx_data.h/.cpp    # 音效数据模型 + hex 编解码
│   │   └── music_data.h/.cpp  # 乐曲数据模型 + hex 编解码
│   ├── serialize/
│   │   ├── cartridge.h/.cpp   # .wy 序列化/反序列化（直译 serializer.js）
│   │   └── storage.h/.cpp     # 自动保存（写文件版）
│   ├── audio/
│   │   └── engine.h/.cpp      # 音频设备 + 回调合成 + 音符环形队列
│   ├── runtime/
│   │   ├── api.h/.cpp         # Lua 状态机 + 14 个 C 原语（对应 api.js）
│   │   ├── prelude.lua        # 与浏览器版同一个文件，一字不改
│   │   ├── prelude_embed.cpp  # xxd/嵌入脚本生成的字节数组
│   │   ├── desugar.h/.cpp     # += 解糖（std::regex 直译）
│   │   └── loop.h/.cpp        # 固定步长主循环 + 指令预算 + 呈现
│   └── ui/
│       ├── app.h/.cpp         # ImGui 总装配：停靠布局 + 六面板
│       ├── panel_sprite.cpp   # 像素画（画布 widget + 色板 + 工具）
│       ├── panel_map.cpp      # 地图
│       ├── panel_sfx.cpp      # 音效 tracker（对应 stepgrid.js）
│       ├── panel_music.cpp    # 音乐
│       ├── panel_code.cpp     # 代码编辑
│       └── panel_run.cpp      # 运行视口 + 手柄/键盘
├── assets/
│   └── fonts/NotoSansSC.ttf   # 中文 UI 字体（ImGui 默认无中文，见 §8.3）
└── tests/
    ├── test_pixel.cpp  test_palette.cpp  test_cartridge.cpp
    ├── test_sfx_music.cpp  test_draw.cpp  test_desugar.cpp
    └── test_runtime.cpp       # 起 Lua state 跑冒烟脚本
```

---

## 5. 整体架构：五层分层 + 双线程

```
┌────────────────────────────────────────────────────┐
│ UI 层  ui/panel_*.cpp（ImGui 即时模式，每帧重建绘制） │  只读数据、发编辑指令
├────────────────────────────────────────────────────┤
│ 运行时层  runtime/{api,prelude,desugar,loop}.cpp     │  Lua 5.4 C API
├────────────────────────────────────────────────────┤
│ 音频层  audio/engine.cpp   ←—— 音频回调线程（SDL 托管）│  无锁音符队列
├────────────────────────────────────────────────────┤
│ 数据层  core/*.h/.cpp + serialize/*                  │  纯 C++ 结构，无 SDL 依赖
├────────────────────────────────────────────────────┤
│ 平台层  main.cpp + SDL2（窗口/事件/时间）             │  固定步长主循环
└────────────────────────────────────────────────────┘
```

**线程模型**（原生版最重要的新课题）：

- **主线程**：SDL 事件轮询 → ImGui UI 绘制 → 游戏逻辑（跑 `_update/_draw`）→ 呈现纹理 → SDL_RenderPresent
- **音频线程**：SDL 内部创建并托管，回调里**只做一件事**——从音符环形队列取音符合成采样。绝不碰 UI、绝不碰堆分配、绝不锁
- 两线程交汇点只有一个**无锁 SPSC 环形队列**（主线程写"音符事件"，音频线程读）

浏览器版里 WebAudio 帮你隐藏了这整套东西；原生版自己写，这正是复刻的价值。

**数据流**：与浏览器版相同的"就地可变 + 显式通知"——但没有订阅者集合了，ImGui 是即时模式，**每帧 UI 直接读当前数据渲染**，编辑动作直接改数据。`store.touch()` 的 300ms 防抖保存变成 `storage.markDirty()`，主循环里检查脏标记决定是否写盘。

---

## 6. 数据模型层（与浏览器版完全相同）

此章是"直译练习"——所有逻辑与 `TECHNICAL.md` §5/§6 一致，仅语言不同：

```cpp
// core/pixel_data.h
constexpr int SHEET_W = 128, SHEET_H = 128, MAP_W = 128, MAP_H = 64;
constexpr int MAX_COLORS = 32;          // 索引上限，与浏览器版同一约定

struct Project {
    std::string code;                          // Lua 源码
    std::array<uint8_t, SHEET_W*SHEET_H> sprites{};   // 页 0
    std::vector<std::array<uint8_t, SHEET_W*SHEET_H>> spritePages; // 最多 8 页
    std::array<uint8_t, MAP_W*MAP_H> map{};    // 瓦片 = 精灵编号
    std::string palette = "pico8";             // PALETTES 键名
    std::optional<SfxBank> sfx;                // 8 槽 × 16 步
    std::optional<MusicData> music;            // 4 pattern × 2 声部 + chain
};
```

必须原样保留的三条规则：

1. **不变式** `spritePages[0] == sprites`（用引用/指针别名或统一 `spritePages[0]` 访问接口实现），老代码只认页 0 永远正确
2. **坐标环绕** `(v % m + m) % m`，越界绕回不报错
3. **取模取色** `paletteColorAt(key, i)`：小色板（GB 4 色）遇到索引 5 循环映射，切色板零数据迁移

调色板注册表从 `palette.js` 逐行直译成 `std::vector<Palette>`，11 套色值原样搬。新增色板依旧 = 加一条数据 + 补一条测试。

---

## 7. 平台层：SDL2 窗口、主循环与像素呈现

### 7.1 初始化与像素级呈现

```cpp
SDL_Init(SDL_INIT_VIDEO | SDL_INIT_AUDIO | SDL_INIT_GAMECONTROLLER);
SDL_Window*   win = SDL_CreateWindow("Pixel Studio", …, SDL_WINDOW_RESIZABLE);
SDL_Renderer* ren = SDL_CreateRenderer(win, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
// 128×128 逻辑分辨率 → 任意窗口尺寸自动整数/均匀缩放
SDL_RenderSetLogicalSize(ren, 128, 128);
// 流纹理：屏幕的最终落点
SDL_Texture* screenTex = SDL_CreateTexture(ren,
    SDL_PIXELFORMAT_ARGB8888, SDL_TEXTUREACCESS_STREAMING, 128, 128);
```

`present()`（对应浏览器版 loop.js 的 present）：

```cpp
void present(const uint8_t* screen, const Palette& pal) {
    uint32_t* px; int pitch;
    SDL_LockTexture(screenTex, nullptr, (void**)&px, &pitch);
    for (int i = 0; i < 128*128; i++) {
        const RGB& c = pal.rgb[screen[i] % pal.rgb.size()];  // 小色板取模
        px[i] = 0xFF000000u | (c.r << 16) | (c.g << 8) | c.b;
    }
    SDL_UnlockTexture(screenTex);
    SDL_RenderCopy(ren, screenTex, nullptr, nullptr);
}
```

对比浏览器版：`ImageData + putImageData` → `SDL_LockTexture + UnlockTexture`。都是"索引数组 → ARGB 字节 → 一次提交"，**每帧 16384 次查表，微秒级**。

### 7.2 固定步长主循环（accumulator 模式）

游戏逻辑锁 30fps，渲染跟 vsync：

```cpp
const double STEP = 1.0 / 30.0;         // 与浏览器版 FRAME_MS 对应
double acc = 0, last = SDL_GetPerformanceCounter();

while (running) {
    frameStart = now();
    pollEvents();                        // SDL + ImGui 事件
    acc += dt();
    while (acc >= STEP) {                // 逻辑可能一帧跑 0~N 步
        if (hasUpdate) callGlobal("_update");
        acc -= STEP;
    }
    if (hasDraw && running) { callGlobal("_draw"); }
    present(screen, palette);
    imguiRender();                       // 编辑器 UI（见 §8）
    SDL_RenderPresent(ren);
}
```

浏览器版用 rAF 节流（`ts - last < 33ms 就跳过`），原生版用标准 **accumulator**：逻辑步长恒定 1/30s，不随帧率漂移——游戏物理从此确定性（回放/录像功能的基石）。

### 7.3 输入映射

SDL 键盘扫描码直接映射 PICO-8 六键（对应 run.js 的 KEYMAP）：

```cpp
const SDL_Keycode KEYMAP[6] = { SDLK_LEFT, SDLK_RIGHT, SDLK_UP, SDLK_DOWN, SDLK_z, SDLK_x };
bool keys[6]{};   // _btn(i) 原语直接读这张表
```

`SDL_INIT_GAMECONTROLLER` 后手柄十字键/AB 键也并入同一张表（浏览器版虚拟按键的原生对偶）。`btnp` 的边沿检测仍在 prelude.lua 的 Lua 侧（`prevbtn` 表），一字不改。

---

## 8. UI 层：Dear ImGui 实现六大工作台

### 8.1 即时模式心智转换

浏览器版是**保留模式**：创建按钮 → 绑回调 → 等事件。ImGui 是**即时模式**：每帧直接写"我想要什么界面"，点没点用返回值：

```cpp
// 浏览器：const b = el('button',{class:'tool-btn'},'✏️'); b.onclick = …
// ImGui：
if (ImGui::Button("Pencil")) tool = Tool::Pencil;
ImGui::SameLine();
if (ImGui::Button("Fill"))   tool = Tool::Fill;
```

没有 DOM、没有 CSS、没有事件冒泡——UI 代码就是命令式的绘制清单。**浏览器版 sprite.js 里所有 `scope.listen` 全部消失**，取而代之的是每帧的 if 判断。

### 8.2 停靠布局替代 tab

ImGui docking 分支提供原生停靠面板：六个工作台不再是"切 tab"，而是**可任意分屏、可同屏**（比如左边像素画右边运行）。默认布局还原浏览器版：顶部菜单栏（对应顶栏按钮组）+ 主区域六个可停靠面板。

### 8.3 关键面板直译

**像素画面板**（panel_sprite.cpp，对应 sprite.js）：

```cpp
// 色板：32 色固定网格（对应 css 的 height:100px + overflow）
ImGui::BeginChild("palette", ImVec2(0, 4*rowH));   // 固定高度 → 超出滚动
for (int i = 0; i < (int)pal.colors.size(); i++) {
    ImGui::PushStyleColor(ImGuiCol_Button, toImVec4(pal.colors[i]));
    if (ImGui::Button(("##c" + std::to_string(i)).c_str(), {rowH,rowH}))
        curColor = i;
    ImGui::PopStyleColor();
    if ((i+1) % 8) ImGui::SameLine();
}
ImGui::EndChild();

// 画布：InvisibleButton + 手动指针事件 → 数据坐标
ImVec2 o = ImGui::GetCursorScreenPos();
if (ImGui::InvisibleButton("canvas", ImVec2(S, S))) { /* 点按 */ }
ImGui::SetItemAllowOverlap();
if (ImGui::IsItemActive() && ImGui::IsMouseDragging(0)) {
    ImVec2 m = ImGui::GetIO().MousePos;
    int px = (m.x - o.x) / zoom, py = (m.y - o.y) / zoom;   // 逆缩放
    // 按工具分发：pencil/line/rect/fill/pick（与浏览器版同一管线）
}
```

画布绘制用 `ImDrawList`：每格一个 `AddRectFilled`，网格线 `AddLine`，当前格描边。**撤销栈照搬**：按精灵格 64 字节快照（`std::array<uint8_t,64>` 进 `std::vector`）。

**tracker 网格**（panel_sfx.cpp，对应 stepgrid.js）：ImGui 表格 + 自绘格子，音高行 24 × 步 16，点格写音、拖动连画、波形/音量行循环取值——交互逻辑与浏览器版逐条对应。

**代码面板**（panel_code.cpp）：初版 `ImGui::InputTextMultiline`（够用，等宽字体）；要语法高亮与行号，接 **Scintilla** 或 ImGui 社区的 syntax-highlighter 组件。`Ctrl+Enter` 运行的热键用 `ImGui::GetIO().KeysDown` 检测。

### 8.4 中文字体

ImGui 默认只有 ASCII。启动时加载 `NotoSansSC.ttf` 并配置 glyph range：

```cpp
io.Fonts->AddFontFromFileTTF("assets/fonts/NotoSansSC.ttf", 16, nullptr,
    io.Fonts->GetGlyphRangesChineseFull());
```

这一步不做，所有中文 UI 显示为 `?`。

---

## 9. 音频层：SDL2 音频回调实现芯片音源

浏览器版 WebAudio 的三个机制（振荡器、包络、lookahead 调度）在原生版全部手写——这是全文档含金量最高的一章。

### 9.1 设备与回调

```cpp
SDL_AudioSpec want{}, have{};
want.freq = 44100; want.format = AUDIO_F32SYS; want.channels = 1;
want.samples = 512;                  // ~11.6ms 一回调
want.callback = audioCallback;
SDL_AudioDeviceID dev = SDL_OpenAudioDevice(nullptr, 0, &want, &have, 0);
SDL_PauseAudioDevice(dev, 0);        // 开机即响，无"手势解锁"
```

### 9.2 波形合成（对应 playTone 的 OscillatorNode）

音频回调按**绝对采样号**工作。每个音符事件携带 `startSample, durSamples, wave, freq, vol`：

```cpp
double phase(float f, int i) { return 2*M_PI*f*i/44100.0; }
float synth(const Note& n, int i) {          // i = 相对音符起点的采样号
    if (i < 0 || i >= n.durSamples) return 0;
    float env = attackDecay(i, n);            // 包络（见下）
    float t = (float)i / 44100.0f;
    switch (n.wave) {
        case Wave::Square:   return 0.5f*env*((std::fmod(n.freq*t,1.f)<0.5f)?1.f:-1.f);
        case Wave::Sine:     return env*std::sin(n.phase(i));
        case Wave::Sawtooth: return env*(2.f*std::fmod(n.freq*t,1.f)-1.f);
        case Wave::Triangle: /* 上斜下斜折线 */ …
        case Wave::Noise:    return env*noiseSample(n);   // 见 9.4
    }
}
```

包络（对应 WebAudio 的 `linearRamp + exponentialRamp`）：

```cpp
float attackDecay(int i, const Note& n) {
    const int attack = 0.008f * 44100;                    // 8ms 起音
    float a = std::min(1.f, (float)i / attack);
    float t = (float)i / 44100.0f;
    float d = std::exp(-t / (n.durSec * 0.30f));          // 指数衰减
    return a * d;
}
```

### 9.3 音符队列：替代 lookahead 调度

WebAudio 的 `setValueAtTime(t)` 允许"预排未来音符"。SDL 回调没有这个，用**无锁 SPSC 环形队列 + 采样时钟**：

```cpp
// 主线程（30fps 或编辑器试播）只管投递：
void playSfxNow(const Sfx& s) {              // 一次性：全部按采样时刻入队
    int64_t t0 = currentSample() + 2048;     // 留 ~46ms 缓冲
    for (int i = 0; i < 16; i++)
        if (s.steps[i].v > 0)
            queue.push({t0 + i*stepSamples, …});   // 与浏览器版 i*stepSec 同构
}

// 音频线程回调（每 512 采样一次）：
void audioCallback(void*, uint8_t* stream, int len) {
    float* out = (float*)stream;
    for (int i = 0; i < len/4; i++, audioClock++) {
        queue.popToActive(audioClock, active);     // 到点的音符进 active 列表
        out[i] = sumActiveVoices(audioClock);      // 多音符叠加
    }
}
```

乐曲循环（`startMusic`）：主线程用一个**调度前瞻**——`while (nextNoteSample < audioClock + 0.15s) { 入队; 步进; }`——逻辑与浏览器版 `scheduleStep` 的 40ms setInterval + 150ms lookahead 完全同构，只是时钟从 `ctx.currentTime` 换成采样号。

**音频线程铁律**：回调内不 malloc、不锁、不碰 STL 容器接口（队列用固定容量原子读写指针实现）。

### 9.4 噪声通道

WebAudio 版是白噪声 buffer + playbackRate 变速。原生版用 **LFSR**（线性反馈移位寄存器，Game Boy 的真实做法，更有"芯片味"）：

```cpp
uint16_t lfsr = 0x7FFF;
float noiseSample(const Note& n) {
    // 每 freq/4 个采样翻转一次 → 音高越高噪声越"密"
    static int countdown = 0;
    if (--countdown <= 0) {
        countdown = std::max(1, (int)(44100 / (n.freq * 2)));
        int bit = ((lfsr ^ (lfsr >> 1)) & 1);
        lfsr = (lfsr >> 1) | (bit << 14);
    }
    return (lfsr & 1) ? 0.8f : -0.8f;
}
```

---

## 10. Lua 运行时：原生 C API 与 fengari 的对应关系

fengari 本身就是 Lua C API 的 JS 转译，所以这一章几乎是"改名练习"：

| fengari（浏览器版 api.js） | Lua 5.4 C API（原生版 api.cpp） |
|---|---|
| `lauxlib.luaL_newstate()` | `luaL_newstate()` |
| `lualib.luaL_openlibs(L)` | `luaL_openlibs(L)` |
| `lua.lua_pushcfunction(L, fn)` | `lua_pushcfunction(L, fn)` |
| `lua.lua_setglobal(L, to_luastring(name))` | `lua_setglobal(L, name)` |
| `lauxlib.luaL_checkinteger(L, n)` | `luaL_checkinteger(L, n)` |
| `lauxlib.luaL_loadbuffer(...)` | `luaL_loadbuffer(L, code, len, name)` |
| `lua.lua_pcall(L, 0, 0, 0)` | `lua_pcall(L, 0, 0, 0)` |
| `lua.lua_sethook(... LUA_MASKCOUNT ...)` | `lua_sethook(..., LUA_MASKCOUNT, ...)` |
| `to_luastring()` / `to_jsstring()` | 不需要（原生 UTF-8 字符串直达） |

原语注册一模一样地薄——14 个静态 C 函数，直接操作 `Project` 与 `screen`：

```cpp
static int l_pset(lua_State* L) {
    auto* rt = (Runtime*)lua_touserdata(L, lua_upvalueindex(1));
    int x = luaL_checkinteger(L, 1), y = luaL_checkinteger(L, 2);
    int c = luaL_checkinteger(L, 3) & 31;
    rt->screen[wrap(y,128)*128 + wrap(x,128)] = (uint8_t)c;
    return 0;
}
// 注册（upvalue 携带 Runtime 指针，替代浏览器版的闭包捕获）：
lua_pushlightuserdata(L, this);
lua_pushcclosure(L, l_pset, 1);
lua_setglobal(L, "_pset");
```

**指令预算逐字成立**：

```cpp
lua_sethook(L, budgetHook, LUA_MASKCOUNT, 5'000'000);
// budgetHook: luaL_error(L, "运行超出单帧指令预算（可能是死循环），已中止");
// 每帧 _update/_draw 前重置 armHook —— 与浏览器版 loop.js 完全同构
```

**prelude.lua 原样复用**：浏览器版的 `runtime/prelude.lua.js` 是个 JS 模板字符串，剥掉外层就是纯 Lua。原生版把它存成真实 `.lua` 文件，构建时用 `xxd -i` 或 CMake 脚本嵌成 `prelude_embed.cpp` 的字节数组，`luaL_loadbuffer` 加载。`desugarP8` 的三条防误伤规则（排除字符串、排除 `==`、不改行号）在 C++ 里用 `std::regex` 同样实现。

**错误呈现**：`lua_pcall` 非 `LUA_OK` 时 `lua_tostring(L, -1)` 取错误消息，打到运行面板控制台（对应 run.js 的 consoleEl），停机。

---

## 11. 卡带格式 `.wy`：一字不改

这是全项目最划算的决策：**序列化层与平台无关，原生版照抄浏览器版的全部块定义**——

- 头两行 `pico-8 cartridge …` + `version 41`
- `__lua__` / `__gfx__`（128 行 × 128 hex）/ `__map__`
- 自定块 `__palette__` / `__pages__`（`P<n> <base64>`）/ `__sfx__`（`L0 S<speed> <hex>`）/ `__music__`（`C <链>` + `P<n> <hex>`）
- 高位色无损方案（`__gfx__` 截断 + `__pages__ P0` 覆盖）、导入容错原则，全部照搬

由此得到跨版本兼容：**浏览器版导出的 `.wy` 双击就能被原生版打开，反之亦然**。实现上把 `serializer.js` 直译为 C++（hex 查表、base64 编解码各 20 行，或用 nlohmann/json 之外再手写——格式是纯文本，`std::ifstream` 逐行即可）。

C++ 里值得注意的一点：base64 编解码自己写（`storage.js` 的分块 `String.fromCharCode` 那套是浏览器特供，原生版直接三字节→四字符位运算）。

---

## 12. 存储：sessionStorage → 本地文件

浏览器版"关页即清、导出才持久"的语义在原生版自然升级为**工作目录 + 自动保存**：

```
~/Documents/PixelStudio/
├── autosave.wy            # 当前项目，脏标记 300ms 防抖后整体重写
├── recent.json            # 最近打开的文件列表（nlohmann/json）
└── 我的游戏.wy             # 用户手动"另存为"的项目
```

```cpp
// storage.cpp —— 对应 storage.js 的 markDirty + flush
void markDirty()            { dirtySince = now(); }
void tick(Project& p) {     // 主循环每帧调用
    if (dirtySince && now() - *dirtySince > 300ms) {
        writeFile(autosavePath, serializeP8(p));   // 整卡带重写（<100KB，毫秒级）
        dirtySince = nullopt;
    }
}
```

细节决策：

- **自动保存直接写 `.wy` 全文**（~几十 KB），不做增量/二进制 journal——格式统一，文件本身就是可分享卡带
- 写文件用"临时文件 + rename"原子替换，避免写一半崩溃留下半个卡带
- 启动时优先恢复 `autosave.wy`，崩溃/断电也不丢内容（浏览器版做不到的事）

---

## 13. 文件 IO：原生打开/保存对话框

浏览器版 `pickTextFile` / Blob 下载 → 原生版 **nfd**（Native File Dialog）：

```cpp
// 打开（对应 importCart）
nfdchar_t* path = nullptr;
if (NFD_OpenDialog("wy,px8,p8,txt,lua", nullptr, &path) == NFD_OKAY) {
    std::string text = readFile(path);
    if (!looksLikeP8(text)) { toast("不是有效的卡带文件"); return; }
    project = deserializeP8(text);
    NFD_Free(path);
}

// 保存（对应 downloadCart，多了"记住路径再存不弹窗"）
if (lastSavePath.empty()) { NFD_SaveDialog("wy", "pixel-studio.wy", &path); lastSavePath = path; }
writeFile(lastSavePath, serializeP8(project));
```

PNG 导出同理：`SDL_Surface` + `stb_image_write`（单头文件）逐像素写 RGB（色 0 = 透明 → RGBA 跳过 alpha=0），多页纵向拼接逻辑照搬浏览器版 `exportPng`。

---

## 14. 测试体系

分层保证可测性的原则**原样成立**：`core/`、`serialize/` 严禁 include SDL/ImGui，数据层就是可独立编译的纯逻辑——这是浏览器版已经验证过的架构纪律，原生版收益更大（C++ 编译慢，纯逻辑测试编译飞快）。

```cpp
// tests/test_cartridge.cpp —— doctest
TEST_CASE("wy 序列化往返：多页 + 高位色") {
    Project p = makeTestProject();
    p.spritePages.push_back(makePage()); p.spritePages[0][0] = 31;  // 高位色
    auto restored = deserializeP8(serializeP8(p));
    CHECK(restored.spritePages.size() == 2);
    CHECK(restored.sprites[0] == 31);        // P0 覆盖无损
    CHECK(restored.palette == p.palette);
}

// tests/test_runtime.cpp —— 真 Lua 冒烟
TEST_CASE("prelude 提供完整 API") {
    Runtime rt;
    rt.loadChunk("function _update() pset(1,1,8) end", "=t");
    rt.step();                      // 一步逻辑
    CHECK(rt.screen[129] == 8);
}
```

```bash
cmake --build build && ctest --test-dir build   # 或 build/pixel_tests
```

浏览器版的"无头 Chrome e2e"在原生版**不再需要**：UI 与平台耦合部分靠人工冒烟清单（打开各面板、运行 demo、导出/导入卡带），逻辑部分全部被 doctest 覆盖。

---

## 15. 构建与分发：CMake

```cmake
cmake_minimum_required(VERSION 3.21)
project(pixel_studio CXX)
set(CMAKE_CXX_STANDARD 17)

include(FetchContent)
FetchContent_Declare(lua GIT_REPOSITORY https://github.com/lua/lua.git GIT_TAG v5_4_6)
FetchContent_Declare(imgui GIT_REPOSITORY https://github.com/ocornut/imgui.git GIT_TAG docking)
FetchContent_Declare(json  URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz)
FetchContent_Declare(doctest URL https://github.com/doctest/doctest/archive/refs/tags/v2.4.12.tar.gz)
FetchContent_MakeAvailable(lua imgui json doctest)

find_package(SDL2 REQUIRED)   # 系统包管理器：brew install sdl2 / apt install libsdl2-dev

add_executable(pixel_studio ${SRC} ${IMGUI_SOURCES} prelude_embed.cpp)
target_link_libraries(pixel_studio PRIVATE SDL2::SDL2 lua_static nlohmann_json::nlohmann_json)

enable_testing()
add_executable(pixel_tests ${TEST_SOURCES} ${CORE_SOURCES})   # 不含 SDL/ImGui
add_test(NAME all COMMAND pixel_tests)
```

平台安装依赖：

```bash
# macOS
brew install sdl2 cmake
# Ubuntu/Debian
sudo apt install libsdl2-dev cmake g++
# Windows
vcpkg install sdl2        # 或 MSYS2
```

分发：macOS 打 `.app` bundle、Windows 打 zip（exe + SDL2.dll）、Linux 给源码 + 一行构建命令。没有服务器、没有构建流水线也能发布（GitHub Releases 传附件即可）。

---

## 16. 手动复刻路线图

对应浏览器版 15 步路线，原生版顺序与验收方式调整如下：

1. **平台骨架**：SDL2 开窗 + `SDL_RenderSetLogicalSize(128,128)` + vsync 循环画个纯色屏。验收：窗口出现、缩放正确
2. **数据层直译**：`pixel_data` / `palette` / `draw`（从浏览器版 JS 逐行翻译）+ doctest。**先有测试再有 UI**（与浏览器版同纪律）
3. **ImGui 接入**：docking 初始化 + 中文字体 + 空面板布局。验收：中文显示正常、面板可拖拽停靠
4. **像素画面板**：画布 widget + 六工具 + 按格快照撤销 + 色板网格。至此已是一个可用的本地画图工具
5. **序列化**：`cartridge.cpp` 直译（先 `__lua__/__gfx__/__map__` 三块）+ 往返测试
6. **存储与文件对话框**：markDirty 防抖写 autosave + nfd 打开/保存。验收：写一半杀进程不坏文件
7. **运行时上屏**：Lua state + `_pset/_cls` 两原语 + `present()`。验收：三行 Lua 把点画上屏
8. **prelude 全量**：相机/颜色状态 → line/rect → circ → btn/btnp → map 原语；desugar 正则
9. **指令预算 + 30fps 主循环**：accumulator + `lua_sethook`。验收：`while true do end` 写在 `_update` 里页面不卡、控制台报错
10. **代码面板**：InputTextMultiline + Ctrl+Enter 运行
11. **地图面板**：从精灵表选瓦片 + 左绘右擦
12. **音频数据层**：`sfx_data`/`music_data` 直译 + hex 编解码测试（与音频硬件无关，先做）
13. **音频引擎**：SDL 设备 → playTone 合成 → 无锁队列 → sfx 一次性 → music lookahead。验收：运行面板里 `sfx(0)` 出声、`music(0)` 循环
14. **音效/音乐面板**：tracker 网格（ImGui 表格自绘）
15. **收尾**：全部自定块、PNG 导出（stb_image_write）、内置 demo 移植、打包分发

每步验收标准：`ctest` 全绿 + 人工冒烟清单对应项通过。

---

## 17. 低门槛替代技术栈

C++ + SDL2 教学价值最大但门槛最高。三个降级选项，数据模型与 `.wy` 格式章节**全部通用**：

| 栈 | 音频 | UI | Lua | 适合 |
|----|------|----|----|------|
| **Rust**：macroquad + egui + mlua | 回调合成（同 §9 思路） | egui（与 ImGui 同为即时模式） | mlua（封装 C API，`lua_sethook` 可达） | 想要内存安全与现代工具链 |
| **Python**：pygame + Dear PyGui + lupa | `pygame.sndarray` / `pygame.mixer`（手写采样合成后播放） | Dear PyGui | lupa（Lua C API 的 Python 绑定） | 最快出原型，性能略逊 |
| **Tauri/Electron** | 复用 WebAudio | 复用整套 Web UI | 复用 fengari | 只想要"本地文件"能力，不想换技术——但**不算原生**，UI/音频/运行时三层的复刻练习全部落空 |

**复刻练习的价值排序**：C+++SDL（全额）> Rust（全额，语言不同）> Python（省略音频线程与渲染细节）> Electron（≈浏览器版换壳）。如果目标是学到浏览器替你藏起来的东西（线程、波形合成、纹理上传、C 互操作），选前两个。

---

## 附录：与浏览器版的差异速查

| 主题 | 浏览器版 | 原生版 |
|------|---------|--------|
| store/订阅 | touch() + Set 回调 | markDirty + 即时模式每帧直读 |
| 事件解绑 | makeScope/abort | 不需要（即时模式无监听器） |
| 帧循环 | rAF + 跳帧 | accumulator 固定步长 |
| 呈现 | ImageData + putImageData | LockTexture + ARGB 字节 + RenderCopy |
| 音频调度 | WebAudio 绝对时间 setValueAtTime | 无锁队列 + 采样时钟 + 150ms 前瞻 |
| 噪声 | 白噪声 buffer + playbackRate | LFSR（Game Boy 同款） |
| 死循环防护 | fengari lua_sethook | 原生 lua_sethook（同 API） |
| 持久化 | sessionStorage + Blob 导出 | 工作目录 + 自动保存 + nfd |
| 测试 | node --test + 无头 Chrome e2e | doctest/ctest，无需 e2e |
| 发布 | git push → Pages | CMake 构建 → Releases |
