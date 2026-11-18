# RunLedger 项目交接说明

> 交接时间：2026-11-17。本文件用于在新的 Trae 工作空间中恢复上下文。项目尚未完工，仍在优化阶段；请先读本文件与 `README.md`，再动代码。

## 1. 项目是什么

RunLedger 是参赛作品（赛事：AI 创新应用挑战赛，编号 Vibe Coding 10039；截止 2026-11-18，具体时刻以官网为准）。它被拆成**两个独立产品**，共用一套本地统计与证据内核：

| 产品 | 路由 | 定位 | 内置实验 |
| --- | --- | --- | --- |
| RunLedger Life | `/life` | 个人生活决策记录 | 周末步数、睡眠后次日步数 |
| RunLedger Lab | `/lab` | 通用实验复测工具 | digits 小样本分类、本地高斯模糊计时 |
| 选择页 | `/` | 两张产品卡片 | — |

两个产品各自拥有品牌、文案、主题配色、实验列表和 localStorage 键（Life `runledger.lifestyle.v1`，Lab `runledger.lab.v1`），互不串数据。

## 2. 技术栈与启动

- Next.js 16.4.6（App Router）+ React 19.3.1 + TypeScript，Turbopack。
- 已在本机验证：Node.js 24.21.0、npm 11.19.0、Windows。Windows 下用 `npm.cmd`。
- 正常使用不需要 Python、AI 密钥或数据库。

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev      # 或 npm.cmd run start（需先 build）
```

访问 <http://localhost:3000> 选择产品，或直接进 `/life`、`/lab`。

## 3. 关键文件

| 文件 | 作用 |
| --- | --- |
| `lib/products.ts` | 两个产品的配置中心：品牌、文案、主题类、数据集、存储键、新建类型 |
| `lib/data.ts` | 导出 `lifeExperiments` / `labExperiments` / `initialExperiments` |
| `components/Dashboard.tsx` | 状态、持久化、导入、导出、新建实验（两产品共用，靠 `product` 参数区分） |
| `components/Views.tsx` | 总览、诊断、复测、证据、表单视图（文案走 `ProductConfig`） |
| `lib/analysis.ts` | 统计、诊断、复测优先级 |
| `lib/export.ts` | `stableStringify` + Web Crypto SHA-256、证据 JSON、HTML 报告 |
| `app/page.tsx` | 产品选择页 |
| `app/life/page.tsx`、`app/lab/page.tsx` | 两个产品入口 |
| `app/globals.css` | 全局样式；含 `.theme-life` / `.theme-lab` 与选择页样式 |
| `public/data/*.json` | 四份内置实验数据 |
| `experiments/prepare_lifestyle_data.py` | CC0 Fitbit 数据确定性聚合 |
| `experiments/run_experiments.py` | digits + 性能计时实验脚本 |
| `submission/` | 技术 PDF、源码 ZIP、提交清单、宣传文案、视频脚本、Prompt 模板 |

## 4. 真实数字（只能这样说）

| 内容 | 数值 |
| --- | --- |
| 周末实验 | 64 条 / 32 对，均值 8009.3772 / 8086.0565 步 |
| 睡眠实验 | 36 条 / 18 对，均值 8588.7017 / 8365.8116 步 |
| digits | MLP 32 均值 93.52%（3 种子均未收敛）、MLP 128 均值 94.32%、128+L2 与 MLP 128 逐点相同、MLP 64×2 仅 1 种子 94.26% |
| digits 判读 | 差值 0.80 个百分点，配对差值标准差约 0.60，信号噪声比约 1.35 → “差异仍需复测” |
| 性能计时 | 32 次（2 首调用 + 30 预热），中位数 18.85 ms / 10.77 ms，最大绝对误差 5.96e-08 |

**严禁**把它写成 MNIST（实际是 sklearn 8×8 `digits`；`data/FashionMNIST/raw` 为空目录）。**严禁**把信号噪声比说成 p 值，把观察关联说成因果，把本机计时说成跨机器性能结论。

## 5. 已修复的坑（不要回退）

1. **本地存储自愈**：加载时若内置实验的 `original` 批次与内置数据不一致，用内置数据替换该实验；用户追加的 `rerun-*` / `import-*` 保留。此前伪造数据曾导致页面崩溃，靠此逻辑修复。
2. **跨产品隔离**：加载时按 `foreignIds` 剔除属于另一产品的内置实验。原因是 Life 复用了旧键，曾把 Lab 的两个实验带进 `/life`。
3. **旧构建问题**：改代码后若页面仍是旧内容，先杀 3000 端口进程，再 `npm.cmd run build` + `npm.cmd run start`，不要只重启 `next start`。旧构建残留还会让 chunk 请求返回 HTML，控制台表现为 `Uncaught SyntaxError: Unexpected token '<'`。
4. **favicon 404**：已加 `app/icon.svg`（Next.js 元数据约定），`/icon.svg` 返回 200 `image/svg+xml`；不要再删掉，否则 `/` 首屏会重新出现 404。

## 6. 硬性约束

- **不得伪造**：Prompt、Git 历史、AI 输出、测试结果、截图、视频、哈希。拿不到就说拿不到。
- **不要 git commit**（用户未授权提交）。
- 所有对外材料必须带边界：关联≠因果、信号噪声比≠p 值、非医疗诊断/效果承诺。
- AI 未配置时 `/api/interpret` 返回 `503 AI_NOT_CONFIGURED`，这是真实行为，不要改成假成功。
- 浏览器验证只认可真实页面读取结果；此前子代理曾报告不存在的数字（“MLP 256 / 92.48%”），不要采信无截图/无文本依据的结论。

## 7. 已完成（可复述，但不必重做）

- 双产品拆分完成，`/`、`/life`、`/lab` 均可访问。
- `npm.cmd run typecheck`、`npm.cmd run build` 通过。
- 真实浏览器核验：`/life` 恰好 2 个生活实验；`/lab` 恰好 2 个工程实验，digits 显示 93.52% / 94.32%，性能实验 18.85 / 10.77 ms，“新建实验配置”弹窗可开关，无崩溃。
- 技术 PDF 14 页（正文 12 + 附录 A 2），附录已改为双产品与四个内置实验。
- 源码 ZIP 36 个文件，含 `lib/products.ts`、两个入口、宣传文案与演示脚本。
- `submission/promo-copy.md`、`submission/demo-video-scripts.md` 已生成。
- 2026-11-17 新环境复跑：`npm.cmd ci`（28 包，0 漏洞）、`typecheck`、`build` 全部通过。
- 导出真实落盘已确认（headless Edge + CDP，指定下载目录后真实点击）：报告 8115 B、证据 JSON 8407 B（10 条 runs / 1 事件）、CSV 模板 488 B，内容逐项核对通过。
- 干净生产构建下 `/`、`/life`、`/lab` 首屏无 console error / 无未捕获异常 / 无 4xx 静态资源；新增 `app/icon.svg` 消除 favicon 404。

## 8. 尚未完成（优先处理）

1. 首屏 2 条 `SyntaxError` 已在干净构建下未复现，判断为旧构建 chunk 缓存；录制前在录制机上清缓存复核一次，仍不能凭旧记录宣称控制台无错误。
2. 真实移动设备、更多浏览器验收；390 px 只是 CSS 模拟。
3. AI 上游成功路径未端到端验证（`/api/interpret`；送货单项目的 `/api/parse` 已用真实 GLM 验证成功）。
4. 5–8 分钟 1080p MP4，其中至少 2 分钟真实 AI 协同。
5. 官网提交。

已完成（2026-11-18）：公开仓库 <https://github.com/EaZEaZE/RunLedger>（提交作者 Zhang Yan，含 6+1 次细粒度提交）；3 轮真实 Prompt 导出见 `submission/prompts/`；均值差 95% 置信区间已上线并同步 README 与技术简报 PDF；源码 ZIP 由 `git archive` 生成（54 条目，含 `app/icon.svg`，不含 `node_modules`/`.env.local`/`.next`）。

## 9. 建议的第一步

1. 读 `README.md` 与 `submission/SUBMISSION_CHECKLIST.md`（里面区分了“已验证”和“未确认”）。
2. 跑 `npm.cmd run typecheck` 和 `npm.cmd run build`，确认新环境可用。
3. 再决定先修 `SyntaxError` 还是先补导出落盘验证。
4. 任何数字改动都要同步 `README.md`、`promo-copy.md`、`demo-video-scripts.md` 和 PDF 附录，避免材料互相矛盾。
