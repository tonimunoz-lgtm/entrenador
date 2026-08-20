/* ==========================================================================
   FORJA21 — App logic
   ========================================================================== */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const STORE_KEYS = {
  settings: "forja21_settings",
  weights: "forja21_weights",
  workouts: "forja21_workouts",
  supps: "forja21_supp_checks"
};

function storeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function storeSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

const state = {
  settings: storeGet(STORE_KEYS.settings, { ...PROFILE_DEFAULTS, onboarded: false }),
  weights: storeGet(STORE_KEYS.weights, []),
  workouts: storeGet(STORE_KEYS.workouts, []),
  supps: storeGet(STORE_KEYS.supps, {}),
  activeTab: "hoy",
  calendarView: "semana",     // "semana" | "mes"
  calendarCursor: new Date()  // mes que se está mirando en la vista de calendario
};

/* ---------------- Date helpers ---------------- */
function pad2(n) { return String(n).padStart(2, "0"); }
function dateKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseDate(str) { const [y, m, d] = str.split("-").map(Number); return new Date(y, m - 1, d); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function nextMonday(d) {
  const day = d.getDay(); // 0=sun..6=sat
  const add = day === 1 ? 0 : (day === 0 ? 1 : 8 - day);
  return addDays(startOfDay(d), add);
}

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_ES_LONG = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DOW_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DOW_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const DOW_MINI = ["D", "L", "M", "X", "J", "V", "S"];

function fmtDateShort(d) { return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`; }

function getWeekNumber(date) {
  const start = startOfDay(parseDate(state.settings.startDate));
  const d = startOfDay(date);
  const diffDays = Math.round((d - start) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

// Monday..Sunday dates for a given week number (1-indexed), week1 monday == settings.startDate
function weekDates(weekNumber) {
  const start = startOfDay(parseDate(state.settings.startDate));
  const monday = addDays(start, (weekNumber - 1) * 7);
  return DAY_ORDER.map((key, i) => ({ key, date: addDays(monday, i) }));
}

function todayInfo() {
  const now = new Date();
  const week = getWeekNumber(now); // puede ser <1 si el plan aún no ha empezado
  const dayKey = JS_DOW_TO_KEY[now.getDay()];
  return { date: now, week, dayKey };
}

function getScheduleForDate(date) {
  const week = getWeekNumber(date);
  if (week < 1) return null;
  const dayKey = JS_DOW_TO_KEY[date.getDay()];
  return getDaySchedule(week, dayKey);
}

/* ---------------- Toast / Modal ---------------- */
let toastTimer = null;
function showToast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function openModal(titleHTML, bodyHTML) {
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "modalBackdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-handle"></div>
      ${titleHTML}
      ${bodyHTML}
    </div>`;
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  document.body.appendChild(backdrop);
}
function closeModal() {
  const el = $("#modalBackdrop");
  if (el) el.remove();
}

/* ---------------- Pace helpers ---------------- */
function parsePaceToSec(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d+):([0-5]\d)$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function formatPaceDiff(sec) {
  const sign = sec > 0 ? "+" : sec < 0 ? "−" : "";
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60), s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, "0")}/km`;
}
function paceDiffClass(sec) {
  if (sec === null || sec === undefined) return "";
  if (Math.abs(sec) <= 5) return "status-ontrack";
  return sec < 0 ? "status-ahead" : "status-behind";
}

/* ---------------- Exercise reference links ---------------- */
function exerciseVideoUrl(name) {
  const q = encodeURIComponent(name + " técnica ejercicio");
  return `https://www.youtube.com/results?search_query=${q}`;
}

/* ---------------- Weight helpers ---------------- */
function latestWeight() {
  if (state.weights.length) return state.weights[state.weights.length - 1].weight;
  return state.settings.startWeight;
}
function weightProgressPct() {
  const startW = state.settings.startWeight;
  const finalW = 71.5;
  const totalLoss = startW - finalW;
  const lost = startW - latestWeight();
  return Math.min(100, Math.max(0, (lost / totalLoss) * 100));
}
function getWeightLog(week) { return state.weights.find(w => w.week === week); }
function saveWeight(week, weight) {
  const idx = state.weights.findIndex(w => w.week === week);
  const entry = { week, date: dateKey(new Date()), weight };
  if (idx >= 0) state.weights[idx] = entry; else state.weights.push(entry);
  state.weights.sort((a, b) => a.week - b.week);
  storeSet(STORE_KEYS.weights, state.weights);
}
function weightStatus(week) {
  const target = getWeightTargetForWeek(week);
  const log = getWeightLog(week);
  if (!target) return { label: "Fase de mantenimiento", cls: "status-none" };
  if (!log) return { label: "Pendiente de pesaje", cls: "status-none" };
  const diff = log.weight - target.weight;
  if (Math.abs(diff) <= 0.25) return { label: "En objetivo", cls: "status-ontrack", diff };
  if (diff < 0) return { label: `${Math.abs(diff).toFixed(1)} kg por delante`, cls: "status-ahead", diff };
  return { label: `${diff.toFixed(1)} kg por detrás`, cls: "status-behind", diff };
}

/* ---------------- Supplements ---------------- */
function getSuppChecks(dk) { return state.supps[dk] || []; }
function toggleSupp(dk, id) {
  const list = new Set(getSuppChecks(dk));
  if (list.has(id)) list.delete(id); else list.add(id);
  state.supps[dk] = Array.from(list);
  storeSet(STORE_KEYS.supps, state.supps);
}

