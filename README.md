# RunLedger · 生活决策与实验复测

RunLedger 现在是**两个独立产品**，共用同一套本地统计与证据内核：

| 产品 | 入口 | 定位 | 内置数据 |
| --- | --- | --- | --- |
| **RunLedger Life** | `/life` | 个人生活决策记录：两种生活条件下的真实数值 | 两份 CC0 生活演示 |
| **RunLedger Lab** | `/lab` | 通用实验复测工具：基线与候选配置的真实重复运行 | 训练准确率 + 本地计时 |

`/` 是两个产品的选择页。两者各自拥有独立文案、配色、实验列表和本地存储键，互不串数据。

**共同边界：观察性关联不等于因果。配对或重复运行不等于随机试验。信号噪声比不是 p 值；展示的 95% 置信区间是描述性区间，同样不用于显著性判定，也不提供医疗诊断、治疗建议或健康效果承诺。**

## 1. 10 分钟复现路径

### 环境

- 已验证：Node.js 24.21.0、npm 11.19.0、Windows。
- Next.js 16.4.6、React 19.3.1、TypeScript。
- 正常使用不需要 Python、AI 密钥或外部数据库。
- Windows 命令使用 `npm.cmd`；macOS / Linux 可改用 `npm`。

### 启动开发环境

```powershell
npm.cmd ci
npm.cmd run dev
```

打开 <http://localhost:3000> 选择产品，或直接访问 <http://localhost:3000/life>、<http://localhost:3000/lab>。四份内置实验 JSON 已随仓库提供，无需下载原始数据包。

