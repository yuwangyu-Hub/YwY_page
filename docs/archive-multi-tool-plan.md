# 多工具聚合站 + 用户体系 · 实施计划

## 一、目标

把现有的 Spritely（视频转精灵图集）扩展成一个**多工具聚合网站**，分四大门类，并加上用户注册登录。

| 门类 | 内容 |
| --- | --- |
| 开发者效率 | JSON 格式化/校验、Base64 与 URL 编解码、时间戳换算、正则测试、UUID、文本对比 |
| 图片/素材 | 以 Spritely 为核心，扩展图片压缩、格式转换、尺寸调整、调色板提取 |
| 像素绘图 | 像素画编辑器：网格画布、PICO-8 风格 16 色调色板、铅笔/橡皮/填充/直线/矩形/选区、图层、导入图片转像素、导出 PNG/精灵图集/JSON |
| 网页端游戏开发 | 参考 PICO-8 Education Edition：128×128 画布、16 色、6 按键、8×8 精灵格、代码编辑器 + 即时运行，**内嵌 fengari 真 Lua 解释器** |


**用户已确认的关键选择：**

1. 游戏工具用**内嵌真 Lua 解释器**（fengari），不用自研 JS API
2. 登录方式：**邮箱 + 密码**（第一期只做这个）；手机验证码 / 微信扫码**预留入口不实现**
3. 云端数据：**第一期只做账号**（登录 + 昵称/头像），架构预留扩展
4. 部署形态：**双轨** —— 云服务发布域做主站（登录可用）+ GitHub Pages 做静态镜像（关闭登录）

---

## 二、技术栈决策

**结论：不引入 Vite，保持「无构建 + 原生 ES Module + vendor 目录存第三方 UMD 库」。**

理由：

- 云服务官方文档明确：无构建的纯 HTML 项目用 CDN `<script>` 形态的 SDK，且**不应为装 SDK 引入打包器**
- 两个部署目标（云服务发布域 / GitHub Pages）都只认静态文件，无构建产物可直接复用，只需全用相对路径
- `fengari-web.js`（214KB，UMD）和 CodeMirror 5 都有现成全局构建，直接 vendor 即可 —— 这与项目现有 `jszip.min.js` 的做法一致，不是新增复杂度
- 业务代码本就是标准 ESM，**未来若要切 Vite 成本极低**（加一个 config + base 即可）

**代码编辑器选型**：第一期用 **CodeMirror 5（UMD + Lua mode）**，vendor 到本地。排除 Monaco（数 MB、需 worker）与 CodeMirror 6（ESM-only、面向 bundler）。

---

## 三、目录结构

站点根 = 现有 git 仓库根（原地重构）。

```
spritely_local/                    # = 仓库根 = 站点根
├── index.html                     # 唯一入口：head + 挂载点 #app + vendor/主模块脚本
├── package.json                   # 极简 {"type":"module"}，仅为让 Node 跑 ESM 测试，无依赖
├── config/
│   ├── cloud.config.js            # 云服务 publicConfig 的三个值（开通后粘贴）
│   └── site.config.js             # 站点开关：启用哪些登录方式、工具顺序
├── css/
│   ├── tokens.css                 # CSS 变量：色板/渐变/间距/圆角/字号/断点
│   ├── base.css                   # reset + 排版
│   ├── components.css             # 共享件：.btn/.card/.input/.modal/.toast/.tabs
│   ├── layout.css                 # 顶栏/分类导航/卡片网格/工具容器 + 四档断点
│   └── tools/{spritely,pixel-editor,pico8}.css
├── js/
│   ├── main.js                    # 入口：初始化 cloud → 处理微信回调 → 注册工具 → 启动路由
│   ├── core/                      # registry / router / lifecycle / shell / events
│   ├── auth/                      # cloud.js（单例）/ auth.js / guard.js / views/{login,account}.js
│   ├── ui/                        # dom.js（取代全局 $）/ toast / modal / icons
│   ├── lib/                       # 纯函数库，不依赖 DOM，可 Node 直测
│   │   ├── image/{chroma-key,bbox,place,crop,halo,palette}.js + index.js
│   │   ├── canvas.js  file.js  zip.js  pixel-data.js
│   └── tools/
│       ├── index.js               # 唯一聚合点：注册所有工具
│       ├── dev/    image/    pixel/    game/
└── vendor/                        # 第三方 UMD（沿用 jszip 既有模式）
    ├── jszip.min.js  fengari-web.js  codemirror/  workbuddy-cloud.global.js
    └── VERSIONS.md                # 记录来源/版本/校验值
```