function renderSupplements(day, dateObj) {
  const dk = dateKey(dateObj);
  const checks = getSuppChecks(dk);
  const items = day.supplements.map(id => SUPPLEMENTS.find(s => s.id === id)).filter(Boolean);
  return `
    <div class="card">
      <div class="card-row"><h4>Suplementación de hoy</h4><span class="badge">${checks.length}/${items.length}</span></div>
      <p class="phase-summary" style="margin-top:4px">Márcalos según los vayas tomando — así llevas el control de cumplimiento.</p>
      <div class="supp-list" data-supp-list data-date="${dk}" style="margin-top:6px">
        ${items.map(s => {
          const detail = SUPPLEMENT_DETAILS.find(d => d.id === s.id);
          return `
          <div class="supp-item ${checks.includes(s.id) ? "checked" : ""}" data-supp-id="${s.id}">
            <div class="supp-check">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="opacity:${checks.includes(s.id) ? 1 : 0}"><path d="M5 12l5 5L19 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="supp-body">
              <div class="supp-name">${s.name}</div>
              <div class="supp-when">${s.when}</div>
              <div class="supp-brand">${detail ? detail.brand : s.brand}</div>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

/* ---------------- Day card renderer (shared) ---------------- */
function renderTrainingBody(day) {
  const t = day.training;
  if (!t) return "";
  let html = `<div class="card"><h4>${t.title || "Entreno"}</h4>`;

  if (t.detail) html += `<p class="phase-summary" style="margin-top:8px">${t.detail}</p>`;

  if (t.todayDistance) {
    const numMatch = t.todayDistance.match(/[\d.,]+\s?km/);
    html += `<div class="distance-hero"><span class="distance-num">${numMatch ? numMatch[0] : t.todayDistance}</span></div>
      <p class="phase-summary">${t.todayDistance}</p>`;
  }

  if (t.targetPace) {
    html += `<div class="badge-row" style="margin-top:8px"><span class="badge">🎯 Ritmo objetivo ${t.targetPace} min/km</span></div>`;
  }

  if (t.exercises) {
    html += `<div style="margin-top:10px">` + t.exercises.map(ex => `
      <div class="exercise">
        <div>
          <div class="exercise-name">${ex.name}</div>
          ${ex.note ? `<div class="exercise-note">${ex.note}</div>` : ""}
          <a class="exercise-video" href="${exerciseVideoUrl(ex.name)}" target="_blank" rel="noopener">▶ Ver ejemplo</a>
        </div>
        <div>
          <div class="exercise-set">${ex.sets}</div>
          <div class="exercise-rest">${ex.rest} descanso</div>
        </div>
      </div>`).join("") + `</div>`;
  }
  if (t.cardio) {
    html += `<div class="exercise" style="border-top:1px solid var(--border)">
      <div><div class="exercise-name">Cardio en cinta</div><div class="exercise-note">${t.cardio}</div></div>
    </div>`;
  }
  if (t.blocks) {
    html += `<div style="margin-top:6px">` + t.blocks.map(b => `
      <div class="block-item">
        <div class="block-range">${b.range}</div>
        <div class="block-text">${b.text}</div>
      </div>`).join("") + `</div>`;
  }
  if (t.note) html += `<p class="phase-summary" style="margin-top:10px">${t.note}</p>`;

  html += `</div>`;
  return html;
}

function renderMealsBody(day) {
  const m = day.meals;
  if (!m) return "";
  return `
    <div class="card">
      <div class="card-row"><h4>Nutrición</h4><span class="badge"><span class="dot" style="background:${m.zoneColor}"></span>${m.label}</span></div>
      <div style="margin-top:8px">
        ${m.items.map(it => `
          <div class="meal">
            <div class="meal-tag">${it.meal}</div>
            <div class="meal-text">${it.text}</div>
          </div>`).join("")}
      </div>
      ${day.note ? `<div class="divider"></div><p class="phase-summary">${day.note}</p>` : ""}
    </div>`;
}

function renderDayTypeBadge(day) {
  return `<span class="daytype-pill type-${day.type}"><span class="dot"></span>${day.typeLabel}</span>`;
}

function fullDayHTML(day, dateObj) {
  let html = "";
  if (day.isGeneralPhase) {
    html += `<div class="card">
      <div class="card-row">${renderDayTypeBadge(day)}</div>
      <p class="phase-summary" style="margin-top:10px">Esta fase (${day.phase.name}) no tiene un calendario día a día detallado — sigue las pautas generales de la fase: ${day.phase.summary}</p>
    </div>`;
  } else {
    html += `<div class="card-row" style="margin-bottom:2px">${renderDayTypeBadge(day)}</div>`;
    html += renderTrainingBody(day);
  }
  html += renderMealsBody(day);
  html += renderSupplements(day, dateObj);
  return html;
}

/* ---------------- Workouts ---------------- */
function logWorkout(entry) {
  entry.id = "w" + Date.now();
  state.workouts.unshift(entry);
  storeSet(STORE_KEYS.workouts, state.workouts);
}
function workoutsForDate(dk) { return state.workouts.filter(w => w.date === dk); }

function openWorkoutForm(day, dateObj) {
  const dk = dateKey(dateObj);
  const targetPace = day.training?.targetPace || "";
  openModal(
    `<div class="modal-title">Registrar sesión</div><div class="modal-desc">${day.label} · ${fmtDateShort(dateObj)} · ${day.typeLabel}${targetPace ? ` · 🎯 ${targetPace} min/km` : ""}</div>`,
    `<form id="workoutForm">
      <div class="log-grid">
        <div class="log-field"><label>Distancia (km)</label><input inputmode="decimal" name="distance" placeholder="12.0" /></div>
        <div class="log-field"><label>Tiempo (hh:mm:ss)</label><input name="time" placeholder="1:02:30" /></div>
        <div class="log-field"><label>Ritmo medio (min/km)</label><input name="pace" placeholder="${targetPace || "4:55"}" /></div>
        <div class="log-field"><label>FC media (ppm)</label><input inputmode="numeric" name="hr" placeholder="122" /></div>
      </div>
      <div class="field" style="margin-top:6px"><label>Notas</label><input name="notes" placeholder="Sensaciones, dolores, clima…" /></div>
      <div class="btn-row" style="margin-top:6px">
        <button type="button" class="btn btn-ghost" id="cancelWorkout">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar sesión</button>
      </div>
    </form>`
  );
  $("#cancelWorkout").addEventListener("click", closeModal);
  $("#workoutForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const paceStr = fd.get("pace") || "";
    let deviationSec = null;
    if (targetPace && paceStr) {
      const t = parsePaceToSec(targetPace);
      const a = parsePaceToSec(paceStr);
      if (t !== null && a !== null) deviationSec = a - t;
    }
    logWorkout({
      date: dk, dayKey: day.key, week: day.weekNumber,
      distance: fd.get("distance") || "", time: fd.get("time") || "",
      pace: paceStr, hr: fd.get("hr") || "", notes: fd.get("notes") || "",
      targetPace, deviationSec
    });
    closeModal();
    if (deviationSec !== null) {
      showToast(`Sesión guardada · ${formatPaceDiff(deviationSec)} vs. objetivo`);
    } else {
      showToast("Sesión guardada 💪");
    }
    render();
  });
}

