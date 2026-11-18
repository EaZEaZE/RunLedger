import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `你是个人生活实验的证据解释助手。你只能依据用户提供的结构化统计与诊断证据作答，不得编造数值、p值、实验结果、生活记录或外部事实。
观察性关联不等于因果；配对比较不等于随机试验；波动较大不等于结论必然错误。不得提供医疗诊断、治疗或用药建议，不得把步数或睡眠差异说成健康收益。
区分事实、待验证假设和下一步行动。建议应聚焦统一条件定义、补充真实记录、保留原始值和核查混杂因素，不得建议用户编造或修改数据。
必须返回一个JSON对象，字段为：summary（字符串）、hypotheses（字符串数组，最多3项）、actions（字符串数组，最多4项）、cautions（字符串数组，最多2项）。
所有内容使用简洁中文。每个假设都要能追溯到输入证据；证据不足时明确说不知道。`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "AI_NOT_CONFIGURED",
      message: "未配置 AI_API_KEY。统计诊断仍可离线使用，系统不会伪造AI解释。",
    }, { status: 503 });
  }

  try {
    const raw = await request.text();
    if (raw.length > 40000) {
      return NextResponse.json({ error: "PAYLOAD_TOO_LARGE", message: "诊断上下文过大。" }, { status: 413 });
    }
    const body = JSON.parse(raw) as { experiment?: unknown; diagnostic?: unknown; stats?: unknown };
    if (!body.experiment || !body.diagnostic) {
      return NextResponse.json({ error: "INVALID_PAYLOAD", message: "缺少生活实验或诊断上下文。" }, { status: 400 });
    }
    const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ experiment: body.experiment, diagnostic: body.diagnostic, stats: body.stats }) },
        ],
      }),
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "UPSTREAM_ERROR", message: `模型接口返回 ${response.status}`, detail: detail.slice(0, 500) }, { status: 502 });
    }
    const completion = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型未返回内容");
    const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned) as { summary?: unknown; hypotheses?: unknown; actions?: unknown; cautions?: unknown };
    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.hypotheses) || !Array.isArray(parsed.actions)) {
      throw new Error("模型返回结构不符合约定");
    }
    return NextResponse.json({
      summary: parsed.summary,
      hypotheses: parsed.hypotheses.filter((item): item is string => typeof item === "string").slice(0, 3),
      actions: parsed.actions.filter((item): item is string => typeof item === "string").slice(0, 4),
      cautions: Array.isArray(parsed.cautions) ? parsed.cautions.filter((item): item is string => typeof item === "string").slice(0, 2) : [],
    });
  } catch (error) {
    return NextResponse.json({
      error: "INTERPRETATION_FAILED",
      message: error instanceof Error ? error.message : "AI解释失败",
    }, { status: 500 });
  }
}