**部署硬约束：全站只允许相对路径**（`./`、`../`），禁止 `/js/xxx` 这类绝对路径，才能同时适配云域名根路径与 Pages 子目录。

---

## 四、工具插件化架构

每个工具 `export default` 一个描述对象，只有 `mount`/`unmount` 两个生命周期钩子：

```js
export default {
  id: 'spritely', title: '精灵图集', category: 'image',
  icon: 'sprite', desc: '视频 / 图片转游戏精灵图集', order: 10,
  mount(host, ctx) { /* 建 DOM、绑事件 */ },
  unmount() { /* 停定时器、解绑、releaseObjectURL */ },
}
```

- **注册表** `core/registry.js`：`Map<id, def>` + 分类元数据；`register()` 校验 id 唯一、分类合法、mount 为函数。首页工具卡片由注册表自动生成，不需要单独维护列表。
- **生命周期** `core/lifecycle.js`：切换工具时先 `unmount()` 清理，再用 **动态 `import()` 懒加载**目标工具（天然代码分割）。
- **作用域清理**：每个工具拿到一个 `AbortController` scope，所有 `addEventListener` 带 `{ signal }`，`unmount()` 一次 `abort()` 全部撤销。
- **路由用 Hash（`#/spritely`）**，这是硬约束不是偏好：云服务发布域是「静态文件、无 history 回退」，请求 `/spritely` 会直接 **404 且发生在 JS 执行前**；且微信 OAuth 回调落在站点根并带 `?code=...`，hash 路由让两者互不干扰。GitHub Pages 子目录也零成本。

---

## 五、现有 Spritely 改造步骤

| 步骤 | 内容 |
| --- | --- |
| 1. 抽算法 | `chromaKey`(app.js L273-280)、`computeBBox`(L282-293)、`haloRemoval`(L328-349) 原样搬入 `js/lib/image/`；`placeInCanvas`(L295-307)、`cropFrames`(L309-326) 拆成「纯几何计算 + canvas 薄适配」。**纯逻辑文件里不出现 `document`** |
| 2. UI 收作用域 | 新建 `js/tools/image/spritely.js`；干掉全局 `$`(L26) 改为 `host.querySelector`；干掉全局 `state`(L6-20) 改为 mount 内闭包；`el.onclick=` 全部改为带 signal 的 `addEventListener`；index.html 的各 section 搬进工具模板 |
| 3. 样式分层 | 硬编码色提为 `tokens.css` 变量（主色 `#667eea`、渐变 `→#764ba2`、背景 `#000`/`#0c0c0c`）；`.btn/.card/input/.progress` 抽出为共享组件；Spritely 专属样式加 `.tool-spritely` 作用域；断点从 1 档补到 4 档 |
| 4. 消除测试重复 | 现在 `test_logic.js` L7-30 把算法**复制了一份**，会漂移。改为 `tests/image.test.js` 直接 `import` 真模块，复用原 14 条断言，删除旧文件 |


---

## 六、认证集成（严格照官方 API）

### 初始化

`js/auth/cloud.js` 单例：`WorkBuddyCloud.createWorkBuddyCloud({ endpoint, publishableKey })`。
两个值**只能来自开通后返回的 publicConfig**，粘贴进 `config/cloud.config.js` —— 不得硬编码、不得从 location/env 推断。
`oauthRelayBaseUrl` 第一期可不传（它是 `signInWithOAuth` 专用，只有微信登录需要）；**预留微信时必须补上**，否则点到登录按钮才在运行时抛 `requires oauthRelayBaseUrl`。

### 邮箱 + 密码（第一期主线）

- **登录**：`signInWithPassword({ email, password })`；失败统一提示「账号或密码错误」，**不区分「邮箱未注册 / 密码错」**。
- **注册**：⚠️ **SDK 没有「免验证的密码注册」**。新邮箱必须走一次 OTP 并带密码：
`sendOtp({ email })` → 把 `{email, verificationId, isExistingUser}` 存到事件处理器**之外** → `verifyOtp({ email, verificationId, isExistingUser, token, password })`。
若表单是注册表单且 `isExistingUser === true`，用中性文案引导去登录，**不暴露该邮箱是否已注册**。文案里禁止出现「该邮箱已注册」这类措辞。
- **忘记密码**：`resetPasswordForEmail(email)` → `started.data.updateUser({ nonce, password })`；成功后 SDK 自动登录并派发 `PASSWORD_RECOVERY`。
- **已登录改密**：`resetPasswordForOld({ oldPassword, newPassword })`。

