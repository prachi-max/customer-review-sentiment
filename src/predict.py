"""Prediction and analytics helpers shared by the API and dashboard."""
from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer

DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "sentiment_pipeline.joblib"


def load_model(model_path: str | Path = DEFAULT_MODEL_PATH):
    path = Path(model_path)
    if not path.exists():
        raise FileNotFoundError(f"Model not found at {path}. Run `python -m src.train` first.")
    return joblib.load(path)


def predict_reviews(reviews: list[str], model_path: str | Path = DEFAULT_MODEL_PATH) -> pd.DataFrame:
    model = load_model(model_path)
    probabilities = model.predict_proba(reviews)
    labels = model.classes_[probabilities.argmax(axis=1)]
    return pd.DataFrame({"review": reviews, "sentiment": labels, "confidence": probabilities.max(axis=1).round(4)})


def negative_topics(reviews: pd.Series, top_n: int = 10) -> pd.DataFrame:
    clean_reviews = reviews.dropna().astype(str)
    if clean_reviews.empty:
        return pd.DataFrame(columns=["topic", "count"])
    vectorizer = CountVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1)
    matrix = vectorizer.fit_transform(clean_reviews)
    counts = matrix.sum(axis=0).A1
    terms = vectorizer.get_feature_names_out()
    result = pd.DataFrame({"topic": terms, "count": counts})
    return result.sort_values(["count", "topic"], ascending=[False, True]).head(top_n)