/* ==========================================================================
   ONBOARDING (primera vez)
   ========================================================================== */
function renderOnboarding() {
  $("#bottomnav").style.display = "none";
  $("#routeBar").innerHTML = "";
  const statStrip = $("#statStrip");
  if (statStrip) statStrip.innerHTML = "";
  $("#topbarSub").textContent = "Bienvenida";

  const suggestedStart = dateKey(nextMonday(new Date()));

  $("#view").innerHTML = `
    <div class="hero">
      <div class="hero-eyebrow">Bienvenido a Forja21</div>
      <div class="hero-title">Tu entrenador hacia Granollers</div>
      <p class="hero-desc">
        Este plan te lleva en ${PHASES[2].weeks[1]} semanas hasta la
        <b style="color:var(--text)">Mitja Marató de Granollers</b> (${PROFILE_DEFAULTS.raceGoal}), pesando ${WEEKLY_WEIGHTS_BLOQUE1[WEEKLY_WEIGHTS_BLOQUE1.length - 1].weight} kg el día de la carrera.
        Después, dos fases más de construcción muscular y definición te llevan a un físico marcado
        para finales de junio, con los abdominales visibles.
      </p>
      <div class="badge-row">
        <span class="badge">🏁 22 de enero · Granollers</span>
        <span class="badge">💪 Junio · Definición</span>
      </div>
    </div>

    <div class="card">
      <h4>Vamos a configurarlo</h4>
      <p class="phase-summary" style="margin-top:6px">Solo hace falta esto una vez.</p>
      <form id="onboardForm" style="margin-top:12px">
        <div class="field">
          <label>¿Cómo te llamas?</label>
          <input name="name" placeholder="Tu nombre" required />
        </div>
        <div class="field">
          <label>¿Qué lunes empiezas la semana 1?</label>
          <input name="startDate" type="date" value="${suggestedStart}" required />
        </div>
        <div class="field">
          <label>Tu peso de hoy (kg)</label>
          <input name="startWeight" type="number" step="0.1" value="87.5" required />
        </div>
        <button type="submit" class="btn btn-primary">Empezar mi plan</button>
      </form>
    </div>`;

  $("#onboardForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.settings.name = fd.get("name") || "Atleta";
    state.settings.startDate = fd.get("startDate");
    state.settings.startWeight = parseFloat(fd.get("startWeight")) || 87.5;
    state.settings.onboarded = true;
    storeSet(STORE_KEYS.settings, state.settings);
    $("#bottomnav").style.display = "";
    state.activeTab = "hoy";
    render();
  });
}

/* ---------------- Route bar (phase progress signature element) ---------------- */
function renderRouteBar() {
  const { week } = todayInfo();
  const bar = $("#routeBar");
  bar.innerHTML = "";
  PHASES.forEach(p => {
    const seg = document.createElement("div");
    const span = p.weeks[1] - p.weeks[0] + 1;
    seg.className = "route-seg";
    seg.style.flexGrow = span;
    let st = "future";
    if (week > p.weeks[1]) st = "done";
    else if (week >= p.weeks[0]) st = "current";
    const i = document.createElement("i");
    if (st === "done") i.style.width = "100%";
    if (st === "current") {
      const pct = Math.min(100, Math.max(4, ((week - p.weeks[0] + 1) / span) * 100));
      i.style.width = pct + "%";
      seg.classList.add("current");
    }
    if (st === "done") seg.classList.add("done");
    seg.appendChild(i);
    seg.title = `${p.name} · semanas ${p.weeks[0]}–${p.weeks[1]}`;
    bar.appendChild(seg);
  });
  $("#topbarSub").textContent = week < 1
    ? `Empieza en ${-week + 1} semana${-week + 1 === 1 ? "" : "s"}`
    : `Semana ${week} · ${getPhaseForWeek(week).name}`;
}

