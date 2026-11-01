# AGENTS.md — cognitive-reappraisal

纯前端的认知行为疗法（CBT）七栏思维记录工具。Vite + 原生 JS（ES modules），无框架、无后端、无运行时依赖。
这份文件记录只有读代码看不出来、但改动前必须知道的约定。文案与界面语言为中文。

## 不可破的边界

- **零运行时依赖**：`dependencies` 必须保持为空；`devDependencies` 只有 `vite` 与 `vitest`。加任何运行时库前先和用户确认。
- **不联网**：应用不发任何请求、无后端、无账号。数据只存 `localStorage`。隐私是产品卖点，不是实现细节。
- **离线可用**：`public/sw.js` 手写（不引 Workbox）。改 SW 行为**必须** bump `CACHE`（现为 `thought-record-v1`），否则旧缓存不失效。策略：导航 network-first + 缓存 shell 兜底；同源静态资源 cache-first（Vite 哈希文件名，安全）。
- **`base: "./"`**（vite.config.js）：为了 GitHub Pages 子路径和 `file://` 直接打开都能跑。改成绝对路径会同时坏两处。

## 命令

| 命令 | 说明 |
|---|---|
| `npm run dev` / `npm run build` / `npm run preview` | 常规 |
| `npm test` | vitest，目前 51 例，只覆盖 `utils.js` / `export.js` / `state.js` 纯函数 |
| `npm run test:e2e` | **必须先 `npm run build`**：脚本自己起静态服务托管 `dist/`，无头 Chrome 走 CDP |

`test-browser.cjs` 需要 Chrome 路径：CI 里是 `/usr/bin/google-chrome`；本地用 `CHROME_PATH` 环境变量或把路径作为 CLI 参数传入。

## 代码地图

- `src/main.js` — 视图路由与 `render()`，注册 SW
- `src/state.js` — localStorage 读写、`normalizeEntry`、`showToast`、全局 `state`
- `src/constants.js` — 界面文案与认知扭曲标签常量（改文案主要在这里）
- `src/views/` — `list.js` / `wizard.js`(12 步) / `detail.js` / `review.js` / `export-modal.js`
- `src/styles.css` — 设计 token 在 `:root`
- `public/` — `sw.js`、`manifest.webmanifest`、`favicon.svg`、`icon.svg`

存储键（`constants.js`）：`cognitive-reappraisal-entries`、`cognitive-reappraisal-wizard-draft`。
**没有数据迁移器**：新增字段必须在 `state.js` 的 `normalizeEntry` 里给默认值，否则用户本地旧记录读出来是 `undefined`。

## 写法约定

- 跟现有代码同风格：`var` + `function`、模板用字符串拼接、无 TypeScript。
- 任何用户输入进 `innerHTML` 前必须过 `utils.escapeHtml`。
- 界面文案：动词开头、主动语态、不施压（产品定位是「无压力回填」，不要用红色/警告口吻催回填）。

## 可读性底线（改样式前先看这段）

- 正文/次要文字对比度 ≥ WCAG AA 4.5:1。`--muted: #5f6a70`（纸面 4.9:1、白卡 5.5:1）是实测结果，**不要再调淡**。
- 图形元素（图表柱、图例块）≥ 3:1，用 `--chart-before: #7d8b95`。
- 触控目标 ≥ 44px（`--touch`），E2E 有断言；`prefers-reduced-motion` 已全局关停动画。
- 全站只有 `light` 主题（`color-scheme` 已声明），没做暗色。

## 测试约定

- `test-browser.cjs` 的断言直接匹配中文界面文案（`"第 1 步"`、`"待回填"`），改文案会让 E2E 变红——这是有意的耦合，改文案时同步改断言。
- 四视口：375 / 390 / 414 / 1280。**未捕获的浏览器异常计入失败**（`Runtime.exceptionThrown` 按视口计数）。
- 改交互逻辑时优先给纯函数补 `*.test.js`；`views/` 目前没有单测，只能靠 E2E 兜。

## 部署

GitHub Pages（`poro789/cognitive-reappraisal`）。`deploy.yml` 的门禁顺序：`npm ci` → `npm test` → `npm run build` → `npm run test:e2e` → 上传 `dist/` → 部署。测试不过不会上线。

## 完成定义

按功能分组提交；每组提交前 `npm test`、`npm run build`、`npm run test:e2e` 全绿。
影响线上站的改动：先本地提交，**经用户确认后再 push**（push 即触发部署）。

## 已知缺口（避免重复审计）

- `views/` 五个模块（约 44 KB）无单测；E2E 视口矩阵缺 320px。
- 无 `LICENSE`、无 git tag，版本号只在 `package.json`（1.0.0）。
- `window.__CR_TEST__`（`main.js`）当前零引用，是历史遗留的调试面。
- `review.js` 的待回填日期用 `toLocaleDateString("zh-CN")`，与 `utils.formatDate` 格式不一致。
- 无 `.gitattributes`，Windows 上提交会刷 LF/CRLF 警告。
