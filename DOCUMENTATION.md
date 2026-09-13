# Customer Review Sentiment — Full Documentation

This document explains the whole project in plain language: what it does, every tool it
uses and why, how data flows from a CSV file to a colored chart on screen, and what each
file in the project is responsible for.

---

## 1. What this project does

You give it customer reviews (text like *"The battery life is excellent"*). It tells you,
for each review, whether it is:

- **Positive** — happy customer
- **Neutral** — no strong opinion
- **Negative** — unhappy customer

It also finds patterns across many reviews at once: what people complain about most, how
sentiment differs between products, whether it's improving or getting worse over time.

There is no external AI service involved (no OpenAI, no Anthropic, no internet call to
classify text). The classifier is a small model trained on your own data, and it runs
entirely on your computer.

---

## 2. The three ways to use it

The project ships three separate front ends. They all use the exact same trained model
underneath — pick whichever one suits you.

| # | Name | What it is | Run with | Best for |
|---|------|-----------|----------|----------|
| 1 | **Flask dashboard** (`webapp/`) | A 5-page website (Dashboard, History, Insights, Compare, Settings) | `python -m webapp.app` | Everyday use — this is the recommended one |
| 2 | **Streamlit dashboard** (`dashboard/`) | A single-page analytics screen, the original prototype | `streamlit run dashboard/app.py` | Quick one-off look, kept for comparison |
| 3 | **FastAPI service** (`app/`) | A JSON API with no visual screen, just `/predict` | `uvicorn app.main:app --reload` | Plugging sentiment analysis into some *other* program you write |

You can run more than one at the same time (they use different ports) — they all read the
same model file from `models/sentiment_pipeline.joblib`.

---

## 3. Tools used, and why each one is there

### Language & runtime

- **Python 3.10+** — the whole project (model, both dashboards, the API) is Python. One
  language for everything means one thing to install, and pandas/scikit-learn (below) are
  Python-only, best-in-class libraries for exactly this kind of work.

### Machine learning

- **scikit-learn** — does the actual "read text, guess sentiment" work. Two pieces of it
  matter here:
  - `TfidfVectorizer` — turns each review's words into numbers a computer can do math on.
    "TF-IDF" stands for *Term Frequency – Inverse Document Frequency*: a word that appears
    a lot in one review but rarely elsewhere (like "leaking" in a complaint) gets weighted
    as more important than a word that appears everywhere (like "the").
  - `LogisticRegression` — the actual classifier. Given a review's TF-IDF numbers, it
    predicts positive/neutral/negative plus a confidence score. It was chosen (over a
    bigger neural network) because it trains in under a second, needs very little data,
    and is easy to explain — appropriate for a small labeled dataset like `sample_reviews.csv`.
  - `CountVectorizer` — used differently, not for prediction: it just counts which words
    and two-word phrases show up most often in a set of reviews. This is what powers
    "Most common negative topics" and the Insights page.
- **pandas** — reads and reshapes the CSV files (spreadsheets) throughout the project:
  loading reviews, grouping by product, building the tables you see on screen.
- **joblib** — saves the trained model to a single file
  (`models/sentiment_pipeline.joblib`) after training, and loads it back instantly on
  every prediction afterward, so the model only needs to be trained once, not every time
  someone uses the site.

### The three front ends

