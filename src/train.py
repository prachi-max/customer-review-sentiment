"""Train and persist the sentiment pipeline."""
from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from src.preprocessing import clean_text


def build_pipeline() -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(preprocessor=clean_text, stop_words="english", ngram_range=(1, 2), min_df=1)),
        ("model", LogisticRegression(max_iter=1_000, class_weight="balanced", random_state=42)),
    ])


def train_model(data_path: str | Path, model_path: str | Path) -> dict[str, float]:
    """Train the pipeline from a CSV and save it; return evaluation metrics."""
    data = pd.read_csv(data_path)
    required = {"review", "sentiment"}
    missing = required - set(data.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {', '.join(sorted(missing))}")

    data = data.dropna(subset=["review", "sentiment"]).copy()
    if data["sentiment"].nunique() < 2:
        raise ValueError("Dataset must contain at least two sentiment classes.")

    x_train, x_test, y_train, y_test = train_test_split(
        data["review"], data["sentiment"], test_size=0.25, random_state=42,
        stratify=data["sentiment"],
    )
    pipeline = build_pipeline()
    pipeline.fit(x_train, y_train)
    predictions = pipeline.predict(x_test)
    accuracy = accuracy_score(y_test, predictions)
    print(f"Accuracy: {accuracy:.3f}")
    print(classification_report(y_test, predictions, zero_division=0))

    destination = Path(model_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, destination)
    print(f"Saved model to {destination}")
    return {"accuracy": float(accuracy)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train a customer-review sentiment model.")
    parser.add_argument("--data", default="data/sample_reviews.csv")
    parser.add_argument("--model-out", default="models/sentiment_pipeline.joblib")
    args = parser.parse_args()
    train_model(args.data, args.model_out)
