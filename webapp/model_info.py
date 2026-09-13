"""Model status + retraining, for the Settings page."""
from __future__ import annotations

import io
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.predict import DEFAULT_MODEL_PATH  # noqa: E402
from src.train import train_model  # noqa: E402

METRICS_PATH = ROOT / "models" / "metrics.json"


def _read_metrics() -> dict | None:
    if not METRICS_PATH.exists():
        return None
    try:
        return json.loads(METRICS_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def _write_metrics(metrics: dict) -> None:
    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2))


def status() -> dict:
    exists = DEFAULT_MODEL_PATH.exists()
    out = {
        "model_exists": exists,
        "model_path": str(DEFAULT_MODEL_PATH),
        "size_bytes": DEFAULT_MODEL_PATH.stat().st_size if exists else None,
        "trained_at": None,
        "accuracy": None,
        "rows_trained_on": None,
        "data_source": None,
    }
    if exists:
        out["trained_at"] = datetime.fromtimestamp(
            DEFAULT_MODEL_PATH.stat().st_mtime, tz=timezone.utc
        ).isoformat(timespec="seconds")
    metrics = _read_metrics()
    if metrics:
        out["accuracy"] = metrics.get("accuracy")
        out["rows_trained_on"] = metrics.get("rows_trained_on")
        out["data_source"] = metrics.get("data_source")
        # Prefer the recorded training time over the file mtime when we have it.
        out["trained_at"] = metrics.get("trained_at", out["trained_at"])
    return out


def retrain(file_storage, use_sample: bool) -> dict:
    """Train from an uploaded (review, sentiment) CSV, or the bundled sample."""
    if use_sample or not (file_storage and file_storage.filename):
        data_path = ROOT / "data" / "sample_reviews.csv"
        source_name = "sample_reviews.csv"
        row_count = len(pd.read_csv(data_path))
        metrics = train_model(data_path, DEFAULT_MODEL_PATH)
    else:
        raw = file_storage.read()
        df = pd.read_csv(io.BytesIO(raw))
        missing = {"review", "sentiment"} - set(df.columns)
        if missing:
            raise ValueError(f"Training CSV is missing required columns: {', '.join(sorted(missing))}")
        source_name = file_storage.filename
        row_count = len(df)
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
            df.to_csv(tmp.name, index=False)
            tmp_path = tmp.name
        try:
            metrics = train_model(tmp_path, DEFAULT_MODEL_PATH)
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    record = {
        "accuracy": round(float(metrics["accuracy"]), 4),
        "rows_trained_on": int(row_count),
        "data_source": source_name,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    _write_metrics(record)
    return record
