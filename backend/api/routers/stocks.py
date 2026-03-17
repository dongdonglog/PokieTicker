import logging

from fastapi import APIRouter, Query, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

from backend.database import get_conn
from backend.market_data import fetch_news, fetch_ohlc, normalize_symbol, provider_name, search_tickers, seed_tickers

router = APIRouter()


class AddTickerRequest(BaseModel):
    symbol: str
    name: Optional[str] = None


@router.get("")
def list_tickers():
    """List all tracked tickers."""
    conn = get_conn()
    rows = conn.execute("SELECT * FROM tickers ORDER BY symbol").fetchall()
    conn.close()
    results = [dict(r) for r in rows]
    if results:
        return results

    return [
        {
            "symbol": item["symbol"],
            "name": item["name"],
            "sector": item.get("sector"),
            "last_ohlc_fetch": None,
            "last_news_fetch": None,
        }
        for item in seed_tickers()
    ]


@router.get("/search")
def search(q: str = Query(..., min_length=1)):
    """Fuzzy search tickers via the active market data client."""
    # First check local DB
    conn = get_conn()
    local = conn.execute(
        "SELECT symbol, name, sector FROM tickers WHERE symbol LIKE ? OR name LIKE ? LIMIT 10",
        (f"%{q}%", f"%{q}%"),
    ).fetchall()
    conn.close()

    results = [dict(r) for r in local]

    # If few local results, ask the configured market data provider.
    if len(results) < 5:
        try:
            remote = search_tickers(q, limit=10)
            seen = {r["symbol"] for r in results}
            for r in remote:
                if r["symbol"] not in seen:
                    results.append(r)
        except Exception:
            logger.debug("%s ticker search failed for query=%s", provider_name(), q)

    return results


@router.get("/{symbol}/ohlc")
def get_ohlc(
    symbol: str,
    start: Optional[str] = None,
    end: Optional[str] = None,
):
    """Get OHLC data for a symbol."""
    normalized_symbol = normalize_symbol(symbol)
    conn = get_conn()

    query = "SELECT * FROM ohlc WHERE symbol = ?"
    params: list = [normalized_symbol]

    if start:
        query += " AND date >= ?"
        params.append(start)
    if end:
        query += " AND date <= ?"
        params.append(end)

    query += " ORDER BY date ASC"
    rows = conn.execute(query, params).fetchall()
    conn.close()

    if not rows:
        raise HTTPException(status_code=404, detail=f"No OHLC data for {normalized_symbol}")

    return [dict(r) for r in rows]


@router.post("")
def add_ticker(req: AddTickerRequest, background_tasks: BackgroundTasks):
    """Add a new ticker and trigger background data fetch."""
    symbol = normalize_symbol(req.symbol)
    metadata = next((item for item in search_tickers(symbol, limit=20) if item["symbol"] == symbol), None)
    conn = get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO tickers (symbol, name, sector) VALUES (?, ?, ?)",
        (
            symbol,
            req.name or (metadata["name"] if metadata else symbol),
            metadata.get("sector") if metadata else None,
        ),
    )
    conn.commit()
    conn.close()

    background_tasks.add_task(_fetch_ticker_data, symbol)
    return {"symbol": symbol, "status": "added", "message": "Data fetch started in background"}


def _fetch_ticker_data(symbol: str):
    """Background task to fetch OHLC and news for a ticker."""
    today = datetime.now(timezone.utc).date()
    start = (today - timedelta(days=2 * 366)).isoformat()
    end = today.isoformat()

    try:
        # Fetch OHLC
        ohlc_rows = fetch_ohlc(symbol, start, end)
        conn = get_conn()
        for row in ohlc_rows:
            conn.execute(
                """INSERT OR IGNORE INTO ohlc
                   (symbol, date, open, high, low, close, volume, vwap, transactions)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    symbol,
                    row["date"],
                    row["open"],
                    row["high"],
                    row["low"],
                    row["close"],
                    row["volume"],
                    row["vwap"],
                    row["transactions"],
                ),
            )
        conn.execute(
            "UPDATE tickers SET last_ohlc_fetch = ? WHERE symbol = ?",
            (end, symbol),
        )
        conn.commit()

        # Fetch news
        import json

        articles = fetch_news(symbol, start, end)
        for art in articles:
            news_id = art.get("id")
            if not news_id:
                continue
            tickers = art.get("tickers") or []
            conn.execute(
                """INSERT OR IGNORE INTO news_raw
                   (id, title, description, publisher, author,
                    published_utc, article_url, amp_url, tickers_json, insights_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    news_id,
                    art.get("title"),
                    art.get("description"),
                    art.get("publisher"),
                    art.get("author"),
                    art.get("published_utc"),
                    art.get("article_url"),
                    art.get("amp_url"),
                    json.dumps(tickers),
                    json.dumps(art.get("insights")) if art.get("insights") else None,
                ),
            )
            for tk in tickers:
                conn.execute(
                    "INSERT OR IGNORE INTO news_ticker (news_id, symbol) VALUES (?, ?)",
                    (news_id, tk),
                )

        conn.execute(
            "UPDATE tickers SET last_news_fetch = ? WHERE symbol = ?",
            (end, symbol),
        )
        conn.commit()
        conn.close()
    except Exception:
        logger.exception("Error fetching data for %s", symbol)
