import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "大宗商品价格预测与采购策略驾驶舱",
  description: "Commodity price monitoring, 7-day trend forecast and procurement strategy dashboard."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
