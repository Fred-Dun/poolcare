/*************************************************
 * POOLCARE — APP
 *************************************************/

const results = document.getElementById("results");

requestNotificationPermission();

/* =========================
   HISTORIQUE
========================= */

function getHistory() {
  return JSON.parse(
    localStorage.getItem("poolcare_history")
  ) || [];
}

let ANALYSIS_HISTORY = getHistory();

function saveAnalysis(data) {

  let history = getHistory();

  history.push({
    date: new Date().toLocaleString(),
    ...data
  });

  if (history.length > 50) history.shift();

  localStorage.setItem(
    "poolcare_history",
    JSON.stringify(history)
  );

  ANALYSIS_HISTORY = history;
}

/* =========================
   SCORE
========================= */

function calculateHealthScore({ ph, tac, cya, algae }) {

  let score = 100;

  if (cya > 60) score -= 25;
  if (tac < 80 || tac > 130) score -= 20;
  if (ph < 7 || ph > 7.4) score -= 20;
  if (algae !== "none") score -= 25;

  if (score < 0) score = 0;

  return score;
}

/* =========================
   ANALYSE
========================= */

function analyze() {

  const ph = Number(document.getElementById("ph").value);
  const tac = Number(document.getElementById("tac").value);
  const cya = Number(document.getElementById("cya").value);
  const algae = document.getElementById("algae").value;

  const score = calculateHealthScore({
    ph,tac,cya,algae
  });

  saveAnalysis({
    ph,tac,cya,algae,score
  });

  render(score);
}

/* =========================
   AFFICHAGE
========================= */

function render(score){

  if(!results) return;

  results.innerHTML = "";

  let image = "images/piscine-propre.jpg";

  if(score < 40){
    image = "images/piscine-sale.jpg";
  }
  else if(score < 70){
    image = "images/piscine-moyenne.jpg";
  }

  results.innerHTML += `
    <img src="${image}"
    style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;">
  `;

  results.innerHTML += `
    <div class="card" style="text-align:center;">
      <h3>Santé de l'eau</h3>
      <h1>${score} / 100</h1>
    </div>
  `;

  renderHistory();
  drawChart();
}

/* =========================
   NAVIGATION
========================= */

function goToPage(id){

  document.querySelectorAll(".page")
    .forEach(p=>p.classList.remove("active"));

  document.getElementById(id)
    ?.classList.add("active");

}

/* =========================
   HISTORIQUE
========================= */

function renderHistory(){

  const box =
    document.getElementById("history") ||
    document.getElementById("history-preview");

  if(!box) return;

  const history = getHistory();

  if(!history.length){
    box.innerHTML = "<p>Aucun historique</p>";
    return;
  }

  box.innerHTML = "";

  history.slice().reverse().forEach(h=>{

    box.innerHTML += `
      <div class="card">
        <strong>${h.date}</strong><br>
        pH: ${h.ph} | TAC: ${h.tac} | CYA: ${h.cya}<br>
        Score: ${h.score}/100
      </div>
    `;
  });

}

/* =========================
   GRAPHIQUE
========================= */

function drawChart(){

  const canvas =
    document.getElementById("historyChart");

  if(!canvas) return;

  const ctx = canvas.getContext("2d");

  const data = ANALYSIS_HISTORY.slice(-10);

  if(data.length < 2) return;

  ctx.clearRect(0,0,canvas.width,canvas.height);

  const w = canvas.width - 40;
  const h = canvas.height - 40;

  ctx.beginPath();
  ctx.moveTo(20,20+h);

  data.forEach((d,i)=>{

    const x = 20 + (i/(data.length-1))*w;
    const y = 20 + h - (d.score/100)*h;

    ctx.lineTo(x,y);
  });

  ctx.strokeStyle = "#1E88E5";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* =========================
   NOTIFS
========================= */

function requestNotificationPermission(){

  if(!("Notification" in window)) return;

  if(Notification.permission==="default"){
    Notification.requestPermission();
  }
}

function sendNotification(title,msg){

  if(Notification.permission!=="granted") return;

  new Notification(title,{
    body:msg,
    icon: window.location.origin+"/poolcare/logo.png"
  });
}
