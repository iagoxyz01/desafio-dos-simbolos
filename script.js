/*
 * Desafio dos Símbolos
 * Para ativar o ranking compartilhado, preencha SUPABASE_URL e SUPABASE_ANON_KEY.
 * Não coloque chaves service_role no código do navegador.
 */
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const TOTAL_TIME = 120;
const BASE_POINTS = 100;
const SYMBOLS = ["🍎", "🍌", "⭐", "💎", "🍇", "🍒", "🌙", "🍋", "⚽", "🧁", "🐸", "🌻"];

const $ = (id) => document.getElementById(id);
const screens = ["home", "game", "result", "ranking"];
let supabaseClient = null;
let teamName = "";
let phases = [];
let phaseIndex = 0;
let points = 0;
let correctAnswers = 0;
let remaining = TOTAL_TIME;
let startedAt = 0;
let timerInterval = null;
let finished = false;
let results = [];

if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function showScreen(name) {
  screens.forEach((screen) => $(screen).classList.toggle("hidden", screen !== name));
}
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

// Gera uma equação linear com solução inteira e uma última linha que exige atenção
// à quantidade de símbolos. Cada partida usa símbolos e valores diferentes.
function makePhase() {
  const [a, b, c] = shuffle(SYMBOLS).slice(0, 3);
  const x = randomInt(2, 10);
  const y = randomInt(2, 9);
  const z = randomInt(1, 8);
  const count = randomInt(2, 4);
  const target = x + y * 2;
  const rows = [
    { parts: [{ symbol: a, n: 3 }, { op: "=" }, { value: x * 3 }] },
    { parts: [{ symbol: a, n: 1 }, { op: "+" }, { symbol: b, n: 2 }, { op: "=" }, { value: x + 2 * y }] },
    { parts: [{ symbol: b, n: 1 }, { op: "+" }, { symbol: c, n: 1 }, { op: "=" }, { value: y + z }] },
    { parts: [{ symbol: a, n: 1 }, { op: "+" }, { symbol: b, n: 1 }, { op: "×" }, { value: 2 }, { op: "=" }, { value: x + 2 * y }] }
  ];
  // Última linha visual: usa os valores revelados nas três primeiras relações,
  // com a precedência multiplicativa explícita no resultado calculado.
  // A terceira linha fornece c = (y+z)-y = z; a linha final usa a + b × 2.
  rows[3].parts[rows[3].parts.length - 1].value = x + 2 * y;
  return {
    symbols: { a, b, c }, values: { x, y, z },
    rows,
    answer: x + 2 * y,
    // A imagem final altera a quantidade de um símbolo para chamar atenção.
    trick: { symbol: b, count, answer: x + count * y }
  };
}

