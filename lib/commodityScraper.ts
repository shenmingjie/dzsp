import { normalizeScrapedCommodities, supportedCodes, type Commodity } from "./marketModel";

export type CrawlerSource = {
  code: string;
  url: string;
  sourceName?: string;
  enabled?: boolean;
  priceSelector?: string;
  changeSelector?: string;
  updatedAtSelector?: string;
  priceRegex?: string;
  changeRegex?: string;
  updatedAtRegex?: string;
  priceScale?: number;
  changeScale?: number;
  headers?: Record<string, string>;
};

export type CrawlerResult = {
  items: Commodity[];
  rows: ScrapedRow[];
  provider: string;
  notes: string[];
  stats: {
    totalSources: number;
    enabledSources: number;
    successSources: number;
    failedSources: number;
    fallbackCodes: string[];
    blockedByRobots: string[];
  };
};

export type ScrapedRow = {
  code: string;
  currentPrice: number;
  dayChangePct: number;
  source: string;
  updatedAt: string;
};

const DEFAULT_USER_AGENT =
  "CommodityAIDashboardBot/1.0 (+contact: procurement-data-team; purpose: price-monitoring; respectful-crawler)";

/**
 * 默认只启用通用公开行情页面，国内钢铁/化工网站差异大，建议在 CRAWLER_SOURCES_JSON 中按客户允许的数据源配置。
 * 注意：这些选择器基于公开网页结构，网页结构变化时需要维护；正式环境建议使用企业已授权的数据页面。
 */
const DEFAULT_CRAWLER_SOURCES: CrawlerSource[] = [
  {
    code: "BRENT",
    sourceName: "Yahoo Finance Page",
    url: "https://finance.yahoo.com/quote/BZ=F",
    priceSelector: 'fin-streamer[data-field="regularMarketPrice"]',
    changeSelector: 'fin-streamer[data-field="regularMarketChangePercent"]',
    priceRegex: '"regularMarketPrice"\\s*:\\s*\\{[^}]*"raw"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)',
    changeRegex: '"regularMarketChangePercent"\\s*:\\s*\\{[^}]*"raw"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)'
  },
  {
    code: "NATGAS",
    sourceName: "Yahoo Finance Page",
    url: "https://finance.yahoo.com/quote/NG=F",
    priceSelector: 'fin-streamer[data-field="regularMarketPrice"]',
    changeSelector: 'fin-streamer[data-field="regularMarketChangePercent"]',
    priceRegex: '"regularMarketPrice"\\s*:\\s*\\{[^}]*"raw"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)',
    changeRegex: '"regularMarketChangePercent"\\s*:\\s*\\{[^}]*"raw"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)'
  },
  {
    code: "COPPER",
    sourceName: "Yahoo Finance Page",
    url: "https://finance.yahoo.com/quote/HG=F",
    priceSelector: 'fin-streamer[data-field="regularMarketPrice"]',
    changeSelector: 'fin-streamer[data-field="regularMarketChangePercent"]',
    priceRegex: '"regularMarketPrice"\\s*:\\s*\\{[^}]*"raw"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)',
    changeRegex: '"regularMarketChangePercent"\\s*:\\s*\\{[^}]*"raw"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)'
  },
  {
    code: "ALUMINUM",
    sourceName: "Yahoo Finance Page",
    url: "https://finance.yahoo.com/quote/ALI=F",
    priceSelector: 'fin-streamer[data-field="regularMarketPrice"]',
    changeSelector: 'fin-streamer[data-field="regularMarketChangePercent"]',
    priceRegex: '"regularMarketPrice"\\s*:\\s*\\{[^}]*"raw"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)',
    changeRegex: '"regularMarketChangePercent"\\s*:\\s*\\{[^}]*"raw"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)'
  }
];

function getCrawlerSources(): CrawlerSource[] {
  const raw = process.env.CRAWLER_SOURCES_JSON;
  if (!raw?.trim()) return DEFAULT_CRAWLER_SOURCES;
  try {
    const parsed = JSON.parse(raw) as CrawlerSource[];
    if (!Array.isArray(parsed)) throw new Error("CRAWLER_SOURCES_JSON 必须是数组");
    return parsed.filter((source) => Boolean(source.code && source.url));
  } catch (error) {
    console.error("Invalid CRAWLER_SOURCES_JSON", error);
    return DEFAULT_CRAWLER_SOURCES;
  }
}

