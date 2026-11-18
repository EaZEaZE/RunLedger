"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BookOpenCheck,
  ChevronDown,
  Download,
  FileDown,
  FileSearch,
  FlaskConical,
  FolderInput,
  History,
  LayoutDashboard,
  ListRestart,
  LockKeyhole,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { cloneExperiment, initialExperiments } from "@/lib/data";
import { sha256, downloadFile, exportEvidenceJson, exportHtmlReport } from "@/lib/export";
import type { ProductConfig } from "@/lib/products";
import type { EvidenceEvent, ExperimentData, ExperimentRun } from "@/lib/types";
import {
  AddRunModal,
  DiagnosticsView,
  EvidenceView,
  NewExperimentModal,
  Overview,
  RerunView,
  SetupView,
  type NewExperimentInput,
  type ViewKey,
} from "./Views";

const navigation: Array<{ id: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "实验总览", icon: LayoutDashboard },
  { id: "diagnostics", label: "对比诊断", icon: FileSearch },
  { id: "rerun", label: "复测计划", icon: ListRestart },
  { id: "evidence", label: "记录与证据", icon: History },
];

function snapshotEvent(data: ExperimentData): EvidenceEvent {
  const isPublic = data.provenance.data_mode === "public_observational_demo";
  const unitLabel = data.experiment.kind === "lifestyle"
    ? "条参与者条件均值"
    : data.experiment.kind === "performance" ? "次真实计时记录" : "次真实训练运行";
  return {
    id: `snapshot-${data.experiment.id}`,
    type: "snapshot" as const,
    title: isPublic ? "公开数据演示快照已锁定" : "真实本地实验快照已锁定",
    detail: `${data.runs.length} ${unitLabel} · ${data.provenance.script}`,
    timestamp: data.experiment.created_at,
    hash: data.provenance.runs_sha256,
  };
}

function initialEvents(experiments: ExperimentData[]): Record<string, EvidenceEvent[]> {
  return Object.fromEntries(experiments.map((data) => [data.experiment.id, [snapshotEvent(data)]]));
}

