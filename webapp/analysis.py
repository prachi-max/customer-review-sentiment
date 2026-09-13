"""Shared review-analysis helpers used by every page (dashboard, history,
insights, compare). Keeping this in one place means every page classifies
and summarizes reviews exactly the same way.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.predict import negative_topics, predict_reviews  # noqa: E402

SAMPLE_PATH = ROOT / "data" / "sample_reviews.csv"
SENTIMENT_ORDER = ["positive", "neutral", "negative"]


def load_dataframe(file_storage) -> pd.DataFrame:
    """Read an uploaded CSV, or fall back to the bundled sample data."""
    if file_storage and file_storage.filename:
        raw = file_storage.read()
        return pd.read_csv(io.BytesIO(raw))
    return pd.read_csv(SAMPLE_PATH)


def top_terms(reviews: pd.Series, top_n: int = 10) -> pd.DataFrame:
    """Most common single words / two-word phrases in a set of reviews.
    Same approach as src.predict.negative_topics, generalized to any subset.
    """
    clean_reviews = reviews.dropna().astype(str)
    if clean_reviews.empty:
        return pd.DataFrame(columns=["topic", "count"])
    vectorizer = CountVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1)
    matrix = vectorizer.fit_transform(clean_reviews)
    counts = matrix.sum(axis=0).A1
    terms = vectorizer.get_feature_names_out()
    result = pd.DataFrame({"topic": terms, "count": counts})
    return result.sort_values(["count", "topic"], ascending=[False, True]).head(top_n)


def analyze(data: pd.DataFrame) -> dict:
    """Classify every review in `data` and return every summary a page needs."""
    if "review" not in data.columns:
        raise ValueError("Your CSV must contain a 'review' column.")

    data = data.copy()
    reviews = data["review"].fillna("").astype(str).tolist()
    predictions = predict_reviews(reviews)

    results = data.copy()
    results["sentiment"] = predictions["sentiment"].values
    results["confidence"] = predictions["confidence"].values

    counts = results["sentiment"].value_counts()
    total = int(counts.sum()) or 1
    counts_out = {label: int(counts.get(label, 0)) for label in SENTIMENT_ORDER}
    percent_out = {label: round(counts_out[label] / total * 100, 1) for label in SENTIMENT_ORDER}

    negative_reviews = results.loc[results["sentiment"] == "negative", "review"]
    topics_out = negative_topics(negative_reviews).to_dict(orient="records")

    product_out = None
    if "product" in results.columns:
        crosstab = pd.crosstab(results["product"], results["sentiment"], normalize="index") * 100
        for label in SENTIMENT_ORDER:
            if label not in crosstab.columns:
                crosstab[label] = 0.0
        crosstab = crosstab[SENTIMENT_ORDER].round(1)
        product_out = [
            {"product": product, **{label: float(row[label]) for label in SENTIMENT_ORDER}}
            for product, row in crosstab.iterrows()
        ]

    display_cols = [c for c in results.columns if c not in ("sentiment", "confidence")]
    rows_out = [
        {
            **{c: ("" if pd.isna(r[c]) else r[c]) for c in display_cols},
            "sentiment": r["sentiment"],
            "confidence": float(r["confidence"]),
        }
        for _, r in results.iterrows()
    ]

    return {
        "total": int(total),
        "counts": counts_out,
        "percent": percent_out,
        "negative_topics": topics_out,
        "product_sentiment": product_out,
        "rows": rows_out,
        "columns": display_cols,
        "_results_df": results,  # internal use only (insights) - stripped before jsonify
    }


def insights_from_results(results: pd.DataFrame, top_n: int = 24) -> dict:
    """Positive vs. negative keyword lists, plus a combined word cloud with
    each word colored by which sentiment it leans toward.
    """
    pos_terms = top_terms(results.loc[results["sentiment"] == "positive", "review"], top_n).to_dict(orient="records")
    neg_terms = top_terms(results.loc[results["sentiment"] == "negative", "review"], top_n).to_dict(orient="records")

    # Word cloud: unigram counts split by how often each word shows up in
    # positive vs. negative reviews, so a word can be colored by its lean
    # even though the cloud itself mixes every review together.
    clean_all = results["review"].dropna().astype(str)
    cloud_words: list[dict] = []
    if not clean_all.empty:
        vectorizer = CountVectorizer(stop_words="english", ngram_range=(1, 1), min_df=1)
        matrix = vectorizer.fit_transform(clean_all)
        terms = vectorizer.get_feature_names_out()
        total_counts = matrix.sum(axis=0).A1

        pos_mask = (results["sentiment"] == "positive").values
        neg_mask = (results["sentiment"] == "negative").values
        pos_counts = matrix[pos_mask].sum(axis=0).A1 if pos_mask.any() else [0] * len(terms)
        neg_counts = matrix[neg_mask].sum(axis=0).A1 if neg_mask.any() else [0] * len(terms)

        order = total_counts.argsort()[::-1][:top_n * 2]
        for i in order:
            p, n = int(pos_counts[i]), int(neg_counts[i])
            if p > n:
                lean = "positive"
            elif n > p:
                lean = "negative"
            else:
                lean = "neutral"
            cloud_words.append({"word": terms[i], "count": int(total_counts[i]), "lean": lean})

    return {"positive_terms": pos_terms, "negative_terms": neg_terms, "cloud": cloud_words}
