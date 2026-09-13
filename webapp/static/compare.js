(function () {
  "use strict";

  const el = {
    fileA: document.getElementById("file-a"),
    fileB: document.getElementById("file-b"),
    dropA: document.getElementById("drop-a"),
    dropB: document.getElementById("drop-b"),
    dropAText: document.getElementById("drop-a-text"),
    dropBText: document.getElementById("drop-b-text"),
    compareBtn: document.getElementById("compare-btn"),
    issuesNote: document.getElementById("issues-note"),
    results: document.getElementById("compare-results"),
    posA: document.getElementById("pos-a"), posB: document.getElementById("pos-b"), posDelta: document.getElementById("pos-delta"),
    neuA: document.getElementById("neu-a"), neuB: document.getElementById("neu-b"), neuDelta: document.getElementById("neu-delta"),
    negA: document.getElementById("neg-a"), negB: document.getElementById("neg-b"), negDelta: document.getElementById("neg-delta"),
    chartNote: document.getElementById("compare-chart-note"),
  };
  let chart = null;

  function wireDrop(input, drop, textEl, placeholder) {
    input.addEventListener("change", function () {
      const f = input.files[0];
      if (f) { drop.classList.add("has-file"); textEl.textContent = f.name; }
      else { drop.classList.remove("has-file"); textEl.textContent = placeholder; }
    });
  }
  wireDrop(el.fileA, el.dropA, el.dropAText, "Choose CSV… (or leave empty to use sample data)");
  wireDrop(el.fileB, el.dropB, el.dropBText, "Choose CSV… (or leave empty to use sample data)");

  el.compareBtn.addEventListener("click", run);

  function setBusy(busy) {
    el.compareBtn.disabled = busy;
    el.compareBtn.textContent = busy ? "Comparing…" : "Compare";
  }

  function run() {
    setBusy(true);
    el.issuesNote.style.display = "none";
    const formData = new FormData();
    if (el.fileA.files[0]) formData.append("file_a", el.fileA.files[0]);
    if (el.fileB.files[0]) formData.append("file_b", el.fileB.files[0]);

    fetch("/api/compare", { method: "POST", body: formData })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (r) {
        setBusy(false);
        if (!r.ok) {
          el.issuesNote.textContent = r.body.message || "Something went wrong.";
          el.issuesNote.style.display = "";
          setModelStatus(r.body.error !== "model_not_trained");
          return;
        }
        setModelStatus(true);
        render(r.body);
      })
      .catch(function (err) {
        setBusy(false);
        el.issuesNote.textContent = "Could not reach the server: " + err;
        el.issuesNote.style.display = "";
      });
  }

  function deltaPill(el2, aPct, bPct) {
    const diff = Math.round((bPct - aPct) * 10) / 10;
    if (Math.abs(diff) < 0.1) {
      el2.className = "delta-pill flat";
      el2.textContent = "±0%";
    } else if (diff > 0) {
      el2.className = "delta-pill up";
      el2.textContent = "+" + diff + "%";
    } else {
      el2.className = "delta-pill down";
      el2.textContent = diff + "%";
    }
  }

  function render(data) {
    el.results.style.display = "";
    const a = data.a, b = data.b;
    el.chartNote.textContent = a.label + " vs. " + b.label;

    el.posA.textContent = a.percent.positive + "%"; el.posB.textContent = b.percent.positive + "%";
    el.neuA.textContent = a.percent.neutral + "%"; el.neuB.textContent = b.percent.neutral + "%";
    el.negA.textContent = a.percent.negative + "%"; el.negB.textContent = b.percent.negative + "%";
    deltaPill(el.posDelta, a.percent.positive, b.percent.positive);
    deltaPill(el.neuDelta, a.percent.neutral, b.percent.neutral);
    deltaPill(el.negDelta, a.percent.negative, b.percent.negative);

    const ctx = document.getElementById("compare-chart");
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: SENTIMENT_ORDER.map(function (s) { return s[0].toUpperCase() + s.slice(1); }),
        datasets: [
          { label: a.label, data: SENTIMENT_ORDER.map(function (k) { return a.percent[k]; }), backgroundColor: "#8b93f8", borderRadius: 4 },
          { label: b.label, data: SENTIMENT_ORDER.map(function (k) { return b.percent[k]; }), backgroundColor: "#4f5fef", borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { max: 100, ticks: { callback: function (v) { return v + "%"; }, font: { size: 11 } }, grid: { color: "#f0f1f6" } },
          x: { grid: { display: false } },
        },
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 12 } } } },
      },
    });
  }
})();
