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

// Empuja un cambio local a Firestore si hay sesión iniciada — silencioso si no.
// Firestore ya encola los cambios cuando no hay conexión y los sincroniza solo.
function cloudPush(fn) {
  if (typeof CloudSync === "undefined" || !CloudSync.enabled || !CloudSync.user) return;
  try { Promise.resolve(fn()).catch(() => {}); } catch (e) {}
}

/* ---------------- Temas de diseño ---------------- */
const THEMES = [
  { id: "classic", name: "Clásico", desc: "El diseño actual de Forja21.", swatch: ["#3E7BFA", "#63E6D4", "#171D22"] },
  { id: "trackside", name: "Trackside", desc: "Energía de pista — negro y verde lima. Inspirado en Nike Training Club.", swatch: ["#D6FF3F", "#0A0A0A", "#141414"] },
  { id: "aura", name: "Aura", desc: "Calma premium con gradientes suaves. Inspirado en Whoop / Oura.", swatch: ["#31D6C4", "#A98CFF", "#0B0E17"] },
  { id: "ledger", name: "Ledger", desc: "Modo claro, rápido y sin distracciones. Inspirado en Hevy / Strong.", swatch: ["#0F6B4C", "#FAFAF8", "#15181B"] }
];

function applyTheme(themeId) {
  document.documentElement.setAttribute("data-theme", themeId || "classic");
}

function saveTheme(themeId) {
  applyTheme(themeId);
  state.settings.theme = themeId;
  storeSet(STORE_KEYS.settings, state.settings);
  cloudPush(() => CloudSync.pushSettings(CloudSync.user.uid, state.settings));
}

function translateAuthError(e) {
  const map = {
    "auth/email-already-in-use": "Ya existe una cuenta con ese email — prueba a iniciar sesión.",
    "auth/invalid-email": "Ese email no parece válido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/user-not-found": "No existe ninguna cuenta con ese email — crea una primero.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Email o contraseña incorrectos.",
    "auth/missing-password": "Escribe tu contraseña.",
    "auth/too-many-requests": "Demasiados intentos — espera un momento y vuelve a probar."
  };
  console.error("Forja21 · error de autenticación:", e?.code, e?.message);
  return map[e?.code] || e?.message || "Algo ha fallado. Inténtalo de nuevo.";
}

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
// Ajusta cualquier fecha al lunes de esa misma semana (las semanas del plan van lunes-domingo)
function mondayOfWeek(d) {
  const day = d.getDay();
  const back = day === 0 ? 6 : day - 1;
  return addDays(startOfDay(d), -back);
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

function isPlanFinished(week) { return week > TOTAL_PLAN_WEEKS; }

function getScheduleForDate(date) {
  const week = getWeekNumber(date);
  if (week < 1 || week > TOTAL_PLAN_WEEKS) return null;
  const dayKey = JS_DOW_TO_KEY[date.getDay()];
  return getDaySchedule(week, dayKey);
}

function milestoneForDate(date) {
  const dk = dateKey(date);
  return MILESTONES.find(m => m.date === dk) || null;
}

/* ---------------- Toast / Modal ---------------- */
let toastTimer = null;
function showToast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, msg.length > 60 ? 5000 : 2600);
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

function confirmModal(title, desc, confirmLabel, onConfirm) {
  openModal(
    `<div class="modal-title">${title}</div><div class="modal-desc">${desc}</div>`,
    `<div class="btn-row" style="margin-top:6px">
      <button type="button" class="btn btn-ghost" id="confirmCancelBtn">Cancelar</button>
      <button type="button" class="btn" id="confirmOkBtn" style="background:var(--z5); color:#fff;">${confirmLabel}</button>
    </div>`
  );
  $("#confirmCancelBtn").addEventListener("click", closeModal);
  $("#confirmOkBtn").addEventListener("click", () => { closeModal(); onConfirm(); });
}

/* ---------------- Zonas de FC (editables) ---------------- */
function getZones() {
  if (state.settings.zones && state.settings.zones.length === HR_ZONES.length) return state.settings.zones;
  return HR_ZONES.map(z => ({ ...z }));
}
function zoneRangeText(z) {
  if (z.key === "z1") return `<${z.min} ppm`;
  if (z.key === "z5") return `>${z.max} ppm`;
  return `${z.min}–${z.max} ppm`;
}
function saveZones(zones) {
  state.settings.zones = zones;
  storeSet(STORE_KEYS.settings, state.settings);
  cloudPush(() => CloudSync.pushSettings(CloudSync.user.uid, state.settings));
}
// El plan trae los rangos de FC escritos dentro de las frases de cada entreno (ej. "Zona 2
// (115–126 ppm)"). En vez de reescribir cada frase, sustituimos el rango por defecto por el
// rango que el usuario tenga configurado ahora mismo, en cualquier HTML ya renderizado.
function applyCustomZoneText(html) {
  const zones = getZones();
  let out = html;
  HR_ZONES.forEach((defaultZone, i) => {
    const current = zones[i];
    if (!current) return;
    const defaultStr = defaultZone.range;
    const currentStr = zoneRangeText(current);
    if (defaultStr !== currentStr) out = out.split(defaultStr).join(currentStr);
  });
  return out;
}

/* ---------------- Notificaciones ---------------- */
function notificationsSupported() { return "Notification" in window; }

async function ensureNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try { return await Notification.requestPermission(); } catch (e) { return "denied"; }
}

async function showLocalNotification(title, body, tag) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, { body, tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png" });
    } else {
      new Notification(title, { body, tag, icon: "icons/icon-192.png" });
    }
  } catch (e) {}
}

async function tryRegisterPeriodicSync() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!("periodicSync" in reg)) return;
    const status = await navigator.permissions.query({ name: "periodic-background-sync" });
    if (status.state === "granted") {
      await reg.periodicSync.register("forja21-daily-check", { minInterval: 20 * 60 * 60 * 1000 });
    }
  } catch (e) { /* no soportado — silencioso, es un extra */ }
}

