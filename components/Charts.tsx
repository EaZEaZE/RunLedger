"use client";

import type { ConfigStats, ExperimentData } from "@/lib/types";
import { configName, formatNumber } from "@/lib/analysis";

const colors = ["#173f35", "#d4f56a", "#ef946f", "#7c8df2", "#c69b5f"];

export function DistributionChart({ data, stats }: { data: ExperimentData; stats: ConfigStats[] }) {
  const width = 820;
  const left = 148;
  const right = 34;
  const rowHeight = 52;
  const top = 22;
  const height = top + stats.length * rowHeight + 48;
  const values = stats.flatMap((stat) => stat.runs.map((run) => run.value));
  if (!values.length) return <div className="chart-empty">暂无可绘制记录</div>;
  let min = Math.min(...values);
  let max = Math.max(...values);
  const rawRange = max - min || Math.max(Math.abs(max) * 0.05, 1);
  min -= rawRange * 0.18;
  max += rawRange * 0.18;
  const x = (value: number) => left + ((value - min) / (max - min)) * (width - left - right);
  const ticks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4);
  const unit = data.experiment.metric.unit;
  const performance = data.experiment.kind === "performance";

  return (
    <div className="chart-wrap">
      <svg className="distribution-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="各配置重复测量分布图">
        {ticks.map((tick, index) => (
          <g key={index}>
            <line x1={x(tick)} x2={x(tick)} y1={top - 4} y2={height - 40} stroke="#dfe4dc" strokeDasharray="3 5" />
            <text x={x(tick)} y={height - 16} textAnchor="middle" className="axis-text">
              {formatNumber(tick, performance ? 1 : 1)}
            </text>
          </g>
        ))}
        {stats.map((stat, index) => {
          const y = top + index * rowHeight + 18;
          const color = colors[index % colors.length];
          const center = performance ? stat.median : stat.mean;
          const low = performance ? stat.q1 : stat.mean - stat.sd;
          const high = performance ? stat.q3 : stat.mean + stat.sd;
          return (
            <g key={stat.configId}>
              <text x={0} y={y - 4} className="chart-label">{configName(data, stat.configId)}</text>
              <text x={0} y={y + 13} className="chart-sub-label">n = {stat.n}</text>
              {stat.n > 0 && (
                <>
                  <line x1={x(stat.min)} x2={x(stat.max)} y1={y} y2={y} stroke={color} strokeOpacity={0.35} strokeWidth={2} />
                  {stat.n > 1 && (
                    <rect
                      x={x(low)}
                      y={y - 12}
                      width={Math.max(2, x(high) - x(low))}
                      height={24}
                      rx={7}
                      fill={color}
                      fillOpacity={0.13}
                    />
                  )}
                  {stat.runs.map((run, runIndex) => {
                    const jitter = stat.n > 1 ? ((runIndex % 3) - 1) * 7 : 0;
                    return (
                      <circle key={run.id} cx={x(run.value)} cy={y + jitter} r={5.5} fill={color} stroke="#fff" strokeWidth={2}>
                        <title>{`${run.id}: ${run.value}${unit}`}</title>
                      </circle>
                    );
                  })}
                  <line x1={x(center)} x2={x(center)} y1={y - 17} y2={y + 17} stroke={color} strokeWidth={3} />
                  <text x={Math.min(width - 10, x(center) + 9)} y={y - 17} className="chart-value">
                    {formatNumber(center)}{unit}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        <span><i className="legend-dot" />每条真实记录</span>
        <span><i className="legend-band" />{performance ? "四分位区间" : "均值 ± 样本标准差"}</span>
        <span><i className="legend-line" />{performance ? "中位数" : "均值"}</span>
      </div>
    </div>
  );
}

export function RunSequenceChart({ data }: { data: ExperimentData }) {
  const width = 760;
  const height = 220;
  const margin = { left: 52, right: 24, top: 18, bottom: 38 };
  const warmRuns = data.runs.filter((run) => run.phase === "warm");
  if (!warmRuns.length) return null;
  const values = warmRuns.map((run) => run.value);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.05;
  const repeats = Math.max(...warmRuns.map((run) => run.repeat ?? 0));
  const x = (repeat: number) => margin.left + ((repeat - 1) / Math.max(1, repeats - 1)) * (width - margin.left - margin.right);
  const y = (value: number) => margin.top + ((max - value) / (max - min || 1)) * (height - margin.top - margin.bottom);
  return (
    <svg className="sequence-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="按重复顺序排列的计时结果">
      {[0, 0.5, 1].map((ratio) => {
        const value = min + (max - min) * ratio;
        return (
          <g key={ratio}>
            <line x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} stroke="#e2e6df" />
            <text x={margin.left - 10} y={y(value) + 4} textAnchor="end" className="axis-text">{value.toFixed(0)}</text>
          </g>
        );
      })}
      {data.configs.map((config, index) => {
        const runs = warmRuns.filter((run) => run.config_id === config.id).sort((a, b) => (a.repeat ?? 0) - (b.repeat ?? 0));
        const points = runs.map((run) => `${x(run.repeat ?? 0)},${y(run.value)}`).join(" ");
        return (
          <g key={config.id}>
            <polyline points={points} fill="none" stroke={colors[index]} strokeWidth={2.5} strokeOpacity={0.8} />
            {runs.map((run) => (
              <circle key={run.id} cx={x(run.repeat ?? 0)} cy={y(run.value)} r={4} fill={colors[index]}>
                <title>{`${config.short_name} 第${run.repeat}次：${run.value}ms`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      <text x={width / 2} y={height - 6} textAnchor="middle" className="axis-text">预热重复次序（AB / BA 交替）</text>
      <text x={12} y={height / 2} textAnchor="middle" className="axis-text" transform={`rotate(-90 12 ${height / 2})`}>耗时 / ms</text>
    </svg>
  );
}
