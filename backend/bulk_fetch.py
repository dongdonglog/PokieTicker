"""Bulk fetch OHLC + news for all tickers missing data."""

import argparse
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, TypeVar

from backend.database import get_conn
from backend.market_data import fetch_news, fetch_ohlc, normalize_symbol, provider_name, search_tickers, seed_tickers, ticker_name
from backend.pipeline.alignment import align_news_for_symbol
from backend.pipeline.layer0 import run_layer0

# 2 years of data
TODAY = datetime.now(timezone.utc).date()
START = (TODAY - timedelta(days=2 * 366)).isoformat()
END = TODAY.isoformat()

# Keep a rolling window so data providers are not hammered during bulk jobs.
REQUEST_TIMES = []
MAX_PER_MIN = 5
SAFETY_SLEEP = 2.0  # extra buffer between calls
DEFAULT_RETRIES = 3
DEFAULT_RETRY_BACKOFF = 8.0
T = TypeVar("T")


def rate_limit():
    """Block until we can make another request within the configured rate limit."""
    global REQUEST_TIMES
    now = time.time()
    # Remove entries older than 60 seconds
    REQUEST_TIMES = [t for t in REQUEST_TIMES if now - t < 60]
    if len(REQUEST_TIMES) >= MAX_PER_MIN:
        wait = 60 - (now - REQUEST_TIMES[0]) + SAFETY_SLEEP
        if wait > 0:
            print(f"    Rate limit: waiting {wait:.1f}s...")
            time.sleep(wait)
    REQUEST_TIMES.append(time.time())


def with_retries(
    label: str,
    fn: Callable[[], T],
    retries: int,
    retry_backoff: float,
) -> T | None:
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except Exception as exc:
            if attempt >= retries:
                print(f"  {label} error: {exc}")
                return None
            wait = retry_backoff * attempt
            print(f"  {label} error (attempt {attempt}/{retries}): {exc}")
            print(f"  Retrying in {wait:.1f}s...")
            time.sleep(wait)
    return None


def fetch_ticker_name(symbol: str) -> str:
    """Fetch company name from the active market data source."""
    try:
        name = ticker_name(symbol)
        if name:
            return name
        matches = search_tickers(symbol, limit=5)
        return matches[0]["name"] if matches else ""
    except Exception as e:
        print(f"  Warning: could not fetch name for {symbol}: {e}")
        return ""


def ensure_seed_tickers() -> int:
    conn = get_conn()
    inserted = 0

    for item in seed_tickers():
        before = conn.total_changes
        conn.execute(
            "INSERT OR IGNORE INTO tickers (symbol, name, sector) VALUES (?, ?, ?)",
            (item["symbol"], item["name"], item.get("sector")),
        )
        if conn.total_changes > before:
            inserted += 1

    conn.commit()
    conn.close()
    return inserted


