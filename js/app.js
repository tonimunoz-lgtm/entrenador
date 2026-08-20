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
  settings: storeGet(STORE_KEYS.settings, { ...PROFILE_DEFAULTS }),
  weights: storeGet(STORE_KEYS.weights, []),      // [{week, date, weight}]
  workouts: storeGet(STORE_KEYS.workouts, []),    // [{id, date, dayKey, week, distance, time, pace, hr, notes}]
  supps: storeGet(STORE_KEYS.supps, {}),          // { "YYYY-MM-DD": ["multi", ...] }
  activeTab: "hoy"
};

/* ---------------- Date helpers ---------------- */
function pad2(n) { return String(n).padStart(2, "0"); }
function dateKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseDate(str) { const [y, m, d] = str.split("-").map(Number); return new Date(y, m - 1, d); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DOW_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DOW_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

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
  const week = Math.max(1, getWeekNumber(now));
  const dayKey = JS_DOW_TO_KEY[now.getDay()];
  return { date: now, week, dayKey };
}

/* ---------------- Toast / Modal ---------------- */
let toastTimer = null;
function showToast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
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
    let state_ = "future";
    if (week > p.weeks[1]) state_ = "done";
    else if (week >= p.weeks[0]) state_ = "current";
    if (state_ !== "future") seg.classList.add(state_ === "done" ? "done" : "current");
    const i = document.createElement("i");
    i.style.background = state_ === "future" ? "transparent" : (state_ === "done" ? p_color(p) : "");
    if (state_ === "current") {
      const pct = Math.min(100, Math.max(4, ((week - p.weeks[0] + 1) / span) * 100));
      i.style.width = pct + "%";
    }
    seg.appendChild(i);
    seg.title = `${p.name} · semanas ${p.weeks[0]}–${p.weeks[1]}`;
    bar.appendChild(seg);
  });
  $("#topbarSub").textContent = week > 0 ? `Semana ${week} · ${getPhaseForWeek(week).name}` : "Configura tu fecha de inicio";
}
function p_color(p) { return "#3E7BFA"; }

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
      <div class="card-row"><h4>Suplementación de hoy</h4></div>
      <div class="supp-list" data-supp-list data-date="${dk}">
        ${items.map(s => `
          <div class="supp-item ${checks.includes(s.id) ? "checked" : ""}" data-supp-id="${s.id}">
            <div class="supp-check">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="opacity:${checks.includes(s.id) ? 1 : 0}"><path d="M5 12l5 5L19 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="supp-body">
              <div class="supp-name">${s.name}</div>
              <div class="supp-when">${s.when}</div>
            </div>
          </div>
        `).join("")}
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
    html += `<div class="distance-hero"><span class="distance-num">${t.todayDistance.match(/[\d.,]+\s?km/)?.[0] || t.todayDistance}</span></div>
      <p class="phase-summary">${t.todayDistance}</p>`;
  } else if (t.byWeek && !t.todayDistance) {
    html += `<p class="phase-summary" style="margin-top:6px">Distancia según semana del plan.</p>`;
  }

  if (t.exercises) {
    html += `<div style="margin-top:10px">` + t.exercises.map(ex => `
      <div class="exercise">
        <div>
          <div class="exercise-name">${ex.name}</div>
          ${ex.note ? `<div class="exercise-note">${ex.note}</div>` : ""}
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

/* ---------------- Weight logic ---------------- */
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
  if (!target || !log) return { label: "Sin registrar", cls: "status-none" };
  const diff = log.weight - target.weight;
  if (Math.abs(diff) <= 0.25) return { label: "En objetivo", cls: "status-ontrack", diff };
  if (diff < 0) return { label: `${Math.abs(diff).toFixed(1)} kg por delante`, cls: "status-ahead", diff };
  return { label: `${diff.toFixed(1)} kg por detrás`, cls: "status-behind", diff };
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
  openModal(
    `<div class="modal-title">Registrar sesión</div><div class="modal-desc">${day.label} · ${fmtDateShort(dateObj)} · ${day.typeLabel}</div>`,
    `<form id="workoutForm">
      <div class="log-grid">
        <div class="log-field"><label>Distancia (km)</label><input inputmode="decimal" name="distance" placeholder="12.0" /></div>
        <div class="log-field"><label>Tiempo (hh:mm:ss)</label><input name="time" placeholder="1:02:30" /></div>
        <div class="log-field"><label>Ritmo (min/km)</label><input name="pace" placeholder="4:55" /></div>
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
    logWorkout({
      date: dk, dayKey: day.key, week: day.weekNumber,
      distance: fd.get("distance") || "", time: fd.get("time") || "",
      pace: fd.get("pace") || "", hr: fd.get("hr") || "", notes: fd.get("notes") || ""
    });
    closeModal();
    showToast("Sesión guardada 💪");
    render();
  });
}

/* ==========================================================================
   TAB RENDERERS
   ========================================================================== */

