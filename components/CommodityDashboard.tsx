"use client";

import { useEffect, useMemo, useState } from "react";

type ForecastPoint = {
  date: string;
  direction: "上涨" | "下跌" | "震荡";
  expectedChangePct: number;
  low: number;
  high: number;
  confidence: number;
  risk: "低" | "中" | "高";
};

type Commodity = {
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
  forecast: ForecastPoint[];
  summary: string;
  strategy: string[];
  factorScores: { factor: string; score: number; note: string }[];
};

type ApiPayload = {
  dataMode: "live" | "fallback";
  provider: string;
  executiveSummary: {
    updatedAt: string;
    headline: string;
    marketRisk: string;
    procurementActions: string[];
  };
  commodities: Commodity[];
  notes: string[];
};

const categoryOrder = ["全部", "能源", "金属", "黑色", "化工"] as const;

function directionClass(direction: string) {
  if (direction === "上涨") return "up";
  if (direction === "下跌") return "down";
  return "flat";
}

function riskClass(risk: string) {
  if (risk === "高") return "riskHigh";
  if (risk === "中") return "riskMedium";
  return "riskLow";
}

function MiniTrend({ data }: { data: ForecastPoint[] }) {
  const values = data.map((d) => d.expectedChangePct);
  const min = Math.min(...values, -1);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = 10 + (index * 180) / Math.max(values.length - 1, 1);
      const y = 56 - ((value - min) / range) * 42;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="miniTrend" viewBox="0 0 200 70" role="img" aria-label="7天趋势图">
      <line x1="10" y1="56" x2="190" y2="56" className="axis" />
      <line x1="10" y1="35" x2="190" y2="35" className="zero" />
      <polyline points={points} fill="none" strokeWidth="3" className="trendLine" />
      {values.map((value, index) => {
        const x = 10 + (index * 180) / Math.max(values.length - 1, 1);
        const y = 56 - ((value - min) / range) * 42;
        return <circle key={index} cx={x} cy={y} r="3.8" className={value > 0 ? "dotUp" : value < 0 ? "dotDown" : "dotFlat"} />;
      })}
    </svg>
  );
}

function FactorBars({ item }: { item: Commodity }) {
  return (
    <div className="factorBars">
      {item.factorScores.slice(0, 5).map((factor) => {
        const width = Math.min(100, Math.max(8, Math.abs(factor.score) + 22));
        return (
          <div className="factorRow" key={factor.factor}>
            <div className="factorName">{factor.factor}</div>
            <div className="factorTrack">
              <div
                className={`factorBar ${factor.score > 0 ? "barUp" : factor.score < 0 ? "barDown" : "barFlat"}`}
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="factorNote">{factor.note}</div>
          </div>
        );
      })}
    </div>
  );
}

function ForecastTable({ item }: { item: Commodity }) {
  return (
    <div className="forecastGrid">
      {item.forecast.map((day) => (
        <div className="forecastDay" key={day.date}>
          <div className="forecastDate">{day.date}</div>
          <div className={`forecastDirection ${directionClass(day.direction)}`}>{day.direction}</div>
          <div className="forecastPct">{day.expectedChangePct > 0 ? "+" : ""}{day.expectedChangePct}%</div>
          <div className="forecastRange">{day.low} - {day.high}</div>
          <div className={`riskTag ${riskClass(day.risk)}`}>风险{day.risk}</div>
        </div>
      ))}
    </div>
  );
}

function CommodityCard({ item }: { item: Commodity }) {
  const first = item.forecast[0];
  const last = item.forecast[item.forecast.length - 1];
  return (
    <article className="commodityCard">
      <div className="cardTop">
        <div>
          <div className="categoryPill">{item.category}</div>
          <h3>{item.name}</h3>
        </div>
        <div className="priceBox">
          <div className="price">{item.currentPrice.toLocaleString("zh-CN")}</div>
          <div className="unit">{item.unit}</div>
          <div className={`change ${item.dayChangePct > 0 ? "up" : item.dayChangePct < 0 ? "down" : "flat"}`}>{item.dayChangePct > 0 ? "+" : ""}{item.dayChangePct}% 今日</div>
        </div>
      </div>

      <div className="trendArea">
        <MiniTrend data={item.forecast} />
        <div className="trendCopy">
          <strong>7天判断：</strong>{first.direction}开局，至{last.date}区间约 {last.low} - {last.high} {item.unit}。
        </div>
      </div>

      <ForecastTable item={item} />

      <div className="analysisBlock">
        <h4>影响因素</h4>
        <FactorBars item={item} />
      </div>

      <div className="analysisBlock strategyBlock">
        <h4>AI总结与采购策略</h4>
        <p>{item.summary}</p>
        <ul>
          {item.strategy.slice(0, 3).map((strategy) => <li key={strategy}>{strategy}</li>)}
        </ul>
      </div>
    </article>
  );
}