def fetch_and_store_ohlc(symbol: str) -> int:
    """Fetch OHLC data and store in database. Returns row count."""
    rows = with_retries(
        label=f"OHLC error for {symbol}",
        fn=lambda: _fetch_ohlc_with_rate_limit(symbol),
        retries=DEFAULT_RETRIES,
        retry_backoff=DEFAULT_RETRY_BACKOFF,
    )
    if rows is None:
        return 0

    if not rows:
        return 0

    conn = get_conn()
    for row in rows:
        conn.execute(
            """INSERT OR IGNORE INTO ohlc
               (symbol, date, open, high, low, close, volume, vwap, transactions)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (symbol, row["date"], row["open"], row["high"], row["low"],
             row["close"], row["volume"], row["vwap"], row["transactions"]),
        )
    conn.execute(
        "UPDATE tickers SET last_ohlc_fetch = ? WHERE symbol = ?",
        (END, symbol),
    )
    conn.commit()
    conn.close()
    return len(rows)


def fetch_and_store_news(symbol: str) -> int:
    """Fetch news and store in database. Returns article count."""
    all_articles = with_retries(
        label=f"News error for {symbol}",
        fn=lambda: _fetch_news_with_rate_limit(symbol),
        retries=DEFAULT_RETRIES,
        retry_backoff=DEFAULT_RETRY_BACKOFF,
    )
    if all_articles is None:
        return 0

    if not all_articles:
        return 0

    conn = get_conn()
    for art in all_articles:
        news_id = art.get("id")
        if not news_id:
            continue
        tickers = art.get("tickers") or []
        conn.execute(
            """INSERT OR IGNORE INTO news_raw
               (id, title, description, publisher, author,
                published_utc, article_url, amp_url, tickers_json, insights_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (news_id, art.get("title"), art.get("description"),
             art.get("publisher"), art.get("author"), art.get("published_utc"),
             art.get("article_url"), art.get("amp_url"),
             json.dumps(tickers),
             json.dumps(art.get("insights")) if art.get("insights") else None),
        )
        for tk in tickers:
            conn.execute(
                "INSERT OR IGNORE INTO news_ticker (news_id, symbol) VALUES (?, ?)",
                (news_id, tk),
            )

    conn.execute(
        "UPDATE tickers SET last_news_fetch = ? WHERE symbol = ?",
        (END, symbol),
    )
    conn.commit()
    conn.close()
    return len(all_articles)


def _fetch_ohlc_with_rate_limit(symbol: str):
    rate_limit()
    return fetch_ohlc(symbol, START, END)


def _fetch_news_with_rate_limit(symbol: str):
    rate_limit()
    return fetch_news(symbol, START, END)


def _load_pending_symbols(symbols: list[str] | None, limit: int | None) -> list[str]:
    if symbols:
        return [normalize_symbol(symbol) for symbol in symbols]

    conn = get_conn()
    rows = conn.execute(
        "SELECT symbol FROM tickers WHERE last_ohlc_fetch IS NULL ORDER BY symbol"
    ).fetchall()
    conn.close()

    pending = [r["symbol"] for r in rows]
    if limit is not None:
        pending = pending[:limit]
    return pending


def _write_failures(errors: list[str]) -> None:
    failures_file = Path(f"docs/{provider_name()}-fetch-failures.txt")
    if not errors:
        if failures_file.exists():
            failures_file.unlink()
        return

    failures_file.write_text("\n".join(errors) + "\n")
    print(f"Failure list written to {failures_file}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch OHLC/news into the local SQLite database.")
    parser.add_argument(
        "--symbols",
        help="Comma-separated symbols to fetch, e.g. AAPL,MSFT or 000333.SZ,000858.SZ",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit the number of pending symbols when --symbols is not provided.",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=DEFAULT_RETRIES,
        help="Retry count for OHLC/news fetch failures.",
    )
    parser.add_argument(
        "--retry-backoff",
        type=float,
        default=DEFAULT_RETRY_BACKOFF,
        help="Base retry backoff in seconds.",
    )
    parser.add_argument(
        "--max-per-min",
        type=int,
        default=MAX_PER_MIN,
        help="Maximum fetch calls per minute.",
    )
    parser.add_argument(
        "--skip-news",
        action="store_true",
        help="Skip news fetch and only populate OHLC.",
    )
    return parser.parse_args()


def main():
    global MAX_PER_MIN, DEFAULT_RETRIES, DEFAULT_RETRY_BACKOFF
    args = parse_args()
    MAX_PER_MIN = args.max_per_min
    DEFAULT_RETRIES = args.retries
    DEFAULT_RETRY_BACKOFF = args.retry_backoff

    seeded = ensure_seed_tickers()
    if seeded:
        print(f"Seeded {seeded} tickers from provider={provider_name()}.")

    symbols = [item.strip() for item in args.symbols.split(",")] if args.symbols else None
    pending = _load_pending_symbols(symbols=symbols, limit=args.limit)
    print(f"=== Bulk Fetch: {len(pending)} tickers pending ===")
    print(f"Date range: {START} to {END}")
    print(f"Rate limit: {MAX_PER_MIN} req/min\n")

    total_ohlc = 0
    total_news = 0
    errors = []

    for idx, symbol in enumerate(pending, 1):
        print(f"[{idx}/{len(pending)}] {symbol}")

        # Fetch company name if missing
        conn = get_conn()
        name = conn.execute(
            "SELECT name FROM tickers WHERE symbol = ?", (symbol,)
        ).fetchone()
        conn.close()

        if not name or not name["name"]:
            company_name = fetch_ticker_name(symbol)
            if company_name:
                conn = get_conn()
                conn.execute(
                    "UPDATE tickers SET name = ? WHERE symbol = ?",
                    (company_name, symbol),
                )
                conn.commit()
                conn.close()
                print(f"  Name: {company_name}")

        # Fetch OHLC
        ohlc_count = fetch_and_store_ohlc(symbol)
        print(f"  OHLC: {ohlc_count} rows")
        total_ohlc += ohlc_count

        if ohlc_count == 0:
            print(f"  WARNING: No OHLC data, possibly delisted or invalid ticker")
            errors.append(symbol)
            continue

        # Fetch news
        news_count = 0 if args.skip_news else fetch_and_store_news(symbol)
        print(f"  News: {news_count} articles")
        total_news += news_count

        # Run alignment + layer 0
        try:
            align_news_for_symbol(symbol)
            l0 = run_layer0(symbol)
            passed = l0.get("passed", 0)
            total = l0.get("total", 0)
            print(f"  Layer0: {passed}/{total} passed")
        except Exception as e:
            print(f"  Alignment/Layer0 error: {e}")

        print()

    print(f"\n=== DONE ===")
    print(f"Total OHLC rows: {total_ohlc}")
    print(f"Total news articles: {total_news}")
    _write_failures(errors)
    if errors:
        print(f"Errors ({len(errors)}): {', '.join(errors)}")


if __name__ == "__main__":
    main()
