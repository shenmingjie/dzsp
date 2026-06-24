export type TrendDirection = "上涨" | "下跌" | "震荡";
export type RiskLevel = "低" | "中" | "高";

export type Commodity = {
  code: string;
  name: string;
  category: "能源" | "金属" | "黑色" | "化工";
  unit: string;
  currency: string;
  currentPrice: number;
  dayChangePct: number;
  source: string;
  updatedAt: string;
  factors: string[];
  procurementUse: string;
};

export type ForecastPoint = {
  date: string;
  direction: TrendDirection;
  expectedChangePct: number;
  low: number;
  high: number;
  confidence: number;
  risk: RiskLevel;
};

export type CommodityView = Commodity & {
  forecast: ForecastPoint[];
  summary: string;
  strategy: string[];
  factorScores: { factor: string; score: number; note: string }[];
};

const round = (n: number, digits = 2) => Number(n.toFixed(digits));

const commodityConfig: Record<string, Pick<Commodity, "name" | "category" | "unit" | "currency" | "factors" | "procurementUse"> & { base: number; bias: number }> = {
  BRENT: {
    name: "Brent原油",
    category: "能源",
    unit: "美元/桶",
    currency: "USD",
    base: 86,
    bias: 0.18,
    factors: ["OPEC+产量政策", "美元指数", "地缘冲突", "炼厂开工率", "商业库存"],
    procurementUse: "影响化工品、燃料、运输成本和能源密集型材料价格。"
  },
  NATGAS: {
    name: "天然气",
    category: "能源",
    unit: "美元/MMBtu",
    currency: "USD",
    base: 3.1,
    bias: -0.05,
    factors: ["季节性需求", "LNG供应", "库存水平", "极端天气", "电力需求"],
    procurementUse: "影响化肥、甲醇、玻璃、陶瓷、能源采购成本。"
  },
  COPPER: {
    name: "铜",
    category: "金属",
    unit: "美元/吨",
    currency: "USD",
    base: 9800,
    bias: 0.12,
    factors: ["美元指数", "全球制造业PMI", "LME库存", "新能源需求", "矿山供给"],
    procurementUse: "影响电缆、电气件、铜排、换热器等采购成本。"
  },
  ALUMINUM: {
    name: "铝",
    category: "金属",
    unit: "美元/吨",
    currency: "USD",
    base: 2650,
    bias: 0.05,
    factors: ["氧化铝价格", "电力成本", "LME库存", "地产/汽车需求", "进口窗口"],
    procurementUse: "影响铝型材、壳体、支架、散热器等采购成本。"
  },
  NICKEL: {
    name: "镍",
    category: "金属",
    unit: "美元/吨",
    currency: "USD",
    base: 18500,
    bias: -0.1,
    factors: ["不锈钢排产", "新能源电池需求", "印尼供应", "LME库存", "政策扰动"],
    procurementUse: "影响不锈钢、电池材料、合金件价格。"
  },
  IRONORE: {
    name: "铁矿石",
    category: "黑色",
    unit: "美元/吨",
    currency: "USD",
    base: 112,
    bias: -0.04,
    factors: ["港口库存", "钢厂利润", "高炉开工", "澳巴发运", "地产基建需求"],
    procurementUse: "影响钢材、结构件、热卷、冷轧、钢板采购成本。"
  },
  HRC: {
    name: "热轧卷板",
    category: "黑色",
    unit: "元/吨",
    currency: "CNY",
    base: 3900,
    bias: 0.03,
    factors: ["铁矿石", "焦煤焦炭", "钢厂库存", "下游订单", "期货基差"],
    procurementUse: "影响钣金、支架、结构件、机加工材料成本。"
  },
  METHANOL: {
    name: "甲醇",
    category: "化工",
    unit: "元/吨",
    currency: "CNY",
    base: 2550,
    bias: 0.08,
    factors: ["煤炭价格", "天然气价格", "装置开工率", "港口库存", "烯烃需求"],
    procurementUse: "影响溶剂、甲醛、MTO链条及部分化工辅材成本。"
  },
  PVC: {
    name: "PVC",
    category: "化工",
    unit: "元/吨",
    currency: "CNY",
    base: 5850,
    bias: -0.02,
    factors: ["电石价格", "乙烯价格", "地产需求", "库存", "出口订单"],
    procurementUse: "影响管材、线缆护套、包装和塑料件采购成本。"
  },
  PTA: {
    name: "PTA",
    category: "化工",
    unit: "元/吨",
    currency: "CNY",
    base: 6100,
    bias: 0.06,
    factors: ["原油", "PX价格", "聚酯开工", "库存", "装置检修"],
    procurementUse: "影响聚酯、薄膜、包装材料及纺织相关辅材。"
  }
};

