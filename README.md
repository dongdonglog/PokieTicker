# PokieTicker

**English | [中文](#中文说明)**

PokieTicker is a news-driven stock analysis app built to answer a simple question: why did a stock move?

- Overlay news on a candlestick chart
- Filter by event type and sentiment
- Ask AI to explain a selected price move
- Compare similar historical periods
- Run short-horizon prediction from news + technical features

Live demo: [mitrui.com/PokieTicker](https://mitrui.com/PokieTicker/)

[![Demo](docs/demo.gif)](https://mitrui.com/PokieTicker/)

## Features

- `Chart + news context`: click a date and inspect the related headlines
- `Range analysis`: ask AI why a stock rallied or dropped over a selected window
- `Signals and forecast`: view event clusters, short-term direction, and similar periods
- `Research workflow`: move between chart, news, range analysis, and historical comparisons in one workspace

![Screenshot](docs/screenshot.png)

## Stack

- Frontend: React, TypeScript, Vite, D3.js
- Backend: FastAPI, SQLite, Pydantic Settings
- AI: Anthropic Claude for news analysis
- ML: XGBoost + similarity search
- Data: Polygon for the current US dataset; A-share support is being added

## Quick Start

The repository includes bundled sample artifacts for quick local startup.

```bash
git clone https://github.com/dongdonglog/PokieTicker.git
cd PokieTicker

gzip -dkf pokieticker.db.gz
tar xzf models.tar.gz -C backend/ml/

python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd frontend
npm install
npm run dev
```

In another terminal:

```bash
source venv/bin/activate
uvicorn backend.api.main:app --reload
```

Frontend: `http://localhost:5173`  
Backend API: `http://127.0.0.1:8000`

## Configuration

Copy `.env.example` to `.env` and fill in any keys you need:

- `MARKET_DATA_PROVIDER` selects the active data backend. Default: `polygon`
- `POLYGON_API_KEY` for US-market data refresh
- `ANTHROPIC_API_KEY` for AI analysis
- `TUSHARE_TOKEN` for the in-progress A-share migration

## Project Structure

```text
backend/            FastAPI app, data pipeline, ML, market clients
frontend/           Vite + React client
docs/               Demo assets and migration plans
backend/api/        API entrypoints
backend/pipeline/   News filtering, alignment, and AI analysis
backend/ml/         Feature engineering, inference, backtest logic
backend/ashare/     Early A-share data integration
```

## Current Status

- The bundled database is still US-market heavy
- Frontend UI has been refactored into a cleaner workspace layout
- A-share migration is in progress
- A-share news integration planning is documented in:
  - [docs/ashare-migration-plan.md](docs/ashare-migration-plan.md)
  - [docs/ashare-news-plan.md](docs/ashare-news-plan.md)

## Development Commands

```bash
uvicorn backend.api.main:app --reload
python -m backend.bulk_fetch
python -m backend.weekly_update
python -m backend.batch_submit --top 50
python -m backend.batch_collect <batch_id>

cd frontend
npm run dev
npm run build
npm run lint
```

## License

MIT. See [LICENSE](LICENSE).

---

# 中文说明

PokieTicker 是一个“新闻驱动的股票分析工具”，核心目标不是只看 K 线，而是解释股价为什么涨跌。

- 在 K 线图上叠加新闻事件
- 按事件类型和情绪筛选新闻
- 选择区间后让 AI 解释这段走势
- 查找相似历史阶段
- 用新闻特征和技术指标做短期方向预测

在线演示： [mitrui.com/PokieTicker](https://mitrui.com/PokieTicker/)

## 功能概览

- `图表 + 新闻上下文`：点击某一天，查看该日期附近的相关新闻
- `区间分析`：框选一段时间，让 AI 解释为什么上涨或下跌
- `信号与预测`：查看事件聚集、短期方向和历史相似阶段
- `研究工作流`：在图表、新闻、区间分析、历史对照之间切换

## 技术栈

- 前端：React、TypeScript、Vite、D3.js
- 后端：FastAPI、SQLite、Pydantic Settings
- AI：Anthropic Claude
- 机器学习：XGBoost + 相似度检索
- 数据源：当前内置数据以美股为主，A 股接入正在开发中

## 快速启动

仓库内已经包含演示所需的样例数据库和模型文件。

```bash
git clone https://github.com/dongdonglog/PokieTicker.git
cd PokieTicker

gzip -dkf pokieticker.db.gz
tar xzf models.tar.gz -C backend/ml/

python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd frontend
npm install
npm run dev
```

另开一个终端启动后端：

```bash
source venv/bin/activate
uvicorn backend.api.main:app --reload
```

前端地址：`http://localhost:5173`  
后端接口：`http://127.0.0.1:8000`

## 配置说明

将 `.env.example` 复制为 `.env`，再按需填写：

- `MARKET_DATA_PROVIDER`：当前启用的数据提供方，默认 `polygon`
- `POLYGON_API_KEY`：美股数据更新
- `ANTHROPIC_API_KEY`：AI 分析
- `TUSHARE_TOKEN`：A 股迁移开发使用

## 目录结构

```text
backend/            FastAPI、数据流水线、模型与市场数据接入
frontend/           Vite + React 前端
docs/               演示素材与迁移文档
backend/api/        API 路由
backend/pipeline/   新闻筛选、对齐和 AI 分析
backend/ml/         特征工程、推理和回测
backend/ashare/     A 股接入脚手架
```

## 当前进度

- 仓库自带数据库目前仍以美股数据为主
- 前端界面已重构为更清晰的工作区布局
- A 股迁移正在进行中
- A 股相关新闻接入方案已单独整理在：
  - [docs/ashare-migration-plan.md](docs/ashare-migration-plan.md)
  - [docs/ashare-news-plan.md](docs/ashare-news-plan.md)

## 常用开发命令

```bash
uvicorn backend.api.main:app --reload
python -m backend.bulk_fetch
python -m backend.weekly_update
python -m backend.batch_submit --top 50
python -m backend.batch_collect <batch_id>

cd frontend
npm run dev
npm run build
npm run lint
```

## 许可证

MIT，详见 [LICENSE](LICENSE)。
