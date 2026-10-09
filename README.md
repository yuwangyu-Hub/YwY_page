# PIXEL STUDIO · 像素游戏开发工作室

浏览器里的「幻想主机」——参考 [PICO-8 教育版](https://pico-8-edu.com/) 与 GameBuilder BASIC 的理念：**打开网页就能做游戏，零安装、零构建、零账号**。

线上地址：<https://yuwangyu-hub.github.io/YwY_page/>

## 四大工作台（一期）

| 模块 | 功能 |
|------|------|
| ⌨ 代码 | CodeMirror Lua 编辑器，`Ctrl/Cmd+Enter` 一键运行 |
| 🎨 像素画 | 128×128 精灵表（256 个 8×8 精灵），铅笔/橡皮/取色/填充/直线/矩形 + 撤销重做 |
| 🗺 地图 | 128×64 瓦片地图，瓦片直接从精灵表选取，左绘右擦 |
| ▶ 运行 | 128×128 逻辑屏幕，30fps，键盘 + 移动端虚拟按键，Lua 错误实时显示 |

> 🔊 音效 / 🎵 音乐两个工作台计划二期推出（与 PICO-8 不同，二者相互独立、不强制绑定）。一期代码中已预留 `sfx()` / `music()` 静音占位，写的代码到二期可直接接上。

## Lua API（PICO-8 风格子集）

`cls` `pset` `pget` `line` `rect` `rectfill` `circ` `circfill` `spr` `map` `mget` `mset` `sget` `sset` `btn` `btnp` `print` `flr` `mid` `min` `max` …（完整清单见 `runtime/prelude.lua.js`）

入口回调：`_init()`（可选）、`_update()`（每帧逻辑）、`_draw()`（每帧绘制）。
内置单帧指令预算（500 万条），死循环会被自动中止，页面不会卡死。

## 存储语义（重要）

- 所有数据存放在**浏览器 sessionStorage**：关闭标签页/浏览器即自动清空，不留痕迹。
- 编辑过程防抖自动保存（300ms），刷新页面不丢失。
- **长期保存请导出**：
  - 💾 **导出 .p8** — PICO-8 兼容文本卡带（`__lua__` / `__gfx__` / `__map__` 三个块，可直接被官方 PICO-8 读取精灵与地图；导入同样支持）。
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
js/lib/             palette/pixel-data/draw（纯函数，Node 可测）
js/project/         数据模型/存储/.p8 序列化/下载/demo
js/views/           code/sprite/map/run 四视图
runtime/            Lua 运行时（prelude + JS 原语 + 主循环）
vendor/             第三方 UMD 库
legacy/             旧版 Spritely 复刻
```

## 路线图

- **一期（当前）**：代码 / 像素画 / 地图 / 运行 四工作台 + .p8 导入导出
- **二期**：音效编辑器（独立于音乐的合成器）+ 音乐编辑器（音序器），`__sfx__` / `__music__` 卡带块
- **三期**：作品分享（云端存档）、多人协作等（待定）