export default function CommodityDashboard() {
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<(typeof categoryOrder)[number]>("全部");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/commodities", { cache: "no-store" });
      const data = await res.json();
      setPayload(data);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const list = payload?.commodities ?? [];
    return selectedCategory === "全部" ? list : list.filter((item) => item.category === selectedCategory);
  }, [payload, selectedCategory]);

  const selected = useMemo(() => {
    if (!payload?.commodities.length) return null;
    return payload.commodities.find((item) => item.code === selectedCode) ?? filtered[0] ?? payload.commodities[0];
  }, [payload, filtered, selectedCode]);

  const stats = useMemo(() => {
    const list = payload?.commodities ?? [];
    return {
      total: list.length,
      highRisk: list.filter((item) => item.forecast.some((day) => day.risk === "高")).length,
      up: list.filter((item) => item.forecast.filter((day) => day.direction === "上涨").length >= 4).length,
      down: list.filter((item) => item.forecast.filter((day) => day.direction === "下跌").length >= 4).length
    };
  }, [payload]);

  return (
    <main>
      <section className="hero">
        <div className="heroCopy">
          <div className="eyebrow">Commodity AI Dashboard</div>
          <h1>大宗商品价格预测与采购策略驾驶舱</h1>
          <p>面向钢铁、化工及制造采购场景，聚合价格行情、影响因素、未来7天趋势、风险等级和采购动作建议。</p>
        </div>
        <div className="heroPanel">
          <div className="statusLabel">数据模式</div>
          <div className={`statusValue ${payload?.dataMode === "live" ? "live" : "demo"}`}>{payload?.dataMode === "live" ? "实时API" : "演示/待接入"}</div>
          <div className="provider">{payload?.provider ?? "加载中..."}</div>
        </div>
      </section>

      {loading && <div className="loading">正在加载大宗商品价格与7天趋势...</div>}

      {payload && (
        <>
          <section className="summaryGrid">
            <div className="summaryCard wide">
              <div className="sectionLabel">AI总览</div>
              <h2>{payload.executiveSummary.headline}</h2>
              <p>{payload.executiveSummary.marketRisk}</p>
            </div>
            <div className="summaryCard"><span>监控品类</span><strong>{stats.total}</strong></div>
            <div className="summaryCard"><span>偏强品类</span><strong>{stats.up}</strong></div>
            <div className="summaryCard"><span>偏弱品类</span><strong>{stats.down}</strong></div>
            <div className="summaryCard"><span>高风险品类</span><strong>{stats.highRisk}</strong></div>
          </section>

          <section className="actionPanel">
            <div>
              <div className="sectionLabel">采购动作建议</div>
              <h2>把“价格预测”转成“采购策略”</h2>
            </div>
            <div className="actions">
              {payload.executiveSummary.procurementActions.map((action) => <div className="actionItem" key={action}>{action}</div>)}
            </div>
          </section>

          <section className="filters">
            {categoryOrder.map((category) => (
              <button
                key={category}
                className={selectedCategory === category ? "active" : ""}
                onClick={() => {
                  setSelectedCategory(category);
                  setSelectedCode(null);
                }}
              >
                {category}
              </button>
            ))}
          </section>

          <section className="marketLayout">
            <aside className="commodityList">
              {filtered.map((item) => (
                <button key={item.code} className={selected?.code === item.code ? "listItem active" : "listItem"} onClick={() => setSelectedCode(item.code)}>
                  <span>{item.name}</span>
                  <strong>{item.currentPrice.toLocaleString("zh-CN")}</strong>
                  <em className={item.dayChangePct > 0 ? "up" : item.dayChangePct < 0 ? "down" : "flat"}>{item.dayChangePct > 0 ? "+" : ""}{item.dayChangePct}%</em>
                </button>
              ))}
            </aside>
            <div className="detailPane">{selected && <CommodityCard item={selected} />}</div>
          </section>

          <section className="allCards">
            <div className="sectionLabel">全部品类快览</div>
            <div className="cardGrid">
              {filtered.map((item) => <CommodityCard key={item.code} item={item} />)}
            </div>
          </section>

          <section className="notes">
            <div className="sectionLabel">模型边界</div>
            {payload.notes.map((note) => <p key={note}>{note}</p>)}
            <p>更新时间：{new Date(payload.executiveSummary.updatedAt).toLocaleString("zh-CN")}</p>
          </section>
        </>
      )}
    </main>
  );
}
