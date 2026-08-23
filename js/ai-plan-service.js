/* ==========================================================================
   FORJA21 — Generación personalizada por etapas con Groq

   1. Plan maestro
   2. Semana 1
   3. Semana 2
   4. Semana 3
   5. Semana 4

   Guarda el progreso después de cada etapa para poder reanudar.
   ========================================================================== */
(function () {
  "use strict";

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function emit(cb, data) {
    if (typeof cb === "function") cb(data);
  }

  async function apiCall(user, payload, onProgress) {
    const token = await user.getIdToken(true);
    let attempt = 0;

    while (attempt < 6) {
      attempt++;

      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      let body = null;
      try { body = await response.json(); } catch (_) {}

      if (response.ok) return body;

      if (response.status === 429) {
        const seconds = Math.max(
          5,
          Number(body?.retryAfterSeconds || 20)
        );

        emit(onProgress, {
          type: "waiting",
          seconds,
          message: `Groq ha alcanzado momentáneamente el límite gratuito. Continuaré automáticamente en ${seconds} s…`
        });

        await sleep((seconds + 1) * 1000);
        continue;
      }

      throw new Error(
        body?.error ||
        `No se pudo generar el plan (${response.status}).`
      );
    }

    throw new Error(
      "Groq sigue limitado temporalmente. Tu progreso está guardado; vuelve a intentarlo dentro de un minuto."
    );
  }

  function createPartialPlan(master, meta, existingWeeks) {
    const weeks = Array.isArray(existingWeeks)
      ? existingWeeks.slice().sort((a,b) => Number(a.week) - Number(b.week))
      : [];

    return {
      ...master,
      firstBlock: {
        blockNumber: 1,
        weekFrom: 1,
        weekTo: Math.min(4, Number(master.totalWeeks || 4)),
        summary: master.firstBlockSummary || "",
        progressionRules: master.firstBlockProgressionRules || [],
        weeks
      },
      generation: {
        status: "generating",
        completedWeeks: weeks.length,
        totalWeeksInFirstBlock: Math.min(4, Number(master.totalWeeks || 4)),
        updatedAt: new Date().toISOString()
      },
      meta: {
        provider: "groq",
        model: meta?.model || "openai/gpt-oss-120b",
        generatedAt: meta?.generatedAt || new Date().toISOString()
      }
    };
  }

  function previousSummary(week) {
    if (!week) return "";
    const dayTitles = Array.isArray(week.days)
      ? week.days
          .filter(d => d && d.type !== "rest")
          .map(d => `${d.day}: ${d.title}`)
          .slice(0, 7)
      : [];

    return [
      `Semana ${week.week}.`,
      week.focus ? `Foco: ${week.focus}.` : "",
      week.loadNote ? `Carga: ${week.loadNote}.` : "",
      dayTitles.length ? `Sesiones: ${dayTitles.join(" | ")}` : ""
    ].filter(Boolean).join(" ");
  }

  function stripInternalMaster(plan) {
    if (!plan) return null;
    const {
      firstBlock,
      generation,
      meta,
      ...master
    } = plan;
    return master;
  }

  async function generate(user, onboarding, onProgress) {
    if (!user?.uid) throw new Error("No hay sesión iniciada.");
    if (!onboarding || onboarding.status !== "completed") {
      throw new Error("Completa primero el cuestionario.");
    }

    let saved = null;
    try { saved = await CloudSync.pullPersonalizedPlan(user.uid); } catch (_) {}

    let master = null;
    let plan = null;

    const resumable =
      saved &&
      saved.generation?.status === "generating" &&
      Array.isArray(saved.firstBlock?.weeks) &&
      saved.totalWeeks;

    if (resumable) {
      master = stripInternalMaster(saved);
      plan = saved;

      emit(onProgress, {
        type: "resume",
        completedWeeks: saved.firstBlock.weeks.length,
        message: `Reanudando desde la semana ${saved.firstBlock.weeks.length + 1}…`
      });
    } else {
      emit(onProgress, {
        type: "master",
        message: "Analizando objetivos y construyendo el plan maestro…"
      });

      const body = await apiCall(
        user,
        {
          action: "master",
          profile: onboarding
        },
        onProgress
      );

      if (!body?.master) {
        throw new Error("La API no devolvió el plan maestro.");
      }

      master = body.master;
      plan = createPartialPlan(master, body.meta, []);

      await CloudSync.pushPersonalizedPlan(user.uid, plan);

      emit(onProgress, {
        type: "masterDone",
        message: "✓ Plan maestro creado y guardado"
      });
    }

    const totalBlockWeeks = Math.min(4, Number(master.totalWeeks || 4));
    const existingWeeks = Array.isArray(plan.firstBlock?.weeks)
      ? plan.firstBlock.weeks
      : [];

    for (let weekNumber = existingWeeks.length + 1; weekNumber <= totalBlockWeeks; weekNumber++) {
      emit(onProgress, {
        type: "week",
        week: weekNumber,
        total: totalBlockWeeks,
        message: `Preparando semana ${weekNumber} de ${totalBlockWeeks}…`
      });

      const previous = plan.firstBlock.weeks.find(
        w => Number(w.week) === weekNumber - 1
      );

      const body = await apiCall(
        user,
        {
          action: "week",
          profile: onboarding,
          master,
          weekNumber,
          previousWeekSummary: previousSummary(previous)
        },
        onProgress
      );

      if (!body?.week) {
        throw new Error(`La API no devolvió la semana ${weekNumber}.`);
      }

      plan.firstBlock.weeks = [
        ...plan.firstBlock.weeks.filter(
          w => Number(w.week) !== weekNumber
        ),
        body.week
      ].sort((a,b) => Number(a.week) - Number(b.week));

      plan.generation = {
        status: "generating",
        completedWeeks: plan.firstBlock.weeks.length,
        totalWeeksInFirstBlock: totalBlockWeeks,
        updatedAt: new Date().toISOString()
      };

      await CloudSync.pushPersonalizedPlan(user.uid, plan);

      emit(onProgress, {
        type: "weekDone",
        week: weekNumber,
        total: totalBlockWeeks,
        message: `✓ Semana ${weekNumber} creada y guardada`
      });
    }

    plan.generation = {
      status: "ready",
      completedWeeks: totalBlockWeeks,
      totalWeeksInFirstBlock: totalBlockWeeks,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    plan.meta = {
      ...(plan.meta || {}),
      uid: user.uid,
      email: user.email || "",
      sourceOnboardingVersion: onboarding.version || 1
    };

    await CloudSync.pushPersonalizedPlan(user.uid, plan);

    emit(onProgress, {
      type: "done",
      message: "✓ Plan completo. Todo ha quedado guardado."
    });

    return plan;
  }

  async function load(user) {
    if (!user?.uid) return null;
    return CloudSync.pullPersonalizedPlan(user.uid);
  }

  window.AIPlanService = { generate, load };
})();