/* ---------------- Persistent stat strip (visible on every tab) ---------------- */
function renderStatStrip() {
  const el = $("#statStrip");
  if (!el) return;
  const { week, date } = todayInfo();

  if (week < 1) {
    const days = Math.ceil((startOfDay(parseDate(state.settings.startDate)) - startOfDay(date)) / 86400000);
    el.innerHTML = `
      <div class="stat-chip"><b>${days}</b><span>días para empezar</span></div>
      <div class="stat-chip"><b>${state.settings.startWeight} kg</b><span>peso de salida</span></div>`;
    return;
  }

  const st = weightStatus(week);
  const dayKey = JS_DOW_TO_KEY[date.getDay()];
  const day = getDaySchedule(week, dayKey);
  const dk = dateKey(date);
  const checks = getSuppChecks(dk);

  el.innerHTML = `
    <div class="stat-chip"><b>S${week}</b><span>semana</span></div>
    <div class="stat-chip"><b class="${st.cls === "status-ontrack" ? "ok" : st.cls === "status-behind" ? "warn" : ""}">${latestWeight().toFixed(1)} kg</b><span>${st.label}</span></div>
    <div class="stat-chip"><b>${day.typeLabel}</b><span>hoy</span></div>
    <div class="stat-chip"><b>${checks.length}/${day.supplements.length}</b><span>suplementos</span></div>`;
}

/* ==========================================================================
   TAB RENDERERS
   ========================================================================== */

