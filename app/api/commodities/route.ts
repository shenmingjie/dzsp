import { NextResponse } from "next/server";
import {
  buildCommodityViews,
  buildExecutiveSummary,
  createFallbackCommodities,
  normalizeTradingEconomics
} from "../../../lib/marketModel";

export const revalidate = 3600;

type ApiResponse = {
  dataMode: "live" | "fallback";
  provider: string;
  executiveSummary: ReturnType<typeof buildExecutiveSummary>;
  commodities: ReturnType<typeof buildCommodityViews>;
  notes: string[];
};

async function fetchTradingEconomics() {
  const client = process.env.TRADING_ECONOMICS_CLIENT;
  const secret = process.env.TRADING_ECONOMICS_SECRET;
  if (!client || !secret) return { items: [], mode: "fallback" as const };
  const endpoint = process.env.TE_COMMODITY_ENDPOINT || "https://api.tradingeconomics.com/markets/commodities";
  const url = `${endpoint}?c=${encodeURIComponent(client)}:${encodeURIComponent(secret)}&format=json`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Trading Economics API failed: ${res.status}`);
  const json = await res.json();
  const items = normalizeTradingEconomics(json);
  return { items, mode: items.some((item) => !item.source.includes("演示")) ? "live" as const : "fallback" as const };
}

export async function GET() {
  let items = createFallbackCommodities();
  let dataMode: ApiResponse["dataMode"] = "fallback";
  let provider = "Fallback Demo Model";
  const notes = [
    "7天预测为趋势模型输出，用于采购决策辅助，不代表绝对价格承诺。",
    "正式上线时建议使用授权行情API，避免前端爬虫和未授权抓取带来的合规与稳定性风险。"
  ];

  try {
    const live = await fetchTradingEconomics();
    if (live.items.length) {
      items = live.items;
      dataMode = live.mode;
      provider = "Trading Economics Markets API + internal forecasting model";
    }
  } catch (error) {
    notes.push(`行情接口暂不可用，已切换为演示模型数据。原因：${error instanceof Error ? error.message : "unknown"}`);
  }

  const commodities = buildCommodityViews(items);
  const executiveSummary = buildExecutiveSummary(commodities);

  return NextResponse.json({
    dataMode,
    provider,
    executiveSummary,
    commodities,
    notes
  } satisfies ApiResponse);
}
