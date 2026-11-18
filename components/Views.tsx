"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Clock3,
  Database,
  Download,
  FileCheck2,
  FlaskConical,
  FolderInput,
  Info,
  ListChecks,
  Loader2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import type { ProductConfig } from "@/lib/products";
import {
  configName,
  formatNumber,
  getAllStats,
  getClaim,
  getDiagnostics,
  getRerunQueue,
} from "@/lib/analysis";
import type {
  ConfigStats,
  Diagnostic,
  EvidenceEvent,
  ExperimentData,
  ExperimentRun,
} from "@/lib/types";
import { DistributionChart, RunSequenceChart } from "./Charts";

export type ViewKey = "overview" | "diagnostics" | "rerun" | "evidence";

const severityText = { critical: "优先复测", warning: "需要核查", info: "设计保障" };

function central(data: ExperimentData, stat: ConfigStats) {
  return data.experiment.kind === "performance" ? stat.median : stat.mean;
}

function SeverityBadge({ severity }: { severity: Diagnostic["severity"] }) {
  return <span className={`severity-badge ${severity}`}>{severityText[severity]}</span>;
}

export function Overview({
  data,
  selectedCandidate,
  onSelectCandidate,
  onNavigate,
}: {
  data: ExperimentData;
  selectedCandidate: string;
  onSelectCandidate: (id: string) => void;
  onNavigate: (view: ViewKey) => void;
}) {
  const stats = getAllStats(data);
  const diagnostics = getDiagnostics(data);
  const queue = getRerunQueue(data);
  const claim = getClaim(data, selectedCandidate);
  const unit = data.experiment.metric.unit;
  const performance = data.experiment.kind === "performance";
  const lifestyle = data.experiment.kind === "lifestyle";
  const paired = lifestyle && data.experiment.design.analysis === "paired";
  const critical = diagnostics.filter((item) => item.severity === "critical").length;
  const higher = data.experiment.metric.higher_is_better;
  const populated = stats.filter((stat) => stat.n > 0);
  const best = populated.reduce((current, stat) => {
    if (!current) return stat;
    return (higher ? central(data, stat) > central(data, current) : central(data, stat) < central(data, current)) ? stat : current;
  }, populated[0]);
  const baseline = stats.find((stat) => stat.configId === data.experiment.baseline_config);
  const candidate = stats.find((stat) => stat.configId === selectedCandidate);
  const ratioWidth = claim ? Math.min(100, (claim.signalRatio / 2) * 100) : 0;

  return (
    <div className="view-stack">
      <section className="experiment-heading">
        <div>
          <div className="eyebrow">{lifestyle ? "LIFE EXPERIMENT / OBSERVATIONAL" : `EXPERIMENT / ${performance ? "PERFORMANCE" : data.experiment.kind === "classification" ? "CLASSIFICATION" : "CUSTOM"}`}</div>
          <h1>{data.experiment.title}</h1>
          <p>{data.experiment.subtitle}</p>
        </div>
        <div className="experiment-stamp">
          <span className="real-data-badge"><span />{data.provenance.data_mode === "public_observational_demo" ? "CC0公开数据演示" : lifestyle ? "本地真实生活记录" : "真实本地实验"}</span>
          <small>{new Date(data.experiment.created_at).toLocaleString("zh-CN")}</small>
        </div>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span>{lifestyle ? "有效条件记录" : "有效运行记录"}</span>
          <strong>{data.runs.length}<small> 条</small></strong>
          <p>{performance ? "含2条首次调用，独立保存" : lifestyle ? "每条可追溯到真实来源，追加不覆盖" : "原始记录只读，追加不覆盖"}</p>
          <Database size={19} />
        </article>
        <article className="summary-card">
          <span>{lifestyle ? "对比条件" : "对比配置"}</span>
          <strong>{data.configs.length}<small> 组</small></strong>
          <p>参照：{configName(data, data.experiment.baseline_config)}</p>
          <FlaskConical size={19} />
        </article>
        <article className={`summary-card ${critical ? "attention" : ""}`}>
          <span>{lifestyle ? "优先补录信号" : "优先复测信号"}</span>
          <strong>{critical}<small> 项</small></strong>
          <p>{queue.length} 项行动已进入复测队列</p>
          <AlertTriangle size={19} />
        </article>
        <article className="summary-card accent">
          <span>{performance ? "最低预热中位数" : lifestyle ? (higher ? "最高条件均值" : "最低条件均值") : "最高组均值"}</span>
          <strong>{formatNumber(central(data, best))}<small> {unit}</small></strong>
          <p>{configName(data, best.configId)} · {lifestyle ? "数值高低不代表因果效果" : "不直接等于可信最优"}</p>
          <CircleGauge size={19} />
        </article>
      </section>

      <section className="claim-panel">
        <div className="claim-topline">
          <span><CircleGauge size={16} />核心判读</span>
          <label>
            {lifestyle ? "对比条件" : "对比配置"}
            <select value={selectedCandidate} onChange={(event) => onSelectCandidate(event.target.value)}>
              {data.configs.filter((config) => config.id !== data.experiment.baseline_config).map((config) => (
                <option key={config.id} value={config.id}>{config.short_name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="claim-layout">
          <div className="claim-copy">
            <h2>{lifestyle ? `${configName(data, selectedCandidate)} 与参照条件的差异稳定吗？` : `${configName(data, selectedCandidate)} 的${performance ? "加速" : "提升"}可信吗？`}</h2>
            <p>{lifestyle ? "先看真实记录与配对波动，再决定是否补录；不把观察关联写成因果。" : "先比较差异与组内波动，再决定是否值得写入实验结论。"}</p>
            {claim && <div className={`verdict-pill ${claim.verdict}`}><span />{claim.label}</div>}
          </div>
          <div className="claim-numbers">
            <div>
              <span>{lifestyle ? "参照条件均值" : `基线${performance ? "中位数" : "均值"}`}</span>
              <strong>{baseline?.n ? formatNumber(central(data, baseline)) : "—"}<small>{unit}</small></strong>
              <p>{configName(data, data.experiment.baseline_config)}</p>
            </div>
            <ArrowRight size={24} />
            <div>
              <span>{lifestyle ? "对比条件均值" : `候选${performance ? "中位数" : "均值"}`}</span>
              <strong>{candidate?.n ? formatNumber(central(data, candidate)) : "—"}<small>{unit}</small></strong>
              <p>{configName(data, selectedCandidate)}</p>
            </div>
            <div className="delta-block">
              <span>{paired ? "平均配对差 / 差值SD" : "均值差 / 波动"}</span>
              <strong>{claim ? `${claim.rawDelta >= 0 ? "+" : ""}${formatNumber(claim.rawDelta)}` : "—"}<small>{unit}</small></strong>
              <p>{claim ? `÷ ${formatNumber(claim.noise)}${unit}` : "等待数据"}</p>
            </div>
          </div>
        </div>
        {claim && (
          <div className="signal-meter">
            <div className="signal-labels">
              <span>差异被波动覆盖</span><span>信号噪声比 {formatNumber(claim.signalRatio)}</span><span>{paired ? "超过2倍配对差值标准差" : "超过2倍组内标准差"}</span>
            </div>
            <div className="signal-track">
              <div className="signal-fill" style={{ width: `${ratioWidth}%` }} />
              <i className="threshold one" /><i className="threshold two" />
            </div>
            <p>{claim.explanation}</p>
          </div>
        )}
        {claim && claim.verdict !== "supported" && (
          <div className="why-not">
            <strong><Info size={14} /> 为什么还不能下结论？</strong>
            <ul>
              <li>信号噪声比 {formatNumber(claim.signalRatio)} 未达到 2 倍波动阈值，差异可能只是随机波动。</li>
              <li>当前样本量有限（基线 {baseline?.n ?? 0} / 候选 {candidate?.n ?? 0}），不能排除偶然。</li>
              <li>{lifestyle ? "观察性记录未随机分配条件，时间、环境等混杂仍可能存在。" : "未控制所有运行条件，重复之间的差异不等于配置差异。"}</li>
              <li>信号噪声比是复测排序启发式，不是 p 值、置信区间或统计显著性。</li>
            </ul>
            <button className="text-button" onClick={() => onNavigate("rerun")}>查看复测计划 →</button>
          </div>
        )}
      </section>

      <section className="panel distribution-panel">
        <div className="panel-heading">
          <div><span className="section-kicker">DISTRIBUTION</span><h2>{lifestyle ? "每一条真实条件记录都保留在图上" : "每一次运行都保留在图上"}</h2></div>
          <button className="text-button" onClick={() => onNavigate("diagnostics")}>查看诊断依据<ArrowUpRight size={16} /></button>
        </div>
        <DistributionChart data={data} stats={stats} />
      </section>

      {performance && (
        <section className="panel">
          <div className="panel-heading"><div><span className="section-kicker">SEQUENCE</span><h2>预热计时的顺序与漂移</h2></div></div>
          <RunSequenceChart data={data} />
        </section>
      )}

      <section className="overview-bottom-grid">
        <article className="panel action-callout">
          <span className="section-kicker">NEXT ACTION</span>
          <h2>{queue[0]?.title ?? "当前没有待复测项"}</h2>
          <p>{queue[0]?.reason ?? "所有启发式检查均已通过，仍应结合实验假设判断。"}</p>
          <button className="primary-button" onClick={() => onNavigate("rerun")}>{lifestyle ? "查看补录计划" : "进入复测队列"}<ArrowRight size={17} /></button>
        </article>
        <article className="panel method-note">
          <Info size={20} />
          <div><h3>{lifestyle ? "配对能减少什么，不能减少什么？" : "这里的“噪声”是什么？"}</h3><p>{lifestyle ? <>同一对象配对可减少个体间差异，但不能消除日程、环境等混杂。配对差值的<strong>样本标准差</strong>只用于安排补录顺序，<strong>不是p值，关联不等于因果</strong>。</> : <>当前使用基线与候选中较大的<strong>样本标准差</strong>做快速筛查。它用于安排复测顺序，<strong>不是p值，也不证明统计显著性</strong>。</>}</p></div>
        </article>
      </section>

      <RunStatsTable data={data} stats={stats} onSelectCandidate={onSelectCandidate} />
    </div>
  );
}

function RunStatsTable({ data, stats, onSelectCandidate }: { data: ExperimentData; stats: ConfigStats[]; onSelectCandidate: (id: string) => void }) {
  const unit = data.experiment.metric.unit;
  return (
    <section className="panel table-panel">
      <div className="panel-heading"><div><span className="section-kicker">CONDITIONS</span><h2>{data.experiment.kind === "lifestyle" ? "条件统计明细" : "配置统计明细"}</h2></div></div>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>{data.experiment.kind === "lifestyle" ? "条件" : "配置"}</th><th>有效 n</th><th>均值</th><th>中位数</th><th>样本标准差</th><th>范围</th><th>判读</th></tr></thead>
        <tbody>{stats.map((stat) => {
          const claim = getClaim(data, stat.configId);
          const isBaseline = stat.configId === data.experiment.baseline_config;
          return (
            <tr key={stat.configId} onClick={() => !isBaseline && onSelectCandidate(stat.configId)} className={!isBaseline ? "clickable-row" : ""}>
              <td><strong>{configName(data, stat.configId)}</strong><small>{stat.configId}</small></td>
              <td>{stat.n}</td><td>{stat.n ? `${formatNumber(stat.mean)}${unit}` : "—"}</td><td>{stat.n ? `${formatNumber(stat.median)}${unit}` : "—"}</td>
              <td>{stat.n > 1 ? `± ${formatNumber(stat.sd)}${unit}` : "无法估计"}</td>
              <td>{stat.n ? `${formatNumber(stat.min)}–${formatNumber(stat.max)}${unit}` : "—"}</td>
              <td>{isBaseline ? <span className="neutral-badge">{data.experiment.kind === "lifestyle" ? "参照条件" : "比较基线"}</span> : <span className={`mini-verdict ${claim?.verdict}`}>{claim?.label ?? "—"}</span>}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
    </section>
  );
}

interface AiResult { summary: string; hypotheses: string[]; actions: string[]; cautions: string[] }

function AiExplanation({ data, diagnostic }: { data: ExperimentData; diagnostic: Diagnostic }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  useEffect(() => { setResult(null); setError(null); }, [diagnostic.id]);

  async function generate() {
    setLoading(true); setError(null);
    try {
      const stats = getAllStats(data).map((stat) => ({
        config: configName(data, stat.configId), n: stat.n, mean: stat.mean,
        median: stat.median, sample_sd: stat.sd, min: stat.min, max: stat.max,
      }));
      const response = await fetch("/api/interpret", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experiment: data.experiment, diagnostic, stats }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError({ code: payload.error ?? "REQUEST_FAILED", message: payload.message ?? "请求失败" });
      } else setResult(payload as AiResult);
    } catch (reason) {
      setError({ code: "NETWORK_ERROR", message: reason instanceof Error ? reason.message : "网络请求失败" });
    } finally { setLoading(false); }
  }

  return (
    <div className="ai-box">
      <div className="ai-title"><Sparkles size={17} /><strong>AI 证据解释</strong><span>可选 · 不参与统计计算</span></div>
      <p className="ai-description">只发送当前实验元数据、统计摘要和这条诊断，不发送完整生活记录。模型不能修改数据，也不能判断因果。</p>
      {!result && <button className="secondary-button" onClick={generate} disabled={loading}>{loading ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}{loading ? "正在请求真实模型…" : "基于这条证据生成解释"}</button>}
      {error && <div className={`ai-error ${error.code === "AI_NOT_CONFIGURED" ? "setup" : ""}`}><Info size={17} /><div><strong>{error.code === "AI_NOT_CONFIGURED" ? "当前为规则诊断模式，未启用AI" : "AI请求未完成"}</strong><p>{error.message}</p>{error.code === "AI_NOT_CONFIGURED" && <code>复制 .env.example 为 .env.local，填写 AI_API_KEY 后重启。</code>}</div></div>}
      {result && <div className="ai-result"><span className="ai-generated-label">真实模型返回 · 请核查</span><p className="ai-summary">{result.summary}</p><h4>可能假设（不是事实）</h4><ul>{result.hypotheses.map((item, index) => <li key={index}>{item}</li>)}</ul><h4>建议行动</h4><ol>{result.actions.map((item, index) => <li key={index}>{item}</li>)}</ol>{result.cautions.length > 0 && <div className="caution">{result.cautions.join("；")}</div>}</div>}
    </div>
  );
}

export function DiagnosticsView({ data }: { data: ExperimentData }) {
  const diagnostics = useMemo(() => getDiagnostics(data), [data]);
  const [selectedId, setSelectedId] = useState(diagnostics[0]?.id ?? "");
  useEffect(() => {
    if (!diagnostics.some((item) => item.id === selectedId)) setSelectedId(diagnostics[0]?.id ?? "");
  }, [diagnostics, selectedId]);
  const selected = diagnostics.find((item) => item.id === selectedId) ?? diagnostics[0];
  if (!selected) return <EmptyState title="没有诊断项" detail="导入包含多次重复的运行记录后，这里会显示诊断。" />;
  return (
    <div className="view-stack">
      <PageTitle kicker="EVIDENCE DIAGNOSTICS" title="诊断不是结论，是下一步行动的依据" detail="每条判断都附带原始证据、适用范围和可执行动作。" />
      <div className="diagnostic-summary">
        {(["critical", "warning", "info"] as const).map((severity) => <div key={severity}><SeverityBadge severity={severity} /><strong>{diagnostics.filter((item) => item.severity === severity).length}</strong></div>)}
        <p>规则计算在浏览器本地完成，AI不会改写这些结果。</p>
      </div>
      <div className="diagnostic-layout">
        <aside className="diagnostic-list">
          {diagnostics.map((item) => <button key={item.id} className={item.id === selected.id ? "selected" : ""} onClick={() => setSelectedId(item.id)}>
            <span className={`severity-dot ${item.severity}`} /><div><small>{item.category}</small><strong>{item.title}</strong><p>{item.summary}</p></div><ChevronRight size={17} />
          </button>)}
        </aside>
        <section className="diagnostic-detail panel">
          <div className="detail-top"><SeverityBadge severity={selected.severity} /><code>{selected.id}</code></div>
          <h2>{selected.title}</h2><p className="detail-summary">{selected.summary}</p>
          <div className="evidence-block"><h3><FileCheck2 size={17} />证据</h3><ul>{selected.evidence.map((line, index) => <li key={index}><span>{String(index + 1).padStart(2, "0")}</span>{line}</li>)}</ul></div>
          <div className="action-block"><h3><ListChecks size={17} />建议行动</h3><p>{selected.action}</p></div>
          <AiExplanation data={data} diagnostic={selected} />
        </section>
      </div>
    </div>
  );
}

export function RerunView({ data, onAddRun }: { data: ExperimentData; onAddRun: (configId: string) => void }) {
  const queue = useMemo(() => getRerunQueue(data), [data]);
  const diagnostics = getDiagnostics(data);
  const [selectedId, setSelectedId] = useState(queue[0]?.id ?? "");
  useEffect(() => { if (!queue.some((item) => item.id === selectedId)) setSelectedId(queue[0]?.id ?? ""); }, [queue, selectedId]);
  const selected = queue.find((item) => item.id === selectedId) ?? queue[0];
  if (!selected) return <EmptyState title="复测队列已清空" detail="当前启发式规则没有产生待办。你仍可主动追加一次独立运行。" />;
  return (
    <div className="view-stack">
      <PageTitle kicker="RERUN QUEUE" title="把不确定的结论，变成一张复测计划" detail="优先级由覆盖缺口、信号噪声比和实验过程风险共同决定。它不是错误概率。" />
      <div className="rerun-layout">
        <aside className="rerun-queue">
          <div className="queue-caption"><span>待办 {queue.length}</span><small>按优先级排序</small></div>
          {queue.map((item, index) => <button key={item.id} className={item.id === selected.id ? "selected" : ""} onClick={() => setSelectedId(item.id)}>
            <span className="priority-number">{String(index + 1).padStart(2, "0")}</span><div><small>{configName(data, item.configId)} · 优先级 {item.priority}</small><strong>{item.title}</strong><p>{item.reason}</p></div>
          </button>)}
        </aside>
        <section className="panel rerun-detail">
          <div className="rerun-detail-heading"><div><span className="section-kicker">ACTION PLAN</span><h2>{selected.title}</h2></div><span className="priority-score">{selected.priority}<small>/ 100</small></span></div>
          <div className="reason-box"><AlertTriangle size={19} /><div><strong>为什么现在要做</strong><p>{selected.reason}</p></div></div>
          <h3>推荐操作</h3><p className="large-action">{selected.action}</p>
          <div className="rerun-steps">
            <div><span>1</span><strong>{data.experiment.kind === "lifestyle" ? "保持定义" : "冻结条件"}</strong><p>{data.experiment.kind === "lifestyle" ? "保持两种条件、指标单位和记录方式一致。" : "保持数据划分、实现与环境一致。"}</p></div>
            <div><span>2</span><strong>追加记录</strong><p>{selected.suggestedRuns > 0 ? `建议新增 ${selected.suggestedRuns} 条真实记录。` : data.experiment.kind === "lifestyle" ? "先核查原始记录，不盲目增加数量。" : "先核查实现，不盲目增加运行。"}</p></div>
            <div><span>3</span><strong>重新判读</strong><p>新结果加入后，诊断自动重新计算，仍不推断因果。</p></div>
          </div>
          <div className="linked-evidence"><h3>关联诊断</h3>{selected.diagnosticIds.map((id) => { const item = diagnostics.find((diagnostic) => diagnostic.id === id); return item ? <div key={id}><code>{id}</code><p>{item.summary}</p></div> : null; })}</div>
          <button className="primary-button" onClick={() => onAddRun(selected.configId)}><Plus size={17} />{data.experiment.kind === "lifestyle" ? "追加一条真实生活记录" : "录入一次真实复测"}</button>
          <p className="form-hint">只接收你实际得到的结果；系统不会自动生成看似合理的新数值。</p>
        </section>
      </div>
    </div>
  );
}

export function EvidenceView({
  data,
  events,
  hash,
  onExport,
}: {
  data: ExperimentData;
  events: EvidenceEvent[];
  hash: { value: string; matches: boolean; checking: boolean };
  onExport: () => void;
}) {
  const original = data.runs.filter((run) => run.batch === "original");
  const added = data.runs.length - original.length;
  return (
    <div className="view-stack">
      <PageTitle kicker="EVIDENCE LEDGER" title="每一个原始值，都有迹可循" detail="原始记录只读；复测以新批次追加。指纹用于发现意外变化，不代表法律级存证。" />
      <section className="evidence-cards">
        <article className="hash-card"><div><LockKeyhole size={21} /><span>原始记录 SHA-256</span></div><code>{hash.value || data.provenance.runs_sha256 || "计算中…"}</code><p>{hash.checking ? "正在浏览器中重新计算…" : hash.matches ? <><CheckCircle2 size={16} />与已保存的原始记录指纹一致</> : <><AlertTriangle size={16} />浏览器指纹与脚本记录不同，请检查导入格式</>}</p></article>
        <article className="version-card"><span>原始 / 追加</span><strong>{original.length}<small> / </small>{added}</strong><p>记录保存在当前浏览器；导出JSON可备份完整状态。</p><button className="secondary-button" onClick={onExport}><Download size={16} />导出证据JSON</button></article>
      </section>
      <div className="evidence-layout">
        <section className="panel timeline-panel"><div className="panel-heading"><div><span className="section-kicker">TIMELINE</span><h2>版本事件</h2></div></div><ol className="evidence-timeline">{events.map((event) => <li key={event.id}><span className={`timeline-icon ${event.type}`}>{event.type === "snapshot" ? <LockKeyhole size={15} /> : <Plus size={15} />}</span><div><strong>{event.title}</strong><p>{event.detail}</p><time>{new Date(event.timestamp).toLocaleString("zh-CN")}</time></div></li>)}</ol></section>
        <section className="panel environment-panel"><div className="panel-heading"><div><span className="section-kicker">ENVIRONMENT</span><h2>运行环境与来源</h2></div></div><dl>{Object.entries(data.experiment.environment).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl><div className="source-box"><Database size={18} /><div><strong>{data.experiment.dataset.name}</strong><p>{data.experiment.dataset.license_note}</p>{data.experiment.dataset.source.startsWith("http") ? <a href={data.experiment.dataset.source} target="_blank" rel="noreferrer">查看数据来源<ArrowUpRight size={13} /></a> : <p>个人记录不会上传；导出前请检查是否含有敏感备注。</p>}</div></div><div className="source-box"><TerminalSquare size={18} /><div><strong>复现命令</strong><code>{data.provenance.command}</code><p>{data.provenance.description}</p></div></div><div className="design-details"><h3>控制变量与适用边界</h3>{Object.entries(data.experiment.design).map(([key, value]) => <div key={key}><span>{key}</span><p>{Array.isArray(value) ? value.join(" / ") : String(value)}</p></div>)}</div></section>
      </div>
      <section className="panel table-panel"><div className="panel-heading"><div><span className="section-kicker">RAW RUNS</span><h2>{data.experiment.kind === "lifestyle" ? "完整生活记录账本" : "完整运行账本"} · {data.runs.length} 条</h2></div></div><div className="table-scroll"><table className="data-table raw-table"><thead><tr><th>记录ID</th><th>{data.experiment.kind === "lifestyle" ? "条件" : "配置"}</th><th>批次</th><th>记录类型</th><th>{data.experiment.kind === "lifestyle" ? "配对 / 记录序号" : "种子 / 重复"}</th><th>结果</th><th>记录时间</th></tr></thead><tbody>{data.runs.map((run) => <tr key={run.id}><td><code>{run.id}</code>{run.note && <small>{run.note}</small>}</td><td>{configName(data, run.config_id)}</td><td><span className={`batch-badge ${run.batch === "original" ? "" : "rerun"}`}>{run.batch}</span></td><td>{data.experiment.kind === "lifestyle" ? (run.phase === "participant_mean" ? "参与者条件均值" : "生活记录") : run.phase}</td><td>{run.repeat ?? run.seed ?? "—"}</td><td><strong>{run.value}{data.experiment.metric.unit}</strong></td><td>{new Date(run.recorded_at).toLocaleString("zh-CN")}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}

export function AddRunModal({ data, initialConfig, onClose, onSubmit }: { data: ExperimentData; initialConfig: string; onClose: () => void; onSubmit: (run: ExperimentRun) => void }) {
  const performance = data.experiment.kind === "performance";
  const lifestyle = data.experiment.kind === "lifestyle";
  const [configId, setConfigId] = useState(initialConfig);
  const [indexValue, setIndexValue] = useState(() => Math.max(0, ...data.runs
    .filter((run) => run.config_id === initialConfig && (!performance || run.phase === "warm"))
    .map((run) => run.repeat ?? run.seed ?? 0)) + 1);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const numericValue = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(numericValue) && numericValue >= 0 && Number.isInteger(indexValue) && indexValue >= 1;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const stamp = Date.now();
    onSubmit({
      id: `manual-${data.experiment.id}-${stamp}`,
      config_id: configId,
      seed: performance || lifestyle ? null : indexValue,
      repeat: indexValue,
      phase: performance ? "warm" : lifestyle ? "observation" : "training",
      value: numericValue,
      metrics: { [data.experiment.metric.key]: numericValue },
      batch: `rerun-${stamp}`,
      recorded_at: new Date().toISOString(),
      note: note.trim() || (lifestyle ? "手动追加的真实生活记录" : "手动录入的真实复测结果"),
    });
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={submit}>
        <div className="modal-heading"><div><span className="section-kicker">APPEND ONLY</span><h2>{lifestyle ? "追加真实生活记录" : "录入真实复测结果"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="关闭">×</button></div>
        <p className="modal-intro">新结果将作为独立批次追加，不修改原始记录。请不要录入估计值或希望得到的值。</p>
        <label>{lifestyle ? "生活条件" : "实验配置"}<select value={configId} onChange={(event) => setConfigId(event.target.value)}>{data.configs.map((config) => <option key={config.id} value={config.id}>{config.name}</option>)}</select></label>
        <div className="form-row"><label>{performance ? "预热重复序号" : lifestyle ? "配对 / 记录序号" : "随机种子"}<input type="number" min="1" value={indexValue} onChange={(event) => setIndexValue(Number(event.target.value))} required /></label><label>实测 {data.experiment.metric.label} / {data.experiment.metric.unit}<input autoFocus type="number" step="any" min="0" value={value} onChange={(event) => setValue(event.target.value)} placeholder="输入实际测量值" required /></label></div>
        <label>{lifestyle ? "记录备注" : "复测备注"}<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={lifestyle ? "例如：记录实际日期、条件执行情况与可能的混杂因素" : "例如：保持原划分，仅更换种子；记录实际环境变化"} rows={3} /></label>
        <div className="modal-notice"><ShieldCheck size={17} /><span>提交后，统计、诊断和复测队列会立即基于新记录重新计算。</span></div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={!valid}><Check size={17} />追加到账本</button></div>
      </form>
    </div>
  );
}

export function SetupView({ data, copy, onImport, onTemplate, onAdd }: { data: ExperimentData; copy: ProductConfig; onImport: () => void; onTemplate: () => void; onAdd: () => void }) {
  const lifestyle = data.experiment.kind === "lifestyle";
  return (
    <div className="view-stack">
      <section className="experiment-heading">
        <div><div className="eyebrow">{copy.setupEyebrow}</div><h1>{data.experiment.title}</h1><p>{data.experiment.subtitle}</p></div>
        <span className="real-data-badge"><span />等待真实记录</span>
      </section>
      <section className="panel setup-panel">
        <span className="section-kicker">START WITH YOUR OWN DATA</span>
        <h2>{copy.setupTitle}</h2>
        <p>当前指标为「{data.experiment.metric.label}」（{data.experiment.metric.unit}），每种{lifestyle ? "条件" : "配置"}目标 {data.experiment.target_seeds} 次。参照{lifestyle ? "条件" : "配置"}使用 <code>baseline</code>，对比{lifestyle ? "条件" : "配置"}使用 <code>candidate</code>。</p>
        <div className="setup-actions">
          <button className="primary-button" onClick={onTemplate}><Download size={17} />下载CSV模板</button>
          <button className="secondary-button" onClick={onImport}><FolderInput size={17} />导入填好的记录</button>
          <button className="text-button" onClick={onAdd}><Plus size={17} />或逐条录入</button>
        </div>
        <div className="setup-steps">
          <div><span>01</span><strong>填写真实值</strong><p>在 value 列填实际测量结果，repeat 填{lifestyle ? "配对或记录序号" : "重复轮次或种子序号"}；模板中的空值不能直接导入。</p></div>
          <div><span>02</span><strong>{lifestyle ? "保留条件定义" : "固定实验条件"}</strong><p>{lifestyle ? "记录期间不要中途改变两种条件和指标单位，备注中写明实际日期与混杂因素。" : "保持数据划分、实现、依赖版本与运行环境一致，备注中写明实际变化。"}</p></div>
          <div><span>03</span><strong>复测并导出</strong><p>诊断会给出补录优先级。新记录只追加，报告和证据JSON可随时导出。</p></div>
        </div>
        <div className="modal-notice"><ShieldCheck size={18} /><span>{copy.setupNotice}</span></div>
      </section>
    </div>
  );
}

export interface NewExperimentInput {
  title: string;
  baselineName: string;
  candidateName: string;
  metricLabel: string;
  unit: string;
  higherIsBetter: boolean;
  target: number;
  paired: boolean;
}

export function NewExperimentModal({ copy, onClose, onSubmit }: { copy: ProductConfig; onClose: () => void; onSubmit: (input: NewExperimentInput) => void }) {
  const [title, setTitle] = useState("");
  const [baselineName, setBaselineName] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [metricLabel, setMetricLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [higherIsBetter, setHigherIsBetter] = useState(true);
  const [target, setTarget] = useState(7);
  const [paired, setPaired] = useState(false);
  const valid = [title, baselineName, candidateName, metricLabel, unit].every((value) => value.trim()) &&
    baselineName.trim() !== candidateName.trim() && Number.isInteger(target) && target >= 2 && target <= 365;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onSubmit({ title: title.trim(), baselineName: baselineName.trim(), candidateName: candidateName.trim(), metricLabel: metricLabel.trim(), unit: unit.trim(), higherIsBetter, target, paired });
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal new-experiment-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label={copy.newTitle}>
        <div className="modal-heading"><div><span className="section-kicker">{copy.newKicker}</span><h2>{copy.newTitle}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="关闭">×</button></div>
        <p className="modal-intro">{copy.newIntro}</p>
        <label>实验名称<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.titlePlaceholder} maxLength={80} required /></label>
        <div className="form-row"><label>{copy.baselineLabel}<input value={baselineName} onChange={(event) => setBaselineName(event.target.value)} placeholder={copy.baselinePlaceholder} maxLength={30} required /></label><label>{copy.candidateLabel}<input value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder={copy.candidatePlaceholder} maxLength={30} required /></label></div>
        <div className="form-row"><label>记录指标<input value={metricLabel} onChange={(event) => setMetricLabel(event.target.value)} placeholder={copy.metricPlaceholder} maxLength={30} required /></label><label>单位<input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder={copy.unitPlaceholder} maxLength={12} required /></label></div>
        <div className="form-row"><label>目标方向<select value={higherIsBetter ? "higher" : "lower"} onChange={(event) => setHigherIsBetter(event.target.value === "higher")}><option value="higher">数值越高越符合目标</option><option value="lower">数值越低越符合目标</option></select></label><label>每种条件目标记录数<input type="number" min="2" max="365" value={target} onChange={(event) => setTarget(Number(event.target.value))} required /></label></div>
        <label className="checkbox-label"><input type="checkbox" checked={paired} onChange={(event) => setPaired(event.target.checked)} /><span><strong>{copy.pairedLabel}</strong><small>{copy.pairedHint}</small></span></label>
        <div className="modal-notice"><Info size={17} /><span>{copy.boundaryNotice}</span></div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={!valid}><Check size={17} />{copy.createButton}</button></div>
      </form>
    </div>
  );
}

function PageTitle({ kicker, title, detail }: { kicker: string; title: string; detail: string }) {
  return <section className="page-title"><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{detail}</p></section>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><CheckCircle2 size={36} /><h2>{title}</h2><p>{detail}</p></div>;
}
