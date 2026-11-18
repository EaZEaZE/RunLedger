import { configName, getAllStats, getDiagnostics } from "./analysis";
import type { EvidenceEvent, ExperimentData } from "./types";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}

export async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  // 延迟清理，避免 Firefox 等浏览器在 revokeObjectURL 时取消尚未完成的下载。
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char] ?? char);
}

export function exportEvidenceJson(data: ExperimentData, events: EvidenceEvent[]) {
  downloadFile(
    `${data.experiment.id}-evidence.json`,
    JSON.stringify({ exported_at: new Date().toISOString(), data, evidence_events: events }, null, 2),
    "application/json;charset=utf-8",
  );
}

export function exportHtmlReport(data: ExperimentData, events: EvidenceEvent[]) {
  const stats = getAllStats(data);
  const diagnostics = getDiagnostics(data);
  const unit = data.experiment.metric.unit;
  const statRows = stats.map((stat) => `<tr><td>${escapeHtml(configName(data, stat.configId))}</td><td>${stat.n}</td><td>${stat.mean.toFixed(4)}${unit}</td><td>${stat.median.toFixed(4)}${unit}</td><td>${stat.sd.toFixed(4)}${unit}</td><td>${stat.min.toFixed(4)}–${stat.max.toFixed(4)}${unit}</td></tr>`).join("");
  const diagnosticBlocks = diagnostics.map((item) => `<section class="diagnostic ${item.severity}"><small>${escapeHtml(item.category)} / ${escapeHtml(item.id)}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><ul>${item.evidence.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul><strong>建议：</strong><p>${escapeHtml(item.action)}</p></section>`).join("");
  const runRows = data.runs.map((run) => `<tr><td>${escapeHtml(run.id)}</td><td>${escapeHtml(run.config_id)}</td><td>${escapeHtml(run.batch)}</td><td>${escapeHtml(run.phase)}</td><td>${run.seed ?? "—"}</td><td>${run.repeat ?? "—"}</td><td>${run.value}${unit}</td><td>${escapeHtml(run.recorded_at)}</td></tr>`).join("");
  const eventRows = events.map((event) => `<li><strong>${escapeHtml(event.title)}</strong><br><span>${escapeHtml(event.detail)}</span><br><time>${escapeHtml(event.timestamp)}</time></li>`).join("");
  const environment = Object.entries(data.experiment.environment).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>RunLedger · ${escapeHtml(data.experiment.title)}</title><style>
body{font:14px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#17231f;max-width:1100px;margin:40px auto;padding:0 28px}h1{font-size:34px;margin-bottom:4px}h2{margin-top:36px;border-bottom:2px solid #173f35;padding-bottom:8px}h3{margin:6px 0}small,time{color:#65736c}.meta{background:#f1f4ed;padding:18px;border-radius:12px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:9px;border-bottom:1px solid #dfe4dc;text-align:left;vertical-align:top}.diagnostic{border:1px solid #dfe4dc;border-left:5px solid #799087;padding:16px 20px;margin:14px 0;border-radius:8px}.diagnostic.critical{border-left-color:#d66c4a}.diagnostic.warning{border-left-color:#c99a37}.diagnostic.info{border-left-color:#5b8a7b}li{margin:4px 0}.note{font-size:12px;color:#65736c}@media print{body{margin:0}.diagnostic{break-inside:avoid}button{display:none}}
</style></head><body><p>RUNLEDGER / EXPERIMENT EVIDENCE REPORT</p><h1>${escapeHtml(data.experiment.title)}</h1><p>${escapeHtml(data.experiment.subtitle)}</p><div class="meta"><strong>数据模式：</strong>${data.experiment.kind === "lifestyle" ? "真实生活观察记录" : "真实本地实验"}<br><strong>生成时间：</strong>${escapeHtml(data.experiment.created_at)}<br><strong>数据来源：</strong>${escapeHtml(data.experiment.dataset.name)}<br><strong>来源地址：</strong>${escapeHtml(data.experiment.dataset.source)}<br><strong>原始运行指纹：</strong><code>${escapeHtml(data.provenance.runs_sha256 ?? "未提供")}</code></div><h2>${data.experiment.kind === "lifestyle" ? "条件统计" : "配置统计"}</h2><table><thead><tr><th>配置</th><th>n</th><th>均值</th><th>中位数</th><th>样本标准差</th><th>范围</th></tr></thead><tbody>${statRows}</tbody></table><p class="note">${data.experiment.kind === "lifestyle" ? "生活实验按同一对象配对编号计算配对差值（如启用）；信号噪声比只用于补录排序，不是p值。观察性关联不等于因果，本报告不构成医疗建议。" : "性能实验的统计仅使用 warm 阶段；首次调用独立保存。信号噪声比只用于复测排序，不是统计显著性检验。"}</p><h2>诊断与行动</h2>${diagnosticBlocks}<h2>实验设计</h2><pre>${escapeHtml(JSON.stringify(data.experiment.design, null, 2))}</pre><h2>运行环境</h2><table>${environment}</table><h2>版本事件</h2><ol>${eventRows}</ol><h2>完整运行记录（${data.runs.length}）</h2><table><thead><tr><th>ID</th><th>配置</th><th>批次</th><th>阶段</th><th>种子</th><th>重复</th><th>结果</th><th>记录时间</th></tr></thead><tbody>${runRows}</tbody></table><p class="note">由 RunLedger 生成。原始记录只读，追加复测不会覆盖旧值。本报告不宣称统计显著性、因果关系、医疗效果、法律级不可篡改或超出记录条件的泛化结论。</p></body></html>`;
  downloadFile(`${data.experiment.id}-report.html`, html, "text/html;charset=utf-8");
}
