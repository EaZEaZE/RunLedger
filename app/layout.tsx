import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RunLedger · 生活决策与实验复测",
  description: "两个产品共用同一套证据标准：个人生活决策记录与通用实验复测；关联不等于因果，信号噪声比不是 p 值。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
