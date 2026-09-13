from src.preprocessing import clean_text


def test_clean_text_normalizes_url_punctuation_and_case():
    assert clean_text("Great!!! See https://example.com NOW") == "great see now"


def test_clean_text_handles_none():
    assert clean_text(None) == ""