function validExperiment(value: unknown): value is ExperimentData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ExperimentData>;
  if (!data.experiment?.id || !data.experiment.title || !data.experiment.metric?.key ||
    !data.experiment.baseline_config || !Array.isArray(data.configs) || data.configs.length < 2 ||
    !Array.isArray(data.runs) || !data.provenance?.script || !data.experiment.dataset?.name ||
    !data.experiment.design || !data.experiment.environment) return false;
  const configIds = new Set(data.configs.map((config) => config.id));
  return configIds.size === data.configs.length && configIds.has(data.experiment.baseline_config) &&
    data.runs.every((run) => configIds.has(run.config_id) && Number.isFinite(run.value));
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { cells.push(current.trim()); current = ""; }
    else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function Dashboard({ product }: { product: ProductConfig }) {
  const [experiments, setExperiments] = useState<ExperimentData[]>(() => product.experiments.map(cloneExperiment));
  const [activeId, setActiveId] = useState(product.experiments[0].experiment.id);
  const data = experiments.find((item) => item.experiment.id === activeId) ?? experiments[0];
  const [view, setView] = useState<ViewKey>("overview");
  const [selectedCandidate, setSelectedCandidate] = useState(data.configs.find((config) => config.id !== data.experiment.baseline_config)?.id ?? data.configs[0].id);
  const [events, setEvents] = useState<Record<string, EvidenceEvent[]>>(() => initialEvents(product.experiments));
  const [modalConfig, setModalConfig] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hash, setHash] = useState({ value: "", matches: false, checking: true });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(product.storageKey) ?? "null") as {
        experiments?: unknown; events?: Record<string, EvidenceEvent[]>; activeId?: string;
      } | null;
      if (saved && Array.isArray(saved.experiments) && saved.experiments.length && saved.experiments.every(validExperiment)) {
        const ownIds = new Set(product.experiments.map((item) => item.experiment.id));
        const foreignIds = new Set(initialExperiments.filter((item) => !ownIds.has(item.experiment.id)).map((item) => item.experiment.id));
        const savedList = saved.experiments.map(cloneExperiment).filter((item) => !foreignIds.has(item.experiment.id));
        if (!savedList.length) return;
        const builtinById = new Map(product.experiments.map((item) => [item.experiment.id, item]));
        const restored = savedList.map((item) => {
          const builtin = builtinById.get(item.experiment.id);
          if (!builtin) return item;
          const originalIds = new Set(builtin.runs.filter((run) => run.batch === "original").map((run) => run.id));
          const savedOriginal = item.runs.filter((run) => run.batch === "original");
          const intact = savedOriginal.length === originalIds.size && savedOriginal.every((run) => originalIds.has(run.id));
          return intact ? item : cloneExperiment(builtin);
        });
        const missing = product.experiments.filter((item) => !restored.some((savedItem) => savedItem.experiment.id === item.experiment.id));
        setExperiments([...restored, ...missing.map(cloneExperiment)]);
        const restoredEvents: Record<string, EvidenceEvent[]> = { ...(saved.events ?? {}) };
        for (const item of product.experiments) {
          if (!restoredEvents[item.experiment.id]) restoredEvents[item.experiment.id] = [snapshotEvent(item)];
        }
        setEvents(restoredEvents);
        if (saved.activeId && [...restored, ...missing].some((item) => item.experiment.id === saved.activeId)) setActiveId(saved.activeId);
      }
    } catch {
      // 无效或不可用的本地存储不阻止公开演示启动。
    } finally {
      setStorageReady(true);
    }
  }, [product]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(product.storageKey, JSON.stringify({ experiments, events, activeId }));
    } catch {
      setToast("浏览器存储空间不足；请立即导出证据JSON留存当前记录");
    }
  }, [experiments, events, activeId, storageReady, product.storageKey]);

  useEffect(() => {
    setSelectedCandidate(data.configs.find((config) => config.id !== data.experiment.baseline_config)?.id ?? data.configs[0].id);
  }, [activeId, data.configs, data.experiment.baseline_config]);

  useEffect(() => {
    let cancelled = false;
    setHash({ value: "", matches: false, checking: true });
    const originalRuns = data.runs.filter((run) => run.batch === "original");
    sha256(originalRuns).then((value) => {
      if (!cancelled) setHash({ value, matches: value === data.provenance.runs_sha256, checking: false });
    }).catch(() => { if (!cancelled) setHash({ value: "", matches: false, checking: false }); });
    return () => { cancelled = true; };
  }, [data.experiment.id, data.provenance.runs_sha256, data.runs]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeEvents = useMemo(() => events[activeId] ?? [], [events, activeId]);

  function switchExperiment(id: string) {
    setActiveId(id);
    setView("overview");
  }

  function createExperiment(input: NewExperimentInput) {
    const stamp = Date.now();
    const isLife = product.newKind === "lifestyle";
    const id = `${product.id}-${stamp}`;
    const now = new Date().toISOString();
    const experiment: ExperimentData = {
      schema_version: "1.1.0",
      experiment: {
        id,
        title: input.title,
        subtitle: `${input.baselineName} vs ${input.candidateName} · ${isLife ? "本地生活记录" : "本地实验配置"}`,
        kind: product.newKind,
        created_at: now,
        duration_s: 0,
        metric: { key: "observed_value", label: input.metricLabel, unit: input.unit, higher_is_better: input.higherIsBetter },
        baseline_config: "baseline",
        target_seeds: input.target,
        dataset: {
          name: isLife ? "个人真实记录（当前浏览器）" : "本机真实运行记录（当前浏览器）",
          source: "local://browser",
          license_note: "由用户自行录入或导入；不会随项目公开。请勿导入不必要的敏感信息。",
        },
        design: {
          analysis: input.paired ? "paired" : "independent",
          [isLife ? "记录方式" : "重复方式"]: input.paired ? (isLife ? "相同 repeat 表示同一对象或配对周期" : "相同 repeat 表示同一种子或同一重复轮次") : (isLife ? "两种条件的独立记录" : "两种配置的独立运行"),
          条件定义: `${input.baselineName}（baseline） vs ${input.candidateName}（candidate）`,
          目标方向: input.higherIsBetter ? `${input.metricLabel}越高越符合目标` : `${input.metricLabel}越低越符合目标`,
          [isLife ? "因果边界" : "结论边界"]: isLife
            ? "个人观察记录未随机化；任何差异都只是关联，不构成因果或医疗结论"
            : "重复运行未随机化；任何差异都不自动构成因果或统计显著",
        },
        environment: isLife
          ? { 存储位置: "当前浏览器 localStorage", 数据来源: "用户手动录入或CSV导入", 原始记录: "只追加，不覆盖" }
          : { 存储位置: "当前浏览器 localStorage", 数据来源: "用户手动录入或CSV导入", 原始运行: "只追加，不覆盖", 环境要求: "保持实现、依赖版本与运行条件一致" },
      },
      configs: [
        { id: "baseline", name: input.baselineName, short_name: input.baselineName, description: isLife ? "用户定义的参照条件" : "用户定义的基线配置", parameters: { role: "baseline" } },
        { id: "candidate", name: input.candidateName, short_name: input.candidateName, description: isLife ? "用户定义的对比条件" : "用户定义的候选配置", parameters: { role: "candidate" } },
      ],
      runs: [],
      provenance: {
        script: isLife ? "browser/new-life-experiment" : "browser/new-experiment",
        command: "下载CSV模板，填入真实记录后导入；也可逐条追加",
        data_mode: "personal_local",
        description: isLife ? "空白个人实验由用户创建。系统不自动生成任何生活记录或结果。" : "空白实验配置由用户创建。系统不自动生成任何运行结果。",
      },
    };
    setExperiments((current) => [...current, experiment]);
    setEvents((current) => ({ ...current, [id]: [{ id: `create-${stamp}`, type: "create", title: product.createEventTitle, detail: isLife ? "等待第一条真实记录；未生成示例数值" : "等待第一次真实运行；未生成示例结果", timestamp: now }] }));
    setActiveId(id);
    setView("overview");
    setCreateOpen(false);
    setToast(product.createToast);
  }

  function downloadTemplate() {
    const rows = [
      ["config_id", "value", "repeat", "recorded_at", "note"],
      ...data.configs.flatMap((config) => [1, 2].map((repeat) => [config.id, "", repeat, "", "填入真实记录；不要填写估计值"])),
    ];
    downloadFile(`${data.experiment.id}-template.csv`, "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
    setToast("模板已下载：value 留空处必须填入你的真实数值");
  }

  async function addRun(run: ExperimentRun) {
    const isFirst = data.runs.length === 0;
    const nextRun = isFirst ? { ...run, batch: "original" } : run;
    const originalRuns = isFirst ? [nextRun] : data.runs.filter((item) => item.batch === "original");
    const nextHash = await sha256(originalRuns);
    setExperiments((current) => current.map((item) => item.experiment.id === activeId ? {
      ...item,
      runs: [...item.runs, nextRun],
      provenance: { ...item.provenance, runs_sha256: isFirst ? nextHash : item.provenance.runs_sha256 },
    } : item));
    setEvents((current) => ({
      ...current,
      [activeId]: [...(current[activeId] ?? []), {
        id: `event-${nextRun.id}`,
        type: isFirst ? "snapshot" : "rerun",
        title: isFirst ? "首条真实记录已锁定" : `追加复测 · ${nextRun.config_id}`,
        detail: `${nextRun.id} = ${nextRun.value}${data.experiment.metric.unit}；${nextRun.note ?? "无备注"}`,
        timestamp: nextRun.recorded_at,
        hash: isFirst ? nextHash : undefined,
      }],
    }));
    setModalConfig(null);
    setToast("真实记录已追加，诊断与计划已重新计算");
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed: unknown = JSON.parse(text);
        const wrapper = parsed && typeof parsed === "object" ? parsed as { data?: unknown; evidence_events?: unknown } : null;
        const experimentValue = wrapper && "data" in wrapper ? wrapper.data : parsed;
        if (!validExperiment(experimentValue)) throw new Error("JSON不符合RunLedger实验结构，或包含无效记录");
        const imported = cloneExperiment(experimentValue);
        if (experiments.some((item) => item.experiment.id === imported.experiment.id)) imported.experiment.id = `${imported.experiment.id}-import-${Date.now()}`;
        const importedEvents = Array.isArray(wrapper?.evidence_events)
          ? wrapper.evidence_events.filter((item): item is EvidenceEvent => Boolean(item && typeof item.id === "string" && typeof item.title === "string" && typeof item.timestamp === "string"))
          : [];
        setExperiments((current) => [...current, imported]);
        setEvents((current) => ({ ...current, [imported.experiment.id]: [...importedEvents, {
          id: `import-${Date.now()}`, type: "import", title: "导入外部实验快照",
          detail: `${file.name} · ${imported.runs.length} 条记录`, timestamp: new Date().toISOString(),
        }] }));
        setActiveId(imported.experiment.id);
        setView("overview");
        setToast("实验JSON已导入");
      } else {
        const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2) throw new Error("CSV没有可导入的记录");
        const headers = parseCsvLine(lines[0]);
        ["config_id", "value", "repeat"].forEach((name) => { if (!headers.includes(name)) throw new Error(`CSV缺少 ${name} 列`); });
        const stamp = Date.now();
        const firstImport = data.runs.length === 0;
        const paired = data.experiment.kind === "lifestyle" && data.experiment.design.analysis === "paired";
        const seenIds = new Set(data.runs.map((run) => run.id));
        const newRuns = lines.slice(1).map((line, index): ExperimentRun => {
          const cells = parseCsvLine(line);
          const row = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ""]));
          const value = Number(row.value);
          const repeat = Number(row.repeat);
          if (!data.configs.some((config) => config.id === row.config_id)) throw new Error(`第${index + 2}行条件 ${row.config_id} 不存在`);
          if (row.value.trim() === "" || !Number.isFinite(value)) throw new Error(`第${index + 2}行value不是真实数值`);
          if (!Number.isInteger(repeat) || repeat < 1) throw new Error(`第${index + 2}行repeat必须是大于0的整数`);
          if (paired && !row.repeat) throw new Error(`第${index + 2}行缺少配对编号repeat`);
          if (row.recorded_at && Number.isNaN(Date.parse(row.recorded_at))) throw new Error(`第${index + 2}行recorded_at日期无效`);
          const id = row.id || `csv-${stamp}-${index}`;
          if (seenIds.has(id)) throw new Error(`第${index + 2}行记录ID重复：${id}`);
          seenIds.add(id);
          return {
            id,
            config_id: row.config_id,
            seed: row.seed ? Number(row.seed) : null,
            repeat,
            phase: row.phase || (data.experiment.kind === "performance" ? "warm" : data.experiment.kind === "lifestyle" ? "observation" : "training"),
            value,
            metrics: { [data.experiment.metric.key]: value },
            batch: firstImport ? "original" : `import-${stamp}`,
            recorded_at: row.recorded_at || new Date().toISOString(),
            note: row.note || `从 ${file.name} 导入`,
          };
        });
        if (!newRuns.length) throw new Error("CSV没有可导入的记录");
        const nextHash = firstImport ? await sha256(newRuns) : data.provenance.runs_sha256;
        setExperiments((current) => current.map((item) => item.experiment.id === activeId ? {
          ...item,
          runs: [...item.runs, ...newRuns],
          provenance: { ...item.provenance, runs_sha256: nextHash },
        } : item));
        setEvents((current) => ({ ...current, [activeId]: [...(current[activeId] ?? []), {
          id: `csv-event-${stamp}`, type: "import", title: firstImport ? `锁定首批CSV记录 · ${newRuns.length}条` : `追加CSV复测 · ${newRuns.length}条`,
          detail: `${file.name}；原始值不覆盖`, timestamp: new Date().toISOString(), hash: firstImport ? nextHash : undefined,
        }] }));
        setView("overview");
        setToast(`已导入 ${newRuns.length} 条真实记录`);
      }
    } catch (error) {
      setToast(error instanceof Error ? `导入失败：${error.message}` : "导入失败");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className={`app-shell ${product.themeClass}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">{product.mark.slice(0, 1)}<span>{product.mark.slice(1)}</span></div><div><strong>{product.brand}</strong><span>{product.tagline}</span></div></div>
        <div className="sidebar-section">
          <div className="sidebar-label">{product.listLabel} <span>{experiments.length}</span></div>
          <div className="experiment-switcher">
            {experiments.map((item, index) => <button key={item.experiment.id} className={item.experiment.id === activeId ? "active" : ""} onClick={() => switchExperiment(item.experiment.id)}>
              <span className="experiment-icon"><BookOpenCheck size={17} /></span>
              <div><strong>{item.experiment.title}</strong><small>{String(index + 1).padStart(2, "0")} · {item.runs.length} 条记录</small></div>
              <ChevronDown size={14} />
            </button>)}
          </div>
          <button className="new-experiment-button" onClick={() => setCreateOpen(true)}><Plus size={15} />{product.newLabel}</button>
        </div>
        <nav className="main-nav">
          <div className="sidebar-label">分析流程</div>
          {navigation.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><Icon size={18} /><span>{item.label}</span>{view === item.id && <i />}</button>; })}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status"><ShieldCheck size={18} /><div><strong>{product.localTitle}</strong><p>{product.localText}</p></div></div>
          <div className="sidebar-meta"><span><i />真实记录模式</span><small>v1.1 · 2026</small></div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb"><span>{product.brand}</span><i>/</i><strong>{navigation.find((item) => item.id === view)?.label}</strong></div>
          <div className="topbar-actions">
            <span className="dataset-pill"><Activity size={14} />{data.experiment.dataset.name.split("/")[0]}</span>
            <input ref={fileInput} className="file-input" type="file" accept=".json,.csv" aria-label="导入CSV记录或实验JSON" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); }} />
            <button className="secondary-button" onClick={() => setCreateOpen(true)} title={product.newLabel}><Plus size={16} /><span>新建</span></button>
            <button className="secondary-button" onClick={downloadTemplate} title="下载当前实验的CSV模板"><FileDown size={16} /><span>CSV模板</span></button>
            <button className="secondary-button" onClick={() => fileInput.current?.click()} title="导入CSV记录或完整实验JSON"><FolderInput size={16} /><span>导入记录</span></button>
            <button className="primary-button" onClick={() => exportHtmlReport(data, activeEvents)} title="导出完整HTML报告"><Download size={16} /><span>导出报告</span></button>
          </div>
        </header>

        <main className="main-content">
          <div className="mobile-workspace"><FlaskConical size={16} /><span>当前实验</span><select aria-label="切换实验" value={activeId} onChange={(event) => switchExperiment(event.target.value)}>{experiments.map((item) => <option key={item.experiment.id} value={item.experiment.id}>{item.experiment.title}</option>)}</select></div>
          {data.runs.length === 0 ? <SetupView data={data} copy={product} onImport={() => fileInput.current?.click()} onTemplate={downloadTemplate} onAdd={() => setModalConfig(data.experiment.baseline_config)} /> : <>
            {view === "overview" && <Overview data={data} selectedCandidate={selectedCandidate} onSelectCandidate={setSelectedCandidate} onNavigate={setView} />}
            {view === "diagnostics" && <DiagnosticsView data={data} />}
            {view === "rerun" && <RerunView data={data} onAddRun={setModalConfig} />}
            {view === "evidence" && <EvidenceView data={data} events={activeEvents} hash={hash} onExport={() => exportEvidenceJson(data, activeEvents)} />}
          </>}
        </main>
        <footer className="app-footer"><span>{product.brand.toUpperCase()} / EVIDENCE BEFORE CONCLUSIONS</span><span>{product.footerTagline}</span></footer>
      </div>

      {createOpen && <NewExperimentModal copy={product} onClose={() => setCreateOpen(false)} onSubmit={createExperiment} />}
      {modalConfig && <AddRunModal key={`${activeId}-${modalConfig}`} data={data} initialConfig={modalConfig} onClose={() => setModalConfig(null)} onSubmit={addRun} />}
      {toast && <div className="toast" role="status"><BookOpenCheck size={18} /><span>{toast}</span><button onClick={() => setToast(null)} aria-label="关闭提示"><X size={15} /></button></div>}
      <button className="floating-add" onClick={() => setModalConfig(data.experiment.baseline_config)} title="追加一次真实记录"><Plus size={20} /><span>追加记录</span></button>
      <div className="security-note" title={product.securityNote}><LockKeyhole size={13} /></div>
    </div>
  );
}
