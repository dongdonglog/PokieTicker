from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from typing import Any

import pandas as pd
import tushare as ts

from backend.config import settings


def _get_pro() -> Any:
    if not settings.tushare_token:
        raise RuntimeError("TUSHARE_TOKEN is not configured")
    return ts.pro_api(settings.tushare_token)


def normalize_symbol(symbol: str) -> str:
    s = symbol.strip().upper()
    if s.endswith(".SH") or s.endswith(".SZ"):
        return s
    if len(s) == 6 and s.startswith("6"):
        return f"{s}.SH"
    if len(s) == 6 and s[0] in {"0", "3"}:
        return f"{s}.SZ"
    return s


def _to_tushare_code(symbol: str) -> str:
    return normalize_symbol(symbol)


@lru_cache(maxsize=1)
def _stock_basic_frame() -> pd.DataFrame:
    pro = _get_pro()
    df = pro.stock_basic(
        exchange="",
        list_status="L",
        fields="ts_code,symbol,name,area,industry,market,list_date",
    )
    if df is None or df.empty:
        return pd.DataFrame(columns=["ts_code", "symbol", "name", "area", "industry", "market", "list_date"])
    return df.fillna("")


def search_tickers(q: str, limit: int = 10) -> list[dict[str, Any]]:
    query = q.strip().upper()
    if not query:
        return []

    df = _stock_basic_frame()
    if df.empty:
        return []

    mask = (
        df["ts_code"].str.upper().str.contains(query, na=False)
        | df["symbol"].str.upper().str.contains(query, na=False)
        | df["name"].str.upper().str.contains(query, na=False)
    )
    rows = df.loc[mask, ["ts_code", "name", "industry"]].head(limit)

    return [
        {
            "symbol": row["ts_code"],
            "name": row["name"],
            "sector": row["industry"] or None,
        }
        for _, row in rows.iterrows()
    ]


def fetch_ohlc(symbol: str, start: str, end: str) -> list[dict[str, Any]]:
    pro = _get_pro()
    df = pro.daily(
        ts_code=_to_tushare_code(symbol),
        start_date=_to_ymd(start),
        end_date=_to_ymd(end),
        fields="ts_code,trade_date,open,high,low,close,vol,amount",
    )
    if df is None or df.empty:
        return []

    df = df.sort_values("trade_date", ascending=True)
    return [
        {
            "date": _from_ymd(row["trade_date"]),
            "open": _to_float(row["open"]),
            "high": _to_float(row["high"]),
            "low": _to_float(row["low"]),
            "close": _to_float(row["close"]),
            "volume": _to_float(row["vol"]),
            "vwap": None,
            "transactions": None,
        }
        for _, row in df.iterrows()
    ]


def fetch_news(symbol: str, start: str, end: str) -> list[dict[str, Any]]:
    # Phase 1: A-share migration only requires search + OHLC.
    return []


def get_stock_basic(limit: int | None = None) -> list[dict[str, Any]]:
    df = _stock_basic_frame()
    if limit is not None:
        df = df.head(limit)

    return [
        {
            "symbol": row["ts_code"],
            "name": row["name"],
            "sector": row["industry"] or None,
            "market": "CN",
            "exchange": "SSE" if str(row["ts_code"]).endswith(".SH") else "SZSE",
        }
        for _, row in df.iterrows()
    ]


def _to_ymd(date_str: str) -> str:
    return datetime.strptime(date_str, "%Y-%m-%d").strftime("%Y%m%d")


def _from_ymd(date_str: str) -> str:
    return datetime.strptime(str(date_str), "%Y%m%d").strftime("%Y-%m-%d")


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