### 类型检查与生产模式

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run start
```

默认地址仍为 <http://localhost:3000>；若端口被占用，按终端输出调整。

## 2. 可以做什么

两个产品共用以下能力，差异在数据口径与文案：

1. **实验总览**：查看条件均值、中位数、样本标准差、分布、配对差异和当前判读；均值差同时给出 95% 置信区间（配对用配对 t，独立用 Welch t），并明确标注区间跨 0 时方向未定。
2. **对比诊断**：查看覆盖不足、差异落入波动、逐点完全相同等问题；每条诊断附证据和建议动作。
3. **复测计划**：按覆盖缺口、记录有效性和差异稳定性安排补录优先级，而不是盲目增加记录。
4. **记录与证据**：查看原始 / 追加批次、完整账本、版本事件、来源、环境和原始记录 SHA-256。
5. **新建实验**：Life 新建生活实验；Lab 新建实验配置。均可定义两组条件、指标、单位、目标方向、目标记录数及是否配对。
6. **真实数据录入**：逐条追加，或下载 CSV 模板填写后导入；系统不会为空白实验生成示例结果。
7. **导出**：生成完整 HTML 报告，或导出包含实验与版本事件的证据 JSON。
8. **可选 AI 解释**：主动点击后，才把当前实验元数据、统计摘要和选中的单条诊断发给服务端；AI 不参与统计计算，也不能修改数据。

## 3. 两个产品怎么用

### RunLedger Life

默认打开“周末会走得更多吗？”，可切换到“睡得更久后，第二天会走更多吗？”。公开演示中的每条 `run` 是一位参与者在一种条件下的日均值，不是单日独立样本，也不是合成生活记录。个人记录保存在 `runledger.lifestyle.v1`。

创建自己的生活实验：

1. 点击“新建生活实验”，填写两种条件和同一个数值指标。
2. 若相同编号代表同一对象或配对周期，勾选“使用配对编号”；不确定时可以不选。
3. 点击“CSV模板”，在 `value` 列填入**实际测量值**。模板中的空值不能直接导入。
4. 点击“导入记录”，或选择“逐条录入”。
5. 在“对比诊断”和“复测计划”中查看下一步；新记录只追加，不覆盖旧值。
6. 在“记录与证据”导出证据 JSON，定期备份。

### RunLedger Lab

内置两份真实本地运行产生的工程实验，用于展示同一套诊断如何用于非生活场景。Lab 的个人记录保存在 `runledger.lab.v1`。

| 实验 | 类型 | 记录 | 结果摘要 |
| --- | --- | ---: | --- |
| digits 小样本图像分类 | classification | 10 次训练 | MLP 32 均值 93.52%，MLP 128 均值 94.32%，128+L2 与 MLP 128 逐点相同；MLP 64×2 仅 1 个种子 |
| 本地高斯模糊性能计时 | performance | 32 次计时 | 二维卷积预热中位数 18.85 ms，可分离卷积 10.77 ms；两种实现最大绝对误差 5.96e-08 |

digits 的 0.80 个百分点差异对应配对差值样本标准差约 0.60，信号噪声比约 1.35，因此界面判读为“差异仍需复测”，不能说成容量提升已被证明。基线 MLP 32 的 3 个种子全部未收敛，这个对比还混入了训练是否充分的问题。工程实验的重现需要 numpy / scipy / scikit-learn，正常查看内置结果不需要。

在 Lab 中“新建实验配置”会创建通用实验（kind=`experiment`），字段与 Life 相同，但文案强调固定实现、依赖版本与运行条件。

CSV 必需列：

- `config_id`：新建实验为 `baseline` 或 `candidate`；公开实验以其配置 ID 为准。
- `value`：有限数值，不能留空或填写估计值。
- `repeat`：大于 0 的整数；配对实验中表示配对编号。

可选列包括 `id`、`seed`、`phase`、`recorded_at`、`note`。记录 ID 不可重复。向已有实验导入 CSV 会追加新批次，不会重写原始批次。

证据 JSON 支持两种结构：直接实验对象，或本应用导出的 `{ exported_at, data, evidence_events }` 包装。若导入实验 ID 已存在，应用会生成新的导入 ID，避免覆盖当前实验。

## 4. 数据来源与固定结果

公开演示来自 Kaggle 数据卡标注为 **CC0-1.0** 的 FitBit Fitness Tracker Data：

- 数据页：<https://www.kaggle.com/datasets/arashnic/fitbit>
- 原始 ZIP：<https://www.kaggle.com/api/v1/datasets/download/arashnic/fitbit>
- 许可说明：<https://creativecommons.org/publicdomain/zero/1.0/>
- 数据期：2016-04-12 至 2016-05-12，具体记录范围以原始文件为准。
- 原始 ZIP SHA-256：`263bb05592792d1dbbd4b3c40b3203e7083489e085b38303dcf7e151c932f870`

| 实验 | 条件 | 参与者对数 / 记录数 | 条件均值 |
| --- | --- | ---: | ---: |
| 周末会走得更多吗？ | 工作日 / 周末 | 32 对 / 64 条 | 8009.3772 / 8086.0565 步 |
| 睡得更久后，第二天会走更多吗？ | 较短睡眠后 / 较长睡眠后 | 18 对 / 36 条 | 8588.7017 / 8365.8116 步 |

这些均值只描述当前样本和分组规则。周末均值略高、较长睡眠后的次日均值略低，都**不能单独证明生活条件导致变化**，也不代表统计显著性或健康收益。

原始 `runs` 的规范化 SHA-256：

- `weekend-steps`：`be33c24502a9df093fc9d3a9f4ae1fba2affb7c81a841b971038cd52bcb394ab`
- `sleep-next-day-steps`：`4edc3f93c189fdc9c722f000fbd49314ef2443bb5f37802215da2ee15480f1a0`

完整文件哈希、原始 CSV 行数和统计见 `data/lifestyle-provenance.json`。

### 从原始数据重新生成（可选）

正常启动无需执行本节。只有复核数据管线时才需要原始 ZIP；ZIP 不随提交源码包分发。

1. 从上述地址下载 ZIP，保存为 `data/fitbit-fitness-tracker-data.zip`。
2. 运行：

```powershell
python experiments/prepare_lifestyle_data.py
```

也可使用 `npm.cmd run data:lifestyle`。脚本只依赖 Python 标准库，已在 Python 3.9.13 验证。它会提取两份原始 CSV，按公开规则聚合并重写 `public/data/*.json` 与 `data/lifestyle-provenance.json`。

周末实验要求每位参与者在两种条件下都至少有 2 个 `TotalSteps > 0` 的有效日。睡眠实验严格连接下一日历日，按每位参与者自身睡眠中位数分组，并要求两种条件都至少有 2 个有效配对日。脚本不生成、不补值、不修改原始结果。

重新生成会更新创建时间、生成时间和整个 JSON 文件哈希；在原始数据与规则不变时，规范化 `runs` 哈希应保持不变。

## 5. 统计与诊断口径

- 组统计：n、均值、中位数、样本标准差、极值、四分位数和变异系数。
- 配对生活实验：以相同 `repeat` 连接参照与对比记录，计算配对差值均值及其样本标准差。
- 非配对比较：使用两组中较大的样本标准差作为波动参考。
- `信号噪声比 = |目标方向差异| / 波动参考`，用于复测排序。
- 差异未朝目标方向、ratio < 1、1 ≤ ratio < 2、ratio ≥ 2 分别对应不同的复测提示；它们不是假设检验、置信区间或显著性等级。
- 生活实验始终附加观察性边界：未随机分配条件，时间、日程、环境、佩戴与记录习惯等混杂仍可能存在。

诊断与优先级是确定性本地规则。AI 关闭时，全部主要功能仍可使用。

## 6. 可选 AI 配置与隐私

不配置密钥时，真实请求 `/api/interpret` 会返回 `503 AI_NOT_CONFIGURED`，界面明确停留在规则诊断模式，不伪造 AI 解释。

需要启用时：

```powershell
Copy-Item .env.example .env.local
```

在 `.env.local` 填写：

```dotenv
AI_API_KEY=你的真实密钥
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

重启服务。上游需兼容 `/chat/completions` 和 JSON object 响应格式。密钥仅放服务端环境文件，不要提交、截图或录进视频。

点击 AI 解释时，UI 发送 `data.experiment`、各条件统计摘要和当前一条 `diagnostic`，**不发送完整 `runs`**。但实验标题、条件、设计、环境等元数据可能仍含个人内容，请求第三方模型前应主动检查。不要在备注或实验元数据中填写不必要的敏感信息。

## 7. 存储、导出与边界

- 两个产品各自独立存储：RunLedger Life 使用 `runledger.lifestyle.v1`，RunLedger Lab 使用 `runledger.lab.v1`；没有账号、云同步或跨设备同步。
- 两个产品的实验列表互不混入：加载时会剔除属于另一个产品的内置实验，避免早期合并状态串数据。
- 若本地副本中某个内置实验的原始批次被改动或与内置数据不一致，加载时会用内置原始批次修复该实验；用户自己追加的 `rerun-*` / `import-*` 批次仍会保留在未被修复的实验里。
- 清除站点数据、更换浏览器或更换访问源可能导致记录不可见；请导出证据 JSON 备份。
- UI 不编辑已有运行值，复测以新批次追加；这不等于法律级不可篡改。
- SHA-256 用于发现原始批次的意外变化，不提供身份签名、可信时间戳或法律级存证。
- HTML 报告包含统计、诊断、设计、环境、事件和完整运行表；导出前检查敏感备注。
- 当前验证以类型检查、生产构建和真实浏览器流程为主，不代表完整自动化测试矩阵或所有浏览器兼容性认证。

## 8. 当前真实验证状态

已执行并通过：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- 公开实验切换、空白实验创建、真实记录追加、刷新后本地持久化。
- 双产品入口在真实浏览器中核验：`/` 显示两张产品卡片；`/life` 品牌为 RunLedger Life，只显示两份生活演示；`/lab` 品牌为 RunLedger Lab，只显示 digits 小样本图像分类与本地高斯模糊性能计时。
- 四个内置实验分别在所属产品中切换通过：digits 显示 MLP 32 93.52% / MLP 128 94.32%，性能实验显示预热中位数 18.85 ms 与 10.77 ms；Lab 的“新建实验配置”弹窗可正常打开和关闭，页面无崩溃。
- 证据 JSON 导出包装结构再导入、CSV 追加后统计更新，以及公开演示原始哈希保持不变。
- 未配置密钥时，真实 POST `/api/interpret` 返回 `503 AI_NOT_CONFIGURED`。
- 612 × 826 真实浏览器视口核验；390 px 仅为 CSS 宽度模拟，未见页面级横向溢出，标题与导航可见，**不是 390 × 844 真机测试**。
- 导出已真实落盘并核对内容（headless Edge + CDP，指定下载目录后真实点击）：`digits-small-sample-report.html` 8115 B，标题与 93.52 / 94.32 均存在；`digits-small-sample-evidence.json` 8407 B，键为 `exported_at` / `data` / `evidence_events`，含 10 条 runs 与 1 个事件；`digits-small-sample-template.csv` 488 B，表头与空值提示正确。
- 干净生产构建下，`/`、`/life`、`/lab` 首屏均无 console error、无未捕获异常、无 4xx/5xx 静态资源请求；`app/icon.svg` 修复后 `/icon.svg` 返回 200 `image/svg+xml`。

尚需人工确认 / 排查：

- 此前记录的 2 条首屏 `SyntaxError` 在干净生产构建与全新浏览器配置下未复现，判断为旧构建 chunk 被缓存、请求返回 HTML 所致；录制前仍应清缓存后再复核一次。
- 真实移动设备、更多浏览器、AI 上游成功路径尚未完成端到端验收。
- 当前环境没有可用的 `git` 命令，公开仓库和细粒度提交历史未核验。

## 9. 代码结构

```text
app/page.tsx                 两个产品的选择页
app/life/page.tsx            RunLedger Life 入口
app/lab/page.tsx             RunLedger Lab 入口
app/api/interpret/route.ts   可选 AI 解释服务端路由
app/icon.svg                 站点图标（由 /icon.svg 提供，消除 favicon 404）
components/Dashboard.tsx     实验状态、导入、追加、本地持久化（两个产品共用）
components/Views.tsx         总览、诊断、复测、证据和表单视图
components/Charts.tsx        分布与配对图表
lib/products.ts              两个产品的品牌、文案、主题、数据集与存储键
lib/data.ts                  生活与工程两组内置实验
lib/analysis.ts              统计、诊断和复测优先级
lib/export.ts                规范化哈希、证据 JSON 和 HTML 报告
lib/types.ts                 数据结构
public/data/                 四份内置实验（2 份 CC0 生活演示 + 2 份本地工程实验）
experiments/prepare_lifestyle_data.py
                             CC0 原始 CSV 的确定性聚合脚本
data/lifestyle-provenance.json
                             来源、原始文件与输出哈希
submission/                  技术说明、Prompt 待填模板、视频脚本、清单
```

## 10. 比赛材料状态

`submission/prompts/` 目前只有**待填模板，不是原始 Prompt 导出**；`submission/video-script.md` 是**录制脚本，不是视频**。公开 Git 仓库、真实细粒度历史、至少 3 轮原始 Prompt 导出（含真实修 Bug）、5–8 分钟 1080p MP4（至少 2 分钟真实 AI 协同）及官网提交仍需人工完成，具体见 `submission/SUBMISSION_CHECKLIST.md`。
