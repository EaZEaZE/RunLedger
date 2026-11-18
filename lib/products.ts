import type { ExperimentData } from "./types";
import { labExperiments, lifeExperiments } from "./data";

export type ProductId = "life" | "lab";

export interface ProductConfig {
  id: ProductId;
  brand: string;
  mark: string;
  tagline: string;
  themeClass: string;
  storageKey: string;
  experiments: ExperimentData[];
  listLabel: string;
  newLabel: string;
  newTitle: string;
  newKicker: string;
  newIntro: string;
  newKind: "lifestyle" | "experiment";
  titlePlaceholder: string;
  baselineLabel: string;
  baselinePlaceholder: string;
  candidateLabel: string;
  candidatePlaceholder: string;
  metricPlaceholder: string;
  unitPlaceholder: string;
  pairedLabel: string;
  pairedHint: string;
  boundaryNotice: string;
  createButton: string;
  setupEyebrow: string;
  setupTitle: string;
  setupNotice: string;
  localTitle: string;
  localText: string;
  footerTagline: string;
  createEventTitle: string;
  createToast: string;
  securityNote: string;
}

export const lifeProduct: ProductConfig = {
  id: "life",
  brand: "RunLedger Life",
  mark: "L/",
  tagline: "个人生活决策记录",
  themeClass: "theme-life",
  storageKey: "runledger.lifestyle.v1",
  experiments: lifeExperiments,
  listLabel: "我的生活实验",
  newLabel: "新建生活实验",
  newTitle: "新建生活实验",
  newKicker: "NEW LIFE EXPERIMENT",
  newIntro: "定义两种生活条件和同一个数值指标。创建后只录入你的真实记录，不生成示例结果。",
  newKind: "lifestyle",
  titlePlaceholder: "例如：晚间减少屏幕时间后，入睡需要多久？",
  baselineLabel: "参照条件",
  baselinePlaceholder: "例如：平常晚间",
  candidateLabel: "对比条件",
  candidatePlaceholder: "例如：22点后不用屏幕",
  metricPlaceholder: "例如：入睡所需时间",
  unitPlaceholder: "例如：分钟",
  pairedLabel: "使用配对编号",
  pairedHint: "相同 repeat 表示同一对象或配对周期；不确定时可不选。",
  boundaryNotice: "目标方向只用于判读差异方向，不代表医疗建议；观察关联不能证明条件导致结果。",
  createButton: "创建并添加真实记录",
  setupEyebrow: "NEW LIFE EXPERIMENT / REAL RECORDS ONLY",
  setupTitle: "先记录，再分析。系统不会替你编造生活数据。",
  setupNotice: "个人记录只保存在当前浏览器。观察性差异不代表因果，本工具不提供医疗诊断。",
  localTitle: "LOCAL FIRST",
  localText: "生活记录留在浏览器；统计本地完成",
  footerTagline: "原始值不覆盖 · 复测有依据 · 关联不等于因果",
  createEventTitle: "生活实验已创建",
  createToast: "实验已创建，请下载模板并填入真实记录",
  securityNote: "只有主动请求AI解释时，才会发送统计摘要；完整生活记录默认不发送。",
};

export const labProduct: ProductConfig = {
  id: "lab",
  brand: "RunLedger Lab",
  mark: "X/",
  tagline: "通用实验复测工具",
  themeClass: "theme-lab",
  storageKey: "runledger.lab.v1",
  experiments: labExperiments,
  listLabel: "实验列表",
  newLabel: "新建实验配置",
  newTitle: "新建实验配置",
  newKicker: "NEW EXPERIMENT",
  newIntro: "定义基线与候选配置、同一个数值指标和固定环境。创建后只录入真实运行结果，不补造数据。",
  newKind: "experiment",
  titlePlaceholder: "例如：更换批大小后，每轮训练耗时？",
  baselineLabel: "基线配置",
  baselinePlaceholder: "例如：batch=32",
  candidateLabel: "候选配置",
  candidatePlaceholder: "例如：batch=64",
  metricPlaceholder: "例如：每轮训练耗时",
  unitPlaceholder: "例如：毫秒",
  pairedLabel: "使用重复编号",
  pairedHint: "相同 repeat 表示同一种子或同一重复轮次；也可在 CSV 中使用 seed 列。",
  boundaryNotice: "目标方向只用于判读差异方向；重复运行不等于随机试验，差异也不能自动证明因果。",
  createButton: "创建并录入真实运行",
  setupEyebrow: "NEW EXPERIMENT / REAL RUNS ONLY",
  setupTitle: "先复现，再比较。系统不会替你编造运行结果。",
  setupNotice: "实验记录只保存在当前浏览器。重复运行不等于随机试验，差异仍需核查实现与环境。",
  localTitle: "REPRODUCIBLE",
  localText: "运行记录留在浏览器；统计本地完成",
  footerTagline: "原始运行不覆盖 · 复测有依据 · 差异不等于因果",
  createEventTitle: "实验配置已创建",
  createToast: "实验已创建，请下载模板并填入真实运行结果",
  securityNote: "只有主动请求AI解释时，才会发送统计摘要；完整运行记录默认不发送。",
};

export const PRODUCTS: Record<ProductId, ProductConfig> = {
  life: lifeProduct,
  lab: labProduct,
};
