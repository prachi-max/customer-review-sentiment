from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from src.predict import predict_reviews

app = FastAPI(title="Customer Review Sentiment API", version="1.0.0")


class PredictionRequest(BaseModel):
    review: str = Field(min_length=3, examples=["The product quality is excellent."])


class PredictionResponse(BaseModel):
    sentiment: str
    confidence: float


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest) -> PredictionResponse:
    try:
        result = predict_reviews([payload.review]).iloc[0]
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return PredictionResponse(sentiment=str(result.sentiment), confidence=float(result.confidence))
