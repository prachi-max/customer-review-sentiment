"""Text normalization utilities."""
from __future__ import annotations

import re


def clean_text(text: object) -> str:
    """Normalize user-provided review text while preserving word boundaries."""
    if text is None:
        return ""
    normalized = str(text).lower()
    normalized = re.sub(r"https?://\S+|www\.\S+", " ", normalized)
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized
