(function () {
  "use strict";

  const data = JSON.parse(document.getElementById("analysis-data").textContent);

  // ---- sentiment donut ----
  const sentimentCtx = document.getElementById("sentiment-chart");
  const donutColors = SENTIMENT_ORDER.map(function (k) { return SENTIMENT_COLORS[k]; });
  const donutValues = SENTIMENT_ORDER.map(function (k) { return data.counts[k]; });
  new Chart(sentimentCtx, {
    type: "doughnut",
    data: {
      labels: SENTIMENT_ORDER.map(function (s) { return s[0].toUpperCase() + s.slice(1); }),
      datasets: [{ data: donutValues, backgroundColor: donutColors, borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "72%",
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });

  const legendEl = document.getElementById("sentiment-legend");
  if (legendEl) {
    const donutTotal = donutValues.reduce(function (a, b) { return a + b; }, 0) || 1;
    legendEl.innerHTML = SENTIMENT_ORDER.map(function (k, i) {
      const pct = Math.round((donutValues[i] / donutTotal) * 1000) / 10;
      return (
        '<div class="donut-legend-row">' +
          '<span class="donut-legend-dot" style="background:' + donutColors[i] + ';"></span>' +
          '<span class="donut-legend-label">' + k[0].toUpperCase() + k.slice(1) + "</span>" +
          '<span class="donut-legend-pct">' + pct + "%</span>" +
        "</div>" +
        '<div class="donut-legend-count">' + donutValues[i] + " reviews</div>"
      );
    }).join("");
  }

  // ---- negative topics ----
  const topicList = document.getElementById("topic-list");
  const topics = data.negative_topics || [];
  if (!topics.length) {
    topicList.innerHTML = '<div class="empty-note">No negative reviews found.</div>';
  } else {
    const max = Math.max.apply(null, topics.map(function (t) { return t.count; }));
    topicList.innerHTML = topics.map(function (t) {
      return '<div class="topic-row">' +
        '<span class="topic-name" title="' + escapeHtml(t.topic) + '">' + escapeHtml(t.topic) + "</span>" +
        '<span class="topic-bar-track"><span class="topic-bar-fill" style="width:' + Math.max(6, (t.count / max) * 100) + '%;"></span></span>' +
        '<span class="topic-count">' + t.count + "</span></div>";
    }).join("");
  }

  // ---- product chart ----
  if (data.product_sentiment && data.product_sentiment.length) {
    const productCtx = document.getElementById("product-chart");
    if (productCtx) {
      new Chart(productCtx, {
        type: "bar",
        data: {
          labels: data.product_sentiment.map(function (r) { return r.product; }),
          datasets: SENTIMENT_ORDER.map(function (k) {
            return {
              label: k[0].toUpperCase() + k.slice(1),
              data: data.product_sentiment.map(function (r) { return r[k]; }),
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
  }

  // ---- results table ----
  const allColumns = data.columns || [];
  const allRows = data.rows || [];
  const head = document.getElementById("results-head");
  const bodyEl = document.getElementById("results-body");
  const search = document.getElementById("results-search");

  function renderTable(filterText) {
    const q = (filterText || "").toLowerCase().trim();
    const rows = q ? allRows.filter(function (r) { return JSON.stringify(r).toLowerCase().indexOf(q) !== -1; }) : allRows;
    const cols = allColumns.concat(["sentiment", "confidence"]);
    head.innerHTML = "<tr>" + cols.map(function (c) { return "<th>" + escapeHtml(c) + "</th>"; }).join("") + "</tr>";
    if (!rows.length) {
      bodyEl.innerHTML = '<tr><td class="empty-note" colspan="' + cols.length + '">No matching rows.</td></tr>';
      return;
    }
    const frag = document.createDocumentFragment();
    rows.slice(0, 500).forEach(function (r) {
      const tr = document.createElement("tr");
      let html = "";
      allColumns.forEach(function (c) {
        html += '<td class="' + (c === "review" ? "review-cell" : "") + '">' + escapeHtml(String(r[c] !== undefined ? r[c] : "")) + "</td>";
      });
      html += '<td><span class="badge badge-' + r.sentiment + '">' + escapeHtml(r.sentiment) + "</span></td>";
      html += "<td>" + Math.round(r.confidence * 100) + "%</td>";
      tr.innerHTML = html;
      frag.appendChild(tr);
    });
    bodyEl.innerHTML = "";
    bodyEl.appendChild(frag);
  }

  search.addEventListener("input", function () { renderTable(search.value); });
  renderTable("");
})();