### 会话与守卫

- `getSession()` 建立会话态（近过期自动刷新）；需强制刷新才用 `refreshSession()`；需服务端校验用 `getUser()`。
- `onAuthStateChange((event, session) => …)` 驱动 UI，`SIGNED_OUT` 回登录页。
- **守卫范围最小化**：只有 `#/account` 需要登录；**所有纯前端工具无需登录即可用**，把登录的爆炸半径压到最小。
- 错误按 `error.kind` 分支（`unauthenticated`/`invalid_grant` → 引导重新登录；`network`/`backend-unavailable` → 保留会话），不靠 message 文本。
- 令牌、邮箱**绝不打印**。

### 预留（第二期再开，第一期只留开关与空入口）

- **手机验证码**：`sendOtp({ phone })` + `verifyOtp({ phone, verificationId, isExistingUser, token })`。大陆号先按 `/^1\d{10}$/` 在**客户端拦截**（不通过就不发请求，输入框下方提示「请输入正确的 11 位手机号」，编辑号码清除该错误）；号码**原样传入**，不自己拼 `+86`；不暴露号码是否已注册。
- **微信扫码（Web）**：入口 `signInWithOAuth({ provider:'wechat', redirectTo: location.origin })` —— **它不导航**，要拿 `data.url` 再 `location.assign`；`redirectTo` 必须是**站点根**，子路径会 404 丢 code。启动时**无条件先跑** `handleWechatWebCallback()`，**必须在任何路由守卫之前**；三级分支：有 error → 报错；有 session → **先 `history.replaceState` 清掉 URL 上的 `?code&state`**（state 一次性，不清会让刷新重放已消费的码）再进首页；session 为 null → 普通访问正常启动。**必须显式判断 `session`**，只判 `!error` 会让每次普通访问都误入已登录态。
- 两者都**只能在已发布的 HTTPS 云域名上验证**，localhost 与预览不是合法回调目标 —— 这是平台边界，不写 mock 兜底。

### 个人中心

头像走 Storage（`upload` + `createSignedUrl`）；昵称进 `profiles` 表（`owner_id TEXT NOT NULL DEFAULT auth.uid()` + RLS `WITH CHECK (owner_id = auth.uid())`，客户端**不传 owner_id**）。存储操作前必过 auth gate。

---

## 七、Lua 游戏工具技术路线

| 环节 | 方案 |
| --- | --- |
| fengari | vendor `fengari-web.js`（214KB UMD，全局 `fengari`），**进入游戏工具时才动态注入 script**，其它页面零成本。注：该包 2018 年后停更，若遇 bug 改为 core+interop 自写几十行引导 |
| API 桥接 | **只向 Lua 注册约 8-10 个底层原语**（`_pset/_pget/_sget/_sset/_btn/_flip/_print/_time`），其余 `cls/spr/map/rect/circ/btnp/flr/sin/rnd/all/add/del` 全部用 `prelude.lua`（内联 Lua 字符串）实现 —— 坐标环绕、透明色、表操作本就是 Lua 语义，用它写最natural，JS 边界最薄 |
| 渲染 | `pset/pget` 直接读写 `Uint8Array(128*128)` 调色板索引；每帧只做**一次** `putImageData` 批量提交到离屏 canvas，再整数倍 `drawImage` 到可见 canvas（`image-rendering: pixelated`） |
| 调色板 | 内置 PICO-8 标准 16 色 RGB 表，索引 0 为透明 |
| 缩放入输入 | 逻辑分辨率固定 128×128，`scale = clamp(floor(min(w,h)/128), 1, 6)`；键盘与移动端虚拟按键共用同一份 `keys[0..5]` 状态；`btnp` 用「上帧未按、本帧按下」做边沿检测 |
| 数据模型 | 精灵表 = 256 个 8×8 = `Uint8Array(128*128)` 索引；地图 = 128×64 tiles = `Uint8Array(128*64)`。**与像素编辑器共用 `js/lib/pixel-data.js`**，避免两套像素模型 |
| 序列化 | `.p8` 文本格式：`__lua__` / `__gfx__`（128 行十六进制）/ `__map__` / `__sfx__`。**第一期不做 sfx/music**，格式预留；草稿存 localStorage |
| 防死循环 | 每次运行新建 `lua_State`；用 `lua_sethook` 的 count 钩子限制单帧指令数，超限中止并报错（挡 `while true do end`） |
| 音频 | 第一期做「静音占位返回」，声音合成放到后期，避免一期过重 |


