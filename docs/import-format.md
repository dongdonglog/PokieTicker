# 通用导入格式

## 目标
允许用户把任意市场的走势数据导入到本地数据库，再交给前端看板和 AI 分析层使用。

## 推荐格式

使用 CSV，最小字段如下：

```csv
symbol,date,open,high,low,close,volume
AAPL,2026-03-16,214.10,216.50,213.40,215.80,53422100
```

## 必填字段

- `symbol`
- `date`
- `open`
- `high`
- `low`
- `close`
- `volume`

## 可选字段

- `name`
- `sector`
- `vwap`
- `transactions`

## 日期格式

- `YYYY-MM-DD`

## 导入命令

单文件：

```bash
python -m backend.import_ohlc data/imports/aapl.csv
```

目录批量导入：

```bash
python -m backend.import_ohlc data/imports/
```

## 说明

- `symbol` 可以是美股代码，也可以是 `600519.SH` 这种带市场后缀的代码
- 导入脚本会把数据写入 `tickers` 和 `ohlc`
- 前端和 API 仍然统一从本地 SQLite 读取
