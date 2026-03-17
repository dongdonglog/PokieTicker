from __future__ import annotations

from typing import Any

from backend.config import settings


def _provider():
    if settings.market_data_provider == "ashare":
        from backend.ashare import client as provider
        return provider

    from backend.polygon import client as provider
    return provider


def provider_name() -> str:
    return settings.market_data_provider


def normalize_symbol(symbol: str) -> str:
    provider = _provider()
    normalize = getattr(provider, "normalize_symbol", None)
    if callable(normalize):
        return normalize(symbol)
    return symbol.strip().upper()


def search_tickers(query: str, limit: int = 20) -> list[dict[str, Any]]:
    return _provider().search_tickers(query, limit=limit)


def fetch_ohlc(symbol: str, start: str, end: str) -> list[dict[str, Any]]:
    return _provider().fetch_ohlc(symbol, start, end)


def fetch_news(symbol: str, start: str, end: str) -> list[dict[str, Any]]:
    return _provider().fetch_news(symbol, start, end)


def seed_tickers() -> list[dict[str, Any]]:
    provider = _provider()
    getter = getattr(provider, "get_stock_basic", None)
    if callable(getter):
        return getter()
    return []


def ticker_name(symbol: str) -> str:
    provider = _provider()
    getter = getattr(provider, "get_ticker_name", None)
    if callable(getter):
        return getter(symbol)
    return ""
