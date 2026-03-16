# A股迁移计划

## 目标
把当前基于美股数据源的 PokieTicker，迁移为可运行的 A 股版本。第一阶段先实现：

- 可搜索 A 股股票
- 可选择股票并加载日线数据
- 前端股票选择器切换为 A 股分组
- 后端保留现有分析框架，新闻能力后补

## 推荐数据源
优先使用 `Tushare`，原因：

- A 股日线、股票基础信息、交易日历更稳定
- 字段结构规整，适合接入当前 SQLite + FastAPI 结构
- 后续做增量更新比临时抓取源更省事

## 实施阶段

### Phase 1: 行情与选股跑通

1. 新增 `backend/ashare/client.py`
2. 实现以下函数：
   - `normalize_symbol(symbol)`
   - `search_tickers(q, limit=10)`
   - `fetch_ohlc(symbol, start, end)`
   - `fetch_news(symbol, start, end)`，第一版先返回空列表
3. 在 `backend/config.py` 中增加 `tushare_token`
4. 在 `.env.example` 中增加 `TUSHARE_TOKEN`，并同步到本地 `.env`

### Phase 2: 后端路由切换

1. 修改 `backend/api/routers/stocks.py`
2. 把 `backend.polygon.client` 替换为 `backend.ashare.client`
3. 统一股票代码格式：
   - 上交所：`600519.SH`
   - 深交所：`000001.SZ`

### Phase 3: 批量更新链路

1. 修改 `backend/bulk_fetch.py`
2. 修改 `backend/weekly_update.py`
3. 第一版只维护 A 股核心股票池，不做全市场

建议初始股票池：

- `600519.SH`
- `300750.SZ`
- `000858.SZ`
- `601318.SH`
- `600036.SH`
- `002594.SZ`

### Phase 4: 前端切换

1. 修改 `frontend/src/components/StockSelector.tsx`
2. 切换成 A 股行业分组
3. 展示方式改为“名称 + 代码”

建议分组：

- 白酒
- 银行
- 券商
- 新能源
- 半导体
- 医药
- 消费电子
- 互联网平台

### Phase 5: 新闻与分析恢复

1. 接入 A 股新闻源
2. 做公司名/股票代码归属
3. 恢复 `layer0 -> layer1 -> layer2`
4. 最后再评估预测模型是否需要适配 A 股特征

## 代码骨架建议

优先新增：

- `backend/ashare/client.py`

建议对外提供：

- `search_tickers(q: str, limit: int = 10) -> list[dict]`
- `fetch_ohlc(symbol: str, start: str, end: str) -> list[dict]`
- `fetch_news(symbol: str, start: str, end: str) -> list[dict]`

## Checklist

- [x] 在 `backend/config.py` 增加 `tushare_token`
- [x] 在 `.env.example` 增加 `TUSHARE_TOKEN`
- [x] 新建 `backend/ashare/client.py`
- [x] 实现 `normalize_symbol`
- [x] 实现 `search_tickers`
- [x] 实现 `fetch_ohlc`
- [x] 让 `fetch_news` 先返回空列表
- [x] 修改 `backend/api/routers/stocks.py` 使用 A 股 client
- [ ] 验证 `/api/stocks/search` 可返回 A 股结果
- [ ] 验证 `/api/stocks/{symbol}/ohlc` 可返回 A 股日线
- [x] 修改 `backend/bulk_fetch.py`
- [x] 修改 `backend/weekly_update.py`
- [ ] 修改 `frontend/src/components/StockSelector.tsx`
- [ ] 前端可正常选择 A 股并显示图表
- [ ] 第二阶段再接入 A 股新闻源

## 当前建议
先完成 Phase 1 到 Phase 3，不要一开始就迁新闻和模型。先把 “选股 + K线” 跑通，才能快速验证 A 股接入方向是否正确。

当前最需要的外部配合：

- 在本地 `.env` 中配置 `TUSHARE_TOKEN`
- 启动后端后验证 `/api/stocks/search?q=600519`
- 如果返回正常，再继续切前端 `StockSelector`
