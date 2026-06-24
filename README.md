# 大宗商品价格预测与采购策略驾驶舱（爬虫版）

这是一个可部署到 Vercel 的 Next.js 网站工程，用于展示：

- 当前大宗商品价格看板
- 未来 7 天每日趋势预测
- 价格影响因素分析
- AI 总结与采购策略建议
- 采购风险预警

> 注意：预测输出用于采购策略辅助，不代表绝对价格承诺。

## 1. 本次重构内容

已从原来的“行情 API 接入模式”重构为“服务端爬虫模式”：

- 移除 Trading Economics API 调用逻辑。
- 新增 `lib/commodityScraper.ts` 服务端爬虫。
- 由 `/api/commodities` 后端接口统一抓取、解析、缓存并生成预测结果。
- 前端不直接抓网页，避免跨域、规则暴露和浏览器端不稳定。
- 支持 `priceSelector` / `changeSelector` 选择器解析。
- 支持 `priceRegex` / `changeRegex` 正则解析。
- 支持 robots.txt 检查、User-Agent、超时、限频和失败兜底。
- 抓不到有效行情时，自动使用演示模型数据兜底，页面不会白屏。

## 2. 技术栈

- Next.js App Router
- React + TypeScript
- Vercel Serverless API Route
- 服务端 HTML 爬虫
- 7 天趋势预测与采购策略模型

## 3. 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

浏览器打开：

```text
http://localhost:3000
```

## 4. 爬虫数据源配置

正式上线时，请在 `.env.local` 或 Vercel Environment Variables 中配置 `CRAWLER_SOURCES_JSON`。

示例：

```bash
CRAWLER_SOURCES_JSON='[
  {
    "code":"BRENT",
    "sourceName":"示例行情网站",
    "url":"https://example.com/brent",
    "priceSelector":".latest-price",
    "changeSelector":".change-percent"
  },
  {
    "code":"PVC",
    "sourceName":"示例化工行情网站",
    "url":"https://example.com/pvc",
    "priceRegex":"PVC价格[:：]\\s*([0-9,.]+)",
    "changeRegex":"涨跌幅[:：]\\s*([-+]?[0-9.]+)%"
  }
]'
```

也可以参考项目中的：

```text
crawler-sources.example.json
```

## 5. 支持的商品编码

当前模型内置以下编码：

| 编码 | 商品 |
|---|---|
| BRENT | Brent 原油 |
| NATGAS | 天然气 |
| COPPER | 铜 |
| ALUMINUM | 铝 |
| NICKEL | 镍 |
| IRONORE | 铁矿石 |
| HRC | 热轧卷板 |
| METHANOL | 甲醇 |
| PVC | PVC |
| PTA | PTA |

## 6. 环境变量

```bash
# 自定义爬虫 User-Agent，建议写明用途和联系人
CRAWLER_USER_AGENT="CommodityAIDashboardBot/1.0 (+contact: procurement-data-team; purpose: price-monitoring)"

# 是否尊重 robots.txt。正式环境建议保持 true
CRAWLER_RESPECT_ROBOTS=true

# robots.txt 获取失败时是否继续抓取。默认 false，更稳妥
CRAWLER_ROBOTS_FAIL_OPEN=false

# 单页面抓取超时时间，单位毫秒
CRAWLER_TIMEOUT_MS=9000

# 每个源之间的等待时间，单位毫秒
CRAWLER_DELAY_MS=500

# 自定义爬虫源 JSON
CRAWLER_SOURCES_JSON='[...]'
```

## 7. 部署到 Vercel

### 方式一：GitHub + Vercel 控制台

1. 把本工程上传到 GitHub 仓库。
2. 在 Vercel 中选择 `Add New Project`。
3. 选择该 GitHub 仓库。
4. Framework Preset 选择 `Next.js`。
5. 在 Environment Variables 中配置：
   - `CRAWLER_SOURCES_JSON`
   - `CRAWLER_USER_AGENT`
   - `CRAWLER_RESPECT_ROBOTS`
6. 点击 Deploy。
7. 部署完成后 Vercel 会生成公网地址，例如：

```text
https://commodity-ai-dashboard-xxx.vercel.app
```

### 方式二：Vercel CLI

```bash
npm install -g vercel
vercel login
vercel link
vercel env add CRAWLER_SOURCES_JSON
vercel env add CRAWLER_USER_AGENT
vercel --prod
```

## 8. 目录说明

```text
app/
  api/commodities/route.ts   # 后端数据接口，执行爬虫并生成模型预测
  page.tsx                   # 首页入口
  layout.tsx                 # 页面元信息
  globals.css                # 全站样式
components/
  CommodityDashboard.tsx     # 前端驾驶舱主组件
lib/
  commodityScraper.ts        # 服务端爬虫，支持选择器/正则/robots/限频/兜底
  marketModel.ts             # 趋势预测、影响因素、采购策略模型
crawler-sources.example.json # 爬虫源配置示例
vercel.json                  # Vercel 定时刷新配置
.env.example                 # 环境变量模板
```

## 9. 合规与稳定性说明

爬虫版适合做原型和企业内部已授权数据源整合，但生产环境必须注意：

- 不抓取登录后、付费墙后、明确禁止抓取的数据。
- 不绕过验证码、反爬、访问限制或安全机制。
- 优先使用企业已购买或获得授权的网站页面。
- 保持合理抓取频率，避免对目标网站造成压力。
- 网页结构会变化，`priceSelector` 和 `changeSelector` 需要维护。

## 10. 后续可增强

- 为每个商品配置多个数据源，做交叉校验。
- 增加来源权重、价格异常剔除和一致性检查。
- 增加历史价格落库，用真实时间序列替代简化趋势模型。
- 增加采购订单、供应商报价、BOM 成本映射。
- 增加模型回测，展示过去 30/60/90 天预测准确率。
