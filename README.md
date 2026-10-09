# PIXEL STUDIO · 像素游戏开发工作室

浏览器里的「幻想主机」——参考 [PICO-8 教育版](https://pico-8-edu.com/) 与 GameBuilder BASIC 的理念：**打开网页就能做游戏，零安装、零构建、零账号**。

线上地址：<https://yuwangyu-hub.github.io/YwY_page/>

## 六大工作台

| 模块 | 功能 |
|------|------|
| ⌨ 代码 | CodeMirror Lua 编辑器，`Ctrl/Cmd+Enter` 一键运行 |
| 🎨 像素画 | 128×128 精灵表（256 个 8×8 精灵），铅笔/橡皮/取色/填充/直线/矩形 + 撤销重做 |
| 🗺 地图 | 128×64 瓦片地图，瓦片直接从精灵表选取，左绘右擦 |
| 🔊 音效 | 8 槽位 × 16 步 tracker：5 种波形（方/正弦/锯齿/三角/噪声）× 24 半音 × 8 级音量，即时试播 |
| 🎵 音乐 | 4 Pattern × 2 声部（主旋律/贝斯）+ 乐曲链编排，整曲循环播放 |
| ▶ 运行 | 128×128 逻辑屏幕，30fps，键盘 + 移动端虚拟按键，Lua 错误实时显示 |

> 音效与音乐**相互独立**（区别于 PICO-8 的强绑定）：音效是游戏里的一次性短促声音（`sfx(0)`），音乐是自己编排的循环曲（`music(0)` 播放 / `music(-1)` 停止）。

## Lua API（PICO-8 风格子集）

`cls` `pset` `pget` `line` `rect` `rectfill` `circ` `circfill` `spr` `map` `mget` `mset` `sget` `sset` `btn` `btnp` `print` `flr` `mid` `min` `max` …（完整清单见 `runtime/prelude.lua.js`）

入口回调：`_init()`（可选）、`_update()`（每帧逻辑）、`_draw()`（每帧绘制）。
内置单帧指令预算（500 万条），死循环会被自动中止，页面不会卡死。

## 存储语义（重要）

- 所有数据存放在**浏览器 sessionStorage**：关闭标签页/浏览器即自动清空，不留痕迹。
- 编辑过程防抖自动保存（300ms），刷新页面不丢失。
- **长期保存请导出**：
  - 💾 **导出 .p8** — PICO-8 兼容文本卡带（`__lua__` / `__gfx__` / `__map__` + 二期新增 `__sfx__` / `__music__` 自定格式块；官方 PICO-8 可读取精灵与地图，音频块为本站私有格式）。
  - 🖼 **导出 PNG** — 128×128 精灵表图片（色 0 透明）。

## 内置 Demo

首次打开自动载入一个可玩的小平台跳跃 demo（角色、地面、砖块平台都是代码生成）。
去「像素画」改角色颜色，回「运行」立刻看到效果——这就是本站的完整工作流。

## 技术栈

- **无构建**：原生 ES Module，静态文件直接部署（GitHub Pages）
- **fengari-web 0.1.4**：Lua 5.3 VM 跑在浏览器里（懒加载，首次点运行才下载）
- **CodeMirror 5.65.16**：Lua 语法高亮
- 数据模型：精灵表 `Uint8Array(128×128)` + 地图 `Uint8Array(128×64)`，纯函数库可被 Node 测试

```bash
npm test        # 运行纯函数库测试（像素/绘图/序列化）
# 本地预览（ES Module 需要 http 服务）：
python3 -m http.server 8080
```

## 旧版工具

本站前身是 Spritely 复刻版（视频/图片 → 精灵图集），已整体移入 [`legacy/`](./legacy/)，可从顶栏「旧版工具」进入。

## 目录结构

```
index.html          入口（顶栏 + tab 栏 + 视图容器）
js/main.js          启动接线
js/core/            dom/store/tabs/toast（应用框架）
js/lib/             palette/pixel-data/draw/sfx-data/music-data（纯函数，Node 可测）
js/audio/           WebAudio 芯片音源 + 乐曲调度
js/ui/              共享 tracker 步进网格
js/project/         数据模型/存储/.p8 序列化/下载/demo
js/views/           code/sprite/map/sfx/music/run 六视图
runtime/            Lua 运行时（prelude + JS 原语 + 主循环 + 语法糖解糖）
vendor/             第三方 UMD 库
legacy/             旧版 Spritely 复刻
```

## 路线图

- **一期 ✅**：代码 / 像素画 / 地图 / 运行 四工作台 + .p8 导入导出
- **二期 ✅**：音效编辑器（独立合成器）+ 音乐编辑器（Pattern × 双声部 + 乐曲链），`sfx()` / `music()` 接入运行时
- **三期**：作品分享（云端存档）、多人协作等（待定）
