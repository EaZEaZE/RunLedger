export type ExperimentKind = "classification" | "performance" | "lifestyle" | "experiment";
export type Severity = "critical" | "warning" | "info";

export interface ExperimentRun {
  id: string;
  config_id: string;
  seed: number | null;
  repeat: number | null;
  phase: string;
  value: number;
  metrics: Record<string, number>;
  duration_ms?: number;
  iterations?: number;
  converged?: boolean;
  batch: string;
  recorded_at: string;
  note?: string;
}

export interface ExperimentConfig {
  id: string;
  name: string;
  short_name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ExperimentData {
  schema_version: string;
  experiment: {
    id: string;
    title: string;
    subtitle: string;
    kind: ExperimentKind;
    created_at: string;
    duration_s: number;
    metric: {
      key: string;
      label: string;
      unit: string;
      higher_is_better: boolean;
    };
    baseline_config: string;
    target_seeds: number;
    dataset: {
      name: string;
      source: string;
      license_note: string;
      [key: string]: unknown;
    };
    design: Record<string, unknown>;
    environment: Record<string, string | number>;
    validation?: {
      output_allclose: boolean;
      max_abs_error: number;
      tolerance: string;
    };
  };
  configs: ExperimentConfig[];
  runs: ExperimentRun[];
  provenance: {
    script: string;
    command: string;
    data_mode: string;
    description: string;
    runs_sha256?: string;
  };
}

export interface ConfigStats {
  configId: string;
  runs: ExperimentRun[];
  n: number;
  mean: number;
  median: number;
  sd: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  cv: number;
}

export interface Claim {
  baseline: ConfigStats;
  candidate: ConfigStats;
  rawDelta: number;
  improvement: number;
  noise: number;
  signalRatio: number;
  verdict: "insufficient" | "noise" | "weak" | "supported" | "no_gain";
  label: string;
  explanation: string;
}

export interface Diagnostic {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  summary: string;
  evidence: string[];
  configIds: string[];
  action: string;
}

export interface RerunItem {
  id: string;
  configId: string;
  kind: "coverage" | "signal" | "convergence" | "implementation" | "dispersion";
  priority: number;
  title: string;
  reason: string;
  action: string;
  suggestedRuns: number;
  diagnosticIds: string[];
}

export interface EvidenceEvent {
  id: string;
  type: "snapshot" | "rerun" | "import" | "create";
  title: string;
  detail: string;
  timestamp: string;
  hash?: string;
}
