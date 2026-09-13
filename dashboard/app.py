from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.predict import negative_topics, predict_reviews

st.set_page_config(page_title="Review Sentiment Dashboard", page_icon="💬", layout="wide")
st.title("💬 Customer Review Sentiment Dashboard")
st.caption("Classify customer feedback and discover recurring issues.")

sample_path = ROOT / "data" / "sample_reviews.csv"
uploaded = st.file_uploader("Upload reviews CSV", type="csv")
data = pd.read_csv(uploaded) if uploaded else pd.read_csv(sample_path)
if "review" not in data.columns:
    st.error("Your CSV must contain a `review` column.")
    st.stop()

try:
    predictions = predict_reviews(data["review"].fillna("").astype(str).tolist())
except FileNotFoundError:
    st.warning("Model is not trained yet. Run `python -m src.train` from the project root, then reload.")
    st.stop()

results = data.copy()
results[["sentiment", "confidence"]] = predictions[["sentiment", "confidence"]]
counts = results["sentiment"].value_counts()
columns = st.columns(3)
for column, label in zip(columns, ["positive", "neutral", "negative"]):
    column.metric(label.title(), int(counts.get(label, 0)))

left, right = st.columns(2)
with left:
    st.subheader("Sentiment distribution")
    st.bar_chart(counts)
with right:
    st.subheader("Most common negative topics")
    negative = results.loc[results["sentiment"] == "negative", "review"]
    topics = negative_topics(negative)
    st.dataframe(topics, use_container_width=True, hide_index=True)

if "product" in results.columns:
    st.subheader("Product-wise sentiment")
    comparison = pd.crosstab(results["product"], results["sentiment"], normalize="index").round(2)
    st.bar_chart(comparison)

st.subheader("Try a live prediction")
review = st.text_input("Review text", placeholder="The delivery was fast and the build quality feels premium.")
if review:
    live = predict_reviews([review]).iloc[0]
    st.success(f"{live.sentiment.title()} ({live.confidence:.0%} confidence)")

st.subheader("Review-level results")
st.dataframe(results, use_container_width=True, hide_index=True)
