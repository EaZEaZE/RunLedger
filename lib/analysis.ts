import type {
  Claim,
  ConfigStats,
  Diagnostic,
  ExperimentData,
  RerunItem,
} from "./types";

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

export function summarize(values: number[]): Omit<ConfigStats, "configId" | "runs"> {
  if (!values.length) {
    return { n: 0, mean: 0, median: 0, sd: 0, min: 0, max: 0, q1: 0, q3: 0, cv: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const variance = n > 1
    ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
    : 0;
  const sd = Math.sqrt(variance);
  return {
    n,
    mean,
    median: quantile(sorted, 0.5),
    sd,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    cv: mean !== 0 ? sd / Math.abs(mean) : 0,
  };
}

export function getStats(data: ExperimentData, configId: string): ConfigStats {
  const runs = data.runs.filter((run) => {
    if (run.config_id !== configId) return false;
    return data.experiment.kind === "performance" ? run.phase === "warm" : run.phase !== "first_call";
  });
  return { configId, runs, ...summarize(runs.map((run) => run.value)) };
}

export function getAllStats(data: ExperimentData): ConfigStats[] {
  return data.configs.map((config) => getStats(data, config.id));
}

function pairedDifferences(data: ExperimentData, candidateId: string): number[] {
  const baseline = getStats(data, data.experiment.baseline_config);
  const candidate = getStats(data, candidateId);
  const key = (run: { seed: number | null; repeat: number | null }) => run.repeat !== null
    ? `repeat:${run.repeat}`
    : `seed:${run.seed ?? "missing"}`;
  const baselineValues = new Map(baseline.runs.map((run) => [key(run), run.value]));
  return candidate.runs.flatMap((run) => {
    const baselineValue = baselineValues.get(key(run));
    return baselineValue === undefined ? [] : [run.value - baselineValue];
  });
}

export function getClaim(data: ExperimentData, candidateId: string): Claim | null {
  const baseline = getStats(data, data.experiment.baseline_config);
  const candidate = getStats(data, candidateId);
  if (!baseline.n || !candidate.n || baseline.configId === candidate.configId) return null;
  const lifestyle = data.experiment.kind === "lifestyle";
  const paired = lifestyle && data.experiment.design.analysis === "paired";
  const differences = paired ? pairedDifferences(data, candidateId) : [];
  const hasPairedEstimate = paired && differences.length >= 2;
  const differenceStats = hasPairedEstimate ? summarize(differences) : null;
  const rawDelta = differenceStats?.mean ?? candidate.mean - baseline.mean;
  const higher = data.experiment.metric.higher_is_better;
  const improvement = higher ? rawDelta : -rawDelta;
  const noise = differenceStats?.sd ?? Math.max(baseline.sd, candidate.sd);
  const signalRatio = noise > 0 ? Math.abs(improvement) / noise : improvement !== 0 ? Infinity : 0;
  const enough = paired ? hasPairedEstimate : baseline.n >= 2 && candidate.n >= 2;
  let verdict: Claim["verdict"];
  let label: string;
  let explanation: string;
  if (!enough) {
    verdict = "insufficient";
    label = lifestyle ? "有效记录不足" : "重复不足";
    explanation = paired
      ? "至少需要2对同一对象的完整记录，才能估计配对差值的波动。"
      : "至少一方不足2次有效重复，不能估计组内波动。";
  } else if (improvement <= 0) {
    verdict = "no_gain";
    label = lifestyle ? "未观察到目标方向变化" : "未观察到提升";
    explanation = lifestyle ? "按条件均值比较，对比条件没有朝预设目标方向变化。" : "按组均值比较，候选配置没有优于基线。";
  } else if (signalRatio < 1) {
    verdict = "noise";
    label = lifestyle ? "差异落入记录波动" : "提升落入噪声";
    explanation = paired
      ? "平均配对差小于配对差值的样本标准差，建议补充真实配对记录。"
      : "均值差小于两组中较大的样本标准差，建议补充重复。";
  } else if (signalRatio < 2) {
    verdict = "weak";
    label = "差异仍需复测";
    explanation = paired
      ? "平均配对差超过1倍但未达到2倍配对差值标准差；这是复测启发式，不是显著性结论。"
      : "均值差超过1倍但未达到2倍组内标准差，这是复测启发式，不是显著性结论。";
  } else {
    verdict = "supported";
    label = paired ? "配对差异较稳定" : "差异较稳定";
    explanation = paired
      ? "平均配对差达到2倍以上配对差值标准差；仍应检查样本量、条件定义与混杂因素。"
      : "均值差达到2倍以上组内标准差；仍应结合样本量、环境和任务假设判断。";
  }
  if (lifestyle) explanation += " 观察性关联不代表该条件导致了变化。";
  return { baseline, candidate, rawDelta, improvement, noise, signalRatio, verdict, label, explanation };
}

export function getClaims(data: ExperimentData): Claim[] {
  return data.configs
    .map((config) => getClaim(data, config.id))
    .filter((claim): claim is Claim => claim !== null);
}

function sameSeries(a: ConfigStats, b: ConfigStats): boolean {
  if (a.n < 2 || a.n !== b.n) return false;
  const key = (run: { seed: number | null; repeat: number | null }) => `${run.seed ?? "r"}:${run.repeat ?? "x"}`;
  const aMap = new Map(a.runs.map((run) => [key(run), run.value]));
  return b.runs.every((run) => aMap.get(key(run)) === run.value);
}

export function getDiagnostics(data: ExperimentData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const stats = getAllStats(data);
  const unit = data.experiment.metric.unit;
  const target = data.experiment.target_seeds;
  const repeatName = data.experiment.kind === "performance"
    ? "次预热重复"
    : data.experiment.kind === "lifestyle"
      ? (data.experiment.design.analysis === "paired" ? "对对象记录" : "次记录")
      : "个种子";

  stats.forEach((stat) => {
    if (stat.n < target) {
      const config = data.configs.find((item) => item.id === stat.configId);
      diagnostics.push({
        id: `coverage-${stat.configId}`,
        severity: stat.n <= 1 ? "critical" : "warning",
        category: "重复覆盖",
        title: `${config?.short_name ?? stat.configId} 只有 ${stat.n} ${repeatName}`,
        summary: `目标为 ${target} ${repeatName}，当前不足以稳定估计波动。`,
        evidence: stat.runs.map((run) => `${run.id} = ${run.value}${unit}`),
        configIds: [stat.configId],
        action: data.experiment.kind === "performance"
          ? `补充 ${Math.max(0, target - stat.n)} 次预热测量，保持AB/BA交替。`
          : data.experiment.kind === "lifestyle"
            ? `补充 ${Math.max(0, target - stat.n)} 次真实记录，保持条件定义、指标单位和记录方式不变。`
            : `补跑 ${Math.max(0, target - stat.n)} 个新种子，保持数据划分与超参不变。`,
      });
    }
  });

  getClaims(data).forEach((claim) => {
    if (claim.verdict !== "noise" && claim.verdict !== "weak") return;
    const candidate = data.configs.find((item) => item.id === claim.candidate.configId);
    const lifestyle = data.experiment.kind === "lifestyle";
    const paired = lifestyle && data.experiment.design.analysis === "paired";
    diagnostics.push({
      id: `signal-${claim.candidate.configId}`,
      severity: claim.verdict === "noise" ? "critical" : "warning",
      category: lifestyle ? "差异可信度" : "提升可信度",
      title: `${candidate?.short_name ?? claim.candidate.configId}：${claim.label}`,
      summary: `相对参照条件均值变化 ${claim.rawDelta >= 0 ? "+" : ""}${claim.rawDelta.toFixed(2)}${unit}，${paired ? "配对差值标准差" : "较大组内标准差"}为 ${claim.noise.toFixed(2)}${unit}。`,
      evidence: [
        `参照条件：${claim.baseline.mean.toFixed(2)} ± ${claim.baseline.sd.toFixed(2)}${unit}（n=${claim.baseline.n}）`,
        `对比条件：${claim.candidate.mean.toFixed(2)} ± ${claim.candidate.sd.toFixed(2)}${unit}（n=${claim.candidate.n}）`,
        `信号噪声比 ${claim.signalRatio.toFixed(2)}；该比值是复测排序启发式，不是p值。`,
      ],
      configIds: [claim.baseline.configId, claim.candidate.configId],
      action: lifestyle
        ? "两种条件各补充至少2次真实记录；保持条件定义不变，并记录可能的混杂因素。"
        : "基线与候选各补充至少2次独立重复；报告每次结果，不只报告均值。",
    });
  });

  for (let i = 0; i < stats.length; i += 1) {
    for (let j = i + 1; j < stats.length; j += 1) {
      if (!sameSeries(stats[i], stats[j])) continue;
      const a = data.configs.find((item) => item.id === stats[i].configId);
      const b = data.configs.find((item) => item.id === stats[j].configId);
      const lifestyle = data.experiment.kind === "lifestyle";
      diagnostics.push({
        id: `identical-${stats[i].configId}-${stats[j].configId}`,
        severity: "warning",
        category: lifestyle ? "记录有效性" : "消融有效性",
        title: `${a?.short_name} 与 ${b?.short_name} 逐点完全相同`,
        summary: lifestyle
          ? "相同配对编号下的指标完全一致。可能是条件定义没有形成有效区别，也可能是复制或导入错误，需回到原始记录核查。"
          : "相同种子/重复下的指标完全一致。可能是变量未生效，也可能是任务对改动不敏感，不能据此直接判定代码错误。",
        evidence: stats[i].runs.map((run, index) => `${run.id}：${run.value}${unit} = ${stats[j].runs[index]?.value}${unit}`),
        configIds: [stats[i].configId, stats[j].configId],
        action: lifestyle ? "核对两种条件的定义和原始记录来源，不要为制造差异而修改真实值。" : "先核对配置是否进入执行路径，并增加能暴露差异的指标或实验条件，再决定复测。",
      });
    }
  }

  const nonConverged = data.runs.filter((run) => run.converged === false);
  if (nonConverged.length) {
    diagnostics.push({
      id: "convergence-budget",
      severity: "warning",
      category: "训练过程",
      title: `${nonConverged.length}/${data.runs.length} 次训练达到迭代上限`,
      summary: "这些运行没有被框架标记为收敛。最高均值不代表优化过程充分。",
      evidence: nonConverged.slice(0, 5).map((run) => `${run.id}：iterations=${run.iterations ?? "未知"}`),
      configIds: [...new Set(nonConverged.map((run) => run.config_id))],
      action: "先提高迭代预算并观察损失曲线，再在相同预算下复测；不要只补随机种子。",
    });
  }

  if (data.experiment.kind === "lifestyle") {
    const paired = data.experiment.design.analysis === "paired";
    diagnostics.push({
      id: "observational-boundary",
      severity: "info",
      category: "结论边界",
      title: paired ? "同一对象配对，仍然不是随机对照试验" : "观察性对比不能证明因果",
      summary: "当前结果只描述已记录条件下的数值关联，不能单独证明某种生活条件导致了变化。",
      evidence: [
        paired ? "配对可减少不同对象之间的差异，但不能消除时间、日程、环境等混杂。" : "两种条件未随机分配，其他同时变化的因素可能解释观察到的差异。",
        "信号噪声比仅用于安排补录顺序，不是p值或健康风险评估。",
        String(data.experiment.design["因果边界"] ?? "请保持原始记录并说明条件定义。"),
      ],
      configIds: data.configs.map((config) => config.id),
      action: "继续如实记录，不改变条件定义；若要讨论因果，需要另行设计随机化和混杂控制，并寻求适当专业意见。",
    });
  }

  if (data.experiment.kind === "performance") {
    stats.forEach((stat) => {
      if (stat.n > 2 && stat.cv > 0.15) {
        const config = data.configs.find((item) => item.id === stat.configId);
        diagnostics.push({
          id: `dispersion-${stat.configId}`,
          severity: "warning",
          category: "计时离散",
          title: `${config?.short_name} 的计时变异系数为 ${(stat.cv * 100).toFixed(1)}%`,
          summary: "预热测量仍有明显离散，单次最快值不适合作为性能结论。",
          evidence: [`中位数 ${stat.median.toFixed(2)}ms`, `范围 ${stat.min.toFixed(2)}–${stat.max.toFixed(2)}ms`, `样本标准差 ${stat.sd.toFixed(2)}ms`],
          configIds: [stat.configId],
          action: "保持AB/BA交替，增加10次预热重复，并记录系统负载与线程环境。",
        });
      }
    });
    diagnostics.push({
      id: "first-call-separated",
      severity: "info",
      category: "测量设计",
      title: "首次调用已与预热测量分开",
      summary: "首次调用不必然更慢；它只表示当前进程内第一次执行，不等于系统冷启动。",
      evidence: data.runs.filter((run) => run.phase === "first_call").map((run) => `${run.config_id}：${run.value.toFixed(2)}ms`),
      configIds: data.configs.map((config) => config.id),
      action: "报告中分别呈现首次和预热结果，不将二者混算均值。",
    });
    if (data.experiment.validation?.output_allclose) {
      diagnostics.push({
        id: "output-equivalence",
        severity: "info",
        category: "正确性校验",
        title: "两种卷积实现通过输出一致性校验",
        summary: `最大绝对误差 ${data.experiment.validation.max_abs_error.toExponential(3)}，容差 ${data.experiment.validation.tolerance}。`,
        evidence: ["相同图片、相同高斯核、相同reflect边界。", "性能优化没有改变可接受的数值输出。"],
        configIds: data.configs.map((config) => config.id),
        action: "复测性能时保留这项正确性检查，避免以错误输出换取加速。",
      });
    }
  }

  const weight = { critical: 0, warning: 1, info: 2 };
  return diagnostics.sort((a, b) => weight[a.severity] - weight[b.severity]);
}

export function getRerunQueue(data: ExperimentData): RerunItem[] {
  const queue: RerunItem[] = [];
  const diagnostics = getDiagnostics(data);
  diagnostics.forEach((diagnostic) => {
    if (diagnostic.severity === "info") return;
    const configId = diagnostic.configIds[diagnostic.configIds.length - 1] ?? data.experiment.baseline_config;
    if (diagnostic.id.startsWith("coverage-")) {
      const stat = getStats(data, configId);
      const missing = Math.max(1, data.experiment.target_seeds - stat.n);
      queue.push({
        id: `queue-${diagnostic.id}`,
        configId,
        kind: "coverage",
        priority: stat.n <= 1 ? 98 : 82,
        title: `补齐 ${data.configs.find((c) => c.id === configId)?.short_name ?? configId} 的重复覆盖`,
        reason: diagnostic.summary,
        action: diagnostic.action,
        suggestedRuns: missing,
        diagnosticIds: [diagnostic.id],
      });
    } else if (diagnostic.id.startsWith("identical-")) {
      queue.push({
        id: `queue-${diagnostic.id}`,
        configId,
        kind: "implementation",
        priority: 88,
        title: data.experiment.kind === "lifestyle" ? "核查两种条件的记录是否有效" : "核查消融变量是否真正生效",
        reason: diagnostic.summary,
        action: diagnostic.action,
        suggestedRuns: 0,
        diagnosticIds: [diagnostic.id],
      });
    } else if (diagnostic.id.startsWith("signal-")) {
      queue.push({
        id: `queue-${diagnostic.id}`,
        configId,
        kind: "signal",
        priority: 76,
        title: data.experiment.kind === "lifestyle"
          ? `补录 ${data.configs.find((c) => c.id === configId)?.short_name ?? configId} 与参照条件`
          : `复测 ${data.configs.find((c) => c.id === configId)?.short_name ?? configId} 与基线`,
        reason: diagnostic.summary,
        action: diagnostic.action,
        suggestedRuns: 4,
        diagnosticIds: [diagnostic.id],
      });
    } else if (diagnostic.id === "convergence-budget") {
      queue.push({
        id: "queue-convergence",
        configId,
        kind: "convergence",
        priority: 68,
        title: "先解决训练预算，再比较模型",
        reason: diagnostic.summary,
        action: diagnostic.action,
        suggestedRuns: 0,
        diagnosticIds: [diagnostic.id],
      });
    } else if (diagnostic.id.startsWith("dispersion-")) {
      queue.push({
        id: `queue-${diagnostic.id}`,
        configId,
        kind: "dispersion",
        priority: 55,
        title: "降低性能计时的不确定性",
        reason: diagnostic.summary,
        action: diagnostic.action,
        suggestedRuns: 10,
        diagnosticIds: [diagnostic.id],
      });
    }
  });
  return queue.sort((a, b) => b.priority - a.priority);
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function configName(data: ExperimentData, id: string): string {
  return data.configs.find((config) => config.id === id)?.short_name ?? id;
}
