# 第 2 轮：从零搭建送货单生成器 MVP

- 轮次：2
- 场景：确定做 idea② 后，新建独立项目并接入真实大模型
- 使用的 AI：Trae 内置 AI 助手（对话式）

## 用户原始输入（逐字）

第一条：

> AI密钥是哪个AI的密钥？我去找
> 在当前工作区新建子目录`delivery-note/`

第二条（拿到密钥后）：

> 我刚注册好了智谱AI（GLM），现在要做什么？

第三条（提供密钥，密钥内容已在本文件中脱敏）：

> ea92ecdc076947c48f5cab2c5516536a.b1vgR4Pf1ki7NYmM
> 上面是API Key

## AI 产出（实际落地的文件）

```
delivery-note/
├── app/
│   ├── page.tsx                 # 首页：AI 解析区 + 表单 + 历史侧栏
│   ├── layout.tsx
│   ├── globals.css              # 含 A4 打印样式
│   ├── icon.svg
│   ├── api/parse/route.ts       # 服务端代理，密钥不下发前端
│   └── note/[id]/page.tsx       # 打印页
├── lib/
│   ├── types.ts                 # Party / LineItem / DeliveryNote
│   ├── calc.ts                  # 行金额、合计、中文大写
│   ├── storage.ts               # localStorage CRUD
│   └── ai.ts                    # System Prompt + JSON 解析
├── .env.example
└── README.md
```

关键实现：

- AI 侧使用 OpenAI 兼容协议调用智谱 `glm-4-flash`，开启 `response_format: { type: "json_object" }`。
- System Prompt 约束：数量与单价必须是数字，无法确定填 0；不确定字段留空，不得编造。
- 前端只请求同源 `/api/parse`，`AI_API_KEY` 仅存在于服务端 `.env.local`。
- 未配置密钥时接口返回真实 `503 AI_NOT_CONFIGURED`，UI 显示「AI 未配置」并保留手动录入。

## 验证记录

| 检查项 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run build` | 通过（`/`、`/api/parse`、`/note/[id]`、`/icon.svg`） |
| 浏览器控制台 | 0 error / 0 异常 / 0 个 4xx |
| 未配置密钥 | 真实返回 503，未伪造解析结果 |
| 配置密钥后 | 一句话描述 → 发货方/收货方/商品/备注自动填入 |

## 人工修正

- 密钥由用户本人到智谱开放平台申请，只写入本地 `.env.local`；该文件已被 `.gitignore` 排除，推送 GitHub 前核验过提交树中不含密钥。
