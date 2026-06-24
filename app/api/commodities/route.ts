import { NextResponse } from "next/server";
import {
  buildCommodityViews,
  buildExecutiveSummary,
  createFallbackCommodities,
  supportedCodes
} from "../../../lib/marketModel";
import { scrapeCommodityPrices } from "../../../lib/commodityScraper";

export const revalidate = 1800;

type ApiResponse = {
  dataMode: "crawler" | "mixed" | "fallback";
  provider: string;
  executiveSummary: ReturnType<typeof buildExecutiveSummary>;
  commodities: ReturnType<typeof buildCommodityViews>;
  notes: string[];
  crawlerStats: {
    totalSources: number;
    enabledSources: number;
    successSources: number;
    failedSources: number;
    fallbackCodes: string[];
    blockedByRobots: string[];
  };
};

export async function GET() {
  let items = createFallbackCommodities();
  let dataMode: ApiResponse["dataMode"] = "fallback";
  let provider = "Fallback Demo Model";
  let crawlerStats: ApiResponse["crawlerStats"] = {
    totalSources: 0,
    enabledSources: 0,
    successSources: 0,
    failedSources: 0,
    fallbackCodes: supportedCodes,
    blockedByRobots: []
  };
  const notes = [
    "7天预测为趋势模型输出，用于采购决策辅助，不代表绝对价格承诺。",
    "当前版本已改为服务端爬虫模式：不使用行情API，不在前端暴露抓取规则。",
    "爬虫默认尊重 robots.txt，并限制抓取频率；如目标网站需要登录、付费授权或禁止抓取，请改用已授权数据源。"
  ];

  try {
    const crawler = await scrapeCommodityPrices();
    crawlerStats = crawler.stats;
    notes.push(...crawler.notes);
    if (crawler.rows.length) {
      items = crawler.items;
      dataMode = crawler.rows.length >= supportedCodes.length ? "crawler" : "mixed";
      provider = crawler.provider;
      if (crawler.stats.fallbackCodes.length) {
        notes.push(`以下品类未抓到有效价格，已使用演示兜底：${crawler.stats.fallbackCodes.join("、")}`);
      }
    } else {
      provider = crawler.provider;
      notes.push("未抓取到有效行情，页面仍可展示预测逻辑，但价格为演示数据。请在 CRAWLER_SOURCES_JSON 中配置可抓取页面。 ");
    }
  } catch (error) {
    notes.push(`爬虫执行失败，已切换为演示模型数据。原因：${error instanceof Error ? error.message : "unknown"}`);
  }

  const commodities = buildCommodityViews(items);
  const executiveSummary = buildExecutiveSummary(commodities);

  return NextResponse.json({
    dataMode,
    provider,
    executiveSummary,
    commodities,
    notes,
    crawlerStats
  } satisfies ApiResponse);
}