function renderHoy() {
  const { date, week, dayKey } = todayInfo();
  const name = state.settings.name || "Atleta";
  const hour = date.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  // ---- Plan aún no ha empezado ----
  if (week < 1) {
    const startD = startOfDay(parseDate(state.settings.startDate));
    const days = Math.ceil((startD - startOfDay(date)) / 86400000);
    const w1sat = weekDates(1).find(d => d.key === "sat");
    $("#view").innerHTML = `
        <div class="hero">
          <div class="hero-eyebrow">${greeting}, ${name}</div>
          <div class="hero-title">Tu plan empieza en ${days} día${days === 1 ? "" : "s"}</div>
          <p class="hero-desc">La semana 1 arranca el lunes ${fmtDateShort(startD)}. Objetivo: llegar a la Mitja Marató de Granollers el 24 de enero de 2027 pesando ${WEEKLY_WEIGHTS_BLOQUE1[WEEKLY_WEIGHTS_BLOQUE1.length - 1].weight} kg.</p>
          <div class="badge-row">
            <span class="badge">⚖️ Peso de salida: ${state.settings.startWeight} kg</span>
            <span class="badge">🏁 ${PROFILE_DEFAULTS.raceGoal}</span>
          </div>
        </div>
        <div class="card">
          <h4>Puedes cambiar la fecha de inicio</h4>
          <p class="phase-summary" style="margin-top:6px">Si prefieres empezar otro día, ve a Ajustes → Fecha de inicio del plan.</p>
          <button class="btn btn-ghost" id="goSettings" style="margin-top:10px">Ir a Ajustes</button>
        </div>`;
    $("#goSettings").addEventListener("click", () => { state.activeTab = "ajustes"; render(); });
    return;
  }

  const day = getDaySchedule(week, dayKey);
  const dk = dateKey(date);
  const phase = day.phase;
  const isTrainingDay = ["gym", "quality", "long"].includes(day.type);
  const hasLog = workoutsForDate(dk).length > 0;

  // ---- stats ----
  const pct = weightProgressPct();
  let trainingStatTile;
  if (!day.isGeneralPhase) {
    const trainKeys = trainingDayKeysForWeek();
    const wd = weekDates(week).filter(d => trainKeys.includes(d.key) && startOfDay(d.date) <= startOfDay(date));
    const done = wd.filter(d => workoutsForDate(dateKey(d.date)).length > 0).length;
    trainingStatTile = `<div class="stat-tile"><div class="stat-tile-val">${done}/${trainKeys.length}</div><div class="stat-tile-label">Entrenos semana</div></div>`;
  } else {
    const thisWeekWorkouts = weekDates(week).filter(d => workoutsForDate(dateKey(d.date)).length > 0).length;
    trainingStatTile = `<div class="stat-tile"><div class="stat-tile-val">${thisWeekWorkouts}</div><div class="stat-tile-label">Sesiones semana</div></div>`;
  }
  const suppChecks = getSuppChecks(dk);

  // ---- reminders ----
  let reminderHTML = "";
  const tomorrow = addDays(date, 1);
  const tomorrowWeek = getWeekNumber(tomorrow);
  if (JS_DOW_TO_KEY[tomorrow.getDay()] === "sat" && tomorrowWeek >= 1 && !getWeightLog(tomorrowWeek)) {
    const t = getWeightTargetForWeek(tomorrowWeek);
    reminderHTML = `
      <div class="card" style="border-color: color-mix(in srgb, var(--z4) 40%, var(--border))">
        <div class="card-row"><span>⏰</span><h4 style="flex:1">Mañana toca báscula</h4></div>
        <p class="phase-summary" style="margin-top:6px">En ayunas, nada más levantarte. Objetivo semana ${tomorrowWeek}: <b style="color:var(--brand-2)">${t ? t.weight + " kg" : "—"}</b>.</p>
      </div>`;
  }

  let html = `
    <div class="hero">
      <div class="hero-eyebrow">${greeting}, ${name}</div>
      <div class="hero-title">${DOW_LONG[date.getDay()]} · ${day.typeLabel}</div>
      <p class="hero-desc">${phase.name} — ${phase.summary}</p>
      <div class="stats-grid">
        <div class="stat-tile"><div class="stat-tile-val">S${week}</div><div class="stat-tile-label">Semana actual</div></div>
        <div class="stat-tile"><div class="stat-tile-val">${pct.toFixed(0)}%</div><div class="stat-tile-label">Progreso de peso</div></div>
        ${trainingStatTile}
        <div class="stat-tile"><div class="stat-tile-val">${suppChecks.length}/${day.supplements.length}</div><div class="stat-tile-label">Suplementos hoy</div></div>
      </div>
    </div>`;

  html += reminderHTML;

  if (day.isWeighDay) {
    const target = getWeightTargetForWeek(week);
    const log = getWeightLog(week);
    const st = weightStatus(week);
    html += `
      <div class="card" style="border-color: color-mix(in srgb, var(--brand) 40%, var(--border))">
        <div class="card-row">
          <h4>⚖️ Día de pesaje</h4>
          <span class="status-pill ${st.cls}">${st.label}</span>
        </div>
        <p class="phase-summary" style="margin-top:6px">En ayunas, recién levantado, antes del café o el plátano. Objetivo esta semana: <b style="color:var(--brand-2)">${target ? target.weight + " kg" : "—"}</b>.</p>
        <div class="weight-input-row">
          <input type="number" step="0.1" inputmode="decimal" class="weight-input" id="hoyWeightInput" placeholder="Peso (kg)" value="${log ? log.weight : ""}" />
          <button class="btn btn-primary btn-sm" id="hoyWeightSave">Guardar</button>
        </div>
      </div>`;
  }

  html += fullDayHTML(day, date);

  if (isTrainingDay && !day.isGeneralPhase) {
    html += `
      <div class="card">
        <div class="card-row">
          <div>
            <h4>¿Completaste la sesión?</h4>
            <p class="phase-summary" style="margin-top:4px">${hasLog ? "Ya has registrado una sesión hoy." : "Registra distancia, tiempo, ritmo y pulso."}</p>
          </div>
        </div>
        <div style="margin-top:12px">
          <button class="btn btn-primary" id="logSessionBtn">${hasLog ? "Añadir otra sesión" : "Registrar sesión"}</button>
        </div>
      </div>`;
  }

  $("#view").innerHTML = html;

  if (day.isWeighDay) {
    $("#hoyWeightSave").addEventListener("click", () => {
      const v = parseFloat($("#hoyWeightInput").value);
      if (!v || v < 30 || v > 250) { showToast("Introduce un peso válido"); return; }
      saveWeight(week, v);
      showToast("Peso guardado");
      render();
    });
  }
  if (isTrainingDay && !day.isGeneralPhase) {
    $("#logSessionBtn").addEventListener("click", () => openWorkoutForm(day, date));
  }
}

/* ---------------- Calendario (semana + mes) ---------------- */
function renderCalendario() {
  const { week: todayWeek, dayKey: todayKey } = todayInfo();

  let html = `
    <div class="seg-toggle">
      <button class="seg-btn ${state.calendarView === "semana" ? "active" : ""}" data-view="semana">Semana</button>
      <button class="seg-btn ${state.calendarView === "mes" ? "active" : ""}" data-view="mes">Mes</button>
    </div>`;

  if (state.calendarView === "semana") {
    if (todayWeek < 1) {
      html += `<div class="empty">Tu plan aún no ha empezado.<br/>Consulta la vista Mes para ver cuándo arranca.</div>`;
      $("#view").innerHTML = html;
      bindCalendarToggle();
      return;
    }
    const days = weekDates(todayWeek);
    const phase = getPhaseForWeek(todayWeek);
    html += `
      <div class="card-row" style="margin:14px 2px 10px">
        <h3 style="font-size:18px">Semana ${todayWeek}</h3>
        <span class="badge">${phase.name}</span>
      </div>
      <div class="week-grid">`;
    days.forEach(({ key, date }) => {
      const d = getDaySchedule(todayWeek, key);
      const isToday = key === todayKey;
      let sub = d.typeLabel;
      if (d.training?.todayDistance) sub = d.training.todayDistance;
      html += `
        <div class="week-day type-${d.type} ${isToday ? "today" : ""}" data-date="${dateKey(date)}">
          <div class="week-day-dow">
            <div class="d">${date.getDate()}</div>
            <div class="m">${DOW_SHORT[date.getDay()]}</div>
          </div>
          <div class="week-day-mid">
            <div class="week-day-title">${d.typeLabel}</div>
            <div class="week-day-sub">${sub}</div>
          </div>
          <div class="week-day-chevron"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        </div>`;
    });
    html += `</div>`;
  } else {
    html += renderMonthGrid();
  }

  $("#view").innerHTML = html;
  bindCalendarToggle();

  $$(".week-day[data-date]").forEach(el => {
    el.addEventListener("click", () => openDayModal(parseDate(el.dataset.date)));
  });
  $$(".month-cell[data-date]").forEach(el => {
    el.addEventListener("click", () => openDayModal(parseDate(el.dataset.date)));
  });
  $("#monthPrev")?.addEventListener("click", () => {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() - 1, 1);
    render();
  });
  $("#monthNext")?.addEventListener("click", () => {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + 1, 1);
    render();
  });
}

