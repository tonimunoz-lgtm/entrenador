/* ==========================================================================
   FORJA21 — Gamificación (inyector)

   Este fichero NO modifica ningún fichero existente. Se carga el último de
   todos y "envuelve" las funciones que ya existen (logWorkout, toggleSupp,
   saveWeight, render, boot, handleCloudAuthChange, renderOnboarding):
   siempre se ejecuta primero el código original tal cual, y por encima,
   protegido con try/catch, se engancha la lógica nueva. Si algo de aquí
   fallara, la app de siempre sigue funcionando exactamente igual.

   Incluye: racha diaria, insignias, días justificados (enfermedad/trabajo),
   y la mascota "Chispa".
   ========================================================================== */

(function () {
  "use strict";

  const FREEZES_PER_MONTH = 2;     // "congeladores" de racha, como Duolingo
  const GK = {
    excused: "forja21_gami_excused",
    badges: "forja21_gami_badges",
    lastMascotMsg: "forja21_gami_lastmsg"
  };

  const GamiState = {
    excused: storeGet(GK.excused, {}),   // { "2026-08-19": {reason, note, at} }
    badges: storeGet(GK.badges, {})      // { badge_id: { unlockedAt: "2026-08-19" } }
  };

  function persistExcused() { storeSet(GK.excused, GamiState.excused); }
  function persistBadges() { storeSet(GK.badges, GamiState.badges); }

  /* ---------------- Nube (Firestore directo, sin tocar firebase-sync.js) ---------------- */
  function gamiEnabled() { return typeof CloudSync !== "undefined" && CloudSync.enabled && typeof firebase !== "undefined"; }
  function gamiDocRef(uid) {
    return firebase.firestore().collection("users").doc(uid).collection("meta").doc("gamification");
  }
  function gamiCloudPush() {
    if (!gamiEnabled() || !CloudSync.user) return;
    try { gamiDocRef(CloudSync.user.uid).set({ excused: GamiState.excused, badges: GamiState.badges }, { merge: true }).catch(() => {}); }
    catch (e) {}
  }
  async function gamiCloudPull(uid) {
    if (!gamiEnabled()) return null;
    try {
      const doc = await gamiDocRef(uid).get();
      return doc.exists ? doc.data() : null;
    } catch (e) { return null; }
  }

  /* ==========================================================================
     RACHA
     ========================================================================= */
  function isTrainingType(type) { return ["gym", "quality", "long", "race"].includes(type); }

  function isExcused(dk) { return !!GamiState.excused[dk]; }

  function dayRequirementMet(dateObj) {
    const week = getWeekNumber(dateObj);
    if (week < 1 || week > TOTAL_PLAN_WEEKS) return true; // fuera del plan, no rompe nada
    const dayKey = JS_DOW_TO_KEY[dateObj.getDay()];
    const day = getDaySchedule(week, dayKey);
    if (!day) return true;
    const dk = dateKey(dateObj);
    if (isExcused(dk)) return true;
    if (isTrainingType(day.type)) return workoutsForDate(dk).length > 0;
    return true; // descanso/activo cuenta solo
  }

  function computeStreak() {
    const today = startOfDay(new Date());
    const startDate = startOfDay(parseDate(state.settings.startDate));
    if (today < startDate) return 0;
    let cursor = new Date(today);
    if (!dayRequirementMet(cursor)) cursor = addDays(cursor, -1); // hoy aún no ha terminado
    let streak = 0;
    const freezeUsage = {};
    while (cursor >= startDate) {
      if (dayRequirementMet(cursor)) { streak++; cursor = addDays(cursor, -1); continue; }
      const mk = cursor.getFullYear() + "-" + cursor.getMonth();
      freezeUsage[mk] = (freezeUsage[mk] || 0) + 1;
      if (freezeUsage[mk] <= FREEZES_PER_MONTH) { streak++; cursor = addDays(cursor, -1); }
      else break;
    }
    return streak;
  }

  function computeSuppStreak() {
    const today = startOfDay(new Date());
    const startDate = startOfDay(parseDate(state.settings.startDate));
    if (today < startDate) return 0;
    function suppComplete(d) {
      const week = getWeekNumber(d);
      if (week < 1 || week > TOTAL_PLAN_WEEKS) return true;
      const dayKey = JS_DOW_TO_KEY[d.getDay()];
      const day = getDaySchedule(week, dayKey);
      if (!day || !day.supplements || !day.supplements.length) return true;
      return getSuppChecks(dateKey(d)).length >= day.supplements.length;
    }
    let cursor = new Date(today);
    if (!suppComplete(cursor)) cursor = addDays(cursor, -1);
    let streak = 0;
    while (cursor >= startDate) {
      if (suppComplete(cursor)) { streak++; cursor = addDays(cursor, -1); } else break;
    }
    return streak;
  }

  function computeWeightOnTrackStreak() {
    if (typeof PLAN_MODE !== "undefined" && PLAN_MODE === "v2") return 0;
    if (typeof getAllWeightTargetWeeks !== "function") return 0;
    const weeks = getAllWeightTargetWeeks().filter(w => getWeightLog(w)).sort((a, b) => b - a);
    let streak = 0;
    for (const w of weeks) {
      if (weightStatus(w).cls === "status-ontrack") streak++; else break;
    }
    return streak;
  }

  function hasHadPerfectWeek() {
    const { week: curWeek } = todayInfo();
    const today = startOfDay(new Date());
    for (let w = 1; w <= Math.min(curWeek, TOTAL_PLAN_WEEKS); w++) {
      const keys = trainingDayKeysForWeek(w);
      if (!keys.length) continue;
      const dates = weekDates(w);
      let allDone = true, anyFuture = false;
      keys.forEach(k => {
        const d = dates.find(x => x.key === k);
        if (!d) { allDone = false; return; }
        if (startOfDay(d.date) > today) { anyFuture = true; return; }
        if (!(workoutsForDate(dateKey(d.date)).length > 0 || isExcused(dateKey(d.date)))) allDone = false;
      });
      if (allDone && !anyFuture) return true;
    }
    return false;
  }

  /* ==========================================================================
     INSIGNIAS
     ========================================================================= */
  const BADGES = [
    { id: "workouts_1", name: "Primer entreno", desc: "Registraste tu primera sesión.", icon: "🏁", check: c => c.totalWorkouts >= 1 },
    { id: "streak_7", name: "Racha de 7 días", desc: "7 días seguidos cumpliendo el plan.", icon: "🔥", check: c => c.streak >= 7 },
    { id: "streak_30", name: "Racha de 30 días", desc: "Un mes entero sin fallar.", icon: "🔥", check: c => c.streak >= 30 },
    { id: "streak_100", name: "Racha de 100 días", desc: "100 días de constancia.", icon: "🔥", check: c => c.streak >= 100 },
    { id: "workouts_10", name: "10 sesiones", desc: "Ya llevas 10 entrenos registrados.", icon: "💪", check: c => c.totalWorkouts >= 10 },
    { id: "workouts_50", name: "50 sesiones", desc: "Medio centenar de entrenos.", icon: "💪", check: c => c.totalWorkouts >= 50 },
    { id: "workouts_100", name: "100 sesiones", desc: "Cien sesiones registradas.", icon: "🏆", check: c => c.totalWorkouts >= 100 },
    { id: "supp_streak_7", name: "Semana de suplementos", desc: "7 días seguidos con todos los suplementos tomados.", icon: "💊", check: c => c.suppStreak >= 7 },
    { id: "perfect_week", name: "Semana perfecta", desc: "Cumpliste todos los entrenos programados de una semana.", icon: "✅", check: c => c.perfectWeek },
    { id: "weight_1", name: "Primera pesada", desc: "Registraste tu primer peso.", icon: "⚖️", planModes: ["v1"], check: c => c.weightLogs >= 1 },
    { id: "weight_ontrack_5", name: "5 semanas en objetivo", desc: "5 semanas seguidas de peso en objetivo.", icon: "🎯", planModes: ["v1"], check: c => c.weightOnTrackStreak >= 5 },
    { id: "weight_loss_5", name: "-5 kg", desc: "Has perdido 5 kg desde el inicio.", icon: "📉", planModes: ["v1"], check: c => c.totalLossKg >= 5 },
    { id: "weight_loss_10", name: "-10 kg", desc: "Has perdido 10 kg desde el inicio.", icon: "📉", planModes: ["v1"], check: c => c.totalLossKg >= 10 },
    { id: "pace_1", name: "Primer ritmo cumplido", desc: "Una sesión dentro de ±10s/km del objetivo.", icon: "⏱️", planModes: ["v1"], check: c => c.onPaceCount >= 1 },
    { id: "pace_5", name: "5 ritmos cumplidos", desc: "5 sesiones dentro del ritmo objetivo.", icon: "⏱️", planModes: ["v1"], check: c => c.onPaceCount >= 5 },
    { id: "phase_1_done", name: "Fase 1 completada", desc: "Terminaste la Base Aeróbica.", icon: "🥇", planModes: ["v1"], check: c => c.week > 8 },
    { id: "race_done", name: "¡Media maratón corrida!", desc: "Completaste la Mitja Marató de Granollers.", icon: "🏅", planModes: ["v1"], check: c => c.raceLogged },
    { id: "final_goal", name: "Objetivo final", desc: "Completaste las 40 semanas del plan.", icon: "👑", planModes: ["v1"], check: c => c.week > 40 },
    { id: "choque_done", name: "12 semanas completadas", desc: "Terminaste el plan de choque de brazos.", icon: "👑", planModes: ["v2"], check: c => c.week > 12 }
  ];

  function activeBadges() {
    const mode = typeof PLAN_MODE !== "undefined" ? PLAN_MODE : "v1";
    return BADGES.filter(b => !b.planModes || b.planModes.includes(mode));
  }

  function buildBadgeContext() {
    const { week } = todayInfo();
    const totalWorkouts = state.workouts.length;
    const weightLogs = state.weights.length;
    const onPaceCount = state.workouts.filter(w => w.deviationSec !== null && w.deviationSec !== undefined && Math.abs(w.deviationSec) <= 10).length;
    const totalLossKg = (typeof PLAN_MODE !== "undefined" && PLAN_MODE === "v2") ? 0 : Math.max(0, (state.settings.startWeight || 0) - latestWeight());
    const raceWk = typeof RACE_WEEK !== "undefined" ? RACE_WEEK : -1;
    const raceLogged = state.workouts.some(w => w.week === raceWk && w.dayKey === "sun");
    return {
      week, totalWorkouts, weightLogs, onPaceCount, totalLossKg,
      weightOnTrackStreak: computeWeightOnTrackStreak(),
      suppStreak: computeSuppStreak(),
      perfectWeek: hasHadPerfectWeek(),
      raceLogged,
      streak: computeStreak()
    };
  }

  function checkAndUnlockBadges() {
    const ctx = buildBadgeContext();
    const newlyUnlocked = [];
    activeBadges().forEach(b => {
      if (GamiState.badges[b.id]) return;
      try {
        if (b.check(ctx)) {
          GamiState.badges[b.id] = { unlockedAt: dateKey(new Date()) };
          newlyUnlocked.push(b);
        }
      } catch (e) {}
    });
    if (newlyUnlocked.length) {
      persistBadges();
      gamiCloudPush();
      queueCelebrations(newlyUnlocked);
    }
    return ctx;
  }

  /* ==========================================================================
     DÍAS JUSTIFICADOS
     ========================================================================= */
  function markExcused(dk, reason, note) {
    GamiState.excused[dk] = { reason, note: note || "", at: Date.now() };
    persistExcused();
    gamiCloudPush();
  }
  function unmarkExcused(dk) {
    delete GamiState.excused[dk];
    persistExcused();
    gamiCloudPush();
  }

  const EXCUSE_REASONS = [
    { id: "enfermedad", label: "🤒 Enfermedad" },
    { id: "trabajo", label: "💼 Exceso de trabajo" },
    { id: "otro", label: "📌 Otro motivo" }
  ];

  function openExcuseModal(dk, onDone) {
    const existing = GamiState.excused[dk];
    openModal(
      `<div class="modal-title">¿Por qué no se pudo hacer?</div><div class="modal-desc">No cuenta como fallo — ni en la racha ni en las estadísticas.</div>`,
      `<div class="gami-excuse-reasons">
        ${EXCUSE_REASONS.map(r => `<button class="gami-excuse-btn ${existing && existing.reason === r.id ? "active" : ""}" data-reason="${r.id}">${r.label}</button>`).join("")}
      </div>
      <div class="field" style="margin-top:12px"><label>Nota (opcional)</label><input id="excuseNote" placeholder="Ej. gripe, viaje de trabajo…" value="${existing ? existing.note || "" : ""}" /></div>
      <div class="btn-row" style="margin-top:6px">
        ${existing ? `<button type="button" class="btn btn-ghost" id="excuseRemove">Quitar justificación</button>` : `<button type="button" class="btn btn-ghost" id="excuseCancel">Cancelar</button>`}
      </div>`
    );
    let chosen = existing ? existing.reason : null;
    $$(".gami-excuse-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        chosen = btn.dataset.reason;
        const note = $("#excuseNote").value;
        markExcused(dk, chosen, note);
        closeModal();
        showToast("Día marcado como justificado 🩹");
        if (onDone) onDone();
      });
    });
    $("#excuseCancel")?.addEventListener("click", closeModal);
    $("#excuseRemove")?.addEventListener("click", () => {
      unmarkExcused(dk);
      closeModal();
      showToast("Justificación eliminada");
      if (onDone) onDone();
    });
  }

  /* ==========================================================================
     MASCOTA "CHISPA"
     ========================================================================= */
  const MASCOT_SVG = `
    <svg viewBox="0 0 100 100" class="chispa-svg">
      <defs>
        <linearGradient id="chispaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3E7BFA"/><stop offset="50%" stop-color="#22C55E"/><stop offset="100%" stop-color="#F5B400"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="52" r="40" fill="url(#chispaGrad)"/>
      <g class="chispa-eyes">
        <ellipse cx="38" cy="46" rx="5" ry="7" fill="#0F1417"/>
        <ellipse cx="64" cy="46" rx="5" ry="7" fill="#0F1417"/>
      </g>
      <path class="chispa-mouth" d="M32 64 Q50 78 68 64" stroke="#0F1417" stroke-width="4" fill="none" stroke-linecap="round"/>
    </svg>`;

  const MSG = {
    greetingMorning: ["¡Buenos días! Hoy toca darlo todo 💪", "Arriba, campeón — vamos a por hoy.", "Un café y a la faena — hoy también cuenta."],
    greetingAfternoon: ["¿Qué tal el día? Aún puedes dejarlo bien rematado.", "Buenas tardes — ¿ya has visto qué toca hoy?"],
    greetingEvening: ["Última llamada del día — no dejes el streak a medias.", "Buenas noches, revisa si te falta algo antes de dormir."],
    streakHigh: n => [`🔥 ${n} días seguidos — no lo sueltes ahora.`, `Llevas ${n} días de racha. Esto ya es un hábito de verdad.`],
    streakZero: ["Empecemos una racha nueva hoy mismo.", "Hoy es un buen día para arrancar racha."],
    streakAtRisk: ["Si hoy no marcas nada, se rompe la racha — aún estás a tiempo.", "Ojo, hoy toca algo para no perder la racha."],
    postWorkout: ["¡Sesión registrada! Así se hace.", "Anotado — un paso más cerca del objetivo.", "Bien ahí. El cuerpo lo nota aunque tú no lo veas todavía."],
    badgeUnlocked: name => [`¡Insignia desbloqueada! ${name} 🎉`],
    noActivity2Days: ["Llevas un par de días sin marcar nada — ¿va todo bien?", "Si necesitas parar unos días, puedes justificarlo en vez de romper la racha."],
    excusedAck: ["Entendido, descansa y recupérate — lo importante es volver.", "Anotado. Lo que importa es la constancia a largo plazo, no un día suelto."]
  };
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  let mascotEl = null;
  function ensureMascot() {
    if (mascotEl) return mascotEl;
    mascotEl = document.createElement("div");
    mascotEl.className = "chispa-widget";
    mascotEl.innerHTML = `
      <div class="chispa-bubble" id="chispaBubble" hidden></div>
      <button class="chispa-avatar" id="chispaAvatar" aria-label="Chispa">${MASCOT_SVG}</button>`;
    document.body.appendChild(mascotEl);
    $("#chispaAvatar").addEventListener("click", () => {
      setMascotMessage(pickContextualMessage());
    });
    return mascotEl;
  }

  function setMascotMessage(text, opts) {
    ensureMascot();
    const bubble = $("#chispaBubble");
    bubble.textContent = text;
    bubble.hidden = false;
    mascotEl.classList.toggle("celebrate", !!(opts && opts.celebrate));
    clearTimeout(mascotEl._hideTimer);
    mascotEl._hideTimer = setTimeout(() => { bubble.hidden = true; mascotEl.classList.remove("celebrate"); }, opts && opts.celebrate ? 4600 : 3800);
  }

  function pickContextualMessage() {
    const ctx = buildBadgeContext();
    const hour = new Date().getHours();
    if (ctx.streak === 0) return pick(MSG.streakZero);
    if (ctx.streak >= 3) return pick(MSG.streakHigh(ctx.streak));
    if (hour < 13) return pick(MSG.greetingMorning);
    if (hour < 20) return pick(MSG.greetingAfternoon);
    return pick(MSG.greetingEvening);
  }

  function maybeProactiveMascotMessage() {
    ensureMascot();
    const today = startOfDay(new Date());
    const dk = dateKey(today);
    if (storeGet(GK.lastMascotMsg, "") === dk) return; // ya hemos saludado hoy
    storeSet(GK.lastMascotMsg, dk);
    const ctx = buildBadgeContext();
    let msg;
    if (ctx.streak === 0) msg = pick(MSG.streakZero);
    else if (ctx.streak > 0 && ctx.streak % 7 === 0) msg = pick(MSG.streakHigh(ctx.streak));
    else {
      const hour = new Date().getHours();
      msg = hour < 13 ? pick(MSG.greetingMorning) : hour < 20 ? pick(MSG.greetingAfternoon) : pick(MSG.greetingEvening);
    }
    setTimeout(() => setMascotMessage(msg), 900);
  }

  /* ---------------- Celebración a pantalla completa ---------------- */
  let celebrationQueue = [];
  let celebrating = false;
  function queueCelebrations(badges) {
    celebrationQueue.push(...badges);
    if (!celebrating) showNextCelebration();
  }
  function showNextCelebration() {
    const badge = celebrationQueue.shift();
    if (!badge) { celebrating = false; return; }
    celebrating = true;
    const overlay = document.createElement("div");
    overlay.className = "gami-celebrate-overlay";
    overlay.innerHTML = `
      <div class="gami-confetti">${Array.from({ length: 26 }).map((_, i) => `<i style="--i:${i}"></i>`).join("")}</div>
      <div class="gami-celebrate-card">
        <div class="chispa-big">${MASCOT_SVG}</div>
        <div class="gami-badge-icon">${badge.icon}</div>
        <div class="gami-celebrate-title">¡Insignia desbloqueada!</div>
        <div class="gami-celebrate-name">${badge.name}</div>
        <div class="gami-celebrate-desc">${badge.desc}</div>
        <button class="btn btn-primary" id="celebrateClose">Seguir</button>
      </div>`;
    document.body.appendChild(overlay);
    $("#celebrateClose", overlay).addEventListener("click", () => { overlay.remove(); showNextCelebration(); });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) { overlay.remove(); showNextCelebration(); } });
  }

  /* ==========================================================================
     INSERCIONES EN LA INTERFAZ (post-render, sin editar app.js)
     ========================================================================= */
  function injectStreakChip() {
    const strip = $("#statStrip");
    if (!strip) return;
    const streak = computeStreak();
    const chip = document.createElement("div");
    chip.className = "stat-chip gami-streak-chip";
    chip.innerHTML = `<b>🔥 ${streak}</b><span>racha</span>`;
    strip.appendChild(chip);
  }

  function injectExcuseButton() {
    const logBtn = $("#logSessionBtn");
    if (!logBtn) return;
    const card = logBtn.closest(".card");
    if (!card || $(".gami-excuse-link", card)) return;
    const { date } = todayInfo();
    const dk = dateKey(date);
    const link = document.createElement("button");
    link.className = "btn btn-ghost btn-sm gami-excuse-link";
    link.style.marginTop = "8px";
    link.textContent = isExcused(dk) ? "🩹 Editar justificación de hoy" : "🩹 No he podido entrenar hoy";
    link.addEventListener("click", () => openExcuseModal(dk, () => render()));
    card.appendChild(link);
  }

  function injectBadgesSection() {
    const view = $("#view");
    if (!view || state.activeTab !== "peso") return;
    if ($(".gami-badges-section")) return;
    const ctx = buildBadgeContext();
    const list = activeBadges();
    const unlockedCount = list.filter(b => GamiState.badges[b.id]).length;
    const section = document.createElement("div");
    section.className = "gami-badges-section";
    section.innerHTML = `
      <div class="section-title">Racha e insignias</div>
      <div class="card">
        <div class="card-row">
          <div><h4 style="font-size:14px">🔥 Racha actual</h4><p class="phase-summary" style="margin-top:4px">${ctx.streak} día${ctx.streak === 1 ? "" : "s"} seguidos · ${FREEZES_PER_MONTH} congeladores al mes si algún día se te olvida</p></div>
          <div class="gami-streak-big">${ctx.streak}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-row"><h4 style="font-size:14px">Insignias</h4><span class="badge">${unlockedCount}/${list.length}</span></div>
        <div class="gami-badge-grid">
          ${list.map(b => {
            const unlocked = GamiState.badges[b.id];
            return `<div class="gami-badge-cell ${unlocked ? "unlocked" : ""}" title="${b.desc}">
              <div class="gami-badge-cell-icon">${unlocked ? b.icon : "🔒"}</div>
              <div class="gami-badge-cell-name">${b.name}</div>
            </div>`;
          }).join("")}
        </div>
      </div>`;
    view.appendChild(section);
  }

  function injectExcusedMarkers() {
    $$("[data-date]").forEach(el => {
      const dk = el.dataset.date;
      if (!dk || !isExcused(dk)) return;
      if ($(".gami-excused-dot", el)) return;
      const dot = document.createElement("span");
      dot.className = "gami-excused-dot";
      dot.textContent = "🩹";
      el.appendChild(dot);
    });
  }

  /* ==========================================================================
     ENVOLTURA DE FUNCIONES EXISTENTES (aquí es donde "nos enganchamos")
     ========================================================================= */
  const _render = render;
  render = function () {
    _render();
    try {
      injectStreakChip();
      if (state.activeTab === "hoy") injectExcuseButton();
      if (state.activeTab === "peso") injectBadgesSection();
      if (state.activeTab === "calendario") injectExcusedMarkers();
      ensureMascot();
    } catch (e) { /* nunca romper la app por esto */ }
  };

  if (typeof openDayModal === "function") {
    const _openDayModal = openDayModal;
    openDayModal = function (dateObj) {
      _openDayModal(dateObj);
      try {
        const week = getWeekNumber(dateObj);
        if (week < 1) return; // pantalla de "aún no ha empezado" — nada que justificar
        const dk = dateKey(dateObj);
        const sheet = $(".modal-sheet");
        if (!sheet || $(".gami-excuse-link", sheet)) return;
        const today = startOfDay(new Date());
        if (startOfDay(dateObj) > today) return; // no se justifican días futuros
        const link = document.createElement("button");
        link.className = "btn btn-ghost btn-sm gami-excuse-link";
        link.style.marginTop = "4px";
        link.textContent = isExcused(dk) ? "🩹 Editar justificación de este día" : "🩹 Marcar este día como no disponible";
        link.addEventListener("click", () => openExcuseModal(dk, () => { closeModal(); render(); }));
        sheet.appendChild(link);
      } catch (e) {}
    };
  }

  const _logWorkout = logWorkout;
  logWorkout = function (entry) {
    _logWorkout(entry);
    try {
      checkAndUnlockBadges();
      setMascotMessage(pick(MSG.postWorkout), { celebrate: false });
    } catch (e) {}
  };

  const _toggleSupp = toggleSupp;
  toggleSupp = function (dk, id) {
    _toggleSupp(dk, id);
    try { checkAndUnlockBadges(); } catch (e) {}
  };

  const _saveWeight = saveWeight;
  saveWeight = function (week, weight) {
    _saveWeight(week, weight);
    try { checkAndUnlockBadges(); } catch (e) {}
  };

  const _boot = boot;
  boot = function () {
    _boot();
    try {
      if (state.settings.onboarded) {
        checkAndUnlockBadges();
        maybeProactiveMascotMessage();
      }
    } catch (e) {}
  };

  if (typeof renderOnboarding === "function") {
    const _renderOnboarding = renderOnboarding;
    renderOnboarding = function () {
      // Si llegamos aquí tras un "borrar todos mis datos", empezamos la
      // gamificación también de cero.
      try {
        if (!state.settings.onboarded) {
          GamiState.excused = {}; GamiState.badges = {};
          persistExcused(); persistBadges();
        }
      } catch (e) {}
      _renderOnboarding();
    };
  }

  if (typeof handleCloudAuthChange === "function") {
    const _handleCloudAuthChange = handleCloudAuthChange;
    handleCloudAuthChange = async function (user) {
      await _handleCloudAuthChange(user);
      try {
        if (user) {
          const cloud = await gamiCloudPull(user.uid);
          if (cloud) {
            if (cloud.excused) GamiState.excused = cloud.excused;
            if (cloud.badges) GamiState.badges = cloud.badges;
            persistExcused(); persistBadges();
          } else {
            gamiCloudPush();
          }
        }
      } catch (e) {}
    };
  }

  /* ---------------- CSS inyectado (usa las variables de tema ya existentes) ---------------- */
  const style = document.createElement("style");
  style.textContent = `
    .gami-streak-chip b{ color: var(--z4); }

    /* Mascota */
    .chispa-widget{ position: fixed; right: 16px; bottom: calc(78px + var(--safe-bottom)); z-index: 45; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
    .chispa-avatar{ width:52px; height:52px; border-radius:50%; border:2px solid var(--surface); background:transparent; padding:0; cursor:pointer; box-shadow: 0 6px 18px rgba(0,0,0,0.35); animation: chispaBounce 3.4s ease-in-out infinite; }
    .chispa-svg{ width:100%; height:100%; display:block; }
    .chispa-eyes{ animation: chispaBlink 4.5s infinite; transform-origin: center; }
    @keyframes chispaBounce{ 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-5px); } }
    @keyframes chispaBlink{ 0%,92%,100%{ transform: scaleY(1); } 95%{ transform: scaleY(0.15); } }
    .chispa-widget.celebrate .chispa-avatar{ animation: chispaCelebrate 0.6s ease-in-out 3; }
    @keyframes chispaCelebrate{ 0%,100%{ transform: rotate(0deg) scale(1); } 30%{ transform: rotate(-12deg) scale(1.08); } 60%{ transform: rotate(10deg) scale(1.08); } }
    .chispa-bubble{
      max-width: 220px; background: var(--surface-2); border:1px solid var(--border); color: var(--text);
      font-size:12.5px; line-height:1.4; padding:10px 13px; border-radius:14px; border-bottom-right-radius:4px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }

    /* Justificar día */
    .gami-excuse-reasons{ display:flex; flex-direction:column; gap:8px; }
    .gami-excuse-btn{
      text-align:left; padding:12px 14px; border-radius:12px; border:1.5px solid var(--border);
      background: var(--surface-3); color: var(--text); font-size:13.5px; font-weight:600; cursor:pointer;
    }
    .gami-excuse-btn.active{ border-color: var(--brand); background: color-mix(in srgb, var(--brand) 14%, var(--surface-3)); }

    /* Insignias */
    .gami-streak-big{ font-family: var(--font-mono); font-size:28px; font-weight:700; color: var(--z4); }
    .gami-badge-grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:12px; }
    .gami-badge-cell{ background: var(--surface-3); border:1px solid var(--border); border-radius: var(--radius-md); padding:12px 6px; text-align:center; opacity:0.5; }
    .gami-badge-cell.unlocked{ opacity:1; border-color: color-mix(in srgb, var(--brand) 40%, var(--border)); }
    .gami-badge-cell-icon{ font-size:22px; }
    .gami-badge-cell-name{ font-size:9.5px; color: var(--text-muted); margin-top:6px; line-height:1.3; }

    .gami-excused-dot{ position:absolute; top:6px; right:8px; font-size:11px; line-height:1; }
    .week-day{ position:relative; }
    .month-cell{ position:relative; }

    /* Celebración */
    .gami-celebrate-overlay{ position:fixed; inset:0; z-index:80; background: rgba(0,0,0,0.72); display:flex; align-items:center; justify-content:center; }
    .gami-celebrate-card{
      position:relative; z-index:2; width: calc(100% - 56px); max-width:320px; background: var(--surface-2);
      border:1px solid var(--border); border-radius:24px; padding:28px 22px; text-align:center;
      animation: gamiPopIn 0.35s cubic-bezier(.2,1.4,.4,1);
    }
    @keyframes gamiPopIn{ from{ transform: scale(0.85); opacity:0; } to{ transform: scale(1); opacity:1; } }
    .chispa-big{ width:88px; height:88px; margin: 0 auto 8px; }
    .gami-badge-icon{ font-size:40px; margin-bottom:6px; }
    .gami-celebrate-title{ font-size:11px; text-transform:uppercase; letter-spacing:1px; color: var(--text-muted); font-weight:700; }
    .gami-celebrate-name{ font-family: var(--font-display); font-size:20px; font-weight:700; margin-top:4px; }
    .gami-celebrate-desc{ font-size:12.5px; color: var(--text-muted); margin-top:8px; line-height:1.5; }
    .gami-celebrate-card .btn{ margin-top:18px; }
    .gami-confetti{ position:absolute; inset:0; overflow:hidden; pointer-events:none; }
    .gami-confetti i{
      position:absolute; top:-10px; left: calc(var(--i) * 4%); width:7px; height:12px;
      background: hsl(calc(var(--i) * 23), 85%, 60%); opacity:0.9;
      animation: gamiFall 2.6s linear calc(var(--i) * 0.05s) 1;
      transform: rotate(calc(var(--i) * 37deg));
    }
    @keyframes gamiFall{ to{ transform: translateY(110vh) rotate(720deg); opacity:0; } }
  `;
  document.head.appendChild(style);
})();