function timeoutMs() {
  return Number(process.env.CRAWLER_TIMEOUT_MS ?? 9000);
}

function respectRobots() {
  return process.env.CRAWLER_RESPECT_ROBOTS !== "false";
}

function failOpenRobots() {
  return process.env.CRAWLER_ROBOTS_FAIL_OPEN === "true";
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timer);
  }
}

function getPathForRobots(target: URL) {
  return `${target.pathname}${target.search}` || "/";
}

function wildcardToRegExp(rulePath: string) {
  const escaped = rulePath.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}`);
}

function parseRobots(robotsText: string, userAgent: string, targetPath: string) {
  const ua = userAgent.toLowerCase();
  const lines = robotsText
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);

  let active = false;
  const rules: Array<{ type: "allow" | "disallow"; path: string }> = [];

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      const valueLower = value.toLowerCase();
      active = valueLower === "*" || ua.includes(valueLower) || valueLower.includes("commodityaidashboardbot");
      continue;
    }
    if (!active) continue;
    if (key === "allow" || key === "disallow") {
      rules.push({ type: key, path: value });
    }
  }

  const matched = rules
    .filter((rule) => rule.path && wildcardToRegExp(rule.path).test(targetPath))
    .sort((a, b) => b.path.length - a.path.length)[0];

  if (!matched) return true;
  return matched.type === "allow";
}

async function isAllowedByRobots(url: string, userAgent: string) {
  if (!respectRobots()) return { allowed: true, reason: "robots check disabled" };
  const target = new URL(url);
  const robotsUrl = `${target.origin}/robots.txt`;
  try {
    const res = await fetchWithTimeout(robotsUrl, {
      headers: { "user-agent": userAgent }
    });
    if (!res.ok) return { allowed: failOpenRobots(), reason: `robots.txt ${res.status}` };
    const text = await res.text();
    const allowed = parseRobots(text, userAgent, getPathForRobots(target));
    return { allowed, reason: allowed ? "allowed by robots.txt" : "blocked by robots.txt" };
  } catch (error) {
    return {
      allowed: failOpenRobots(),
      reason: `robots check failed: ${error instanceof Error ? error.message : "unknown"}`
    };
  }
}

function stripHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
}

function extractBySelector(html: string, selector?: string) {
  if (!selector) return "";
  // 轻量级选择器支持：tag[attr="value"]、.class、#id、tag。避免额外依赖，适合 Vercel 快速部署。
  const attrMatch = selector.match(/^([a-zA-Z0-9_-]+)?\[([^=\]]+)=["']?([^"'\]]+)["']?\]$/);
  if (attrMatch) {
    const tag = attrMatch[1] || "[a-zA-Z0-9_-]+";
    const attr = attrMatch[2];
    const value = attrMatch[3];
    const re = new RegExp(`<${tag}[^>]*${attr}=["']${value}["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const matched = html.match(re);
    return matched ? stripHtml(matched[1]).trim() : "";
  }

  if (selector.startsWith("#")) {
    const id = selector.slice(1);
    const re = new RegExp(`<([a-zA-Z0-9_-]+)[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "i");
    const matched = html.match(re);
    return matched ? stripHtml(matched[2]).trim() : "";
  }

  if (selector.startsWith(".")) {
    const className = selector.slice(1);
    const re = new RegExp(`<([a-zA-Z0-9_-]+)[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "i");
    const matched = html.match(re);
    return matched ? stripHtml(matched[2]).trim() : "";
  }

  const tagRe = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\/${selector}>`, "i");
  const matched = html.match(tagRe);
  return matched ? stripHtml(matched[1]).trim() : "";
}

function extractByRegex(html: string, pattern?: string) {
  if (!pattern) return "";
  const re = new RegExp(pattern, "i");
  const matched = html.match(re);
  return matched?.[1]?.trim() ?? "";
}

function normalizeNumberText(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/,/g, "")
    .replace(/[％%]/g, "%")
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(text: string) {
  const normalized = normalizeNumberText(text);
  const matched = normalized.match(/[-+]?\d+(?:\.\d+)?/);
  return matched ? Number(matched[0]) : NaN;
}

function parsePercent(text: string) {
  const normalized = normalizeNumberText(text);
  const percentMatch = normalized.match(/([-+]?\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) return Number(percentMatch[1]);
  const firstNumber = normalized.match(/[-+]?\d+(?:\.\d+)?/);
  return firstNumber ? Number(firstNumber[0]) : 0;
}

async function scrapeOne(source: CrawlerSource, userAgent: string): Promise<{ row?: ScrapedRow; note?: string; blocked?: boolean }> {
  const code = source.code.toUpperCase();
  if (!supportedCodes.includes(code)) return { note: `${source.code} 不在系统支持的大宗品类中，已忽略。` };

  const robots = await isAllowedByRobots(source.url, userAgent);
  if (!robots.allowed) {
    return { blocked: true, note: `${code} ${source.url} 被 robots.txt 限制，已跳过。` };
  }

  const res = await fetchWithTimeout(source.url, {
    headers: {
      "user-agent": userAgent,
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      ...(source.headers ?? {})
    }
  });

  if (!res.ok) return { note: `${code} 抓取失败：HTTP ${res.status}` };
  const html = await res.text();
  const priceText = extractBySelector(html, source.priceSelector) || extractByRegex(html, source.priceRegex);
  const changeText = extractBySelector(html, source.changeSelector) || extractByRegex(html, source.changeRegex);
  const updatedAtText = extractBySelector(html, source.updatedAtSelector) || extractByRegex(html, source.updatedAtRegex);

  const price = parsePrice(priceText) * (source.priceScale ?? 1);
  const change = parsePercent(changeText) * (source.changeScale ?? 1);

  if (!Number.isFinite(price) || price <= 0) {
    return { note: `${code} 已访问页面，但未解析到有效价格。请检查 priceSelector/priceRegex。` };
  }

  return {
    row: {
      code,
      currentPrice: Number(price.toFixed(price < 10 ? 3 : 2)),
      dayChangePct: Number((Number.isFinite(change) ? change : 0).toFixed(2)),
      source: source.sourceName ? `${source.sourceName}：${source.url}` : source.url,
      updatedAt: updatedAtText || new Date().toISOString()
    }
  };
}

export async function scrapeCommodityPrices(): Promise<CrawlerResult> {
  const sources = getCrawlerSources();
  const enabledSources = sources.filter((source) => source.enabled !== false);
  const userAgent = process.env.CRAWLER_USER_AGENT || DEFAULT_USER_AGENT;
  const rows: ScrapedRow[] = [];
  const notes: string[] = [];
  const blockedByRobots: string[] = [];

  for (const source of enabledSources) {
    try {
      const result = await scrapeOne(source, userAgent);
      if (result.row) rows.push(result.row);
      if (result.note) notes.push(result.note);
      if (result.blocked) blockedByRobots.push(source.code);
      await new Promise((resolve) => setTimeout(resolve, Number(process.env.CRAWLER_DELAY_MS ?? 500)));
    } catch (error) {
      notes.push(`${source.code} 抓取异常：${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  const items = normalizeScrapedCommodities(rows);
  const liveCodes = new Set(rows.map((row) => row.code));
  const fallbackCodes = supportedCodes.filter((code) => !liveCodes.has(code));

  return {
    items,
    rows,
    provider: rows.length
      ? `Server-side crawler：${rows.length}/${supportedCodes.length} 个品类已抓取，其余使用演示兜底`
      : "Server-side crawler：未抓取到有效行情，使用演示兜底",
    notes,
    stats: {
      totalSources: sources.length,
      enabledSources: enabledSources.length,
      successSources: rows.length,
      failedSources: Math.max(0, enabledSources.length - rows.length),
      fallbackCodes,
      blockedByRobots
    }
  };
}
