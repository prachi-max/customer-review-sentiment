// Shared helpers used by every page: toast messages, HTML escaping, sentiment
// colors, and the model-status check in the sidebar footer.
const SENTIMENT_COLORS = { positive: "#1a9e6a", neutral: "#b8860b", negative: "#d64545" };
const SENTIMENT_ORDER = ["positive", "neutral", "negative"];

function showToast(message, isError) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("error", !!isError);
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function () { toast.classList.remove("show"); }, 3200);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setModelStatus(ok) {
  const dot = document.getElementById("model-dot");
  const text = document.getElementById("model-text");
  if (dot) dot.className = "status-dot " + (ok ? "ok" : "bad");
  if (text) text.textContent = ok ? "Model loaded" : "Not trained yet";
  const serverDot = document.getElementById("server-dot");
  const serverTitle = document.getElementById("server-chip-title");
  if (serverDot) serverDot.className = "status-dot " + (ok ? "ok" : "bad");
  if (serverTitle) serverTitle.textContent = ok ? "Ready" : "Model missing";
}

function checkModelStatus() {
  fetch("/api/model_status")
    .then(function (res) { return res.json(); })
    .then(function (body) { setModelStatus(!!body.model_exists); })
    .catch(function () { setModelStatus(false); });
}

document.addEventListener("DOMContentLoaded", checkModelStatus);
