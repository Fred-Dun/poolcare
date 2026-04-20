
"use strict";

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  requestNotificationPermission();
});

/* =========================
   HISTORIQUE
========================= */
function getHistory() {
  return JSON.parse(localStorage.getItem("poolcare_history")) || [];
}

let ANALYSIS_HISTORY = getHistory();

function saveAnalysis(data) {

  let history =
    JSON.parse(localStorage.getItem("poolcare_history")) || [];

  history.push({
    date: new Date().toLocaleString(),
    ...data
  });

  if (history.length > 50) {
    history.shift();
  }

  localStorage.setItem(
    "poolcare_history",
    JSON.stringify(history)
  );

  ANALYSIS_HISTORY = history;
}
/* =========================
   NAVIGATION
========================= */
function goToPage(id) {

  document.querySelectorAll(".page").forEach(p =>
    p.classList.remove("active")
  );

  const page = document.getElementById(id);

  if (page) page.classList.add("active");

  if (id === "page-history" || id === "page-results") {
    setTimeout(() => {
      renderHistory();
      drawChart();
    }, 50);
  }
}

/* =========================
   NOTIFICATIONS
========================= */
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendNotification(title, message) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    body: message,
    icon: "logo.png"
  });
}

/* =========================
   PREMIUM (évite erreurs)
========================= */
function openTrial() {
  document.getElementById("premium-trial")?.classList.remove("hidden");
}

function activatePremium(type) {
  alert("Premium activé : " + type);
}

function closePremium() {
  document.querySelectorAll(".premium-modal").forEach(m =>
    m.classList.add("hidden")
  );
}

/* =========================
   SCORE
========================= */
function calculateHealthScore({ ph, tac, cya, algae }) {

  let score = 100;

  if (cya > 60) score -= 25;
  else if (cya > 50) score -= 15;

  if (tac < 80 || tac > 130) score -= 20;
  if (ph < 7.0 || ph > 7.4) score -= 20;
  if (algae !== "none") score -= 25;

  return Math.max(score, 0);
}

/* =========================
   ANALYSE
========================= */
function analyze() {

  const volume = Number(document.getElementById("volume").value);
  const ph = Number(document.getElementById("ph").value);
  const tac = Number(document.getElementById("tac").value);
  const cya = Number(document.getElementById("cya").value);
  const algae = document.getElementById("algae").value;
  const treatment = document.getElementById("treatment").value;
  const season = document.getElementById("season").value;

  const score = calculateHealthScore({ ph, tac, cya, algae });

  saveAnalysis({
    volume,
    ph,
    tac,
    cya,
    algae,
    treatment,
    season,
    score
  });

  render([], [], [], score);
}

/* =========================
   RENDER
========================= */
function render(actions = [], safety = [], alerts = [], score = 100) {

  const results = document.getElementById("results");
  if (!results) return;

  const headerScore = document.getElementById("header-score");
  if (headerScore) headerScore.textContent = `${score} / 100`;

  let image = "images/piscine-propre.jpg";
  if (score < 40) image = "images/piscine-sale.jpg";
  else if (score < 70) image = "images/piscine-moyenne.jpg";

  results.innerHTML = `
    <img src="${image}" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;">
    <div class="card">
      <h3>Score : ${score}/100</h3>
    </div>
  `;
}

/* =========================
   HISTORIQUE UI
========================= */
function renderHistory() {

  const box =
    document.getElementById("history") ||
    document.getElementById("history-preview");

  if (!box) return;

  const history = getHistory();

  if (!history.length) {
    box.innerHTML = "<p>Aucune analyse</p>";
    return;
  }

  box.innerHTML = history
    .slice()
    .reverse()
    .map(h => `
      <div class="card">
        ${h.date}<br>
        Score : ${h.score}/100
      </div>
    `)
    .join("");
}

/* =========================
   GRAPH
========================= */
function drawChart() {

  const canvas = document.getElementById("historyChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const scores = ANALYSIS_HISTORY.map(a => a.score);

  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.beginPath();

  scores.forEach((s,i)=>{
    const x = i * 30;
    const y = canvas.height - s;
    if (i === 0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });

  ctx.stroke();
}