- **Flask** — the framework behind the new multi-page dashboard (`webapp/`). It's a
  lightweight Python web framework: you write a Python function per page/URL, and it
  returns HTML or JSON. Chosen because it gives full control over the page's look
  (matches your CDR dashboard's style) and is simple to run locally with no extra
  infrastructure.
- **Streamlit** — the framework behind the original `dashboard/app.py`. It turns a short
  Python script directly into a web page, with no HTML/CSS/JavaScript needed. Fast to
  build, but less control over exact appearance — kept in the project as the original,
  simpler alternative.
- **FastAPI** + **Uvicorn** — FastAPI defines the `/predict` JSON endpoint;
  Uvicorn is the actual program that runs it and listens for requests. FastAPI
  auto-generates the interactive documentation page at `/docs`, useful if another
  developer wants to call this project's model from their own code.

### Inside the Flask dashboard specifically

- **SQLite** (via Python's built-in `sqlite3` — no separate install) — a single-file
  database, used only by the **History** page, to remember every analysis you chose to
  save. It lives at `webapp/history.db` and is created automatically the first time you
  save something.
- **Chart.js** — draws the donut chart, the bar charts, and the compare chart. A copy of
  it is bundled directly inside the project (`webapp/static/vendor/chart.umd.js`) instead
  of being loaded from the internet, so the dashboard's charts still work with no internet
  connection.
- **IBM Plex Sans / IBM Plex Mono** (Google Fonts) — the typeface. Loaded from Google's
  font service; if there's no internet connection when the page loads, the browser falls
  back to its normal system font automatically — nothing breaks, it just looks slightly
  different.
- **Jinja2** (comes bundled with Flask) — the templating language used to build the HTML
  pages (`webapp/templates/*.html`). It lets one shared layout (`base.html` — the sidebar
  and page frame) be reused by every page, with only the middle part changing.
- **Vanilla JavaScript** (no React/Vue/jQuery) — every page's interactivity (uploading a
  file, clicking Analyze, filtering the table) is plain JavaScript talking to the Flask
  server via `fetch()`. Chosen to keep the project dependency-free and easy to read/edit.

### Testing

- **pytest** — runs the automated checks in `tests/`, which confirm the text-cleaning and
  topic-extraction functions behave correctly. Run it with `pytest` from the project root.

---

## 4. How a review becomes "positive/neutral/negative" — the full pipeline

```
                    ┌─────────────────────────┐
  Training          │  data/sample_reviews.csv │   <- reviews you (or the sample) already
  (happens once,    │  review, sentiment,       │      know the correct answer for
  or whenever you    │  product columns          │
  click Retrain)     └────────────┬─────────────┘
                                   │
                                   ▼
                     src/train.py : build_pipeline()
                     1. clean_text()      (src/preprocessing.py)
                     2. TfidfVectorizer   (turn words into numbers)
                     3. LogisticRegression (learn the pattern)
                                   │
                                   ▼
                 models/sentiment_pipeline.joblib   <- the saved, trained model
                                   │
   ┌───────────────────────────────┼───────────────────────────────┐
   │                                │                                │
   ▼                                ▼                                ▼
Flask dashboard              Streamlit dashboard                FastAPI /predict
(webapp/)                    (dashboard/app.py)                 (app/main.py)
   │                                │                                │
   └── src/predict.py : predict_reviews() loads the .joblib file and
       runs new, never-before-seen reviews through it
```

**In words:**

1. `src/train.py` reads a CSV that already has a `sentiment` column filled in (the sample
   data, or a file you upload on the Settings page). It cleans the text, converts it to
   TF-IDF numbers, and fits a Logistic Regression model on 75% of the rows, testing itself
   on the remaining 25% to report an accuracy score. The finished model is saved to
   `models/sentiment_pipeline.joblib`.
2. From then on, whenever any of the three front ends needs to classify a review, it calls
   `predict_reviews()` in `src/predict.py`, which loads that saved file and asks it "what's
   the sentiment of this text?" This is instant — no retraining happens on every request.
3. `models/metrics.json` is a small side-file the Flask app writes each time you retrain
   from the Settings page, recording the accuracy, how many rows were used, and when — so
   the Settings page can show that information back to you later.

---

## 5. The Flask dashboard — how each page works

All 5 pages share one sidebar/layout (`webapp/templates/base.html`) and one small helper
script (`webapp/static/common.js`) for the toast pop-ups and the "Model loaded" light in
the sidebar footer. Every page follows the same pattern: a page loads instantly with empty
placeholders, then JavaScript calls a Flask endpoint (an "API") in the background and fills
the page in once the answer comes back — so the page never fully freezes while it works.

### Dashboard (`/`)

The main screen. You upload a CSV (or leave it blank to use the bundled sample), click
**Analyze**, and the browser sends that file to `POST /api/analyze`. On the server,
`webapp/analysis.py`'s `analyze()` function:

1. Classifies every review with `predict_reviews()`.
2. Counts how many are positive/neutral/negative, and what percent of the total each is.
3. Finds the most common words/phrases in the negative ones (`negative_topics()`).
4. If there's a `product` column, works out the sentiment split per product.
5. Sends all of that back as JSON, which the page turns into the stat cards, the donut
   chart, the topics list, the product bar chart, and the results table.

Clicking **Save to History** sends that same JSON to `POST /api/history/save`, which writes
it into `webapp/history.db`.

The **Try a live prediction** box is separate — it sends just one typed sentence to
`POST /api/predict_live` and shows the single answer, without needing a whole CSV.

### History (`/history` and `/history/<id>`)

The list page calls `GET /api/history/list`, which reads every saved row out of
`webapp/history.db` and shows a summary table (date, source file name, totals, a small
three-color split bar). Clicking a row opens `/history/<id>`, which loads that one saved
analysis's full details from the database and redraws the same charts/table the Dashboard
uses — but read-only, nothing is re-calculated, it's exactly what was saved. The trash-can
icon calls `POST /api/history/<id>/delete`.

### Insights (`/insights`)

Same upload-and-Analyze pattern as the Dashboard, but instead of `/api/analyze` it calls
`POST /api/insights`, which classifies the reviews and then specifically compares word
frequency *inside positive reviews only* against *inside negative reviews only*
(`insights_from_results()` in `webapp/analysis.py`), plus builds the word cloud by counting
every word across all reviews and coloring it green/red/gray depending on which sentiment
it showed up in more often.

### Compare (`/compare`)

Upload two files into File A and File B (either can be left blank to use the sample data).
`POST /api/compare` runs `analyze()` on each one separately and returns both results side
by side, plus the page calculates the percentage-point difference between them (the little
"+12%" / "-4%" pills) and draws a grouped bar chart.

### Settings (`/settings`)

`GET /api/model_status` reports whether a trained model file currently exists, when it was
trained, its accuracy, and how many rows it was trained on (read from `models/metrics.json`
plus the model file's own timestamp/size). The **Retrain Model** button posts to
`POST /api/train`, which calls the *same* `train_model()` function `src/train.py` uses from
the command line — either on the bundled sample data, or on a CSV you upload that must have
`review` and `sentiment` columns filled in.

---

## 6. Every file, what it's for

```text
customer-review-sentiment/
│
├── data/
│   └── sample_reviews.csv        Example reviews used whenever no file is uploaded,
│                                  and to train the model out of the box.
│
├── models/                       Created automatically - not written by hand.
│   ├── sentiment_pipeline.joblib The trained model (TF-IDF + Logistic Regression).
│   └── metrics.json              Accuracy/row-count/date from the last time it was
│                                  trained through the Settings page (or omitted if it
│                                  was only ever trained from the command line).
│
├── src/                          The "brain" - shared by all three front ends.
│   ├── preprocessing.py          clean_text() - lowercases, strips links/punctuation.
│   ├── train.py                  Builds and trains the model, saves it, prints accuracy.
│   └── predict.py                Loads the saved model; predict_reviews() classifies
│                                  new text; negative_topics() finds common complaint words.
│
├── app/                          The FastAPI JSON service (no visual screen).
│   └── main.py                   Defines GET /health and POST /predict.
│
├── dashboard/                    The original Streamlit dashboard.
│   └── app.py                    One script = the whole page (Streamlit's style).
│
├── webapp/                       The Flask dashboard (recommended UI, 5 pages).
│   ├── app.py                    Every URL/route the site responds to (pages + APIs).
│   ├── analysis.py               Shared logic: load a CSV, classify it, summarize it -
│   │                              used by the Dashboard, History-save, Insights, Compare.
│   ├── store.py                  Reads/writes webapp/history.db (the History page's data).
│   ├── model_info.py             Model status + retraining, for the Settings page.
│   ├── history.db                Created automatically the first time you save something.
│   ├── templates/                The HTML for each page (Jinja2 - Python's templating).
│   │   ├── base.html             Shared sidebar + page frame every other page extends.
│   │   ├── dashboard.html
│   │   ├── history.html
│   │   ├── history_detail.html
│   │   ├── insights.html
│   │   ├── compare.html
│   │   └── settings.html
│   └── static/                   CSS, JavaScript, and the bundled chart library.
│       ├── style.css             All visual styling for every page.
│       ├── common.js             Shared helpers: toasts, HTML-escaping, model-status light.
│       ├── dashboard.js          Dashboard page logic.
│       ├── history.js            History list page logic.
│       ├── history_detail.js     History detail page logic.
│       ├── insights.js           Insights page logic.
│       ├── compare.js            Compare page logic.
│       ├── settings.js           Settings page logic.
│       └── vendor/chart.umd.js   Chart.js, bundled locally (works offline).
│
├── tests/                        Automated checks (run with `pytest`).
│   ├── test_preprocessing.py
│   └── test_predict.py
│
├── requirements.txt              Every Python package this project needs, in one place.
├── .gitignore                    Tells Git which generated files not to track
│                                  (the trained model, the history database, caches).
├── README.md                     Quick-start instructions (setup, run, CSV format).
└── DOCUMENTATION.md              This file.
```

---

## 7. API reference (what the front-end JavaScript actually calls)

All of these belong to the Flask dashboard (`webapp/app.py`) and only work while
`python -m webapp.app` is running.

| Method | URL | What it does |
|--------|-----|--------------|
| GET | `/api/model_status` | Is a model trained? When, what accuracy, how many rows. |
| POST | `/api/analyze` | Classify a CSV (or the sample) - the Dashboard's main action. |
| POST | `/api/predict_live` | Classify one typed sentence. |
| POST | `/api/history/save` | Save an already-computed analysis to `history.db`. |
| GET | `/api/history/list` | List every saved analysis (summary only). |
| POST | `/api/history/<id>/delete` | Delete one saved analysis. |
| POST | `/api/insights` | Positive/negative keyword lists + word cloud data. |
| POST | `/api/compare` | Classify two files and return both results, for the Compare page. |
| POST | `/api/train` | Retrain the model (sample data, or an uploaded labeled CSV). |

The separate FastAPI service (`app/main.py`, run with `uvicorn app.main:app`) has its own,
smaller set: `GET /health` and `POST /predict`.

---

## 8. Where things are stored, and what's safe to delete

Everything runs on your own machine — nothing in this project sends data anywhere over the
internet (the only outside network calls are the Google Fonts stylesheet, which is
cosmetic and optional; if it fails to load the page still works with a fallback font).

- `models/sentiment_pipeline.joblib` — the trained model. Delete it and every front end
  will show "model not trained yet" until you retrain (Settings page, or
  `python -m src.train`).
- `models/metrics.json` — just display info for the Settings page. Safe to delete; it will
  simply show blank accuracy/row-count until the next retrain.
- `webapp/history.db` — everything you saved on the History page. Delete it to wipe your
  saved history; a fresh empty one is created automatically next time you save something.
- Nothing else in the project is generated — `src/`, `app/`, `dashboard/`, `webapp/`
  (besides `history.db`), `data/`, and the `.py`/`.html`/`.css`/`.js` files are all source
  code, not data.
