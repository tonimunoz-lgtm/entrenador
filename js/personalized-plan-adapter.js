/* ==========================================================================
   FORJA21 — Adaptador del plan personalizado a la interfaz legacy

   Convierte el JSON generado por Mistral al formato que ya usan:
   - Hoy
   - Calendario
   - Fases
   - Progreso

   Toni y Beizga no pasan nunca por este adaptador.
   ========================================================================== */

(function () {
  "use strict";

  const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const PHASE_COLORS = ["#3E7BFA", "#22C55E", "#8B5CF6", "#FB923C", "#EC4899", "#06B6D4"];

  let activePlan = null;
  let activeOnboarding = null;

  function n(v, fallback = 0) {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }

  function slug(text) {
    return String(text || "suplemento")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "suplemento";
  }

  function isoToDateLabel(startDate, fromWeek, toWeek) {
    try {
      const start = new Date(startDate + "T00:00:00");
      const from = new Date(start);
      from.setDate(from.getDate() + (fromWeek - 1) * 7);
      const to = new Date(start);
      to.setDate(to.getDate() + (toWeek - 1) * 7 + 6);

      const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
      return `${from.getDate()} ${months[from.getMonth()]} – ${to.getDate()} ${months[to.getMonth()]} ${to.getFullYear()}`;
    } catch (_) {
      return `Semanas ${fromWeek}–${toWeek}`;
    }
  }

  function phaseForWeek(weekNumber) {
    return PHASES.find(
      p => weekNumber >= p.weeks[0] && weekNumber <= p.weeks[1]
    ) || PHASES[PHASES.length - 1];
  }

  function mapType(day) {
    const raw = String(day?.type || "").toLowerCase();

    if (raw === "rest") return "rest";
    if (raw === "strength") return "gym";
    if (raw === "mobility") return "active";
    if (raw === "cross_training") return "active";

    if (raw === "running") {
      const txt = `${day?.title || ""} ${day?.objective || ""} ${day?.mainWork || ""}`.toLowerCase();
      if (/tirada|larga|long run|fondo/.test(txt)) return "long";
      if (/carrera|competici[oó]n|race/.test(txt)) return "race";
      return "quality";
    }

    return raw === "other" ? "active" : "active";
  }

  function cardioText(cardio) {
    if (!cardio) return "";

    const bits = [];

    if (n(cardio.distanceKm) > 0) bits.push(`${n(cardio.distanceKm)} km`);
    if (n(cardio.durationMin) > 0) bits.push(`${n(cardio.durationMin)} min`);
    if (cardio.pace) bits.push(`Ritmo: ${cardio.pace}`);
    if (cardio.heartRate) bits.push(`FC/Zona: ${cardio.heartRate}`);
    if (cardio.structure) bits.push(cardio.structure);

    return bits.join(" · ");
  }

  function ensureSupplementGlobals(plan) {
    const found = new Map();

    for (const week of (plan?.firstBlock?.weeks || [])) {
      for (const day of (week?.days || [])) {
        for (const sup of (day?.supplements || [])) {
          const id = `p-${slug(sup.name)}-${slug(sup.amount).slice(0, 12)}`;
          if (!found.has(id)) {
            found.set(id, {
              id,
              name: sup.name || "Suplemento",
              brand: sup.optional ? "Recomendación opcional" : "Incluido en tu planificación",
              when: [sup.amount, sup.timing].filter(Boolean).join(" · "),
              icon: "bolt",
              detail: {
                id,
                name: sup.name || "Suplemento",
                brand: sup.optional ? "Opcional según tu planificación" : "Plan personalizado",
                dose: sup.amount || "",
                fn: sup.reason || "",
                kcal: 0,
                kcalNote: sup.timing || ""
              }
            });
          }
        }
      }
    }

    SUPPLEMENTS = Array.from(found.values()).map(({ detail, ...s }) => s);
    SUPPLEMENT_DETAILS = Array.from(found.values()).map(s => s.detail);
  }

  function supplementIds(day) {
    return (day?.supplements || []).map(
      sup => `p-${slug(sup.name)}-${slug(sup.amount).slice(0, 12)}`
    );
  }

  function mapMeals(day) {
    const nut = day?.nutrition;
    if (!nut || nut.mode === "none") return null;

    const items = Array.isArray(nut.meals) ? nut.meals.map(m => ({
      meal: m.meal || "Comida",
      text: m.text || "",
      kcal: n(m.kcalApprox)
    })) : [];

    if (!items.length && nut.summary) {
      items.push({
        meal: "Recomendación",
        text: nut.summary,
        kcal: 0
      });
    }

    return {
      label: nut.summary || "Nutrición personalizada",
      zoneColor: "#22C55E",
      totalKcal: n(nut.kcalApprox),
      macros: {
        protein: n(nut.proteinG),
        carbs: n(nut.carbsG),
        fat: n(nut.fatG)
      },
      items
    };
  }

  function mapTraining(day) {
    if (!day || day.type === "rest") {
      return {
        title: day?.title || "Descanso / recuperación",
        detail: day?.mainWork || day?.objective || "Día de recuperación.",
        note: (day?.coachingNotes || []).join(" · ")
      };
    }

    const exercises = Array.isArray(day.exercises)
      ? day.exercises.map(ex => ({
          name: ex.name || "Ejercicio",
          sets: [ex.sets, ex.reps].filter(Boolean).join(" × "),
          rest: ex.rest || "—",
          note: [ex.intensity, ex.notes].filter(Boolean).join(" · ")
        }))
      : [];

    const cardio = cardioText(day.cardio);
    const detail = [
      day.objective,
      day.mainWork
    ].filter(Boolean).join(" — ");

    const notes = [
      day.cooldown ? `Vuelta a la calma: ${day.cooldown}` : "",
      ...(Array.isArray(day.coachingNotes) ? day.coachingNotes : [])
    ].filter(Boolean).join(" · ");

    let targetPace = "";
    const pace = String(day?.cardio?.pace || "").trim();
    const simplePace = pace.match(/\b\d{1,2}:\d{2}\b/);
    if (simplePace) targetPace = simplePace[0];

    return {
      title: day.title || day.typeLabel || "Entrenamiento",
      detail,
      exercises,
      cardio,
      note: notes,
      targetPace
    };
  }

  function detailedWeek(weekNumber) {
    return activePlan?.firstBlock?.weeks?.find(
      w => n(w.week) === n(weekNumber)
    ) || null;
  }

  function mapDetailedDay(weekNumber, dayKey) {
    const week = detailedWeek(weekNumber);
    const index = DAY_KEYS.indexOf(dayKey);
    const source = index >= 0 ? week?.days?.[index] : null;
    const phase = phaseForWeek(weekNumber);

    if (!source) return null;

    const target = getWeightTargetForWeek(weekNumber);

    return {
      key: dayKey,
      label: DAY_LABELS[index],
      weekNumber,
      phase,
      type: mapType(source),
      typeLabel: source.typeLabel || source.title || "Plan personalizado",
      training: mapTraining(source),
      meals: mapMeals(source),
      supplements: supplementIds(source),
      note: source.nutrition?.timingNotes?.join(" · ") || "",
      isWeighDay: !!target && dayKey === "sat",
      isGeneralPhase: false,
      personalized: true,
      raw: source
    };
  }

  function makeGeneralDay(weekNumber, dayKey) {
    const phase = phaseForWeek(weekNumber);
    const weekly = activePlan?.weeklyTargets?.find(w => n(w.week) === n(weekNumber));
    const index = DAY_KEYS.indexOf(dayKey);

    return {
      key: dayKey,
      label: DAY_LABELS[index] || "",
      weekNumber,
      phase,
      type: "general",
      typeLabel: "Plan maestro",
      training: null,
      meals: null,
      supplements: [],
      note: weekly?.note || "",
      isWeighDay: false,
      isGeneralPhase: true,
      personalized: true
    };
  }

  function weightTargetForWeek(week) {
    const target = activePlan?.weeklyTargets?.find(
      x => n(x.week) === n(week) && n(x.weightTargetKg) > 0
    );

    if (!target) return null;

    return {
      week: n(target.week),
      weight: n(target.weightTargetKg),
      note: target.note || ""
    };
  }

  function activate(plan, onboarding) {
    if (!plan || plan?.generation?.status !== "ready") {
      return false;
    }

    activePlan = plan;
    activeOnboarding = onboarding || null;

    PLAN_MODE = "personalized";

    const generatedPhases = Array.isArray(plan.phases) ? plan.phases : [];

    PHASES = generatedPhases.map((p, index) => {
      const from = n(p.weekFrom, 1);
      const to = n(p.weekTo, from);

      const fromTarget = weightTargetForWeek(from);
      const toTarget = weightTargetForWeek(to);

      return {
        id: n(p.id, index + 1),
        key: `personalized-phase-${n(p.id, index + 1)}`,
        shortLabel: `Fase ${index + 1}`,
        name: p.name || `Fase ${index + 1}`,
        weeks: [from, to],
        dateLabel: isoToDateLabel(plan.startDate, from, to),
        weightFrom: fromTarget?.weight ?? null,
        weightTo: toTarget?.weight ?? null,
        kcal: p.nutritionFocus || "Nutrición según tu perfil",
        macroFocus: "",
        color: PHASE_COLORS[index % PHASE_COLORS.length],
        summary: p.summary || "",
        focus: Array.isArray(p.focus) ? p.focus : [],
        personalized: true
      };
    });

    TOTAL_PLAN_WEEKS = n(plan.totalWeeks, PHASES.at(-1)?.weeks?.[1] || 1);
    RACE_WEEK = null;
    ZONE_REVIEW_INTERVAL_WEEKS = 999;

    MILESTONES = (plan.milestones || [])
      .filter(m => m.date)
      .map((m, index) => ({
        date: m.date,
        icon: /carrera|race|marat|10k|5k|media/i.test(`${m.label} ${m.target}`) ? "🏁" : "🎯",
        label: m.label || `Hito ${index + 1}`,
        desc: m.target || ""
      }));

    ensureSupplementGlobals(plan);

    PROFILE_DEFAULTS = {
      ...PROFILE_DEFAULTS,
      name: plan.athleteName || onboarding?.profile?.name || "Atleta",
      startDate: plan.startDate || PROFILE_DEFAULTS.startDate,
      raceDate: MILESTONES.find(m => m.icon === "🏁")?.date || null,
      raceGoal: plan.primaryGoal || "",
      startWeight: n(onboarding?.profile?.weightKg, PROFILE_DEFAULTS.startWeight),
      notificationsEnabled: false
    };

    PLAN_COPY = {
      welcomeTitle: plan.title || "Tu planificación personalizada",
      welcomeDesc: () => plan.strategySummary || "",
      welcomeBadges: [`${TOTAL_PLAN_WEEKS} semanas`, `${PHASES.length} fases`],
      preplanDesc: startD => `Tu planificación personalizada empieza el ${startD}.`,
      preplanBadges: () => [plan.primaryGoal || "Plan personalizado"],
      finishedTitle: "🏆 Has completado tu planificación",
      finishedDesc: (_startWeight, _currentWeight, totalWorkouts) =>
        `Has completado ${TOTAL_PLAN_WEEKS} semanas y registrado ${totalWorkouts} sesiones.`
    };

    getPhaseForWeek = function (weekNumber) {
      return phaseForWeek(weekNumber);
    };

    getDaySchedule = function (weekNumber, dayKey) {
      const detailed = mapDetailedDay(weekNumber, dayKey);
      return detailed || makeGeneralDay(weekNumber, dayKey);
    };

    getWeightTargetForWeek = function (weekNumber) {
      return weightTargetForWeek(weekNumber);
    };

    getAllWeightTargetWeeks = function () {
      return (activePlan?.weeklyTargets || [])
        .filter(x => n(x.weightTargetKg) > 0)
        .map(x => n(x.week))
        .sort((a, b) => a - b);
    };

    isZoneReviewWeek = function () {
      return false;
    };

    trainingDayKeysForWeek = function (weekNumber) {
      const week = detailedWeek(weekNumber);
      if (!week) return [];

      return DAY_KEYS.filter((key, index) => {
        const d = week.days?.[index];
        return d && String(d.type || "").toLowerCase() !== "rest";
      });
    };

    window.FORJA_PERSONALIZED_PLAN = plan;
    window.FORJA_PERSONALIZED_ONBOARDING = onboarding || null;

    return true;
  }

  function getPlan() {
    return activePlan;
  }

  function getOnboarding() {
    return activeOnboarding;
  }

  window.PersonalizedPlanRuntime = {
    activate,
    getPlan,
    getOnboarding
  };
})();