function bindCalendarToggle() {
  $$(".seg-btn").forEach(b => b.addEventListener("click", () => {
    state.calendarView = b.dataset.view;
    render();
  }));
}

function renderMonthGrid() {
  const cursor = state.calendarCursor;
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // lunes=0
  const gridStart = addDays(firstOfMonth, -startOffset);
  const today = startOfDay(new Date());

  let html = `
    <div class="month-nav">
      <button class="icon-btn" id="monthPrev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="month-label">${MONTHS_ES_LONG[month]} ${year}</div>
      <button class="icon-btn" id="monthNext"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>
    <div class="month-dow-row">${DOW_MINI.slice(1).concat(DOW_MINI[0]).map(d => `<span>${d}</span>`).join("")}</div>
    <div class="month-grid">`;

  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    if (i >= 35 && d.getMonth() !== month) break; // no mostrar 6ª fila si no hace falta
    const inMonth = d.getMonth() === month;
    const isToday = startOfDay(d).getTime() === today.getTime();
    const sched = getScheduleForDate(d);
    html += `
      <div class="month-cell ${inMonth ? "" : "out"} ${isToday ? "today" : ""}" data-date="${dateKey(d)}">
        <span class="month-cell-num">${d.getDate()}</span>
        ${sched ? `<span class="month-cell-dot" style="background:${dayTypeColor(sched.type)}"></span>` : ""}
      </div>`;
  }
  html += `</div>
    <div class="month-legend">
      ${[
        ["rest", "Descanso"], ["active", "Activo"], ["gym", "Gimnasio"], ["quality", "Calidad"], ["long", "Tirada larga"], ["general", "Fase sin calendario"]
      ].map(([t, l]) => `<span class="legend-item"><i style="background:${dayTypeColor(t)}"></i>${l}</span>`).join("")}
    </div>`;
  return html;
}

function dayTypeColor(type) {
  return { rest: "#6B7784", active: "#3E7BFA", gym: "#F5B400", quality: "#22C55E", long: "#EF4444", general: "#3E7BFA" }[type] || "#6B7784";
}

function openDayModal(dateObj) {
  const week = getWeekNumber(dateObj);
  if (week < 1) {
    openModal(`<div class="modal-title">${fmtDateShort(dateObj)}</div>`, `<p class="phase-summary">Todavía no ha empezado tu plan en esta fecha.</p>`);
    return;
  }
  const dayKey = JS_DOW_TO_KEY[dateObj.getDay()];
  const d = getDaySchedule(week, dayKey);
  openModal(
    `<div class="modal-title">${d.label} · ${fmtDateShort(dateObj)}</div><div class="modal-desc">Semana ${week} · ${d.typeLabel}</div>`,
    `<div>${fullDayHTML(d, dateObj)}</div>`
  );
  bindSuppHandlers();
  const trainKeys = ["gym", "quality", "long"];
  if (trainKeys.includes(d.type)) {
    const sheet = $(".modal-sheet");
    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.style.marginTop = "4px";
    btn.textContent = workoutsForDate(dateKey(dateObj)).length ? "Añadir otra sesión" : "Registrar sesión";
    btn.addEventListener("click", () => openWorkoutForm(d, dateObj));
    sheet.appendChild(btn);
  }
}

function renderFases() {
  const { week } = todayInfo();
  let html = "";
  PHASES.forEach(p => {
    const isCurrent = week >= p.weeks[0] && week <= p.weeks[1];
    const isPast = week > p.weeks[1];
    const span = p.weeks[1] - p.weeks[0] + 1;
    const pct = isPast ? 100 : isCurrent ? Math.min(100, Math.max(4, ((week - p.weeks[0] + 1) / span) * 100)) : 0;
    html += `
      <div class="card phase-card ${isCurrent ? "open" : ""}" data-phase="${p.key}">
        <div class="phase-head">
          <div>
            <div class="phase-num">FASE ${p.id} · ${p.dateLabel}</div>
            <div class="phase-name">${p.name}</div>
            <div class="phase-range">Semanas ${p.weeks[0]}–${p.weeks[1]}${isCurrent ? " · en curso" : isPast ? " · completada" : ""}</div>
          </div>
          <div class="phase-weight">${p.weightFrom} → ${p.weightTo} kg</div>
        </div>
        <div class="phase-progress-bar"><i style="width:${pct}%"></i></div>
        <div class="phase-body">
          <p class="phase-summary">${p.summary}</p>
          <div class="phase-focus">${p.focus.map(f => `<div class="phase-focus-item">${f}</div>`).join("")}</div>
          <div class="badge-row"><span class="badge">🎯 ${p.kcal}</span></div>
        </div>
      </div>`;
  });
  $("#view").innerHTML = `<div class="section-title">Las 5 fases del plan</div>` + html;

  $$(".phase-card").forEach(el => {
    el.addEventListener("click", () => el.classList.toggle("open"));
  });
}