---

## 八、分期实施

### 第一期（本次执行）：骨架 + 登录 + 3 个示例工具

交付物：

1. 新 shell + hash 路由跑通，首页由注册表自动生成四门类卡片网格
2. 设计系统四件套（tokens/base/components/layout）+ 四档断点
3. **Spritely 完成迁移**（算法入库、UI 收作用域、样式分层、测试去重）
4. 示例开发者工具 2-3 个：JSON 格式化/校验 + Base64/URL 编解码
5. **认证全链路（邮箱密码）**：注册（邮箱验证码 + 密码）、登录、忘记密码、`#/account` 个人中心；手机/微信以开关关闭并预留空入口
6. 根 `package.json`、`vendor/VERSIONS.md`、README 补部署说明

**验收标准**：

- `node tests/image.test.js` 14 条断言全绿
- 无全局泄漏：`js/` 下 grep 不到 `window.` / 顶层 `function` / 顶层 `const state`
- Spritely 对同一输入输出与旧版一致
- 邮箱注册：发一次验证码 → 提交（带密码）→ 建立会话；`signInWithPassword` 登录成功；刷新后会话保持；忘记密码可重置并自动登录
- 失败文案不区分「邮箱未注册 / 密码错误」；分支走 `error.kind` 而非 message
- 未登录态下所有纯前端工具可直接使用，不被守卫拦
- 离开工具后无残留定时器/监听

### 第二期：开发者工具补齐 + 图片工具集

regex 测试器、文本对比、时间戳；图片压缩/格式转换/尺寸调整/调色板提取；抽出统一的「文件进→文件出」管线。

### 第三期：像素绘图工具

网格画布、16 色调色板、六种工具、图层、导入图片转像素、导出 PNG/精灵图集/JSON。与第四期共用像素模型。

### 第四期：Lua 游戏工具

fengari 懒加载 + prelude + 运行时 + 输入层 + CodeMirror 5 + `.p8` 序列化。可选项：切 Vite 接更现代编辑器；草稿存云。

---

## 九、风险与应对

| 风险 | 应对 |
| --- | --- |
| **fengari 体积与性能**：214KB + 解释执行慢，逐像素写在 Lua 里 60fps 会吃力 | 绘制原语落 JS 快路径，每帧只一次 putImageData；固定 128×128（仅 16384 像素）；指令数钩子限预算；懒加载让非游戏页零成本；准备 core+interop 后手 |
| **Origin 严格校验**：登录态只在云服务发布域生效，GitHub Pages 域名不匹配会登录失效 | 主发布目标定为云发布域（复用同一 applicationId 保住预留域名）；Pages 作为纯静态镜像并用 `site.config.js` 关闭登录入口；绝不从 location/env 推断 endpoint |
| **无构建的模块管理成本**：手工 vendor、无 tree-shaking、版本漂移；ESM 需 HTTP 服务不能 `file://` 直开 | `vendor/VERSIONS.md` 固定来源版本；全站相对路径；`import()` 做工具级代码分割；业务代码本就 ESM，未来迁 Vite 成本极低 |
| **认证边界态写错**：邮箱注册必须走 OTP+密码（SDK 无免验证注册）、发送与提交必须分离、失败文案暴露账号存在性是合规问题；预留的微信回调还需三分支 + 清 URL | 逐条对照官方 Completion Bar 自检；不暴露账号存在性；微信回调启动时无条件先跑并显式按 session 分支 |
| **双轨部署漂移**：同一份代码要在云域（根路径）与 Pages（子目录）两处跑，出现绝对路径或登录入口未关就会踩坑 | 硬约束全相对路径；`loginEnabled` 开关不引入代码分叉；发布统一用同一 `applicationId` |
| **四门类并行导致范围蔓延** | 以 registry 插件接口 + `js/lib/*` 共享库为收敛点；严格按分期交付 |


---

## 十、已确认的关键决策

