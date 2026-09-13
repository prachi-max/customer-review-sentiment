"""Flask frontend for the Customer Review Sentiment project.

Run with:
    python -m webapp.app
from the project root (after training the model with `python -m src.train`,
or from the Settings page in the browser).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.predict import predict_reviews  # noqa: E402
from webapp import model_info, store  # noqa: E402
from webapp.analysis import analyze, insights_from_results, load_dataframe  # noqa: E402
from webapp.icons import icon_svg  # noqa: E402

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8 MB upload cap
app.jinja_env.globals["icon"] = icon_svg

store.init_db()

MODEL_NOT_TRAINED = {
    "error": "model_not_trained",
    "message": "Model is not trained yet. Run `python -m src.train` from the project root (or use the Settings page), then reload.",
}


def _public(result: dict) -> dict:
    """Strip internal-only keys before a result goes to jsonify or storage."""
    return {k: v for k, v in result.items() if not k.startswith("_")}


# ---------------------------------------------------------------- pages ----

@app.route("/")
def dashboard():
    return render_template("dashboard.html", active_page="dashboard")


@app.route("/history")
def history_page():
    return render_template("history.html", active_page="history")


@app.route("/history/<int:analysis_id>")
def history_detail(analysis_id: int):
    analysis = store.get_analysis(analysis_id)
    if analysis is None:
        abort(404)
    return render_template(
        "history_detail.html",
        active_page="history",
        analysis=analysis,
        analysis_json=json.dumps(analysis),
    )


@app.route("/insights")
def insights_page():
    return render_template("insights.html", active_page="insights")


@app.route("/compare")
def compare_page():
    return render_template("compare.html", active_page="compare")


@app.route("/settings")
def settings_page():
    return render_template("settings.html", active_page="settings")


# ------------------------------------------------------------- core api ----

@app.route("/api/analyze", methods=["POST"])
def api_analyze():
    file_storage = request.files.get("file")
    try:
        data = load_dataframe(file_storage)
        result = _public(analyze(data))
    except FileNotFoundError:
        return jsonify(MODEL_NOT_TRAINED), 503
    except ValueError as exc:
        return jsonify({"error": "bad_request", "message": str(exc)}), 400
    except Exception as exc:  # pragma: no cover - defensive
        return jsonify({"error": "server_error", "message": str(exc)}), 500

    result["used_sample"] = not bool(file_storage and file_storage.filename)
    return jsonify(result)


@app.route("/api/predict_live", methods=["POST"])
def api_predict_live():
    payload = request.get_json(silent=True) or {}
    review = str(payload.get("review", "")).strip()
    if len(review) < 3:
        return jsonify({"error": "bad_request", "message": "Type at least a few words."}), 400
    try:
        prediction = predict_reviews([review]).iloc[0]
    except FileNotFoundError:
        return jsonify(MODEL_NOT_TRAINED), 503
    return jsonify({"sentiment": str(prediction["sentiment"]), "confidence": float(prediction["confidence"])})


@app.route("/api/model_status")
def api_model_status():
    return jsonify(model_info.status())


# ---------------------------------------------------------------- history ----

@app.route("/api/history/save", methods=["POST"])
def api_history_save():
    payload = request.get_json(silent=True) or {}
    source = str(payload.get("source") or "uploaded file")[:200]
    result = payload.get("result")
    if not isinstance(result, dict) or "counts" not in result:
        return jsonify({"error": "bad_request", "message": "Nothing to save yet - analyze some reviews first."}), 400
    try:
        analysis_id = store.save_analysis(source, result)
    except Exception as exc:  # pragma: no cover - defensive
        return jsonify({"error": "server_error", "message": str(exc)}), 500
    return jsonify({"id": analysis_id})


@app.route("/api/history/list")
def api_history_list():
    return jsonify(store.list_analyses())


@app.route("/api/history/<int:analysis_id>/delete", methods=["POST"])
def api_history_delete(analysis_id: int):
    ok = store.delete_analysis(analysis_id)
    if not ok:
        return jsonify({"error": "not_found", "message": "Already gone."}), 404
    return jsonify({"deleted": True})


@app.route("/api/history/recent")
def api_history_recent():
    """A few reviews from the most recently saved analysis, for the
    Dashboard's "Recent reviews" widget. Real data pulled straight from the
    History store - no synthetic rows or per-row timestamps.
    """
    items = store.list_analyses()
    if not items:
        return jsonify({"analysis": None, "rows": []})
    latest = store.get_analysis(items[0]["id"])
    if latest is None:
        return jsonify({"analysis": None, "rows": []})
    rows = latest.get("rows", [])[:5]
    return jsonify({
        "analysis": {
            "id": latest["id"],
            "source": latest["source"],
            "created_at": latest["created_at"],
            "total": latest["total"],
        },
        "rows": rows,
    })


# --------------------------------------------------------------- insights ----

@app.route("/api/insights", methods=["POST"])
def api_insights():
    file_storage = request.files.get("file")
    try:
        data = load_dataframe(file_storage)
        result = analyze(data)
    except FileNotFoundError:
        return jsonify(MODEL_NOT_TRAINED), 503
    except ValueError as exc:
        return jsonify({"error": "bad_request", "message": str(exc)}), 400
    except Exception as exc:  # pragma: no cover - defensive
        return jsonify({"error": "server_error", "message": str(exc)}), 500

    insights = insights_from_results(result["_results_df"])
    return jsonify(insights)


# ---------------------------------------------------------------- compare ----

@app.route("/api/compare", methods=["POST"])
def api_compare():
    file_a = request.files.get("file_a")
    file_b = request.files.get("file_b")
    try:
        data_a = load_dataframe(file_a)
        data_b = load_dataframe(file_b)
        result_a = _public(analyze(data_a))
        result_b = _public(analyze(data_b))
    except FileNotFoundError:
        return jsonify(MODEL_NOT_TRAINED), 503
    except ValueError as exc:
        return jsonify({"error": "bad_request", "message": str(exc)}), 400
    except Exception as exc:  # pragma: no cover - defensive
        return jsonify({"error": "server_error", "message": str(exc)}), 500

    result_a["label"] = file_a.filename if (file_a and file_a.filename) else "Sample data (A)"
    result_b["label"] = file_b.filename if (file_b and file_b.filename) else "Sample data (B)"
    return jsonify({"a": result_a, "b": result_b})


# ---------------------------------------------------------------- settings ----

@app.route("/api/train", methods=["POST"])
def api_train():
    use_sample = request.form.get("use_sample", "true").lower() != "false"
    file_storage = request.files.get("file")
    try:
        metrics = model_info.retrain(file_storage, use_sample)
    except ValueError as exc:
        return jsonify({"error": "bad_request", "message": str(exc)}), 400
    except Exception as exc:  # pragma: no cover - defensive
        return jsonify({"error": "server_error", "message": str(exc)}), 500
    return jsonify(metrics)


if __name__ == "__main__":
    app.run(debug=True, port=5050)
