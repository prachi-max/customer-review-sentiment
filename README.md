# Real-Time Customer Review Sentiment Analysis

An end-to-end NLP project that classifies product reviews as **positive**, **negative**, or **neutral**. It includes model training, a FastAPI prediction service, and a Streamlit analytics dashboard.

## Features

- Text cleaning and TF-IDF feature extraction
- Logistic Regression sentiment classifier
- Single-review and batch predictions
- Negative-topic extraction using n-grams
- Product-level sentiment comparison
- REST API with interactive Swagger documentation
- Flask dashboard (recommended) for upload, analytics, and live predictions
- Streamlit dashboard (still included) as an alternative
- Automated tests

## Project structure

```text
customer-review-sentiment/
├── app/                 # FastAPI service
├── dashboard/           # Streamlit dashboard (original)
├── webapp/              # Flask dashboard (recommended UI)
├── data/                # Sample labeled review data
├── models/              # Created by training (ignored by Git)
├── src/                 # Reusable NLP, training, and prediction code
├── tests/               # Pytest suite
├── requirements.txt
└── README.md
```

## Setup

Requires Python 3.10+.

```bash
python -m venv .venv
# Windows
.venv\\Scripts\\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## Train the model

```bash
python -m src.train --data data/sample_reviews.csv --model-out models/sentiment_pipeline.joblib
```

The command prints accuracy and classification metrics, then saves the full preprocessing/model pipeline.

## Run the FastAPI backend

```bash
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` for the API documentation.

Example request:

```bash
curl -X POST http://127.0.0.1:8000/predict -H "Content-Type: application/json" -d "{\"review\": \"The battery life is excellent\"}"
```

## Run the dashboard (Flask - recommended)

In a second terminal, from the project root:

```bash
python -m webapp.app
```

Open `http://127.0.0.1:5050`. Upload a CSV containing `review` and optionally `product` columns, or click Analyze to use the included sample data. Charts are bundled locally (`webapp/static/vendor/chart.umd.js`), so this page works even with no internet connection.

It's a multi-page app:

- **Dashboard** &mdash; upload/analyze, sentiment breakdown, charts, live prediction, "Save to History"
- **History** &mdash; every analysis you saved, browsable later (stored in `webapp/history.db`, a local SQLite file, ignored by Git)
- **Insights** &mdash; top keywords in positive vs. negative reviews, plus a word cloud
- **Compare** &mdash; upload two files (e.g. this month vs. last month) and see sentiment shift side by side
- **Settings** &mdash; model status (when trained, accuracy, row count) and a Retrain button, no command line needed

## Run the dashboard (Streamlit - original)

In a second terminal:

```bash
streamlit run dashboard/app.py
```

Upload a CSV containing `review` and optionally `product` columns. The dashboard can also use the included sample data.

## CSV format

Training data requires `review` and `sentiment` columns. `product` is optional.

```csv
product,review,sentiment
Wireless Earbuds,The sound is clear and battery lasts all day,positive
Wireless Earbuds,The left earbud stopped working,negative
```

## Test

```bash
pytest
```

## Notes

This is a demonstration model trained on a deliberately small sample dataset. For production, use a larger representative dataset, monitor model drift, version artifacts, and add authentication/rate limiting to the API.
