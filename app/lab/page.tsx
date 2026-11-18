import type { Metadata } from "next";

import Dashboard from "@/components/Dashboard";
import { labProduct } from "@/lib/products";

export const metadata: Metadata = {
  title: "RunLedger Lab · 通用实验复测工具",
  description: "对基线与候选配置做真实重复运行，识别差异、波动和收敛问题；差异不等于因果，信号噪声比不是 p 值。",
};

export default function LabPage() {
  return <Dashboard product={labProduct} />;
}
