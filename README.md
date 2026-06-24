# 大宗商品价格预测与采购策略驾驶舱

这是一个可部署到 Vercel 的 Next.js 网站工程，用于展示：

- 当前大宗商品价格看板
- 未来 7 天每日趋势预测
- 价格影响因素分析
- AI 总结与采购策略建议
- 采购风险预警

> 注意：预测输出用于采购策略辅助，不代表绝对价格承诺。

## 1. 技术栈

- Next.js App Router
- React + TypeScript
- Vercel Serverless API Route
- Trading Economics API 预留接口
- 无需前端暴露 API Key

## 2. 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

浏览器打开：

```text
http://localhost:3000
```

## 3. 接入真实行情数据

在 `.env.local` 或 Vercel Environment Variables 中配置：

```bash
TRADING_ECONOMICS_CLIENT=你的client
TRADING_ECONOMICS_SECRET=你的secret
```

没有配置时，系统会使用演示模型数据，页面会标记为“演示/待接入”。

## 4. 部署到 Vercel

### 方式一：GitHub + Vercel 控制台

1. 把本工程上传到 GitHub 仓库。
2. 在 Vercel 中选择 `Add New Project`。
3. 选择该 GitHub 仓库。
4. Framework Preset 选择 `Next.js`。
5. 在 Environment Variables 中配置：
   - `TRADING_ECONOMICS_CLIENT`
   - `TRADING_ECONOMICS_SECRET`
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
vercel env add TRADING_ECONOMICS_CLIENT
vercel env add TRADING_ECONOMICS_SECRET
vercel --prod
```

## 5. 目录说明

```text
app/
  api/commodities/route.ts   # 后端数据接口，接行情 API 并生成模型预测
  page.tsx                   # 首页入口
  layout.tsx                 # 页面元信息
  globals.css                # 全站样式
components/
  CommodityDashboard.tsx     # 前端驾驶舱主组件
lib/
  marketModel.ts             # 趋势预测、影响因素、采购策略模型
vercel.json                  # 定时刷新配置
.env.example                 # 环境变量模板
```

## 6. 正式项目建议

生产环境建议进一步增强：

- 接入多个授权行情源，例如 Trading Economics、Nasdaq Data Link、交易所或行业数据平台。
- 建立企业内部采购价、供应商报价、BOM成本和大宗指数映射关系。
- 引入历史价格序列，替换当前简化的趋势模型。
- 增加模型回测功能，展示过去 30/60/90 天预测准确率。
- 增加权限控制，区分总裁视角、采购总监视角、品类经理视角。
