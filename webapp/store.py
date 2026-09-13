"""Small SQLite-backed store for the History page. No ORM, just sqlite3 -
same lightweight approach as everywhere else in this project.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "webapp" / "history.db"

MAX_STORED_ROWS = 5000  # keep the DB file small even for a big upload


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                source TEXT NOT NULL,
                total INTEGER NOT NULL,
                counts_json TEXT NOT NULL,
                percent_json TEXT NOT NULL,
                topics_json TEXT NOT NULL,
                product_json TEXT,
                columns_json TEXT NOT NULL,
                rows_json TEXT NOT NULL,
                rows_truncated INTEGER NOT NULL DEFAULT 0
            )
            """
        )


def save_analysis(source: str, result: dict) -> int:
    rows = result.get("rows", [])
    truncated = len(rows) > MAX_STORED_ROWS
    stored_rows = rows[:MAX_STORED_ROWS]

    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO analyses
                (created_at, source, total, counts_json, percent_json, topics_json,
                 product_json, columns_json, rows_json, rows_truncated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
                source,
                result["total"],
                json.dumps(result["counts"]),
                json.dumps(result["percent"]),
                json.dumps(result["negative_topics"]),
                json.dumps(result["product_sentiment"]) if result.get("product_sentiment") else None,
                json.dumps(result["columns"]),
                json.dumps(stored_rows),
                int(truncated),
            ),
        )
        return int(cur.lastrowid)


def list_analyses() -> list[dict]:
    with _connect() as conn:
        cur = conn.execute(
            "SELECT id, created_at, source, total, counts_json, percent_json FROM analyses ORDER BY id DESC"
        )
        out = []
        for row in cur.fetchall():
            counts = json.loads(row["counts_json"])
            percent = json.loads(row["percent_json"])
            out.append({
                "id": row["id"],
                "created_at": row["created_at"],
                "source": row["source"],
                "total": row["total"],
                "counts": counts,
                "percent": percent,
            })
        return out


def get_analysis(analysis_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "created_at": row["created_at"],
            "source": row["source"],
            "total": row["total"],
            "counts": json.loads(row["counts_json"]),
            "percent": json.loads(row["percent_json"]),
            "negative_topics": json.loads(row["topics_json"]),
            "product_sentiment": json.loads(row["product_json"]) if row["product_json"] else None,
            "columns": json.loads(row["columns_json"]),
            "rows": json.loads(row["rows_json"]),
            "rows_truncated": bool(row["rows_truncated"]),
        }


def delete_analysis(analysis_id: int) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM analyses WHERE id = ?", (analysis_id,))
        return cur.rowcount > 0
