import weekendSteps from "@/public/data/weekend-steps.json";
import sleepNextDay from "@/public/data/sleep-next-day-steps.json";
import digitsSmallSample from "@/public/data/digits-small-sample.json";
import localPerformance from "@/public/data/local-performance.json";
import type { ExperimentData } from "./types";

export const lifeExperiments = [
  weekendSteps as ExperimentData,
  sleepNextDay as ExperimentData,
];

export const labExperiments = [
  digitsSmallSample as ExperimentData,
  localPerformance as ExperimentData,
];

export const initialExperiments = [...lifeExperiments, ...labExperiments];

export function cloneExperiment(data: ExperimentData): ExperimentData {
  return JSON.parse(JSON.stringify(data)) as ExperimentData;
}
