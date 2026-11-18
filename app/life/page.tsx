import type { Metadata } from "next";

import Dashboard from "@/components/Dashboard";
import { lifeProduct } from "@/lib/products";

export const metadata: Metadata = {
  title: "RunLedger Life · 个人生活决策记录",
  description: "记录两种生活条件下的真实数值，判断差异是否只是波动；观察关联不等于因果，不提供医疗建议。",
};

export default function LifePage() {
  return <Dashboard product={lifeProduct} />;
}
