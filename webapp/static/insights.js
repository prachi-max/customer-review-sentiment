(function () {
  "use strict";

  const el = {
    fileInput: document.getElementById("file-input"),
    uploadDrop: document.getElementById("upload-drop"),
    uploadDropText: document.getElementById("upload-drop-text"),
    analyzeBtn: document.getElementById("analyze-btn"),
    issuesNote: document.getElementById("issues-note"),
    keywordGrid: document.getElementById("keyword-grid"),
    positiveKeywords: document.getElementById("positive-keywords"),
    negativeKeywords: document.getElementById("negative-keywords"),
    cloudPanel: document.getElementById("cloud-panel"),
    tagCloud: document.getElementById("tag-cloud"),
  };

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

  el.analyzeBtn.addEventListener("click", run);

  function setBusy(busy) {
    el.analyzeBtn.disabled = busy;
    el.analyzeBtn.textContent = busy ? "Analyzing…" : "Analyze";
  }

  function run() {
    setBusy(true);
    el.issuesNote.style.display = "none";
    const formData = new FormData();
    const f = el.fileInput.files[0];
    if (f) formData.append("file", f);

    fetch("/api/insights", { method: "POST", body: formData })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (r) {
        setBusy(false);
        if (!r.ok) {
          el.issuesNote.textContent = r.body.message || "Something went wrong.";
          el.issuesNote.style.display = "";
          showToast(r.body.message || "Failed", true);
          setModelStatus(r.body.error !== "model_not_trained");
          return;
        }
        setModelStatus(true);
        render(r.body);
        showToast("Done");
      })
      .catch(function (err) {
        setBusy(false);
        el.issuesNote.textContent = "Could not reach the server: " + err;
        el.issuesNote.style.display = "";
      });
  }

  function renderKeywordList(container, terms, lean) {
    if (!terms.length) {
      container.innerHTML = '<div class="empty-note">Nothing found.</div>';
      return;
    }
    const max = Math.max.apply(null, terms.map(function (t) { return t.count; }));
    container.innerHTML = terms.map(function (t) {
      return '<div class="keyword-row">' +
        '<span class="keyword-name" title="' + escapeHtml(t.topic) + '">' + escapeHtml(t.topic) + "</span>" +
        '<span class="keyword-bar-track"><span class="keyword-bar-fill ' + lean + '" style="width:' + Math.max(6, (t.count / max) * 100) + '%;"></span></span>' +
        '<span class="keyword-count">' + t.count + "</span></div>";
    }).join("");
  }

  function render(data) {
    el.keywordGrid.style.display = "";
    el.cloudPanel.style.display = "";
    renderKeywordList(el.positiveKeywords, data.positive_terms, "positive");
    renderKeywordList(el.negativeKeywords, data.negative_terms, "negative");

    const cloud = data.cloud || [];
    if (!cloud.length) {
      el.tagCloud.innerHTML = '<div class="empty-note">Not enough text to build a word cloud.</div>';
      return;
    }
    const max = Math.max.apply(null, cloud.map(function (w) { return w.count; }));
    const min = Math.min.apply(null, cloud.map(function (w) { return w.count; }));
    el.tagCloud.innerHTML = cloud.map(function (w) {
      const t = max === min ? 1 : (w.count - min) / (max - min);
      const size = 13 + t * 22; // 13px .. 35px
      return '<span class="cloud-word ' + w.lean + '" style="font-size:' + size.toFixed(1) + 'px;" title="' + w.count + ' mentions">' + escapeHtml(w.word) + "</span>";
    }).join("");
  }
})();