function renderPeso() {
  const { week } = todayInfo();
  const target = week >= 1 ? getWeightTargetForWeek(week) : WEEKLY_WEIGHTS_BLOQUE1[0];
  const log = week >= 1 ? getWeightLog(week) : null;
  const st = week >= 1 ? weightStatus(week) : { label: "El plan aún no ha empezado", cls: "status-none" };

  const startW = state.settings.startWeight;
  const finalW = 71.5;
  const totalLoss = startW - finalW;
  const currentW = latestWeight();
  const lost = startW - currentW;
  const progressPct = Math.min(100, Math.max(0, (lost / totalLoss) * 100));

  const circumference = 2 * Math.PI * 40;
  const dash = circumference * (progressPct / 100);

  let html = `
    <div class="card">
      <div class="weight-gauge">
        <div class="gauge-ring">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" stroke="#242E36" stroke-width="8" fill="none"/>
            <circle cx="48" cy="48" r="40" stroke="url(#gaugeGrad)" stroke-width="8" fill="none"
              stroke-dasharray="${circumference}" stroke-dashoffset="${circumference - dash}" stroke-linecap="round"/>
            <defs><linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#3E7BFA"/><stop offset="100%" stop-color="#63E6D4"/>
            </linearGradient></defs>
          </svg>
          <div class="gauge-center">
            <div class="gauge-value">${progressPct.toFixed(0)}%</div>
            <div class="gauge-label">del plan</div>
          </div>
        </div>
        <div class="weight-stats">
          <div class="weight-stat-row"><span>Peso actual</span><b>${currentW.toFixed(1)} kg</b></div>
          <div class="weight-stat-row"><span>Objetivo semana ${week >= 1 ? week : 1}</span><b>${target ? target.weight + " kg" : "—"}</b></div>
          <div class="weight-stat-row"><span>Meta carrera (S22)</span><b>75.5 kg</b></div>
          <div class="weight-stat-row"><span>Meta definición</span><b>71–72 kg</b></div>
        </div>
      </div>
      <div class="card-row" style="margin-top:14px">
        <span class="status-pill ${st.cls}">${st.label}</span>
      </div>
      ${week >= 1 ? `
      <div class="weight-input-row">
        <input type="number" step="0.1" inputmode="decimal" class="weight-input" id="pesoInput" placeholder="Peso (kg)" value="${log ? log.weight : ""}" />
        <button class="btn btn-primary btn-sm" id="pesoSave">Guardar</button>
      </div>` : ""}
    </div>

    <div class="section-title">Histórico semanal</div>
    <div class="card weight-history">`;

  const maxW = startW;
  const minW = finalW;
  const range = maxW - minW;

  if (state.weights.length === 0) {
    html += `<div class="empty">Aún no has registrado ningún peso.<br/>Se pesará cada sábado en ayunas.</div>`;
  } else {
    const upTo = Math.min(Math.max(week, 1), WEEKLY_WEIGHTS_BLOQUE1.length);
    for (let w = upTo; w >= 1; w--) {
      const t = getWeightTargetForWeek(w);
      const l = getWeightLog(w);
      const val = l ? l.weight : null;
      const barPct = val ? Math.min(100, Math.max(2, ((maxW - val) / range) * 100)) : 0;
      const targetPct = t ? Math.min(100, Math.max(2, ((maxW - t.weight) / range) * 100)) : 0;
      const color = !val ? "var(--text-faint)" : Math.abs(val - (t?.weight ?? val)) <= 0.25 ? "var(--z3)" : (val < (t?.weight ?? val) ? "var(--brand)" : "var(--z5)");
      html += `
        <div class="wh-row">
          <div class="wh-week">S${w}</div>
          <div class="wh-bar-wrap">
            <div class="wh-bar" style="width:${barPct}%; background:${color}"></div>
            ${t ? `<div class="wh-target-mark" style="left:${targetPct}%"></div>` : ""}
          </div>
          <div class="wh-val">${val ? val.toFixed(1) + " kg" : "—"}</div>
        </div>`;
    }
  }

  html += `</div>`;

  $("#view").innerHTML = html;

  if (week >= 1) {
    $("#pesoSave").addEventListener("click", () => {
      const v = parseFloat($("#pesoInput").value);
      if (!v || v < 30 || v > 250) { showToast("Introduce un peso válido"); return; }
      saveWeight(week, v);
      showToast("Peso guardado");
      render();
    });
  }
}