export const supportedCodes = Object.keys(commodityConfig);

export type ScrapedCommodityInput = {
  code: string;
  currentPrice: number;
  dayChangePct?: number;
  source: string;
  updatedAt?: string;
};

export function normalizeScrapedCommodities(raw: ScrapedCommodityInput[]): Commodity[] {
  const result: Commodity[] = [];
  for (const row of raw) {
    const code = String(row.code ?? "").trim().toUpperCase();
    const cfg = commodityConfig[code];
    if (!cfg) continue;
    const price = Number(row.currentPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    const pct = Number(row.dayChangePct ?? 0);
    result.push({
      code,
      name: cfg.name,
      category: cfg.category,
      unit: cfg.unit,
      currency: cfg.currency,
      currentPrice: round(price, price < 10 ? 3 : 2),
      dayChangePct: round(Number.isFinite(pct) ? pct : 0, 2),
      source: row.source || "服务端爬虫",
      updatedAt: row.updatedAt || new Date().toISOString(),
      factors: cfg.factors,
      procurementUse: cfg.procurementUse
    });
  }
  return mergeWithFallback(result);
}

export function createFallbackCommodities(): Commodity[] {
  const today = new Date();
  return supportedCodes.map((code, index) => {
    const cfg = commodityConfig[code];
    const cycle = Math.sin((today.getDate() + index * 3) / 4);
    const change = round(cfg.bias + cycle * 1.15, 2);
    const price = round(cfg.base * (1 + change / 100), cfg.base < 10 ? 3 : 2);
    return {
      code,
      name: cfg.name,
      category: cfg.category,
      unit: cfg.unit,
      currency: cfg.currency,
      currentPrice: price,
      dayChangePct: change,
      source: "演示模型数据：爬虫未抓到有效行情时兜底",
      updatedAt: today.toISOString(),
      factors: cfg.factors,
      procurementUse: cfg.procurementUse
    };
  });
}

function mergeWithFallback(live: Commodity[]) {
  const fallback = createFallbackCommodities();
  const byCode = new Map(live.map((item) => [item.code, item]));
  return fallback.map((item) => byCode.get(item.code) ?? item);
}

function trendDirection(value: number): TrendDirection {
  if (value > 0.35) return "上涨";
  if (value < -0.35) return "下跌";
  return "震荡";
}

function riskLevel(volatility: number, confidence: number): RiskLevel {
  if (volatility > 1.5 || confidence < 58) return "高";
  if (volatility > 0.8 || confidence < 70) return "中";
  return "低";
}

function factorScores(item: Commodity): { factor: string; score: number; note: string }[] {
  return item.factors.map((factor, idx) => {
    const signal = Math.sin(item.dayChangePct + idx * 1.7 + item.currentPrice / 10000);
    const score = Math.round(signal * 45 + item.dayChangePct * 8);
    const note = score > 18 ? "推升价格" : score < -18 ? "压制价格" : "影响中性";
    return { factor, score, note };
  });
}

export function buildCommodityViews(items: Commodity[]): CommodityView[] {
  const today = new Date();
  return items.map((item, itemIndex) => {
    const scores = factorScores(item);
    const aggregateFactor = scores.reduce((sum, f) => sum + f.score, 0) / Math.max(scores.length, 1);
    const momentum = item.dayChangePct * 0.55 + aggregateFactor * 0.018;
    const volatility = Math.min(2.4, Math.abs(item.dayChangePct) * 0.35 + Math.abs(aggregateFactor) / 45 + 0.35);
    let anchor = item.currentPrice;

    const forecast: ForecastPoint[] = Array.from({ length: 7 }).map((_, idx) => {
      const date = new Date(today);
      date.setDate(today.getDate() + idx + 1);
      const decay = 1 - idx * 0.07;
      const seasonalNoise = Math.sin((today.getDate() + idx + itemIndex) / 2.2) * 0.22;
      const expectedChangePct = round(momentum * decay + seasonalNoise, 2);
      anchor = anchor * (1 + expectedChangePct / 100);
      const spread = volatility * (1 + idx * 0.1);
      const confidence = Math.max(52, Math.min(86, 78 - spread * 8 + Math.max(-5, Math.min(5, aggregateFactor / 10))));
      return {
        date: date.toISOString().slice(5, 10),
        direction: trendDirection(expectedChangePct),
        expectedChangePct,
        low: round(anchor * (1 - spread / 100), item.currentPrice < 10 ? 3 : 2),
        high: round(anchor * (1 + spread / 100), item.currentPrice < 10 ? 3 : 2),
        confidence: Math.round(confidence),
        risk: riskLevel(spread, confidence)
      };
    });

    const upDays = forecast.filter((f) => f.direction === "上涨").length;
    const downDays = forecast.filter((f) => f.direction === "下跌").length;
    const mainDirection = upDays > downDays ? "偏强" : downDays > upDays ? "偏弱" : "震荡";
    const risk = forecast.some((f) => f.risk === "高") ? "高" : forecast.some((f) => f.risk === "中") ? "中" : "低";

    const strategy = buildStrategies(item, mainDirection, risk, forecast);
    return {
      ...item,
      forecast,
      factorScores: scores,
      summary: `${item.name}未来7天模型判断为${mainDirection}，波动风险${risk}。核心驱动因素包括${item.factors.slice(0, 3).join("、")}。建议采购侧不要只看单日价格，重点关注连续上涨/下跌信号与供应商报价联动情况。`,
      strategy
    };
  });
}

function buildStrategies(item: Commodity, mainDirection: string, risk: RiskLevel, forecast: ForecastPoint[]): string[] {
  const firstThree = forecast.slice(0, 3);
  const avgShort = firstThree.reduce((sum, f) => sum + f.expectedChangePct, 0) / firstThree.length;
  const result: string[] = [];
  if (mainDirection === "偏强" || avgShort > 0.3) {
    result.push("对刚需用量提前询价，争取锁定当前价格或设置价格上限。");
    result.push("对价格敏感物料采用分批下单，避免后续连续上涨抬高采购成本。");
  } else if (mainDirection === "偏弱" || avgShort < -0.3) {
    result.push("非紧急需求可适度延后，保留二次议价空间。");
    result.push("要求供应商同步解释报价与上游大宗价格的联动关系。期货/现货下行时触发降价谈判。");
  } else {
    result.push("采用小批量、多批次采购，等待方向进一步明确。");
    result.push("合同中增加价格联动条款，降低单次价格判断错误带来的风险。");
  }
  if (risk === "高") {
    result.push("将该品类纳入采购风险日报，重点监控库存、期货和突发事件。 ");
  }
  result.push(`适用范围：${item.procurementUse}`);
  return result;
}

export function buildExecutiveSummary(views: CommodityView[]) {
  const highRisk = views.filter((v) => v.forecast.some((f) => f.risk === "高"));
  const up = views.filter((v) => v.forecast.filter((f) => f.direction === "上涨").length >= 4);
  const down = views.filter((v) => v.forecast.filter((f) => f.direction === "下跌").length >= 4);
  return {
    updatedAt: new Date().toISOString(),
    headline: `未来7天：${up.length}个品类偏强，${down.length}个品类偏弱，${highRisk.length}个品类波动风险较高。`,
    marketRisk: highRisk.length >= 3 ? "整体价格波动加大，建议采购侧强化锁价、分批采购和供应商报价校验。" : "整体波动可控，但仍需关注能源、金属和黑色链条的传导风险。",
    procurementActions: [
      "对连续上涨品类，优先评估锁价、框架协议和安全库存。",
      "对连续下跌品类，启动供应商降价谈判和成本拆解。",
      "对高波动品类，避免一次性大单，采用分批采购和价格联动条款。",
      "将大宗价格指数与采购订单、供应商报价、成本BOM建立关联，形成采购驾驶舱闭环。"
    ]
  };
}
