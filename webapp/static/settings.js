(function () {
  "use strict";

  const el = {
    infoStatus: document.getElementById("info-status"),
    infoTrained: document.getElementById("info-trained"),
    infoAccuracy: document.getElementById("info-accuracy"),
    infoRows: document.getElementById("info-rows"),
    infoSource: document.getElementById("info-source"),
    infoSize: document.getElementById("info-size"),
    radios: document.querySelectorAll('input[name="train-source"]'),
    uploadField: document.getElementById("train-upload-field"),
    trainFile: document.getElementById("train-file"),
    trainDrop: document.getElementById("train-drop"),
    trainDropText: document.getElementById("train-drop-text"),
    retrainBtn: document.getElementById("retrain-btn"),
    retrainNote: document.getElementById("retrain-note"),
  };

  function fmtBytes(n) {
    if (n === null || n === undefined) return "—";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function loadStatus() {
    fetch("/api/model_status")
      .then(function (res) { return res.json(); })
      .then(function (s) {
        el.infoStatus.textContent = s.model_exists ? "Loaded" : "Not trained";
        el.infoTrained.textContent = s.trained_at ? s.trained_at.replace("T", " ").slice(0, 16) : "—";
        el.infoAccuracy.textContent = s.accuracy !== null && s.accuracy !== undefined ? Math.round(s.accuracy * 100) + "%" : "—";
        el.infoRows.textContent = s.rows_trained_on !== null && s.rows_trained_on !== undefined ? s.rows_trained_on : "—";
        el.infoSource.textContent = s.data_source || "—";
        el.infoSize.textContent = fmtBytes(s.size_bytes);
        setModelStatus(!!s.model_exists);
      })
      .catch(function () {});
  }

  el.radios.forEach(function (r) {
    r.addEventListener("change", function () {
      el.uploadField.style.display = r.value === "upload" && r.checked ? "" : (document.querySelector('input[name="train-source"]:checked').value === "upload" ? "" : "none");
    });
  });

  el.trainFile.addEventListener("change", function () {
    const f = el.trainFile.files[0];
    if (f) { el.trainDrop.classList.add("has-file"); el.trainDropText.textContent = f.name; }
    else { el.trainDrop.classList.remove("has-file"); el.trainDropText.textContent = "Choose CSV…"; }
  });

  el.retrainBtn.addEventListener("click", function () {
    const useUpload = document.querySelector('input[name="train-source"]:checked').value === "upload";
    if (useUpload && !el.trainFile.files[0]) {
      showToast("Choose a CSV file first", true);
      return;
    }
    el.retrainBtn.disabled = true;
    el.retrainBtn.textContent = "Training…";
    el.retrainNote.textContent = "";
    el.retrainNote.style.color = "";

    const formData = new FormData();
    formData.append("use_sample", useUpload ? "false" : "true");
    if (useUpload) formData.append("file", el.trainFile.files[0]);

    fetch("/api/train", { method: "POST", body: formData })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (r) {
        el.retrainBtn.disabled = false;
        el.retrainBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>Retrain Model';
        if (!r.ok) {
          el.retrainNote.textContent = r.body.message || "Training failed.";
          el.retrainNote.style.color = "var(--negative)";
          showToast(r.body.message || "Training failed", true);
          return;
        }
        el.retrainNote.textContent = "Trained on " + r.body.rows_trained_on + " rows — accuracy " + Math.round(r.body.accuracy * 100) + "%.";
        el.retrainNote.style.color = "var(--positive)";
        showToast("Model retrained");
        loadStatus();
      })
      .catch(function (err) {
        el.retrainBtn.disabled = false;
        el.retrainBtn.textContent = "Retrain Model";
        showToast("Network error: " + err, true);
      });
  });

  loadStatus();
})();
