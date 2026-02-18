/*************************************************
 * POOLCARE V1 — MOTEUR DE DÉCISION DE RÉFÉRENCE
 *************************************************/

/* =========================
   ÉLÉMENTS DOM
========================= */
const results = document.getElementById("results");
requestNotificationPermission();

/* =========================
   CONFIGURATION CLIENT
========================= */
const poolConfig = {
  treatment: null,
  volume: null,
  season: null
};

/* =========================
   MODE UTILISATEUR
========================= */
const USER = {
  isPremium: false,
  onTrial: true,
  trialDaysLeft: 7
};

/* =========================
   HISTORIQUE GLOBAL
========================= */
let ANALYSIS_HISTORY = getHistory();

/* =========================
   HISTORIQUE ANALYSES (UNIQUE)
========================= */

function saveAnalysis(data) {
let ANALYSIS_HISTORY = getHistory();

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

function getHistory() {
  return JSON.parse(
    localStorage.getItem("poolcare_history")
  ) || [];
}


/* =========================
   RÈGLES DE DOSAGE (FIABLES)
========================= */
const DOSAGES = {
  cya: v => `${Math.round(v * 0.4)} m³ d’eau à renouveler`,

  tacPlus: (v, delta) =>
    `${Math.round((v * delta * 15) / 10)} g`,

  tacMinus: (v, delta) =>
    `${Math.round((v * delta * 10) / 10)} g`,

  ph: v => `${Math.round(v * 100)} g`,

  chloreChocPastille: v => `${Math.round(v)} pastille(s)`,
  chloreChocPoudre: v => `${Math.round(v * 15)} g`,

  oxygene: v => `${(v * 0.3).toFixed(1)} L`,
  antiAlgaeStrong: v => `${Math.round(v * 30)} ml`
};
/* =========================
   SCORE SANTÉ
========================= */

function calculateHealthScore({ ph, tac, cya, algae }) {

  let score = 100;

  /* CYA */
  if (cya > 60) score -= 25;
  else if (cya > 50) score -= 15;

  /* TAC */
  if (tac < 80 || tac > 130) score -= 20;

  /* pH */
  if (ph < 7.0 || ph > 7.4) score -= 20;

  /* Algues */
  if (algae !== "none") score -= 25;

  if (score < 0) score = 0;

  return score;
}
/* =========================
   ALERTES AUTOMATIQUES
========================= */
let ALERT_HISTORY = [];

function checkAlerts({ ph, tac, cya, algae, treatment, score }) {

  let alerts = [];

  if (cya > 70) {
    alerts.push("CYA critique : désinfection inefficace");
  }

  if (ph < 6.8 || ph > 7.8) {
    alerts.push("pH dangereux pour baigneurs");
  }

  if (tac < 70 || tac > 150) {
    alerts.push("TAC très instable");
  }

  if (algae !== "none") {
    alerts.push("Présence d’algues détectée");
  }

  if (treatment === "oxygene" && algae !== "none") {
    alerts.push("Oxygène actif inefficace avec algues");
  }

  if (score < 50) {
    alerts.push("Santé de l’eau critique");
  }

  /* 🔔 Envoi push */
  alerts.forEach(msg => {
    sendNotification("🚨 PoolCare", msg);
  });

  return alerts;
}

/* =========================
   ANALYSE PRINCIPALE
========================= */
function analyze() {

  if (USER.onTrial && USER.trialDaysLeft > 0) {
    USER.trialDaysLeft--;
    if (USER.trialDaysLeft <= 0) USER.onTrial = false;
  }

  const volume = Number(document.getElementById("volume")?.value || 0);
  const season = document.getElementById("season")?.value;
  const treatment =
    poolConfig.treatment || document.getElementById("treatment")?.value;

  const ph = Number(document.getElementById("ph")?.value);
  const tac = Number(document.getElementById("tac")?.value);
  const cya = Number(document.getElementById("cya")?.value);
  const algae = document.getElementById("algae")?.value;

  const isCyaBlocking = cya > 60;
  const isCyaOk = cya <= 60;
  const isTacOk = tac >= 80 && tac <= 130;

  let actions = [];
  let safetyMessages = [];

  /* Score */
  const healthScore = calculateHealthScore({
    ph,
    tac,
    cya,
    algae
  });

  /* Alertes */
  const alerts = checkAlerts({
    ph,
    tac,
    cya,
    algae,
    treatment,
    score: healthScore
  });

  /* Hivernage */
  if (season === "hivernage-passif") {

    actions.push({
      level: "info",
      title: "Piscine en hivernage passif",
      text: "Aucune correction chimique n’est nécessaire.",
      product: "Surveillance",
      dosage: "Contrôle visuel régulier"
    });

    saveAnalysis({
      volume,
      season,
      treatment,
      ph,
      tac,
      cya,
      algae,
      score: healthScore,
      actionsCount: actions.length
    });

    return render(actions, safetyMessages, alerts, healthScore);
  }

  /* CYA */
  if (cya > 50) {

    actions.push({
      level: cya > 60 ? "urgent" : "important",
      title: "Stabilisant (CYA) trop élevé",
      text: "Le stabilisant bloque l’efficacité du désinfectant.",
      product: "Renouvellement partiel de l’eau",
      dosage: DOSAGES.cya(volume),
      lock: true
    });

    safetyMessages.push(
      "🔒 Tant que le CYA est trop élevé, aucune correction ne sera efficace."
    );
  }

  /* Autres paramètres */
  if (!isCyaBlocking) {

    if (tac < 80) {

      const delta = 100 - tac;

      actions.push({
        level: "important",
        title: "TAC trop bas",
        text: "Corrigez le TAC avant toute autre action.",
        product: "TAC +",
        dosage: DOSAGES.tacPlus(volume, delta),
        lock: true
      });
    }

    if (tac > 130) {

      const delta = tac - 120;

      actions.push({
        level: "important",
        title: "TAC trop élevé",
        text: "Un TAC trop élevé empêche la régulation du pH.",
        product: "TAC -",
        dosage: DOSAGES.tacMinus(volume, delta),
        lock: true
      });
    }

    if (isCyaOk && isTacOk && (ph < 7.0 || ph > 7.4)) {

      actions.push({
        level: "important",
        title: "pH déséquilibré",
        text:
          ph < 7.0
            ? "Un pH trop bas rend l’eau agressive."
            : "Un pH trop élevé réduit l’efficacité du désinfectant.",
        product: ph < 7.0 ? "pH +" : "pH -",
        dosage: DOSAGES.ph(volume),
        lock: true
      });

    } else if (!isTacOk && (ph < 7.0 || ph > 7.4)) {

      safetyMessages.push(
        "ℹ️ Le pH sera corrigé après stabilisation du TAC."
      );
    }

    const parametersBalanced =
      cya <= 60 &&
      tac >= 80 && tac <= 130 &&
      ph >= 7.0 && ph <= 7.6;

    if (algae !== "none") {

      if (!parametersBalanced) {

        actions.push({
          level: "urgent",
          title: "Présence d’algues détectée",
          text: "Corrigez les paramètres avant traitement.",
          product: "Aucun pour le moment",
          dosage: "Corriger CYA → TAC → pH",
          lock: true
        });

      } else if (algae === "green") {

        actions.push({
          level: "important",
          title: "Algues vertes — Chlore choc",
          text: "Les paramètres sont corrects.",
          product:
            "🔹 Chlore choc pastilles<br>🔹 Chlore choc poudre",
          dosage:
            `<strong>Pastilles :</strong> ${DOSAGES.chloreChocPastille(volume)}<br>
             <strong>Poudre :</strong> ${DOSAGES.chloreChocPoudre(volume)}`
        });

        safetyMessages.push(
          "⏱️ Attendre 24 h avant baignade",
          "⚠️ Ne jamais mélanger"
        );
      }
    }
  }

  /* Sauvegarde finale */
  saveAnalysis({
    volume,
    season,
    treatment,
    ph,
    tac,
    cya,
    algae,
    score: healthScore,
    actionsCount: actions.length
  });

  render(actions, safetyMessages, alerts, healthScore);
}

/* =========================
   RELANCE APRÈS CORRECTION
========================= */
function relaunchAnalysis() {
  goToPage("page-analyse");
}

/* =========================
   AFFICHAGE UX
========================= */
function render(actions, safetyMessages = [], alerts = [], healthScore = 100) {
/* 🔝 Mise à jour du score dans le header */
const headerScore = document.getElementById("header-score");

if (headerScore) {
  headerScore.textContent = `${healthScore} / 100`;
}

  if (!results) return;

  results.innerHTML = "";
// 📸 Image selon état de l'eau
let statusImage = "./images/piscine-propre.jpg";

if (healthScore < 40) {
  statusImage = "./images/piscine-sale.jpg";
} 
else if (healthScore < 70) {
  statusImage = "./images/piscine-moyenne.jpg";
}

results.innerHTML += `
  <div style="
    width:100%;
    text-align:center;
    margin-bottom:16px;
  ">
    <img src="${statusImage}" style="
      width:100%;
      max-width:600px;
      height:auto;
      display:block;
      margin:0 auto;
      border-radius:12px;
      background:#f4f7f9;
    ">
  </div>
`;

  /* 🚨 ALERTES */
  if (alerts.length) {

    results.innerHTML += `
      <div class="card" style="
        background:#ffebee;
        border-left:6px solid #d32f2f;
        color:#b71c1c;
      ">
        <strong>🚨 Alertes importantes</strong>
        <ul>
          ${alerts.map(a => `<li>${a}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  /* 📊 SCORE */
  let scoreColor = "#43A047";

  if (healthScore < 40) scoreColor = "#E53935";
  else if (healthScore < 70) scoreColor = "#FB8C00";

  results.innerHTML += `
    <div class="card" style="
      background:#f5faff;
      border-left:6px solid ${scoreColor};
      text-align:center;
    ">
      <h3>📊 Santé de l’eau</h3>

      <p style="
        font-size:34px;
        font-weight:bold;
        margin:10px 0;
        color:${scoreColor};
      ">
        ${healthScore} / 100
      </p>

      <p class="small">
        ${
          healthScore >= 85
            ? "✅ Excellente qualité"
            : healthScore >= 65
            ? "⚠️ Eau correcte"
            : healthScore >= 40
            ? "❗ Eau instable"
            : "🚨 Eau critique"
        }
      </p>
    </div>
  `;

  /* HEADER */
  if (actions.length) {

    results.innerHTML += `
      <div class="card" style="background:#E3F2FD;">
        <strong>🧭 PoolCare vous guide étape par étape</strong>
        <p>Respectez l’ordre indiqué.</p>
      </div>
    `;

  } else {

    results.innerHTML += `
      <div class="card" style="background:#E8F5E9;border-left:6px solid #43A047;">
        <strong>✅ Eau équilibrée</strong>
        <p>Aucune correction nécessaire.</p>
      </div>
    `;
  }

  /* TRI */
  const order = { urgent: 1, important: 2, info: 3 };
  actions.sort((a, b) => (order[a.level] || 99) - (order[b.level] || 99));

  /* ACTIONS */
  actions.forEach(action => {

    results.innerHTML += `
      <div class="card ${action.level}">
        <h4>${action.title}</h4>
        <p>${action.text}</p>
        <p><strong>Produit :</strong><br>${action.product}</p>
        <p><strong>Dosage :</strong><br>${action.dosage}</p>
      </div>
    `;
  });

  /* RELANCE */
  if (actions.some(a => a.lock)) {

    results.innerHTML += `
      <div style="text-align:center;margin-top:20px;">
        <button onclick="relaunchAnalysis()">
          🔁 Paramètres corrigés → relancer
        </button>
      </div>
    `;
  }

  /* SÉCURITÉ */
  if (safetyMessages.length) {

    results.innerHTML += `
      <div class="card" style="background:#fff3cd;">
        <ul>${safetyMessages.map(m => `<li>${m}</li>`).join("")}</ul>
      </div>
    `;
  }
}

/* =========================
   NAVIGATION
========================= */
function showHistory() {
  const div = document.getElementById("history");
  if (!div) return;

  const history = getHistory();

  if (!history.length) {
    div.innerHTML = "<p>Aucune analyse enregistrée.</p>";
    return;
  }

  div.innerHTML = history
    .slice()
    .reverse()
    .map(h => `
      <div class="card">
        <strong>${h.date}</strong><br>
        📊 Score: ${h.score}/100<br>
        pH: ${h.ph} | TAC: ${h.tac} | CYA: ${h.cya}
      </div>
    `)
    .join("");
}

function goToPage(id) {

  document.querySelectorAll(".page").forEach(p =>
    p.classList.remove("active")
  );

  const page = document.getElementById(id);

  if (page) {
    page.classList.add("active");
  }

  /* Affichage historique au bon moment */
  if (id === "page-history" || id === "page-results") {
    setTimeout(() => {
      renderHistory();
      drawChart();
    }, 50);
  }
}

/* =========================
   PREMIUM
========================= */
function openPremiumLock() {
  document.getElementById("premium-lock")?.classList.remove("hidden");
}
/* =========================
   NOTIFICATIONS PUSH
========================= */

/* Demande autorisation */
function requestNotificationPermission() {
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

/* Envoi notification */
function sendNotification(title, message) {

  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    body: message,
    icon: "logo.png"
  });
}

/* =========================
   AFFICHAGE HISTORIQUE
========================= */
function renderHistory() {

  const box =
  document.getElementById("history") ||
  document.getElementById("history-preview");

  if (!box) return;

  const history = getHistory();

  if (!history.length) {
    box.innerHTML =
      "<p class='small'>Aucune analyse enregistrée.</p>";
    return;
  }

  box.innerHTML = "";

  history.slice().reverse().forEach(item => {

    box.innerHTML += `
      <div class="card">

        <strong>📅 ${item.date}</strong>

        <p class="small">
          Volume : ${item.volume} m³ |
          Traitement : ${item.treatment}
        </p>

        <p>
          pH : ${item.ph} |
          TAC : ${item.tac} |
          CYA : ${item.cya}
        </p>

        <p>
          🌿 Algues : ${item.algae}
        </p>

        <p>
          📊 Score : <strong>${item.score}/100</strong>
        </p>

        <p class="small">
          Actions : ${item.actionsCount}
        </p>

      </div>
    `;
  });
}

/* =========================
   GRAPHIQUE
========================= */
function drawChart() {

  const canvas = document.getElementById("historyChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const data = ANALYSIS_HISTORY.slice(-10);

  const scores = data.map(a => a.score);

  ctx.clearRect(0,0,canvas.width,canvas.height);

  const max = 100;
  const padding = 20;

  const w = canvas.width - padding*2;
  const h = canvas.height - padding*2;

  ctx.beginPath();
  ctx.moveTo(padding, padding + h);

  scores.forEach((s,i)=>{

    const x = padding + (i/(scores.length-1||1))*w;
    const y = padding + h - (s/max)*h;

    ctx.lineTo(x,y);
  });

  ctx.strokeStyle = "#1E88E5";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Points
  ctx.fillStyle = "#1E88E5";

  scores.forEach((s,i)=>{
    const x = padding + (i/(scores.length-1||1))*w;
    const y = padding + h - (s/max)*h;

    ctx.beginPath();
    ctx.arc(x,y,3,0,Math.PI*2);
    ctx.fill();
  });
}
