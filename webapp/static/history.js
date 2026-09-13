(function () {
  "use strict";

  const body = document.getElementById("history-body");
  const note = document.getElementById("history-note");

  function load() {
    fetch("/api/history/list")
      .then(function (res) { return res.json(); })
      .then(render)
      .catch(function (err) {
        body.innerHTML = '<tr><td class="empty-note" colspan="8">Could not load history: ' + escapeHtml(String(err)) + "</td></tr>";
      });
  }

  function render(items) {
    if (!items.length) {
      note.textContent = "Nothing saved yet";
      body.innerHTML = '<tr><td class="empty-note" colspan="8">No saved analyses yet — go to the Dashboard, analyze some reviews, then click "Save to History".</td></tr>';
      return;
    }
    note.textContent = items.length + " saved analys" + (items.length === 1 ? "is" : "es");
    const frag = document.createDocumentFragment();
    items.forEach(function (item) {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      const pPct = item.percent.positive, nPct = item.percent.neutral, gPct = item.percent.negative;
      tr.innerHTML =
        "<td>" + escapeHtml(item.created_at.replace("T", " ").slice(0, 16)) + "</td>" +
        '<td class="mono">' + escapeHtml(item.source) + "</td>" +
        "<td>" + item.total + "</td>" +
        '<td><span class="mini-bar" title="' + pPct + '% positive · ' + nPct + '% neutral · ' + gPct + '% negative">' +
          '<span style="width:' + pPct + '%; background:' + SENTIMENT_COLORS.positive + ';"></span>' +
          '<span style="width:' + nPct + '%; background:' + SENTIMENT_COLORS.neutral + ';"></span>' +
          '<span style="width:' + gPct + '%; background:' + SENTIMENT_COLORS.negative + ';"></span>' +
        "</span></td>" +
        "<td>" + item.counts.positive + "</td>" +
        "<td>" + item.counts.neutral + "</td>" +
        "<td>" + item.counts.negative + "</td>" +
        '<td class="row-actions">' +
          '<button class="icon-btn" title="View" data-view="' + item.id + '">&#8594;</button>' +
          '<button class="icon-btn danger" title="Delete" data-delete="' + item.id + '">&times;</button>' +
        "</td>";
      tr.addEventListener("click", function (e) {
        if (e.target.closest("[data-delete]")) return;
        window.location.href = "/history/" + item.id;
      });
      frag.appendChild(tr);
    });
    body.innerHTML = "";
    body.appendChild(frag);

    body.querySelectorAll("[data-delete]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const id = btn.getAttribute("data-delete");
        if (!window.confirm("Delete this saved analysis? This can't be undone.")) return;
        fetch("/api/history/" + id + "/delete", { method: "POST" })
          .then(function (res) { return res.json(); })
          .then(function () { showToast("Deleted"); load(); })
          .catch(function (err) { showToast("Could not delete: " + err, true); });
      });
    });
  }

  load();
})();