// As fases são geradas com equações internamente consistentes. A linha final
// pede a + (quantidade de b × valor de b); as três primeiras linhas permitem
// encontrar os valores dos símbolos sem depender de conhecimento externo.
function buildPhase() {
  const [a,b,c] = shuffle(SYMBOLS).slice(0,3);
  const av = randomInt(2,9), bv = randomInt(2,9), cv = randomInt(1,8);
  const aCount = randomInt(2,4), bCount = randomInt(2,4);
  const answer = av + bCount * bv;
  return {
    answer,
    rows: [
      [{s:a,n:3},{op:"="},{v:av*3}],
      [{s:a,n:1},{op:"+"},{s:b,n:2},{op:"="},{v:av+2*bv}],
      [{s:b,n:1},{op:"+"},{s:c,n:1},{op:"="},{v:bv+cv}],
      [{s:a,n:1},{op:"+"},{s:b,n:bCount},{op:"="},{v:answer}]
    ],
    symbols: {a,b,c}, values: {a:av,b:bv,c:cv}, trick: {symbol:b,count:bCount}
  };
}
function generateGame() {
  // Evita repetir exatamente a mesma combinação de símbolos entre fases.
  const used = new Set();
  return Array.from({length:5}, () => {
    let phase = buildPhase(), key = phase.rows.map(row => row.map(p => p.s || "").join("")).join("");
    let attempts = 0;
    while (used.has(key) && attempts++ < 20) {
      phase = buildPhase();
      key = phase.rows.map(row => row.map(p => p.s || "").join("")).join("");
    }
    used.add(key);
    return phase;
  });
}
function renderEquation(parts) {
  const row = document.createElement("div");
  row.className = "equation";
  parts.forEach(part => {
    const span = document.createElement("span");
    if (part.s) {
      span.className = "symbol";
      span.textContent = part.s.repeat(part.n || 1);
      span.setAttribute("aria-label", `${part.n || 1} símbolo(s)`);
    } else if (part.op) {
      span.className = "equals";
      span.textContent = part.op;
    } else {
      span.textContent = String(part.v);
    }
    row.appendChild(span);
  });
  return row;
}
function renderPhase() {
  const phase = phases[phaseIndex];
  $("phaseTitle").textContent = `Fase ${phaseIndex + 1} de 5`;
  $("progressBar").style.width = `${(phaseIndex / 5) * 100}%`;
  $("phaseScore").textContent = `Pontuação: ${points}`;
  $("equations").replaceChildren(...phase.rows.map(renderEquation));
  $("answer").value = "";
  $("feedback").textContent = "";
  $("feedback").className = "feedback";
  $("answer").disabled = false;
  $("answer").focus();
}
function startGame(event) {
  event.preventDefault();
  const name = $("teamName").value.trim();
  if (!name) return;
  teamName = name;
  phases = generateGame();
  phaseIndex = 0;
  points = 0;
  correctAnswers = 0;
  remaining = TOTAL_TIME;
  startedAt = Date.now();
  finished = false;
  $("teamLabel").textContent = teamName.toLocaleUpperCase("pt-BR");
  $("timer").textContent = formatTime(remaining);
  $("timer").parentElement.classList.remove("urgent");
  showScreen("game");
  renderPhase();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    remaining = Math.max(0, TOTAL_TIME - Math.floor((Date.now() - startedAt) / 1000));
    $("timer").textContent = formatTime(remaining);
    $("timer").parentElement.classList.toggle("urgent", remaining <= 20);
    if (remaining <= 0) finishGame(true);
  }, 200);
}
function submitAnswer(event) {
  event.preventDefault();
  if (finished || remaining <= 0) return;
  const value = Number($("answer").value);
  if ($("answer").value.trim() === "") return;
  const phase = phases[phaseIndex];
  if (Number.isFinite(value) && value === phase.answer) {
    points += BASE_POINTS;
    correctAnswers++;
    $("feedback").textContent = "Resposta correta! +100 pontos";
    $("feedback").className = "feedback good";
  } else {
    $("feedback").textContent = `Resposta incorreta. A resposta era ${phase.answer}. Próxima fase!`;
    $("feedback").className = "feedback bad";
  }
  $("answer").disabled = true;
  $("phaseScore").textContent = `Pontuação: ${points}`;
  window.setTimeout(() => {
    if (finished) return;
    phaseIndex++;
    if (phaseIndex >= phases.length) finishGame(false);
    else renderPhase();
  }, 650);
}
async function saveResult(result) {
  // Sem backend, o jogo continua funcional e salva o placar apenas neste navegador.
  const local = JSON.parse(localStorage.getItem("symbolGameResults") || "[]");
  local.push(result);
  localStorage.setItem("symbolGameResults", JSON.stringify(local.slice(-100)));
  if (!supabaseClient) return { saved: true, shared: false };
  const { error } = await supabaseClient.from("scores").insert([{
    team_name: result.teamName,
    score: result.score,
    time_seconds: result.timeSeconds,
    correct_answers: result.correctAnswers,
    created_at: result.createdAt
  }]);
  if (error) {
    console.error("Erro ao salvar no Supabase:", error.message);
    return { saved: true, shared: false, error: true };
  }
  return { saved: true, shared: true };
}
async function finishGame(timedOut) {
  if (finished) return;
  finished = true;
  clearInterval(timerInterval);
  remaining = Math.max(0, TOTAL_TIME - Math.floor((Date.now() - startedAt) / 1000));
  const timeSeconds = TOTAL_TIME - remaining;
  // Bônus de velocidade: até 100 pontos, proporcional ao tempo economizado.
  const speedBonus = Math.round((remaining / TOTAL_TIME) * 100);
  const total = points + speedBonus;
  const result = {
    teamName, score: total, baseScore: points, bonus: speedBonus,
    timeSeconds, correctAnswers, createdAt: new Date().toISOString(), timedOut
  };
  $("progressBar").style.width = "100%";
  $("resultTitle").textContent = timedOut ? "O tempo acabou!" : "Desafio concluído!";
  $("resultMessage").textContent = timedOut
    ? "O cronômetro chegou a zero. Confira seu resultado e tente novamente."
    : "Boa! Veja a pontuação da sua equipe e confira o ranking.";
  $("finalScore").textContent = total;
  $("timeSpent").textContent = formatTime(timeSeconds);
  $("correctCount").textContent = `${correctAnswers}/5`;
  $("saveStatus").textContent = "Salvando resultado…";
  showScreen("result");
  const saved = await saveResult(result);
  $("saveStatus").textContent = saved.shared
    ? "Resultado salvo no ranking compartilhado."
    : saved.error
      ? "Resultado salvo neste navegador. Não foi possível atualizar o ranking online."
      : "Resultado salvo neste navegador. Configure o Supabase para compartilhar o ranking entre dispositivos.";
}
function getLocalResults() {
  try { return JSON.parse(localStorage.getItem("symbolGameResults") || "[]"); }
  catch { return []; }
}
async function showRanking() {
  showScreen("ranking");
  $("rankingList").innerHTML = '<div class="empty-ranking">Carregando ranking…</div>';
  $("rankingNote").textContent = "";
  let list = [];
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from("scores")
      .select("team_name, score, time_seconds, correct_answers, created_at")
      .order("score", {ascending:false}).order("time_seconds", {ascending:true}).limit(50);
    if (!error && data) {
      list = data.map(row => ({
        teamName: row.team_name, score: row.score, timeSeconds: row.time_seconds,
        correctAnswers: row.correct_answers, createdAt: row.created_at
      }));
    } else {
      list = getLocalResults();
      $("rankingNote").textContent = "Não foi possível consultar o ranking online; mostrando resultados deste navegador.";
    }
  } else {
    list = getLocalResults();
    $("rankingNote").textContent = "Ranking local deste navegador. Configure o Supabase para reunir resultados de todas as equipes.";
  }
  list.sort((a,b) => b.score - a.score || a.timeSeconds - b.timeSeconds);
  if (!list.length) {
    $("rankingList").innerHTML = '<div class="empty-ranking">Ainda não há resultados. Seja a primeira equipe a jogar!</div>';
    return;
  }
  $("rankingList").replaceChildren(...list.slice(0,50).map((item,index) => {
    const row = document.createElement("div"); row.className = "rank-row";
    const pos = document.createElement("div"); pos.className = "rank-position";
    pos.textContent = ["🥇","🥈","🥉"][index] || `${index+1}º`;
    const details = document.createElement("div");
    const name = document.createElement("div"); name.className = "rank-name"; name.textContent = item.teamName;
    const detail = document.createElement("div"); detail.className = "rank-detail";
    detail.textContent = `${item.correctAnswers ?? "—"}/5 acertos • ${formatTime(item.timeSeconds)} • ${new Date(item.createdAt).toLocaleDateString("pt-BR")}`;
    details.append(name,detail);
    const score = document.createElement("div"); score.className = "rank-points"; score.textContent = `${item.score} pts`;
    row.append(pos,details,score); return row;
  }));
}
$("startForm").addEventListener("submit", startGame);
$("answerForm").addEventListener("submit", submitAnswer);
$("rankingTop").addEventListener("click", showRanking);
$("rankingResult").addEventListener("click", showRanking);
$("closeRanking").addEventListener("click", () => showScreen("home"));
$("playAgain").addEventListener("click", () => { $("teamName").value = teamName; showScreen("home"); $("teamName").focus(); });
