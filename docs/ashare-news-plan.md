# A股新闻接入计划

## 目标
为 A 股版本补齐新闻采集、股票归属和现有分析流水线接入能力。第一阶段不追求“全市场全覆盖”，而是先让核心股票池具备可用的新闻解释能力。

## 设计原则

- 行情源和新闻源分离，不把 A 股能力绑死在单一供应商上
- 先做稳定归属，再做大规模覆盖
- 先保住 `news_raw -> news_ticker -> layer0/layer1/layer2` 这条现有链路

## 推荐方案

第一阶段优先采用“公开财经新闻源 + 本地股票名映射”方案：

- 新闻采集：东方财富、新浪财经、腾讯财经任选一个先落地
- 股票归属：基于股票简称、公司全称、常见别名做本地匹配
- 结构保持兼容现有 `news_raw` 和 `news_ticker` 表

原因：

- 比继续依赖 `Tushare` 更稳
- 采集、匹配、分析可以分步落地
- 后续替换新闻源时不用重写前端和分析层

## 建议新增文件

- `backend/ashare/news_client.py`
- `backend/ashare/symbol_map.py`
- `backend/pipeline/news_matcher.py`

职责建议：

- `news_client.py`
  抓取原始新闻，输出统一字段结构
- `symbol_map.py`
  维护 `symbol/name/aliases/sector`
- `news_matcher.py`
  将新闻标题或摘要匹配到一个或多个 A 股股票

## 统一数据结构

`news_client.py` 建议输出：

```python
{
    "id": "source-specific-id",
    "source": "eastmoney",
    "title": "贵州茅台发布年报预告",
    "description": "摘要文本",
    "content": None,
    "published_utc": "2026-03-17T09:30:00Z",
    "article_url": "https://...",
}
```

匹配完成后再生成：

```python
{
    "symbol": "600519.SH",
    "confidence": 0.95,
    "matched_on": "name",
}
```

## 匹配规则

第一阶段按以下顺序匹配：

1. 精确命中股票简称
2. 精确命中公司全称
3. 命中常见别名
4. 若命中多只股票，标记低置信度
5. 无法确认则不写入 `news_ticker`

建议只使用标题和摘要做第一版匹配，不要一开始就做全文 NLP。

## 数据库建议

现有表先尽量复用：

- `news_raw`
  继续存原始新闻
- `news_ticker`
  继续存新闻与股票的对应关系

如需增强，可后续补充：

- `news_raw.source`
- `news_raw.content`
- `news_ticker.match_confidence`
- `news_ticker.match_reason`

## 实施顺序

### Phase 1

- 建立 A 股核心股票池名称映射
- 完成 `symbol_map.py`
- 完成 `news_matcher.py` 的基础规则

### Phase 2

- 接入一个新闻源
- 抓取标题、时间、链接、摘要
- 写入 `news_raw`

### Phase 3

- 对新抓到的新闻做股票归属
- 写入 `news_ticker`
- 验证核心股票池的命中率

### Phase 4

- 接回 `align_news_for_symbol`
- 恢复 `layer0 -> layer1 -> layer2`
- 再评估是否需要扩展到更多新闻源

## Checklist

- [ ] 定义 A 股核心股票池
- [ ] 新建 `backend/ashare/symbol_map.py`
- [ ] 新建 `backend/ashare/news_client.py`
- [ ] 新建 `backend/pipeline/news_matcher.py`
- [ ] 实现股票简称/全称/别名映射
- [ ] 实现标题和摘要匹配规则
- [ ] 选定第一个新闻源
- [ ] 抓取新闻写入 `news_raw`
- [ ] 匹配结果写入 `news_ticker`
- [ ] 验证 `600519.SH` 等核心股票的新闻命中
- [ ] 接回 `align_news_for_symbol`
- [ ] 恢复 `layer0 -> layer1 -> layer2`

## 当前建议

先不要着急做多源聚合。第一版只要能让核心股票池看到“可归属、可解释”的新闻，就已经足够支撑 A 股 UI 和分析链路继续往前走。