| # | 决策项 | 结论 |
| --- | --- | --- |
| 1 | 新站与现有仓库的关系 | **原地重构 `yuwangyu-Hub/YwY_page`**，不新建仓库 |
| 2 | 网站名称 | **像素游戏站**（用于云服务应用 appName） |
| 3 | 昵称/头像存储 | **入库**：`profiles` 表存昵称 + Storage 存头像 |
| 4 | 游戏工具脚本 | 内嵌 fengari 真 Lua 解释器 |
| 5 | 登录方式 | **邮箱 + 密码**（第一期）；手机验证码 / 微信扫码**预留不实现** |
| 6 | 云端数据范围 | 第一期只做账号，架构预留扩展 |
| 7 | 部署形态 | **双轨**：云服务发布域为主站（登录可用）+ GitHub Pages 为静态镜像（关闭登录） |
| 8 | 云服务成本 | **用户已是标准版（连续包月 ¥70）→ 零增量成本**：30 个云应用名额、每应用 25,000 资源点/月 |


### 云服务成本（已核实官方口径）

云服务不单独收费，按 WorkBuddy 会员档位分配「可开启云服务的应用数」与「每应用每月资源点」：

| 版本 | 价格 | 可开云应用数 | 每应用每月资源点 |
| --- | --- | --- | --- |
| 免费版 | ¥0 | 10 | 5,000 |
| **标准版（用户当前档位）** | **¥99/月，连续包月 ¥70** | **30** | **25,000** |
| 高级版 | ¥199/月（连续包月 ¥140） | 50 | 50,000 |
| 旗舰版 | ¥999/月（连续包月 ¥700） | 99 | 150,000 |


- **用户已在标准版（¥70 连续包月）** → 本项目的云服务**不产生任何新增费用**，也不必再对比「免费版够不够」。
- 放开后的余量：**可开 30 个应用**（本期只占 1 个），**每应用 25,000 资源点/月**（是第一期的数倍上限）。后续第二~四期加工具、加落库量都在额度内。
- 由此**解锁的可选项**（免费版下不建议、现在可以做）：`profiles` 表加「使用记录/收藏」、像素画与游戏项目**云存档**（Database + Storage）、工具调用 LLM 的 AI 功能。**已与用户确认：第一期仍只做账号**，上述额度留作第二期及以后使用，本期不扩范围。
- 资源点 ≠ 积分（积分是 AI 对话那套）；资源点只按「数据落库、文件存储、用户访问峰值、调用大模型次数」扣。
- **不开云服务不消耗资源点、不占名额**；且**不会静默开通**，只有用户确认才连。
- ⚠️ 仍需留意的唯一坑：资源点用尽或会员到期 → 云服务暂停，**数据只保留 15 天**，逾期删除。付费档位把这条风险窗口压得很低。

### 「原地重构」的三点连带影响（必须处理）

**① 现有在线地址的语义变化**
`https://yuwangyu-hub.github.io/YwY_page/` 将从「Spritely 工具页」变为「工具站首页」，Spritely 移到 `#/spritely`。用户已确认接受。

**② 需要双轨部署，且两边的能力不同**

| 部署目标 | 承载内容 | 登录 |
| --- | --- | --- |
| **云服务发布域**（主站，复用同一 `applicationId`） | 完整站 | ✅ 可用 |
| **GitHub Pages**（`YwY_page`，静态镜像） | 同样代码 | ❌ 域名不匹配，登录会失效 |


因此 `config/site.config.js` 必须有一个 **`loginEnabled` 运行时开关**：部署到 Pages 时关闭登录入口（隐藏登录/个人中心入口，不发起任何云请求），避免用户点了登录却报错。判断依据不能用 `location.hostname` 硬编码到具体域名，而是从 `cloud.config.js` 是否已填入真实 `publicConfig` + 当前 Origin 是否匹配来推导。

**③ Spritely 的老链接要兜底**
重构后 `#/spritely` 是新地址，但旧的无 hash 链接仍然落在首页。首页需要在 `localStorage` 里记住一次「是否已迁移」或直接在首页显著位置引导到 Spritely，避免老用户以为工具没了。

---

## 十一、开工第一步

**开通云服务并取回 publicConfig**（所有云代码都依赖它）：
先 `action:"inspect"` 查看会话内已有应用（当前为空）→ 再 `applicationMode:"create"` + `appName:"像素游戏站"` + **`domainPrefix:"pixel-tools"`**（create 时必填，决定预留域名的首段，创建后不可改）新建独立应用 → 由官方 UI 弹框确认 → 拿到 `endpoint` / `publishableKey` / `oauthRelayBaseUrl`。

后续发布主站时**必须复用同一个 `applicationId`**，否则预留域名变化会导致 Origin 校验失败、登录直接失效。

**第二条轨**：GitHub Pages 沿用现有 `yuwangyu-Hub/YwY_page`（本地仓库就是它），推送即镜像，无需再建仓库。