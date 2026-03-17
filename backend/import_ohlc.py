from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from pathlib import Path

from backend.database import get_conn, init_db

REQUIRED_FIELDS = {"symbol", "date", "open", "high", "low", "close", "volume"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import OHLC CSV files into the local SQLite database.")
    parser.add_argument("paths", nargs="+", help="CSV files or directories containing CSV files")
    return parser.parse_args()


def iter_csv_files(paths: list[str]) -> list[Path]:
    files: list[Path] = []
    for raw_path in paths:
        path = Path(raw_path)
        if path.is_dir():
            files.extend(sorted(path.glob("*.csv")))
        elif path.suffix.lower() == ".csv":
            files.append(path)
    return files


def import_file(path: Path) -> dict[str, int]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise RuntimeError(f"{path} has no header row")

        fieldnames = {name.strip() for name in reader.fieldnames}
        missing = REQUIRED_FIELDS - fieldnames
        if missing:
            raise RuntimeError(f"{path} missing required columns: {sorted(missing)}")

        conn = get_conn()
        inserted_rows = 0
        ticker_meta: dict[str, dict[str, str | None]] = {}

        for row in reader:
            symbol = row["symbol"].strip().upper()
            ticker_meta.setdefault(
                symbol,
                {
                    "name": (row.get("name") or "").strip() or None,
                    "sector": (row.get("sector") or "").strip() or None,
                },
            )
            conn.execute(
                """INSERT OR IGNORE INTO ohlc
                   (symbol, date, open, high, low, close, volume, vwap, transactions)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    symbol,
                    row["date"].strip(),
                    float(row["open"]),
                    float(row["high"]),
                    float(row["low"]),
                    float(row["close"]),
                    float(row["volume"]),
                    float(row["vwap"]) if row.get("vwap") else None,
                    int(float(row["transactions"])) if row.get("transactions") else None,
                ),
            )
            inserted_rows += 1

        for symbol, meta in ticker_meta.items():
            conn.execute(
                """INSERT INTO tickers (symbol, name, sector, last_ohlc_fetch)
                   VALUES (?, ?, ?, (SELECT MAX(date) FROM ohlc WHERE symbol = ?))
                   ON CONFLICT(symbol) DO UPDATE SET
                     name = COALESCE(excluded.name, tickers.name),
                     sector = COALESCE(excluded.sector, tickers.sector),
                     last_ohlc_fetch = (SELECT MAX(date) FROM ohlc WHERE symbol = excluded.symbol)""",
                (symbol, meta["name"] or symbol, meta["sector"], symbol),
            )

        conn.commit()
        ticker_count = len(ticker_meta)
        conn.close()
        return {"rows": inserted_rows, "tickers": ticker_count}


def main() -> None:
    args = parse_args()
    init_db()

    files = iter_csv_files(args.paths)
    if not files:
        raise SystemExit("No CSV files found")

    totals = defaultdict(int)
    for path in files:
        stats = import_file(path)
        totals["files"] += 1
        totals["rows"] += stats["rows"]
        totals["tickers"] += stats["tickers"]
        print(f"Imported {path}: {stats['rows']} rows across {stats['tickers']} tickers")

    print(
        f"Done. Imported {totals['files']} files, "
        f"{totals['rows']} OHLC rows, {totals['tickers']} ticker batches."
    )


if __name__ == "__main__":
    main()