function renderAjustes() {
  const s = state.settings;
  let html = `
    <div class="section-title">Tu perfil</div>
    <div class="card">
      <div class="field"><label>Nombre</label><input id="setName" value="${s.name}" /></div>
      <div class="field"><label>Fecha de inicio del plan (lunes de la semana 1)</label><input id="setStart" type="date" value="${s.startDate}" /></div>
      <div class="field"><label>Peso inicial (kg)</label><input id="setStartWeight" type="number" step="0.1" value="${s.startWeight}" /></div>
      <button class="btn btn-primary" id="saveSettings">Guardar cambios</button>
    </div>

    <div class="section-title">Zonas de frecuencia cardíaca</div>
    <div class="card">
      ${HR_ZONES.map(z => `
        <div class="exercise">
          <div class="exercise-name"><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${z.color};margin-right:8px"></span>${z.label}</div>
          <div class="exercise-set" style="color:${z.color}">${z.range}</div>
        </div>`).join("")}
      <div class="divider"></div>
      <p class="phase-summary">FC reposo ${s.fcr} ppm · FC máxima ${s.fcm} ppm · Techo Zona 2: ${s.z2max} ppm</p>
    </div>

    <div class="section-title">Suplementación de referencia</div>
    <div class="card">
      ${SUPPLEMENT_DETAILS.map(sup => `
        <div class="exercise" style="display:block">
          <div class="exercise-name">${sup.name}</div>
          <div class="exercise-note">${sup.brand}</div>
          <div class="exercise-note" style="color:var(--brand-2); margin-top:4px">${sup.dose}</div>
          <div class="exercise-note" style="margin-top:4px">${sup.fn}</div>
        </div>`).join("")}
    </div>

    <div class="section-title">Historial de sesiones</div>
    <div class="card" id="workoutHistoryCard">
      ${state.workouts.length === 0 ? `<div class="empty">Todavía no hay sesiones registradas.</div>` :
        state.workouts.slice(0, 30).map(w => `
        <div class="log-entry">
          <div class="log-entry-head"><span>${w.date}</span><span>Semana ${w.week}</span></div>
          <div class="log-entry-stats">
            ${w.distance ? `<div class="log-stat">${w.distance} km<span>distancia</span></div>` : ""}
            ${w.time ? `<div class="log-stat">${w.time}<span>tiempo</span></div>` : ""}
            ${w.pace ? `<div class="log-stat">${w.pace}<span>min/km</span></div>` : ""}
            ${w.hr ? `<div class="log-stat">${w.hr}<span>ppm</span></div>` : ""}
          </div>
          ${w.targetPace ? `<div class="badge-row" style="margin-top:8px">
              <span class="badge">🎯 objetivo ${w.targetPace}</span>
              ${w.deviationSec !== null && w.deviationSec !== undefined ? `<span class="status-pill ${paceDiffClass(w.deviationSec)}">${formatPaceDiff(w.deviationSec)}</span>` : ""}
            </div>` : ""}
          ${w.notes ? `<div class="phase-summary" style="margin-top:6px">${w.notes}</div>` : ""}
        </div>`).join("")}
    </div>

    <div class="section-title">Datos</div>
    <div class="card">
      <p class="phase-summary" style="margin-bottom:12px">Todos tus datos (peso, sesiones, checklist) se guardan solo en este dispositivo.</p>
      <button class="btn btn-danger" id="resetData">Borrar todos mis datos</button>
    </div>
  `;
  $("#view").innerHTML = html;

  $("#saveSettings").addEventListener("click", () => {
    state.settings.name = $("#setName").value || "Atleta";
    state.settings.startDate = $("#setStart").value || state.settings.startDate;
    state.settings.startWeight = parseFloat($("#setStartWeight").value) || state.settings.startWeight;
    storeSet(STORE_KEYS.settings, state.settings);
    showToast("Ajustes guardados");
    render();
  });

  $("#resetData").addEventListener("click", () => {
    if (!confirm("¿Seguro? Se borrarán tus pesos, sesiones, checklist y el perfil guardado.")) return;
    Object.values(STORE_KEYS).forEach(k => localStorage.removeItem(k));
    state.weights = []; state.workouts = []; state.supps = {};
    state.settings = { ...PROFILE_DEFAULTS, onboarded: false };
    showToast("Datos borrados");
    boot();
  });
}

/* ---------------- Supplement click binding (delegated, works for Hoy + modal) ---------------- */
function bindSuppHandlers() {
  $$("[data-supp-list]").forEach(list => {
    $$(".supp-item", list).forEach(item => {
      item.onclick = () => {
        toggleSupp(list.dataset.date, item.dataset.suppId);
        item.classList.toggle("checked");
        const svg = $("svg", item);
        svg.style.opacity = item.classList.contains("checked") ? 1 : 0;
      };
    });
  });
}

/* ---------------- Tab routing ---------------- */
const RENDERERS = { hoy: renderHoy, calendario: renderCalendario, fases: renderFases, peso: renderPeso, ajustes: renderAjustes };

function render() {
  renderRouteBar();
  renderStatStrip();
  RENDERERS[state.activeTab]();
  bindSuppHandlers();
  $$(".navbtn").forEach(b => b.classList.toggle("active", b.dataset.tab === state.activeTab));
  window.scrollTo(0, 0);
}

$$(".navbtn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.activeTab = btn.dataset.tab;
    render();
  });
});

/* ---------------- PWA install prompt ---------------- */
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

let deferredInstallPrompt = null;
if (!isStandalone()) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    $("#installBtn").hidden = false;
  });
}
window.addEventListener("appinstalled", () => {
  $("#installBtn").hidden = true;
  deferredInstallPrompt = null;
});
$("#installBtn").addEventListener("click", async () => {
  if (!deferredInstallPrompt) { showToast("Usa el menú del navegador → 'Añadir a pantalla de inicio'"); return; }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $("#installBtn").hidden = true;
});

/* ---------------- Service worker ---------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---------------- Init ---------------- */
function boot() {
  if (isStandalone()) $("#installBtn").hidden = true;
  if (!state.settings.onboarded) {
    renderOnboarding();
  } else {
    $("#bottomnav").style.display = "";
    render();
  }
}
boot();