function renderHoy() {
  const { date, week, dayKey } = todayInfo();
  const day = getDaySchedule(week, dayKey);
  const dk = dateKey(date);
  const phase = day.phase;
  const isTrainingDay = ["gym", "quality", "long"].includes(day.type);
  const hasLog = workoutsForDate(dk).length > 0;

  let html = `
    <div class="hero">
      <div class="hero-eyebrow">${DOW_LONG[date.getDay()]} · ${fmtDateShort(date)} · Semana ${week}</div>
      <div class="hero-title">${day.typeLabel}</div>
      <p class="hero-desc">${phase.name} — ${phase.summary}</p>
      <div class="badge-row">
        <span class="badge"><span class="dot" style="background:${p_color(phase)}"></span>Fase ${phase.id}</span>
        <span class="badge">🎯 ${phase.kcal}</span>
      </div>
    </div>`;

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
          <input type="number" step="0.1" inputmode="decimal" class="weight-input" id="hoyWeightInput" placeholder="Tu peso (kg)" value="${log ? log.weight : ""}" />
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

function renderSemana() {
  const { week, dayKey: todayKey } = todayInfo();
  const days = weekDates(week);
  const phase = getPhaseForWeek(week);

  let html = `
    <div class="card-row" style="margin-bottom:10px">
      <h3 style="font-size:18px">Semana ${week}</h3>
      <span class="badge">${phase.name}</span>
    </div>
    <div class="week-grid">`;

  days.forEach(({ key, date }) => {
    const d = getDaySchedule(week, key);
    const isToday = key === todayKey;
    let sub = d.typeLabel;
    if (d.training?.todayDistance) sub = d.training.todayDistance;
    html += `
      <div class="week-day ${isToday ? "today" : ""}" data-day-key="${key}">
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
  $("#view").innerHTML = html;

  $$(".week-day").forEach(el => {
    el.addEventListener("click", () => {
      const key = el.dataset.dayKey;
      const dInfo = days.find(x => x.key === key);
      const d = getDaySchedule(week, key);
      openModal(
        `<div class="modal-title">${d.label} · ${fmtDateShort(dInfo.date)}</div><div class="modal-desc">${d.typeLabel}</div>`,
        `<div>${fullDayHTML(d, dInfo.date)}</div>`
      );
      bindSuppHandlers();
    });
  });
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
  const target = getWeightTargetForWeek(week);
  const log = getWeightLog(week);
  const st = weightStatus(week);

  const startW = state.settings.startWeight;
  const finalW = 71.5;
  const totalLoss = startW - finalW;
  const currentW = log ? log.weight : (state.weights.length ? state.weights[state.weights.length - 1].weight : startW);
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
          <div class="weight-stat-row"><span>Objetivo semana ${week}</span><b>${target ? target.weight + " kg" : "—"}</b></div>
          <div class="weight-stat-row"><span>Meta carrera (S22)</span><b>75.5 kg</b></div>
          <div class="weight-stat-row"><span>Meta definición</span><b>71–72 kg</b></div>
        </div>
      </div>
      <div class="card-row" style="margin-top:14px">
        <span class="status-pill ${st.cls}">${st.label}</span>
      </div>
      <div class="weight-input-row">
        <input type="number" step="0.1" inputmode="decimal" class="weight-input" id="pesoInput" placeholder="Peso (kg)" value="${log ? log.weight : ""}" />
        <button class="btn btn-primary btn-sm" id="pesoSave">Guardar</button>
      </div>
    </div>

    <div class="section-title">Histórico semanal</div>
    <div class="card weight-history">`;

  const maxW = startW;
  const minW = finalW;
  const range = maxW - minW;

  if (state.weights.length === 0 && week === 1) {
    html += `<div class="empty">Aún no has registrado ningún peso.<br/>Se pesará cada sábado en ayunas.</div>`;
  } else {
    for (let w = Math.min(week, WEEKLY_WEIGHTS_BLOQUE1.length); w >= 1; w--) {
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

  $("#pesoSave").addEventListener("click", () => {
    const v = parseFloat($("#pesoInput").value);
    if (!v || v < 30 || v > 250) { showToast("Introduce un peso válido"); return; }
    saveWeight(week, v);
    showToast("Peso guardado");
    render();
  });
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
    if (!confirm("¿Seguro? Se borrarán tus pesos, sesiones y checklist guardados.")) return;
    Object.values(STORE_KEYS).forEach(k => localStorage.removeItem(k));
    state.weights = []; state.workouts = []; state.supps = {};
    state.settings = { ...PROFILE_DEFAULTS };
    showToast("Datos borrados");
    render();
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
const RENDERERS = { hoy: renderHoy, semana: renderSemana, fases: renderFases, peso: renderPeso, ajustes: renderAjustes };

function render() {
  renderRouteBar();
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
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  $("#installBtn").hidden = false;
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
render();
