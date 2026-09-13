(function () {
  "use strict";

  const el = {
    fileInput: document.getElementById("file-input"),
    uploadDrop: document.getElementById("upload-drop"),
    uploadDropText: document.getElementById("upload-drop-text"),
    analyzeBtn: document.getElementById("analyze-btn"),
    clearBtn: document.getElementById("clear-btn"),
    saveHistoryBtn: document.getElementById("save-history-btn"),
    statRow: document.getElementById("stat-row"),
    statPositive: document.getElementById("stat-positive"),
    statNeutral: document.getElementById("stat-neutral"),
    statNegative: document.getElementById("stat-negative"),
    statPositivePct: document.getElementById("stat-positive-pct"),
    statNeutralPct: document.getElementById("stat-neutral-pct"),
    statNegativePct: document.getElementById("stat-negative-pct"),
    issuesNote: document.getElementById("issues-note"),
    chartGrid: document.getElementById("chart-grid"),
    donutTotal: document.getElementById("donut-total"),
    sentimentLegend: document.getElementById("sentiment-legend"),
    topicList: document.getElementById("topic-list"),
    trendPanel: document.getElementById("trend-panel"),
    productPanel: document.getElementById("product-panel"),
    resultsPanel: document.getElementById("results-panel"),
    resultsNote: document.getElementById("results-note"),
    resultsHead: document.getElementById("results-head"),
    resultsBody: document.getElementById("results-body"),
    resultsSearch: document.getElementById("results-search"),
    predictInput: document.getElementById("predict-input"),
    predictBtn: document.getElementById("predict-btn"),
    predictResult: document.getElementById("predict-result"),
    predictBadge: document.getElementById("predict-badge"),
    predictConfidenceFill: document.getElementById("predict-confidence-fill"),
    predictConfidenceText: document.getElementById("predict-confidence-text"),
    recentList: document.getElementById("recent-list"),
    recentNote: document.getElementById("recent-note"),
  };

  const SENTIMENT_ICON = { positive: "\u{1F642}", neutral: "\u{1F610}", negative: "\u{1F61E}" };

  let sentimentChart = null;
  let productChart = null;
  let trendChart = null;
  const sparkCharts = { positive: null, neutral: null, negative: null };
  let allRows = [];
  let allColumns = [];
  let lastResult = null;
  let lastSourceName = null;

  function setBusy(busy) {
    el.analyzeBtn.disabled = busy;
    el.analyzeBtn.innerHTML = busy
      ? "Analyzing&hellip;"
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>Analyze';
  }

  el.fileInput.addEventListener("change", function () {
    const f = el.fileInput.files[0];
    if (f) {
      el.uploadDrop.classList.add("has-file");
      el.uploadDropText.textContent = f.name;
    } else {
      el.uploadDrop.classList.remove("has-file");
      el.uploadDropText.textContent = "Choose CSV… (or use sample data)";
    }
  });

  el.clearBtn.addEventListener("click", function () {
    el.fileInput.value = "";
    el.uploadDrop.classList.remove("has-file");
    el.uploadDropText.textContent = "Choose CSV… (or use sample data)";
  });

  el.analyzeBtn.addEventListener("click", analyze);
  el.resultsSearch.addEventListener("input", function () { renderTable(el.resultsSearch.value); });
  el.predictBtn.addEventListener("click", predictLive);
  el.predictInput.addEventListener("keydown", function (e) { if (e.key === "Enter") predictLive(); });
  el.saveHistoryBtn.addEventListener("click", saveToHistory);

  function analyze() {
    setBusy(true);
    el.issuesNote.style.display = "none";
    el.saveHistoryBtn.disabled = true;

    const formData = new FormData();
    const f = el.fileInput.files[0];
    if (f) formData.append("file", f);

    fetch("/api/analyze", { method: "POST", body: formData })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (r) {
        setBusy(false);
        if (!r.ok) {
          el.issuesNote.textContent = r.body.message || "Something went wrong.";
          el.issuesNote.style.display = "";
          showToast(r.body.message || "Analysis failed", true);
          setModelStatus(r.body.error !== "model_not_trained");
          return;
        }
        setModelStatus(true);
        lastResult = r.body;
        lastSourceName = f ? f.name : "sample_reviews.csv";
        el.saveHistoryBtn.disabled = false;
        el.saveHistoryBtn.title = "Save this analysis to History";
        applyResult(r.body);
        showToast(r.body.used_sample ? "Analyzed sample data (" + r.body.total + " reviews)" : "Analyzed " + r.body.total + " reviews");
      })
      .catch(function (err) {
        setBusy(false);
        el.issuesNote.textContent = "Could not reach the server: " + err;
        el.issuesNote.style.display = "";
        showToast("Network error", true);
      });
  }

  function saveToHistory() {
    if (!lastResult) return;
    el.saveHistoryBtn.disabled = true;
    el.saveHistoryBtn.textContent = "Saving…";
    fetch("/api/history/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: lastSourceName, result: lastResult }),
    })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (r) {
        el.saveHistoryBtn.disabled = false;
        el.saveHistoryBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>Save to History';
        if (!r.ok) {
          showToast(r.body.message || "Could not save", true);
          return;
        }
        showToast("Saved to History");
        loadRecent();
      })
      .catch(function (err) {
        el.saveHistoryBtn.disabled = false;
        showToast("Network error: " + err, true);
      });
  }

  function applyResult(data) {
    el.statRow.style.display = "";
    el.chartGrid.style.display = "";
    el.resultsPanel.style.display = "";

    el.statPositive.textContent = data.counts.positive;
    el.statNeutral.textContent = data.counts.neutral;
    el.statNegative.textContent = data.counts.negative;
    el.statPositivePct.textContent = data.percent.positive + "%";
    el.statNeutralPct.textContent = data.percent.neutral + "%";
    el.statNegativePct.textContent = data.percent.negative + "%";

    try { renderSentimentChart(data.counts, data.total); } catch (err) { console.error("sentiment chart failed:", err); }
    renderTopics(data.negative_topics);

    if (data.product_sentiment && data.product_sentiment.length) {
      el.productPanel.style.display = "";
      try { renderProductChart(data.product_sentiment); } catch (err) { console.error("product chart failed:", err); }
    } else {
      el.productPanel.style.display = "none";
    }

    allRows = data.rows || [];
    allColumns = data.columns || [];
    el.resultsNote.textContent = data.total + " review" + (data.total === 1 ? "" : "s") + " · sorted as uploaded";
    renderTable("");

    try { renderSparklines(allRows); } catch (err) { console.error("sparklines failed:", err); }
    try { renderTrendChart(allRows); } catch (err) { console.error("trend chart failed:", err); }
  }

  function renderSentimentChart(counts, total) {
    const ctx = document.getElementById("sentiment-chart");
    const values = SENTIMENT_ORDER.map(function (k) { return counts[k]; });
    const colors = SENTIMENT_ORDER.map(function (k) { return SENTIMENT_COLORS[k]; });
    if (sentimentChart) sentimentChart.destroy();
    sentimentChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: SENTIMENT_ORDER.map(function (s) { return s[0].toUpperCase() + s.slice(1); }),
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "72%",
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
      },
    });

    el.donutTotal.textContent = total;

    const total2 = values.reduce(function (a, b) { return a + b; }, 0) || 1;
    el.sentimentLegend.innerHTML = SENTIMENT_ORDER.map(function (k, i) {
      const pct = Math.round((values[i] / total2) * 1000) / 10;
      return (
        '<div class="donut-legend-row">' +
          '<span class="donut-legend-dot" style="background:' + colors[i] + ';"></span>' +
          '<span class="donut-legend-label">' + k[0].toUpperCase() + k.slice(1) + "</span>" +
          '<span class="donut-legend-pct">' + pct + "%</span>" +
        "</div>" +
        '<div class="donut-legend-count">' + values[i] + " reviews</div>"
      );
    }).join("");
  }

  function renderSparklines(rows) {
    SENTIMENT_ORDER.forEach(function (key) {
      const canvas = document.getElementById("spark-" + key);
      if (!canvas) return;
      if (sparkCharts[key]) { sparkCharts[key].destroy(); sparkCharts[key] = null; }

      // Real per-item confidence values, in upload order, for rows the
      // model classified as this sentiment.
      const values = rows.filter(function (r) { return r.sentiment === key; }).map(function (r) { return r.confidence; });

      if (values.length < 2) {
        canvas.style.display = "none";
        return;
      }
      canvas.style.display = "";
      sparkCharts[key] = new Chart(canvas, {
        type: "line",
        data: {
          labels: values.map(function (_, i) { return i; }),
          datasets: [{
            data: values,
            borderColor: SENTIMENT_COLORS[key],
            backgroundColor: "transparent",
            borderWidth: 1.75,
            pointRadius: 0,
            tension: 0.35,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: false,
          scales: { x: { display: false }, y: { display: false } },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
        },
      });
    });
  }

  function renderTrendChart(rows) {
    if (!rows.length) { el.trendPanel.style.display = "none"; return; }
    el.trendPanel.style.display = "";

    // Bucket reviews into up to 10 groups, in the order they appeared in the
    // uploaded file, and count each sentiment per bucket - real data derived
    // straight from the analyzed rows, no synthetic timestamps involved.
    const bucketCount = Math.min(10, rows.length);
    const bucketSize = Math.ceil(rows.length / bucketCount);
    const buckets = [];
    for (let i = 0; i < rows.length; i += bucketSize) {
      buckets.push(rows.slice(i, i + bucketSize));
    }
    const labels = buckets.map(function (b, i) {
      const start = i * bucketSize + 1;
      const end = Math.min(rows.length, start + b.length - 1);
      return start === end ? "#" + start : "#" + start + "–" + end;
    });
    const datasets = SENTIMENT_ORDER.map(function (key) {
      return {
        label: key[0].toUpperCase() + key.slice(1),
        data: buckets.map(function (b) { return b.filter(function (r) { return r.sentiment === key; }).length; }),
        borderColor: SENTIMENT_COLORS[key],
        backgroundColor: SENTIMENT_COLORS[key],
        pointRadius: 3,
        pointHoverRadius: 4,
        tension: 0.3,
        borderWidth: 2,
      };
    });

    const ctx = document.getElementById("trend-chart");
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
      type: "line",
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, title: { display: true, text: "Position in uploaded file", font: { size: 11 } } },
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: "#f0f1f6" } },
        },
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 12 } } } },
      },
    });
  }

  function renderProductChart(rows) {
    const ctx = document.getElementById("product-chart");
    const labels = rows.map(function (r) { return r.product; });
    if (productChart) productChart.destroy();
    productChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: SENTIMENT_ORDER.map(function (k) {
          return {
            label: k[0].toUpperCase() + k.slice(1),
            data: rows.map(function (r) { return r[k]; }),
            backgroundColor: SENTIMENT_COLORS[k],
            borderRadius: 4,
          };
        }),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { stacked: true, max: 100, ticks: { callback: function (v) { return v + "%"; }, font: { size: 11 } }, grid: { color: "#f0f1f6" } },
        },
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 12 } } } },
      },
    });
  }

  function renderTopics(topics) {
    el.topicList.innerHTML = "";
    if (!topics || !topics.length) {
      el.topicList.innerHTML = '<div class="empty-note">No negative reviews found.</div>';
      return;
    }
    const max = Math.max.apply(null, topics.map(function (t) { return t.count; }));
    topics.forEach(function (t) {
      const row = document.createElement("div");
      row.className = "topic-row";
      row.innerHTML =
        '<span class="topic-name" title="' + escapeHtml(t.topic) + '">' + escapeHtml(t.topic) + "</span>" +
        '<span class="topic-bar-track"><span class="topic-bar-fill" style="width:' + Math.max(6, (t.count / max) * 100) + '%;"></span></span>' +
        '<span class="topic-count">' + t.count + "</span>";
      el.topicList.appendChild(row);
    });
  }

  function renderTable(filterText) {
    const q = (filterText || "").toLowerCase().trim();
    const rows = q
      ? allRows.filter(function (r) { return JSON.stringify(r).toLowerCase().indexOf(q) !== -1; })
      : allRows;

    const cols = allColumns.concat(["sentiment", "confidence"]);
    el.resultsHead.innerHTML = "<tr>" + cols.map(function (c) { return "<th>" + escapeHtml(c) + "</th>"; }).join("") + "</tr>";

    if (!rows.length) {
      el.resultsBody.innerHTML = '<tr><td class="empty-note" colspan="' + cols.length + '">No matching rows.</td></tr>';
      return;
    }

    const frag = document.createDocumentFragment();
    rows.slice(0, 500).forEach(function (r) {
      const tr = document.createElement("tr");
      let html = "";
      allColumns.forEach(function (c) {
        const isReview = c === "review";
        html += '<td class="' + (isReview ? "review-cell" : "") + '">' + escapeHtml(String(r[c] !== undefined ? r[c] : "")) + "</td>";
      });
      html += '<td><span class="badge badge-' + r.sentiment + '">' + escapeHtml(r.sentiment) + "</span></td>";
      html += "<td>" + Math.round(r.confidence * 100) + "%</td>";
      tr.innerHTML = html;
      frag.appendChild(tr);
    });
    el.resultsBody.innerHTML = "";
    el.resultsBody.appendChild(frag);
  }

  function predictLive() {
    const review = el.predictInput.value.trim();
    if (review.length < 3) {
      showToast("Type at least a few words first", true);
      return;
    }
    el.predictBtn.disabled = true;
    el.predictBtn.textContent = "Predicting…";
    fetch("/api/predict_live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review: review }),
    })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (r) {
        el.predictBtn.disabled = false;
        el.predictBtn.textContent = "Predict";
        if (!r.ok) {
          showToast(r.body.message || "Prediction failed", true);
          return;
        }
        el.predictResult.style.display = "flex";
        el.predictBadge.className = "badge badge-" + r.body.sentiment;
        el.predictBadge.textContent = r.body.sentiment;
        const pct = Math.round(r.body.confidence * 100);
        el.predictConfidenceFill.style.width = pct + "%";
        el.predictConfidenceText.textContent = pct + "% confidence";
      })
      .catch(function (err) {
        el.predictBtn.disabled = false;
        el.predictBtn.textContent = "Predict";
        showToast("Network error: " + err, true);
      });
  }

  function loadRecent() {
    fetch("/api/history/recent")
      .then(function (res) { return res.json(); })
      .then(function (body) {
        if (!body.analysis || !body.rows || !body.rows.length) {
          el.recentNote.textContent = "Nothing saved yet";
          el.recentList.innerHTML = '<div class="empty-note">Analyze some reviews above and click &ldquo;Save to History&rdquo; to see them here.</div>';
          return;
        }
        el.recentNote.textContent = "From " + escapeHtml(body.analysis.source) + ", saved " + escapeHtml(body.analysis.created_at.replace("T", " ").slice(0, 16));
        el.recentList.innerHTML = body.rows.map(function (r) {
          const sentiment = r.sentiment || "neutral";
          const text = r.review !== undefined ? String(r.review) : "";
          return (
            '<div class="recent-row">' +
              '<span class="recent-avatar ' + sentiment + '">' + (SENTIMENT_ICON[sentiment] || "") + "</span>" +
              '<div class="recent-body">' +
                '<div class="recent-text">' + escapeHtml(text) + "</div>" +
                '<div class="recent-meta">' +
                  '<span class="badge badge-' + sentiment + '">' + escapeHtml(sentiment) + "</span>" +
                  '<span class="mono" style="font-size:11px; color:var(--text-faint);">' + Math.round((r.confidence || 0) * 100) + "% confidence</span>" +
                "</div>" +
              "</div>" +
            "</div>"
          );
        }).join("");
      })
      .catch(function () {
        el.recentNote.textContent = "Nothing saved yet";
        el.recentList.innerHTML = '<div class="empty-note">Could not load recent reviews.</div>';
      });
  }

  loadRecent();
})();
