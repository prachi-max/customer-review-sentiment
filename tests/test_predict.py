import pandas as pd

from src.predict import negative_topics


def test_negative_topics_returns_ranked_frame():
    topics = negative_topics(pd.Series(["battery is bad", "bad battery life", "battery failed"]))
    assert list(topics.columns) == ["topic", "count"]
    assert topics.iloc[0]["topic"] == "battery"
    assert topics.iloc[0]["count"] == 3