// Avisa (una vez al día) de lo que toca hoy: báscula o entreno. Se dispara al abrir/foreground la app.
function maybeSendDailyReminder() {
  if (!state.settings.notificationsEnabled || Notification?.permission !== "granted") return;
  const { date, week, dayKey } = todayInfo();
  if (week < 1 || isPlanFinished(week)) return;
  const dk = dateKey(date);
  const flagKey = "forja21_notified_" + dk;
  if (localStorage.getItem(flagKey)) return;

  const day = getDaySchedule(week, dayKey);
  let title, body;
  if (day.isWeighDay && !getWeightLog(week)) {
    const t = getWeightTargetForWeek(week);
    title = "⚖️ Hoy toca báscula";
    body = `En ayunas, antes del café. Objetivo: ${t ? t.weight + " kg" : "—"}.`;
  } else if (["gym", "quality", "long", "race"].includes(day.type)) {
    title = `💪 Hoy toca ${day.typeLabel}`;
    body = day.training?.todayDistance || day.training?.title || "Abre Forja21 para ver el detalle de hoy.";
  } else {
    title = "😌 Hoy descanso";
    body = day.typeLabel;
  }
  showLocalNotification(title, body, "forja21-daily");
  localStorage.setItem(flagKey, "1");

  if (isZoneReviewWeek(week) && dayKey === "mon") {
    const zoneFlagKey = "forja21_zonecheck_w" + week;
    if (!localStorage.getItem(zoneFlagKey)) {
      showLocalNotification("🫀 Toca revisar tus zonas de FC", "Cada pocas semanas conviene reajustar los ppm de tus zonas en Ajustes según cómo evolucione tu forma.", "forja21-zonecheck");
      localStorage.setItem(zoneFlagKey, "1");
    }
  }
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
  cloudPush(() => CloudSync.pushWeight(CloudSync.user.uid, entry));
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

/* ---------------- Estadísticas y seguimiento ---------------- */
function computeStats() {
  const { week } = todayInfo();
  const elapsedWeek = Math.max(0, Math.min(week, TOTAL_PLAN_WEEKS));
  const today = startOfDay(new Date());

  // Peso
  const targetWeeksElapsed = getAllWeightTargetWeeks().filter(w => w <= elapsedWeek);
  const weighableWeeks = targetWeeksElapsed.length;
  let loggedWeeks = 0, onTargetWeeks = 0, devSum = 0, devCount = 0;
  targetWeeksElapsed.forEach(w => {
    const l = getWeightLog(w);
    const t = getWeightTargetForWeek(w);
    if (l) {
      loggedWeeks++;
      if (t) {
        const diff = l.weight - t.weight;
        devSum += diff; devCount++;
        if (Math.abs(diff) <= 0.25) onTargetWeeks++;
      }
    }
  });
  const weightLogPct = weighableWeeks ? (loggedWeeks / weighableWeeks * 100) : 0;
  const weightOnTargetPct = loggedWeeks ? (onTargetWeeks / loggedWeeks * 100) : null;
  const avgWeightDev = devCount ? (devSum / devCount) : null;

  // Entrenos
  let scheduledCount = 0, completedCount = 0;
  for (let w = 1; w <= elapsedWeek; w++) {
    const keys = trainingDayKeysForWeek(w);
    const dates = weekDates(w);
    keys.forEach(k => {
      const dObj = dates.find(x => x.key === k);
      if (dObj && startOfDay(dObj.date) <= today) {
        scheduledCount++;
        if (workoutsForDate(dateKey(dObj.date)).length > 0) completedCount++;
      }
    });
  }
  const trainingPct = scheduledCount ? (completedCount / scheduledCount * 100) : null;

  // Ritmo
  const pacedSessions = state.workouts.filter(w => w.targetPace && w.deviationSec !== null && w.deviationSec !== undefined);
  const onPaceCount = pacedSessions.filter(w => Math.abs(w.deviationSec) <= 10).length;
  const avgPaceDev = pacedSessions.length ? Math.round(pacedSessions.reduce((s, w) => s + w.deviationSec, 0) / pacedSessions.length) : null;
  const pacePct = pacedSessions.length ? (onPaceCount / pacedSessions.length * 100) : null;

  // Suplementos
  let suppTotalDays = 0, suppSumPct = 0;
  for (let w = 1; w <= elapsedWeek; w++) {
    weekDates(w).forEach(({ key, date }) => {
      if (startOfDay(date) > today) return;
      const wk = getWeekNumber(date);
      if (wk < 1) return;
      const day = getDaySchedule(wk, key);
      if (!day || !day.supplements || !day.supplements.length) return;
      suppTotalDays++;
      const checks = getSuppChecks(dateKey(date));
      suppSumPct += (checks.length / day.supplements.length);
    });
  }
  const suppPct = suppTotalDays ? (suppSumPct / suppTotalDays * 100) : null;

  return {
    weightLogPct, weightOnTargetPct, avgWeightDev, loggedWeeks, weighableWeeks,
    trainingPct, scheduledCount, completedCount,
    pacePct, onPaceCount, pacedSessionsCount: pacedSessions.length, avgPaceDev,
    suppPct
  };
}

function statBarHTML(label, pct, detail, color) {
  const p = pct === null || pct === undefined ? 0 : Math.round(pct);
  return `
    <div class="stat-block">
      <div class="stat-block-head"><span>${label}</span><b>${pct === null || pct === undefined ? "—" : p + "%"}</b></div>
      <div class="stat-block-bar"><i style="width:${p}%; background:${color || "var(--brand)"}"></i></div>
      ${detail ? `<p class="stat-block-detail">${detail}</p>` : ""}
    </div>`;
}

/* ---------------- Supplements ---------------- */
function getSuppChecks(dk) { return state.supps[dk] || []; }
function toggleSupp(dk, id) {
  const list = new Set(getSuppChecks(dk));
  if (list.has(id)) list.delete(id); else list.add(id);
  state.supps[dk] = Array.from(list);
  storeSet(STORE_KEYS.supps, state.supps);
  cloudPush(() => CloudSync.pushSupps(CloudSync.user.uid, dk, state.supps[dk]));
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
  if (t.items) {
    html += `<div style="margin-top:10px">` + t.items.map(it => `
      <div class="exercise">
        <div>
          <div class="exercise-name">${it.name}</div>
          ${it.note ? `<div class="exercise-note">${it.note}</div>` : ""}
          <a class="exercise-video" href="${exerciseVideoUrl(it.name)}" target="_blank" rel="noopener">▶ Ver ejemplo</a>
        </div>
      </div>`).join("") + `</div>`;
  }
  if (t.cardio) {
    html += `<div class="exercise" style="border-top:1px solid var(--border)">
      <div><div class="exercise-name">Cardio</div><div class="exercise-note">${t.cardio}</div></div>
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
      ${m.totalKcal ? `<div class="badge-row" style="margin-top:8px">
        <span class="badge">🔥 ~${m.totalKcal} kcal/día</span>
        ${m.macros ? `<span class="badge">${m.macros.protein}g P · ${m.macros.carbs}g H · ${m.macros.fat}g G</span>` : ""}
      </div>` : ""}
      <div style="margin-top:8px">
        ${m.items.map(it => `
          <div class="meal">
            <div class="meal-tag">${it.meal}</div>
            <div class="meal-text">${it.text}${it.kcal ? ` <span class="meal-kcal">~${it.kcal} kcal</span>` : ""}</div>
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
  cloudPush(() => CloudSync.pushWorkout(CloudSync.user.uid, entry));
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

  const cloudReady = typeof CloudSync !== "undefined" && CloudSync.enabled;
  const signInCard = cloudReady ? `
    <div class="card" id="onboardSignInCard" style="border-color: color-mix(in srgb, var(--brand) 40%, var(--border))">
      <h4>¿Ya tienes cuenta?</h4>
      <p class="phase-summary" style="margin-top:6px">Si perdiste el móvil o es un dispositivo nuevo, inicia sesión aquí para recuperar todo tu progreso en vez de configurar de cero.</p>
      <div class="field" style="margin-top:12px"><label>Email</label><input id="obAuthEmail" type="email" placeholder="tu@email.com" autocomplete="email" /></div>
      <div class="field"><label>Contraseña</label><input id="obAuthPassword" type="password" placeholder="Tu contraseña" autocomplete="current-password" /></div>
      <button class="btn btn-primary" id="obSignInBtn">Iniciar sesión y recuperar mis datos</button>
    </div>
    <div class="divider" style="margin: 18px 0"></div>
    <p class="phase-summary" style="margin-bottom:10px">O configura el plan desde cero:</p>` : "";

  $("#view").innerHTML = `
    <div class="hero">
      <div class="hero-eyebrow">Bienvenido a Forja21</div>
      <div class="hero-title">${PLAN_COPY.welcomeTitle}</div>
      <p class="hero-desc">${PLAN_COPY.welcomeDesc(PROFILE_DEFAULTS.raceGoal, WEEKLY_WEIGHTS_BLOQUE1.length ? WEEKLY_WEIGHTS_BLOQUE1[WEEKLY_WEIGHTS_BLOQUE1.length - 1].weight : "")}</p>
      <div class="badge-row">
        ${PLAN_COPY.welcomeBadges.map(b => `<span class="badge">${b}</span>`).join("")}
      </div>
    </div>

    ${signInCard}

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

  $("#obSignInBtn")?.addEventListener("click", async () => {
    const email = $("#obAuthEmail").value.trim();
    const password = $("#obAuthPassword").value;
    if (!email || !password) { showToast("Escribe tu email y contraseña"); return; }
    try {
      await CloudSync.signInWithEmail(email, password);
      // handleCloudAuthChange se encarga de recuperar los datos y volver a arrancar la app
    } catch (e) {
      showToast(translateAuthError(e));
    }
  });

  $("#onboardForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pickedDate = parseDate(fd.get("startDate"));
    const monday = mondayOfWeek(pickedDate);
    state.settings.name = fd.get("name") || "Atleta";
    state.settings.startDate = dateKey(monday);
    state.settings.startWeight = parseFloat(fd.get("startWeight")) || 87.5;
    state.settings.onboarded = true;
    storeSet(STORE_KEYS.settings, state.settings);
    cloudPush(() => CloudSync.pushSettings(CloudSync.user.uid, state.settings));
    $("#bottomnav").style.display = "";
    state.activeTab = "hoy";
    render();
    if (dateKey(pickedDate) !== dateKey(monday)) {
      showToast(`Ajustado al lunes ${fmtDateShort(monday)} (las semanas van de lunes a domingo)`);
    }
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
    : isPlanFinished(week)
    ? "Plan completado 🏆"
    : `Semana ${week} · ${getPhaseForWeek(week).name}`;
}

/* ---------------- Persistent stat strip (visible on every tab) ---------------- */
function renderStatStrip() {
  const el = $("#statStrip");
  if (!el) return;
  const { week, date } = todayInfo();

  if (week < 1) {
    const days = Math.ceil((startOfDay(parseDate(state.settings.startDate)) - startOfDay(date)) / 86400000);
    el.innerHTML = PLAN_MODE === "v2"
      ? `<div class="stat-chip"><b>${days}</b><span>días para empezar</span></div>
         <div class="stat-chip"><b>12</b><span>semanas de plan</span></div>`
      : `<div class="stat-chip"><b>${days}</b><span>días para empezar</span></div>
         <div class="stat-chip"><b>${state.settings.startWeight} kg</b><span>peso de salida</span></div>`;
    return;
  }

  if (isPlanFinished(week)) {
    el.innerHTML = PLAN_MODE === "v2"
      ? `<div class="stat-chip"><b>🏆</b><span>12 semanas completadas</span></div>
         <div class="stat-chip"><b>${state.workouts.length}</b><span>sesiones registradas</span></div>`
      : `<div class="stat-chip"><b>🏆</b><span>plan completado</span></div>
         <div class="stat-chip"><b>${latestWeight().toFixed(1)} kg</b><span>peso actual</span></div>`;
    return;
  }

  const dayKey = JS_DOW_TO_KEY[date.getDay()];
  const day = getDaySchedule(week, dayKey);
  const dk = dateKey(date);
  const checks = getSuppChecks(dk);

  if (PLAN_MODE === "v2") {
    const trainKeys = trainingDayKeysForWeek(week);
    const doneThisWeek = weekDates(week).filter(d => trainKeys.includes(d.key) && startOfDay(d.date) <= startOfDay(date) && workoutsForDate(dateKey(d.date)).length > 0).length;
    el.innerHTML = `
      <div class="stat-chip"><b>S${week}/${TOTAL_PLAN_WEEKS}</b><span>semana</span></div>
      <div class="stat-chip"><b>${doneThisWeek}/${trainKeys.length}</b><span>entrenos semana</span></div>
      <div class="stat-chip"><b>${day.typeLabel}</b><span>hoy</span></div>
      <div class="stat-chip"><b>${checks.length}/${day.supplements.length}</b><span>suplementos</span></div>`;
    return;
  }

  const st = weightStatus(week);
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
    $("#view").innerHTML = `
        <div class="hero">
          <div class="hero-eyebrow">${greeting}, ${name}</div>
          <div class="hero-title">Tu plan empieza en ${days} día${days === 1 ? "" : "s"}</div>
          <p class="hero-desc">${PLAN_COPY.preplanDesc(fmtDateShort(startD), WEEKLY_WEIGHTS_BLOQUE1.length ? WEEKLY_WEIGHTS_BLOQUE1[WEEKLY_WEIGHTS_BLOQUE1.length - 1].weight : "")}</p>
          <div class="badge-row">
            ${PLAN_COPY.preplanBadges(state.settings.startWeight, PROFILE_DEFAULTS.raceGoal).map(b => `<span class="badge">${b}</span>`).join("")}
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

  // ---- Plan ya completado (más de TOTAL_PLAN_WEEKS semanas desde el inicio) ----
  if (isPlanFinished(week)) {
    const totalWorkouts = state.workouts.length;
    $("#view").innerHTML = `
        <div class="hero">
          <div class="hero-eyebrow">${greeting}, ${name}</div>
          <div class="hero-title">${PLAN_COPY.finishedTitle}</div>
          <p class="hero-desc">${PLAN_COPY.finishedDesc(state.settings.startWeight, latestWeight().toFixed(1), totalWorkouts)}</p>
        </div>
        ${MILESTONES.length ? `
        <div class="card">
          <h4>Tus hitos</h4>
          ${MILESTONES.map(m => `
            <div class="exercise">
              <div><div class="exercise-name">${m.icon} ${m.label}</div><div class="exercise-note">${m.desc}</div></div>
            </div>`).join("")}
        </div>` : ""}`;
    return;
  }

  const day = getDaySchedule(week, dayKey);
  const dk = dateKey(date);
  const phase = day.phase;
  const isTrainingDay = ["gym", "quality", "long", "race"].includes(day.type);
  const hasLog = workoutsForDate(dk).length > 0;

  // ---- stats ----
  const pct = weightProgressPct();
  let trainingStatTile;
  if (!day.isGeneralPhase) {
    const trainKeys = trainingDayKeysForWeek(week);
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
  if (PLAN_MODE !== "v2" && JS_DOW_TO_KEY[tomorrow.getDay()] === "sat" && tomorrowWeek >= 1 && !getWeightLog(tomorrowWeek)) {
    const t = getWeightTargetForWeek(tomorrowWeek);
    reminderHTML += `
      <div class="card" style="border-color: color-mix(in srgb, var(--z4) 40%, var(--border))">
        <div class="card-row"><span>⏰</span><h4 style="flex:1">Mañana toca báscula</h4></div>
        <p class="phase-summary" style="margin-top:6px">En ayunas, nada más levantarte. Objetivo semana ${tomorrowWeek}: <b style="color:var(--brand-2)">${t ? t.weight + " kg" : "—"}</b>.</p>
      </div>`;
  }
  if (isZoneReviewWeek(week)) {
    reminderHTML += `
      <div class="card" style="border-color: color-mix(in srgb, var(--brand) 40%, var(--border))">
        <div class="card-row"><span>🫀</span><h4 style="flex:1">Toca revisar tus zonas de FC</h4></div>
        <p class="phase-summary" style="margin-top:6px">Cada ${ZONE_REVIEW_INTERVAL_WEEKS} semanas conviene reajustar los ppm de tus zonas según tu forma actual.</p>
        <button class="btn btn-ghost btn-sm" id="goSettingsZones" style="margin-top:10px">Ajustar zonas</button>
      </div>`;
  }

  const weightTile = PLAN_MODE === "v2"
    ? `<div class="stat-tile"><div class="stat-tile-val">${week}/${TOTAL_PLAN_WEEKS}</div><div class="stat-tile-label">Semana del plan</div></div>`
    : `<div class="stat-tile"><div class="stat-tile-val">${pct.toFixed(0)}%</div><div class="stat-tile-label">Progreso de peso</div></div>`;

  let html = `
    <div class="hero">
      <div class="hero-eyebrow">${greeting}, ${name}</div>
      <div class="hero-title">${DOW_LONG[date.getDay()]} · ${day.typeLabel}</div>
      <p class="hero-desc">${phase.name} — ${phase.summary}</p>
      <div class="stats-grid">
        <div class="stat-tile"><div class="stat-tile-val">S${week}</div><div class="stat-tile-label">Semana actual</div></div>
        ${weightTile}
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

  $("#view").innerHTML = applyCustomZoneText(html);

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
  $("#goSettingsZones")?.addEventListener("click", () => { state.activeTab = "ajustes"; render(); });
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
      const milestone = milestoneForDate(date);
      let sub = d.typeLabel;
      if (d.training?.todayDistance) sub = d.training.todayDistance;
      html += `
        <div class="week-day type-${d.type} ${isToday ? "today" : ""}" data-date="${dateKey(date)}">
          <div class="week-day-dow">
            <div class="d">${date.getDate()}</div>
            <div class="m">${DOW_SHORT[date.getDay()]}</div>
          </div>
          <div class="week-day-mid">
            <div class="week-day-title">${d.typeLabel} ${d.isWeighDay ? "⚖️" : ""} ${key === "mon" && isZoneReviewWeek(todayWeek) ? "🫀" : ""} ${milestone ? milestone.icon : ""}</div>
            <div class="week-day-sub">${milestone ? milestone.label : (key === "mon" && isZoneReviewWeek(todayWeek)) ? "Revisar zonas de FC · " + sub : sub}</div>
          </div>
          <div class="week-day-chevron"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        </div>`;
    });
    html += `</div>`;
  } else {
    html += renderMonthGrid();
  }

  $("#view").innerHTML = applyCustomZoneText(html);
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

  const phasesInView = new Set();

  let cellsHtml = "";
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    if (i >= 35 && d.getMonth() !== month) break; // no mostrar 6ª fila si no hace falta
    const inMonth = d.getMonth() === month;
    const isToday = startOfDay(d).getTime() === today.getTime();
    const sched = getScheduleForDate(d);
    const milestone = milestoneForDate(d);
    const dWeek = getWeekNumber(d);
    const isZoneReviewMon = JS_DOW_TO_KEY[d.getDay()] === "mon" && isZoneReviewWeek(dWeek);
    const dPhase = (dWeek >= 1 && dWeek <= TOTAL_PLAN_WEEKS) ? getPhaseForWeek(dWeek) : null;
    if (dPhase && inMonth) phasesInView.add(dPhase.key);

    const badges = [];
    if (sched) badges.push(`<span class="month-cell-dot" style="background:${dayTypeColor(sched.type)}"></span>`);
    if (sched?.isWeighDay) badges.push(`<span class="month-cell-icon">⚖️</span>`);
    if (milestone) badges.push(`<span class="month-cell-icon">${milestone.icon}</span>`);
    if (isZoneReviewMon) badges.push(`<span class="month-cell-icon">🫀</span>`);

    const titleParts = [dPhase?.name, milestone?.label, isZoneReviewMon ? "Revisar zonas de FC" : null, sched?.isWeighDay ? "Día de pesaje" : null].filter(Boolean);
    const bgStyle = (dPhase && !milestone) ? `style="background: color-mix(in srgb, ${dPhase.color} ${inMonth ? 16 : 8}%, var(--surface));"` : "";

    cellsHtml += `
      <div class="month-cell ${inMonth ? "" : "out"} ${isToday ? "today" : ""} ${milestone ? "milestone" : ""}" ${bgStyle} data-date="${dateKey(d)}" title="${titleParts.join(" · ")}">
        <span class="month-cell-num">${d.getDate()}</span>
        <span class="month-cell-badges">${badges.join("")}</span>
      </div>`;
  }

  const phaseLegendHtml = phasesInView.size
    ? `<div class="phase-legend">${PHASES.filter(p => phasesInView.has(p.key)).map(p => `<span class="legend-item"><i style="background:${p.color}"></i>${p.name}</span>`).join("")}</div>`
    : "";

  let html = `
    <div class="month-nav">
      <button class="icon-btn" id="monthPrev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="month-label">${MONTHS_ES_LONG[month]} ${year}</div>
      <button class="icon-btn" id="monthNext"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>
    ${phaseLegendHtml}
    <div class="month-dow-row">${DOW_MINI.slice(1).concat(DOW_MINI[0]).map(d => `<span>${d}</span>`).join("")}</div>
    <div class="month-grid">${cellsHtml}</div>
    <div class="month-legend">
      ${[
        ["rest", "Descanso"], ["active", "Activo"], ["gym", "Gimnasio"], ["quality", "Calidad"], ["long", "Tirada larga"], ["general", "Fase sin calendario"]
      ].map(([t, l]) => `<span class="legend-item"><i style="background:${dayTypeColor(t)}"></i>${l}</span>`).join("")}
      ${PLAN_MODE !== "v2" ? `<span class="legend-item">⚖️ Pesaje</span>` : ""}
      ${MILESTONES.some(m => m.icon === "🏁") ? `<span class="legend-item">🏁 Carrera</span>` : ""}
      ${MILESTONES.some(m => m.icon === "🏆") ? `<span class="legend-item">🏆 Objetivo final</span>` : ""}
      ${ZONE_REVIEW_INTERVAL_WEEKS < 999 ? `<span class="legend-item">🫀 Revisar zonas FC</span>` : ""}
    </div>`;
  return html;
}

function dayTypeColor(type) {
  return { rest: "#6B7784", active: "#3E7BFA", gym: "#F5B400", quality: "#22C55E", long: "#EF4444", general: "#3E7BFA", race: "#FFD84D" }[type] || "#6B7784";
}

function openDayModal(dateObj) {
  const week = getWeekNumber(dateObj);
  const milestone = milestoneForDate(dateObj);
  if (week < 1 || week > TOTAL_PLAN_WEEKS) {
    openModal(
      `<div class="modal-title">${milestone ? milestone.icon + " " + milestone.label : fmtDateShort(dateObj)}</div>`,
      milestone
        ? `<p class="phase-summary">${milestone.desc}</p>`
        : `<p class="phase-summary">${week < 1 ? "Todavía no ha empezado tu plan en esta fecha." : "Esta fecha queda fuera del plan (ya lo habrás completado)."}</p>`
    );
    return;
  }
  const dayKey = JS_DOW_TO_KEY[dateObj.getDay()];
  const d = getDaySchedule(week, dayKey);
  const phase = d.phase;
  const weightTarget = getWeightTargetForWeek(week);
  const phaseContextCard = `
    <div class="card tight phase-context-card" style="border-color: color-mix(in srgb, ${phase.color} 40%, var(--border))">
      <div class="badge-row" style="margin-top:0">
        <span class="badge" style="background:color-mix(in srgb, ${phase.color} 20%, transparent); border-color:color-mix(in srgb, ${phase.color} 45%, transparent); color:${phase.color}"><span class="dot" style="background:${phase.color}"></span>${phase.shortLabel} · ${phase.name}</span>
        ${weightTarget ? `<span class="badge">🎯 ${weightTarget.weight} kg esta semana</span>` : ""}
      </div>
      <p class="phase-summary" style="margin-top:8px">${phase.summary}</p>
    </div>`;
  const milestoneBanner = milestone ? `<div class="card" style="border-color: color-mix(in srgb, var(--z4) 45%, var(--border))"><div class="card-row"><span style="font-size:20px">${milestone.icon}</span><h4 style="flex:1">${milestone.label}</h4></div><p class="phase-summary" style="margin-top:6px">${milestone.desc}</p></div>` : "";
  openModal(
    `<div class="modal-title">${d.label} · ${fmtDateShort(dateObj)}</div><div class="modal-desc">Semana ${week} · ${d.typeLabel}${d.isWeighDay ? " · ⚖️ pesaje" : ""}</div>`,
    applyCustomZoneText(`<div>${phaseContextCard}${milestoneBanner}${fullDayHTML(d, dateObj)}</div>`)
  );
  bindSuppHandlers();
  const trainKeys = ["gym", "quality", "long", "race"];
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

function phaseCalorieBalance(p) {
  const weeks = p.weeks[1] - p.weeks[0] + 1;
  const totalChangeKg = p.weightTo - p.weightFrom; // negativo = pérdida, positivo = ganancia
  const weeklyChangeKg = totalChangeKg / weeks;
  const dailyKcalBalance = Math.round((weeklyChangeKg * 7700) / 7);
  return { weeklyChangeKg, dailyKcalBalance, isLoss: totalChangeKg < 0 };
}

function renderFases() {
  const { week } = todayInfo();
  let html = "";
  PHASES.forEach(p => {
    const isCurrent = week >= p.weeks[0] && week <= p.weeks[1];
    const isPast = week > p.weeks[1];
    const span = p.weeks[1] - p.weeks[0] + 1;
    const pct = isPast ? 100 : isCurrent ? Math.min(100, Math.max(4, ((week - p.weeks[0] + 1) / span) * 100)) : 0;
    const hasWeightGoal = p.weightFrom !== null && p.weightFrom !== undefined && p.weightTo !== null && p.weightTo !== undefined;
    const bal = hasWeightGoal ? phaseCalorieBalance(p) : null;
    const balAbsKcal = bal ? Math.abs(bal.dailyKcalBalance) : 0;
    const balAbsGrams = bal ? Math.round(Math.abs(bal.weeklyChangeKg) * 1000) : 0;
    html += `
      <div class="card phase-card ${isCurrent ? "open" : ""}" data-phase="${p.key}">
        <div class="phase-head">
          <div>
            <div class="phase-num">${p.shortLabel.toUpperCase()} · ${p.dateLabel}</div>
            <div class="phase-name">${p.name}</div>
            <div class="phase-range">Semanas ${p.weeks[0]}–${p.weeks[1]}${isCurrent ? " · en curso" : isPast ? " · completada" : ""}</div>
          </div>
          ${hasWeightGoal ? `<div class="phase-weight">${p.weightFrom} → ${p.weightTo} kg</div>` : ""}
        </div>
        <div class="phase-progress-bar"><i style="width:${pct}%"></i></div>
        <div class="phase-body">
          <p class="phase-summary">${p.summary}</p>
          <div class="phase-focus">${p.focus.map(f => `<div class="phase-focus-item">${f}</div>`).join("")}</div>
          <div class="badge-row">
            <span class="badge">🎯 ${p.kcal}</span>
            ${p.macroFocus ? `<span class="badge">${p.macroFocus}</span>` : ""}
          </div>
          ${bal ? `
          <div class="calorie-balance-card">
            <div class="calorie-balance-head">⚖️ Balance calórico estimado</div>
            <p class="phase-summary" style="margin-top:4px">
              ${bal.isLoss
                ? `Un déficit medio de <b style="color:var(--text)">~${balAbsKcal} kcal/día</b> explica la pérdida prevista de <b style="color:var(--text)">~${balAbsGrams} g/semana</b>.`
                : `Un superávit medio de <b style="color:var(--text)">~${balAbsKcal} kcal/día</b> explica la ganancia prevista de <b style="color:var(--text)">~${balAbsGrams} g/semana</b>.`}
            </p>
            <p class="phase-summary" style="margin-top:4px; font-size:11px">Calculado a partir del objetivo de báscula de esta fase (1 kg ≈ 7.700 kcal) — es una estimación, no una medición real.</p>
          </div>` : ""}
        </div>
      </div>`;
  });
  $("#view").innerHTML = `<div class="section-title">${PHASES.length > 1 ? `Las ${PHASES.length} fases del plan` : "Tu plan"}</div>` + html;

  $$(".phase-card").forEach(el => {
    el.addEventListener("click", () => el.classList.toggle("open"));
  });
}

function renderPeso() {
  const { week } = todayInfo();

  if (PLAN_MODE === "v2") {
    const stats = computeStats();
    const html = `
      <div class="section-title">Seguimiento</div>
      <div class="card">
        <p class="phase-summary">Este plan no usa báscula — el resultado se ve en la piel del brazo, no en el peso. Aquí tienes tu constancia real.</p>
      </div>
      <div class="card">
        ${statBarHTML("Entrenos completados", stats.trainingPct, `${stats.completedCount} de ${stats.scheduledCount} sesiones programadas hasta hoy`, "var(--z4)")}
        ${statBarHTML("Suplementos tomados", stats.suppPct, "Media diaria de creatina, proteína y omega 3 marcados sobre los programados", "var(--brand-2)")}
      </div>
      <div class="section-title">Recuerda cada domingo</div>
      <div class="card">
        <p class="phase-summary">${V2_WEEKLY_REVIEW_NOTE}</p>
      </div>`;
    $("#view").innerHTML = html;
    return;
  }

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
    const weeksToShow = getAllWeightTargetWeeks().filter(w => w <= Math.max(week, 1)).reverse();
    weeksToShow.forEach(w => {
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
    });
  }

  html += `</div>`;

  const stats = computeStats();
  html += `
    <div class="section-title">Estadísticas y seguimiento</div>
    <div class="card">
      ${statBarHTML("Semanas pesadas", stats.weightLogPct, `${stats.loggedWeeks} de ${stats.weighableWeeks} semanas con peso registrado`, "var(--brand)")}
      ${statBarHTML("Peso en objetivo", stats.weightOnTargetPct, stats.avgWeightDev !== null ? `Desviación media: ${stats.avgWeightDev >= 0 ? "+" : ""}${stats.avgWeightDev.toFixed(2)} kg respecto al objetivo semanal` : "Aún sin pesajes suficientes", "var(--z3)")}
      ${statBarHTML("Entrenos completados", stats.trainingPct, `${stats.completedCount} de ${stats.scheduledCount} sesiones programadas hasta hoy`, "var(--z4)")}
      ${statBarHTML("Ritmo en objetivo", stats.pacePct, stats.pacedSessionsCount ? `${stats.onPaceCount} de ${stats.pacedSessionsCount} sesiones dentro de ±10s/km · desviación media ${formatPaceDiff(stats.avgPaceDev)}` : "Registra sesiones con ritmo objetivo para verlo aquí", "var(--z5)")}
      ${statBarHTML("Suplementos tomados", stats.suppPct, "Media diaria de suplementos marcados sobre los programados", "var(--brand-2)")}
    </div>`;

  $("#view").innerHTML = applyCustomZoneText(html);

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
  const cloudUser = (typeof CloudSync !== "undefined" && CloudSync.user) || null;

  let accountHtml;
  if (typeof CloudSync === "undefined" || !CloudSync.enabled) {
    accountHtml = `
      <div class="section-title">Cuenta y copia en la nube</div>
      <div class="card">
        <p class="phase-summary">Aún no está configurada la sincronización en la nube. Tus datos siguen guardados solo en este dispositivo.</p>
      </div>`;
  } else if (cloudUser) {
    accountHtml = `
      <div class="section-title">Cuenta y copia en la nube</div>
      <div class="card">
        <div class="card-row">
          <div style="display:flex; align-items:center; gap:10px">
            ${cloudUser.photoURL ? `<img src="${cloudUser.photoURL}" alt="" style="width:36px;height:36px;border-radius:50%" />` : ""}
            <div>
              <div style="font-size:13.5px; font-weight:600">${cloudUser.displayName || "Sesión iniciada"}</div>
              <div style="font-size:11.5px; color:var(--text-muted)">${cloudUser.email || ""}</div>
            </div>
          </div>
          <span class="status-pill status-ontrack">☁️ Sincronizado</span>
        </div>
        <p class="phase-summary" style="margin-top:10px">Tus pesos, sesiones y ajustes se guardan también en la nube — si pierdes el móvil, entra con esta misma cuenta desde otro dispositivo y lo recuperas todo.</p>
        <button class="btn btn-ghost" id="signOutBtn" style="margin-top:12px">Cerrar sesión</button>
      </div>`;
  } else {
    accountHtml = `
      <div class="section-title">Cuenta y copia en la nube</div>
      <div class="card">
        <p class="phase-summary" style="margin-bottom:12px">Guarda una copia de tus datos en la nube — si pierdes el móvil o cambias de dispositivo, no pierdes tus semanas de progreso.</p>
        <div class="field"><label>Email</label><input id="authEmail" type="email" placeholder="tu@email.com" autocomplete="email" /></div>
        <div class="field"><label>Contraseña</label><input id="authPassword" type="password" placeholder="Mínimo 6 caracteres" autocomplete="current-password" /></div>
        <div class="btn-row">
          <button class="btn btn-ghost" id="signUpBtn">Crear cuenta</button>
          <button class="btn btn-primary" id="signInBtn">Iniciar sesión</button>
        </div>
        <button class="btn btn-ghost btn-sm" id="forgotPasswordBtn" style="margin-top:10px">¿Has olvidado tu contraseña?</button>
      </div>`;
  }

  const currentTheme = s.theme || "classic";
  let html = accountHtml + `
    <div class="section-title">Apariencia</div>
    <div class="card">
      <p class="phase-summary" style="margin-bottom:12px">Prueba los 4 diseños y quédate con el que más te guste — todo lo demás sigue funcionando igual.</p>
      <div class="theme-grid">
        ${THEMES.map(t => `
          <button class="theme-option ${t.id === currentTheme ? "active" : ""}" data-theme-id="${t.id}">
            <span class="theme-swatch">${t.swatch.map(c => `<i style="background:${c}"></i>`).join("")}</span>
            <span class="theme-name">${t.name}</span>
            <span class="theme-desc">${t.desc}</span>
            ${t.id === currentTheme ? `<span class="theme-check">✓</span>` : ""}
          </button>`).join("")}
      </div>
    </div>

    <div class="section-title">Tu perfil</div>
    <div class="card">
      <div class="field"><label>Nombre</label><input id="setName" value="${s.name}" /></div>
      <div class="field"><label>Fecha de inicio del plan (lunes de la semana 1)</label><input id="setStart" type="date" value="${s.startDate}" /></div>
      ${PLAN_MODE !== "v2" ? `<div class="field"><label>Peso inicial (kg)</label><input id="setStartWeight" type="number" step="0.1" value="${s.startWeight}" /></div>` : ""}
      <button class="btn btn-primary" id="saveSettings">Guardar cambios</button>
    </div>

    ${HR_ZONES.length ? `
    <div class="section-title">Zonas de frecuencia cardíaca</div>
    <div class="card">
      <p class="phase-summary" style="margin-bottom:10px">Ajusta los ppm de cada zona cuando revises tu forma física — se actualizan en todo el plan (entrenos, calendario y avisos).</p>
      <div id="zoneEditor">
        ${getZones().map((z, i) => `
          <div class="zone-edit-row">
            <span class="dot" style="width:9px;height:9px;border-radius:50%;background:${z.color};flex:none"></span>
            <span class="zone-edit-label">${z.label}</span>
            ${z.key === "z1" ? `
              <span class="zone-edit-inputs"><span>&lt;</span><input type="number" class="zone-input" data-idx="${i}" data-field="max" value="${z.max}" /></span>
            ` : z.key === "z5" ? `
              <span class="zone-edit-inputs"><span>&gt;</span><input type="number" class="zone-input" data-idx="${i}" data-field="min" value="${z.min}" /></span>
            ` : `
              <span class="zone-edit-inputs"><input type="number" class="zone-input" data-idx="${i}" data-field="min" value="${z.min}" /><span>–</span><input type="number" class="zone-input" data-idx="${i}" data-field="max" value="${z.max}" /></span>
            `}
          </div>`).join("")}
      </div>
      <button class="btn btn-primary" id="saveZones" style="margin-top:12px">Guardar zonas</button>
      <div class="divider"></div>
      <p class="phase-summary">FC reposo ${s.fcr} ppm · FC máxima ${s.fcm} ppm</p>
    </div>` : ""}

    <div class="section-title">Suplementación de referencia</div>
    <div class="card">
      ${SUPPLEMENT_DETAILS.map(sup => `
        <div class="exercise" style="display:block">
          <div class="card-row" style="align-items:flex-start">
            <div class="exercise-name">${sup.name}</div>
            <span class="badge" style="flex:none">${sup.kcal} kcal</span>
          </div>
          <div class="exercise-note">${sup.brand}</div>
          <div class="exercise-note" style="color:var(--brand-2); margin-top:4px">${sup.dose}</div>
          <div class="exercise-note" style="margin-top:4px">${sup.fn}</div>
          ${sup.kcalNote ? `<div class="exercise-note" style="margin-top:4px; font-style:italic">${sup.kcalNote}</div>` : ""}
        </div>`).join("")}
    </div>

    ${Object.keys(CALORIE_DICTIONARY).length ? `
    <div class="section-title">Diccionario de calorías</div>
    <div class="card">
      <p class="phase-summary" style="margin-bottom:8px">Pesos en crudo/seco — así se pesan en la báscula de cocina.</p>
      ${Object.values(CALORIE_DICTIONARY).map(group => `
        <div style="margin-top:12px">
          <h4 style="font-size:13px">${group.title}</h4>
          ${group.note ? `<p class="phase-summary" style="margin-top:4px">${group.note}</p>` : ""}
          ${group.items.map(it => `
            <div class="exercise">
              <div>
                <div class="exercise-name" style="font-size:13px">${it.name}</div>
                ${it.macro ? `<div class="exercise-note">${it.macro}</div>` : ""}
                ${it.note ? `<div class="exercise-note" style="color:var(--brand-2); margin-top:2px">${it.note}</div>` : ""}
              </div>
              <div class="exercise-set">${it.kcal} kcal</div>
            </div>`).join("")}
        </div>`).join("")}
    </div>` : ""}

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

    <div class="section-title">Avisos</div>
    <div class="card">
      <div class="card-row">
        <div>
          <h4 style="font-size:14px">Avisos diarios</h4>
          <p class="phase-summary" style="margin-top:4px">Un aviso al abrir la app avisando de si hoy toca báscula o qué entreno toca.</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="notifToggle" ${s.notificationsEnabled ? "checked" : ""} ${notificationsSupported() ? "" : "disabled"} />
          <span class="switch-track"><span class="switch-thumb"></span></span>
        </label>
      </div>
      ${!notificationsSupported() ? `<p class="phase-summary" style="margin-top:10px; color:var(--z4)">Tu navegador no soporta notificaciones.</p>` : ""}
      <p class="phase-summary" style="margin-top:10px">Solo se muestran mientras el teléfono permite que la app avise en segundo plano — esto depende del sistema operativo: funciona bien en Android con la app instalada, pero iPhone no permite avisos fiables en segundo plano para apps web, ni siquiera instaladas. Es la limitación de la plataforma, no de Forja21.</p>
    </div>

    <div class="section-title">Datos</div>
    <div class="card">
      <p class="phase-summary" style="margin-bottom:12px">Todos tus datos (peso, sesiones, checklist) se guardan solo en este dispositivo.</p>
      <button class="btn btn-danger" id="resetData">Borrar todos mis datos</button>
    </div>
  `;
  $("#view").innerHTML = html;

  $$(".theme-option").forEach(btn => {
    btn.addEventListener("click", () => {
      saveTheme(btn.dataset.themeId);
      showToast(`Tema "${THEMES.find(t => t.id === btn.dataset.themeId).name}" aplicado`);
      render();
    });
  });

  $("#saveSettings").addEventListener("click", () => {
    state.settings.name = $("#setName").value || "Atleta";
    const pickedRaw = $("#setStart").value;
    if (pickedRaw) {
      const monday = mondayOfWeek(parseDate(pickedRaw));
      state.settings.startDate = dateKey(monday);
    }
    const startWeightEl = $("#setStartWeight");
    if (startWeightEl) state.settings.startWeight = parseFloat(startWeightEl.value) || state.settings.startWeight;
    storeSet(STORE_KEYS.settings, state.settings);
    cloudPush(() => CloudSync.pushSettings(CloudSync.user.uid, state.settings));
    showToast("Ajustes guardados" + (pickedRaw && pickedRaw !== state.settings.startDate ? " (ajustado al lunes de esa semana)" : ""));
    render();
  });

  $("#saveZones")?.addEventListener("click", () => {
    const zones = getZones().map(z => ({ ...z }));
    $$(".zone-input").forEach(inp => {
      const idx = parseInt(inp.dataset.idx, 10);
      const field = inp.dataset.field;
      const v = parseInt(inp.value, 10);
      if (!isNaN(v)) zones[idx][field] = v;
    });
    // valida que cada zona tenga sentido (min < max) y que estén en orden ascendente
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (z.min != null && z.max != null && z.min >= z.max) { showToast("Cada zona necesita un mínimo menor que el máximo"); return; }
    }
    saveZones(zones);
    showToast("Zonas guardadas");
    render();
  });

  $("#notifToggle")?.addEventListener("change", async (e) => {
    if (e.target.checked) {
      const perm = await ensureNotificationPermission();
      if (perm === "granted") {
        state.settings.notificationsEnabled = true;
        storeSet(STORE_KEYS.settings, state.settings);
        cloudPush(() => CloudSync.pushSettings(CloudSync.user.uid, state.settings));
        showToast("Avisos activados");
        tryRegisterPeriodicSync();
        maybeSendDailyReminder();
      } else {
        e.target.checked = false;
        showToast(perm === "denied" ? "Bloqueado en los permisos del navegador" : "No se pudo activar");
      }
    } else {
      state.settings.notificationsEnabled = false;
      storeSet(STORE_KEYS.settings, state.settings);
      cloudPush(() => CloudSync.pushSettings(CloudSync.user.uid, state.settings));
      showToast("Avisos desactivados");
    }
  });

  $("#resetData").addEventListener("click", () => {
    confirmModal(
      "¿Borrar todos tus datos?",
      cloudUser
        ? "Se borrarán tus pesos, sesiones, checklist y el perfil guardado, tanto en este dispositivo como en la nube. Esta acción no se puede deshacer."
        : "Se borrarán tus pesos, sesiones, checklist y el perfil guardado. Esta acción no se puede deshacer.",
      "Sí, borrar todo",
      async () => {
        if (cloudUser) { try { await CloudSync.deleteAllCloudData(cloudUser.uid); } catch (e) {} }
        Object.values(STORE_KEYS).forEach(k => localStorage.removeItem(k));
        state.weights = []; state.workouts = []; state.supps = {};
        state.settings = { ...PROFILE_DEFAULTS, onboarded: false };
        showToast("Datos borrados");
        boot();
      }
    );
  });

  $("#signInBtn")?.addEventListener("click", async () => {
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    if (!email || !password) { showToast("Escribe tu email y contraseña"); return; }
    try {
      await CloudSync.signInWithEmail(email, password);
    } catch (e) {
      showToast(translateAuthError(e));
    }
  });
  $("#signUpBtn")?.addEventListener("click", async () => {
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    if (!email || !password) { showToast("Escribe tu email y contraseña"); return; }
    if (password.length < 6) { showToast("La contraseña debe tener al menos 6 caracteres"); return; }
    try {
      await CloudSync.signUpWithEmail(email, password);
      showToast("Cuenta creada — ya estás sincronizado");
    } catch (e) {
      showToast(translateAuthError(e));
    }
  });
  $("#forgotPasswordBtn")?.addEventListener("click", async () => {
    const email = $("#authEmail").value.trim();
    if (!email) { showToast("Escribe tu email arriba primero"); return; }
    try {
      await CloudSync.resetPassword(email);
      showToast("Te hemos enviado un email para restablecer la contraseña");
    } catch (e) {
      showToast(translateAuthError(e));
    }
  });
  $("#signOutBtn")?.addEventListener("click", async () => {
    await CloudSync.signOutUser();
    if (typeof ForjaPlanRouter !== "undefined") ForjaPlanRouter.applyPlanRoute(null);
    else if (typeof applyPlanForEmail === "function") applyPlanForEmail(null);
    showToast("Sesión cerrada — tus datos siguen en este dispositivo");
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

/* ---------------- Nuevo sistema personalizado ---------------- */
function renderPersonalizedSetupStart(user) {
  if (typeof PersonalizedOnboarding !== "undefined") {
    PersonalizedOnboarding.start(user);
    return;
  }

  // Fallback de seguridad por si una caché antigua todavía no tiene el fichero.
  $("#bottomnav").style.display = "none";
  $("#routeBar").innerHTML = "";
  const statStrip = $("#statStrip");
  if (statStrip) statStrip.innerHTML = "";
  $("#topbarSub").textContent = "Plan personalizado";
  $("#view").innerHTML = `
    <div class="card">
      <h4>Actualizando Forja21…</h4>
      <p class="phase-summary" style="margin-top:6px">Recarga la aplicación para cargar el nuevo cuestionario personalizado.</p>
    </div>`;
}

/* ---------------- Init ---------------- */
function boot() {
  applyTheme(state.settings.theme || "classic");
  if (isStandalone()) $("#installBtn").hidden = true;

  const personalizedUser = typeof ForjaPlanRouter !== "undefined"
    && ForjaPlanRouter.route === "personalized"
    && typeof CloudSync !== "undefined"
    && CloudSync.user;

  if (personalizedUser) {
    renderPersonalizedSetupStart(CloudSync.user);
    return;
  }

  if (!state.settings.onboarded) {
    renderOnboarding();
  } else {
    $("#bottomnav").style.display = "";
    render();
    maybeSendDailyReminder();
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.settings.onboarded) maybeSendDailyReminder();
});
boot();

/* ---------------- Sincronización con la nube al iniciar/cerrar sesión ---------------- */
let cloudSyncInProgress = false;
async function handleCloudAuthChange(user) {
  if (!user || cloudSyncInProgress) return;
  cloudSyncInProgress = true;
  try {
    const route = typeof ForjaPlanRouter !== "undefined"
      ? ForjaPlanRouter.applyPlanRoute(user)
      : "legacy-toni";

    // Los usuarios nuevos NO heredan ni suben datos locales de Toni/Beizga.
    // Entrarán por su propio onboarding y su propio documento de plan.
    if (route === "personalized") {
      boot();
      return;
    }

    // A partir de aquí el flujo legacy se conserva exactamente como estaba.
    const cloud = await CloudSync.pullAll(user.uid);
    const cloudHasData = cloud.settings || cloud.weights.length || cloud.workouts.length || Object.keys(cloud.supps).length;

    if (cloudHasData) {
      // Ya había datos en esta cuenta — la nube manda sobre lo que hay en este dispositivo.
      if (cloud.settings) state.settings = { ...state.settings, ...cloud.settings, onboarded: true };
      if (cloud.weights.length) state.weights = cloud.weights;
      if (cloud.workouts.length) state.workouts = cloud.workouts;
      if (Object.keys(cloud.supps).length) state.supps = cloud.supps;
      storeSet(STORE_KEYS.settings, state.settings);
      storeSet(STORE_KEYS.weights, state.weights);
      storeSet(STORE_KEYS.workouts, state.workouts);
      storeSet(STORE_KEYS.supps, state.supps);
      showToast("Datos recuperados de la nube ☁️");
    } else if (state.settings.onboarded) {
      // Primera vez con esta cuenta y ya había progreso en este dispositivo — lo subimos.
      await CloudSync.pushSettings(user.uid, state.settings);
      await Promise.all(state.weights.map(w => CloudSync.pushWeight(user.uid, w)));
      await Promise.all(state.workouts.map(w => CloudSync.pushWorkout(user.uid, w)));
      await Promise.all(Object.entries(state.supps).map(([dk, arr]) => CloudSync.pushSupps(user.uid, dk, arr)));
      showToast("Copia de seguridad subida a la nube ☁️");
    }
    boot();
  } catch (e) {
    showToast("No se pudo sincronizar con la nube");
  } finally {
    cloudSyncInProgress = false;
  }
}
if (typeof CloudSync !== "undefined" && CloudSync.enabled) {
  CloudSync.onAuthChange(handleCloudAuthChange);
}
