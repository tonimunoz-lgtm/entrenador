/* ==========================================================================
   FORJA21 — Generación Mistral + objetivos semanales locales

   Mistral:
   1. Diseña el plan maestro y sus fases.
   2. Genera las semanas detalladas.

   JavaScript:
   - Construye weeklyTargets de forma determinista a partir del cuestionario
     y de las fases. Así no dependemos de que la IA devuelva listas largas.

   Todo se guarda progresivamente en Firestore.
   ========================================================================== */

(function () {

  "use strict";


  const sleep =
    ms =>
      new Promise(
        resolve =>
          setTimeout(resolve, ms)
      );


  function emit(callback, data) {

    if (
      typeof callback ===
      "function"
    ) {
      callback(data);
    }

  }


  async function call(
    user,
    payload,
    onProgress
  ) {

    const token =
      await user.getIdToken(true);


    for (
      let attempt = 0;
      attempt < 8;
      attempt++
    ) {

      const response =
        await fetch(
          "/api/generate-plan",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${token}`
            },

            body:
              JSON.stringify(payload)
          }
        );


      let body = null;

      try {
        body = await response.json();
      } catch (_) {}


      if (
        response.ok
      ) {
        return body;
      }


      if (
        response.status === 429
      ) {

        const seconds =
          Math.max(
            5,
            Number(
              body?.retryAfterSeconds ||
              20
            )
          );


        emit(
          onProgress,
          {
            type: "waiting",
            seconds,
            message:
              body?.error
                ? `${body.error} (${seconds} s…)`
                : `Límite gratuito de Mistral: continuamos automáticamente en ${seconds} s…`
          }
        );


        await sleep(
          (seconds + 1) *
          1000
        );

        continue;

      }


      throw new Error(
        body?.error ||
        `No se pudo generar el plan (${response.status}).`
      );

    }


    throw new Error(
      "Mistral sigue limitado temporalmente. El progreso guardado no se pierde."
    );

  }


  /* ==========================================================================
     WEEKLY TARGETS LOCALES
     ========================================================================== */

  function number(value, fallback = 0) {

    const n =
      Number(value);

    return Number.isFinite(n)
      ? n
      : fallback;

  }


  function phaseForWeek(
    phases,
    week
  ) {

    if (
      !Array.isArray(phases)
    ) {
      return null;
    }


    return (
      phases.find(
        phase =>
          week >=
            number(
              phase?.weekFrom,
              1
            ) &&
          week <=
            number(
              phase?.weekTo,
              week
            )
      ) ||
      phases[phases.length - 1] ||
      null
    );

  }


  function availableSessions(
    onboarding
  ) {

    const wanted =
      Math.max(
        1,
        Math.round(
          number(
            onboarding?.availability
              ?.sessionsPerWeekWanted,
            4
          )
        )
      );


    const fixedDays =
      Array.isArray(
        onboarding?.availability?.days
      )
        ? onboarding.availability.days.length
        : 0;


    if (
      fixedDays > 0
    ) {

      return Math.min(
        wanted,
        fixedDays
      );

    }


    return wanted;

  }


  function createLocalWeeklyTargets(
    plan,
    onboarding
  ) {

    const totalWeeks =
      Math.max(
        1,
        Math.round(
          number(
            plan?.totalWeeks,
            1
          )
        )
      );


    const goals =
      Array.isArray(
        onboarding?.goals
      )
        ? onboarding.goals
        : [];


    const runningGoal =
      goals.includes("race") ||
      goals.includes("endurance");


    const fatLossGoal =
      goals.includes("fat_loss");


    const sessions =
      availableSessions(
        onboarding
      );


    /*
     * Running:
     * Partimos del volumen REAL declarado.
     * Si el usuario quiere correr pero declaró 0 km semanales,
     * usamos una referencia inicial conservadora para que weeklyTargets
     * no indique 0 km a un plan de carrera.
     */
    let runningKm =
      runningGoal
        ? number(
            onboarding?.background
              ?.runningKmWeek,
            0
          )
        : 0;


    if (
      runningGoal &&
      runningKm <= 0
    ) {

      const longest =
        number(
          onboarding?.background
            ?.longestRunKm,
          0
        );


      runningKm =
        longest > 0
          ? Math.max(
              6,
              longest * 1.5
            )
          : 6;

    }


    /*
     * Peso:
     * Solo generamos una referencia semanal si existe un objetivo
     * explícito de pérdida de peso y tenemos peso actual + objetivo.
     * Se limita la bajada prevista a un ritmo conservador.
     */
    const currentWeight =
      number(
        onboarding?.profile
          ?.weightKg,
        0
      );


    const requestedTargetWeight =
      number(
        onboarding?.goalDetails
          ?.fat_loss
          ?.targetWeightKg,
        0
      );


    let weeklyWeightLoss =
      0;


    if (
      fatLossGoal &&
      currentWeight > 0 &&
      requestedTargetWeight > 0 &&
      requestedTargetWeight <
        currentWeight
    ) {

      const requiredLoss =
        (currentWeight -
          requestedTargetWeight) /
        totalWeeks;


      const conservativeCap =
        currentWeight *
        0.0075;


      weeklyWeightLoss =
        Math.min(
          requiredLoss,
          conservativeCap
        );

    }


    const targets =
      [];


    let runningState =
      runningKm;


    for (
      let week = 1;
      week <= totalWeeks;
      week++
    ) {

      const phase =
        phaseForWeek(
          plan?.phases,
          week
        );


      const phaseFocus =
        Array.isArray(
          phase?.focus
        ) &&
        phase.focus.length

          ? phase.focus.join(" · ")

          : (
              phase?.name ||
              plan?.primaryGoal ||
              "Progresión general"
            );


      /*
       * Descarga conservadora:
       * Si el texto de la fase menciona descarga/recovery o es cada 4ª
       * semana, reducimos ligeramente el objetivo de kilometraje.
       *
       * No es el entrenamiento: sirve como referencia para Mistral.
       */
      const phaseText =
        [
          phase?.name,
          phase?.summary,
          phase?.progression
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


      const explicitDeload =
        /descarga|recuperaci[oó]n|deload|taper|puesta a punto/.test(
          phaseText
        );


      const periodicDeload =
        week % 4 === 0;


      let kmTarget =
        0;


      if (
        runningGoal
      ) {

        if (
          week === 1
        ) {

          runningState =
            runningKm;

        } else if (
          explicitDeload ||
          periodicDeload
        ) {

          runningState =
            Math.max(
              runningKm,
              runningState *
                0.88
            );

        } else {

          runningState =
            runningState *
            1.05;

        }


        kmTarget =
          Math.round(
            runningState *
            10
          ) /
          10;

      }


      let weightTarget =
        0;


      if (
        weeklyWeightLoss > 0
      ) {

        weightTarget =
          Math.max(
            requestedTargetWeight,

            currentWeight -
              weeklyWeightLoss *
              week
          );


        weightTarget =
          Math.round(
            weightTarget *
            10
          ) /
          10;

      }


      const noteParts =
        [];


      if (
        phase?.progression
      ) {
        noteParts.push(
          phase.progression
        );
      }


      if (
        explicitDeload ||
        periodicDeload
      ) {
        noteParts.push(
          "Semana de carga controlada/recuperación: priorizar técnica y calidad."
        );
      }


      targets.push(
        {
          week,

          focus:
            phaseFocus,

          trainingSessions:
            sessions,

          runningKmApprox:
            runningGoal
              ? kmTarget
              : 0,

          weightTargetKg:
            fatLossGoal
              ? weightTarget
              : 0,

          note:
            noteParts.join(" ")
        }
      );

    }


    return targets;

  }


  /* ==========================================================================
     RESUMEN DE SEMANA PREVIA
     ========================================================================== */

  function previousWeekSummary(
    week
  ) {

    if (!week) {
      return "";
    }


    const sessions =
      Array.isArray(
        week.days
      )

        ? week.days
            .filter(
              day =>
                day?.type !==
                "rest"
            )
            .map(
              day =>
                `${day.day}: ${day.title}`
            )
            .join(" | ")

        : "";


    return [

      `Semana ${week.week}.`,

      week.focus
        ? `Foco: ${week.focus}.`
        : "",

      week.loadNote
        ? `Carga: ${week.loadNote}.`
        : "",

      sessions
        ? `Sesiones: ${sessions}`
        : ""

    ]
      .filter(Boolean)
      .join(" ");

  }


  /* ==========================================================================
     GENERACIÓN
     ========================================================================== */

  async function generate(
    user,
    onboarding,
    onProgress
  ) {

    if (
      !user?.uid
    ) {
      throw new Error(
        "No hay sesión iniciada."
      );
    }


    let plan =
      null;


    try {

      plan =
        await CloudSync
          .pullPersonalizedPlan(
            user.uid
          );

    } catch (_) {}


    /* ======================================================================
       1. ESTRUCTURA MAESTRA
       ====================================================================== */

    if (
      !plan?.generation?.coreDone
    ) {

      emit(
        onProgress,
        {
          type: "core",
          message:
            "Analizando objetivos y diseñando las fases…"
        }
      );


      const response =
        await call(
          user,
          {
            action:
              "masterCore",

            profile:
              onboarding
          },
          onProgress
        );


      const core =
        response.core;


      plan = {

        ...core,

        weeklyTargets:
          [],

        firstBlock: {

          blockNumber:
            1,

          weekFrom:
            1,

          weekTo:
            Math.min(
              4,
              number(
                core.totalWeeks,
                4
              )
            ),

          summary:
            core.firstBlockSummary ||
            "",

          progressionRules:
            core.firstBlockProgressionRules ||
            [],

          weeks:
            []

        },

        generation: {

          status:
            "generating",

          coreDone:
            true,

          targetsDone:
            false,

          targetsSource:
            "local",

          completedWeeks:
            0,

          updatedAt:
            new Date()
              .toISOString()

        },

        meta: {

          ...(response.meta || {}),

          uid:
            user.uid,

          email:
            user.email ||
            "",

          sourceOnboardingVersion:
            onboarding.version ||
            1

        }

      };


      await CloudSync
        .pushPersonalizedPlan(
          user.uid,
          plan
        );


      emit(
        onProgress,
        {
          type:
            "coreDone",

          message:
            "✓ Fases y estrategia creadas y guardadas"
        }
      );

    }


    /* ======================================================================
       2. WEEKLY TARGETS LOCALES

       IMPORTANTE:
       Siempre los reconstruimos completos.
       De esta forma eliminamos restos incompletos de intentos anteriores.
       ====================================================================== */

    emit(
      onProgress,
      {
        type:
          "targetsLocal",

        message:
          "Construyendo la progresión semanal del plan…"
      }
    );


    plan.weeklyTargets =
      createLocalWeeklyTargets(
        plan,
        onboarding
      );


    plan.generation =
      {

        ...(plan.generation || {}),

        status:
          "generating",

        coreDone:
          true,

        targetsDone:
          true,

        targetsSource:
          "local",

        completedTargetWeeks:
          plan.weeklyTargets.length,

        updatedAt:
          new Date()
            .toISOString()

      };


    await CloudSync
      .pushPersonalizedPlan(
        user.uid,
        plan
      );


    emit(
      onProgress,
      {
        type:
          "targetsLocalDone",

        total:
          plan.weeklyTargets.length,

        message:
          `✓ Progresión de ${plan.weeklyTargets.length} semanas preparada y guardada`
      }
    );


    /* ======================================================================
       3. PRIMERAS SEMANAS DETALLADAS
       ====================================================================== */

    const totalWeeks =
      number(
        plan.totalWeeks,
        0
      );


    const totalDetailed =
      Math.min(
        4,
        totalWeeks
      );


    plan.firstBlock =
      plan.firstBlock ||
      {
        blockNumber:
          1,

        weekFrom:
          1,

        weekTo:
          totalDetailed,

        summary:
          plan.firstBlockSummary ||
          "",

        progressionRules:
          plan.firstBlockProgressionRules ||
          [],

        weeks:
          []
      };


    if (
      !Array.isArray(
        plan.firstBlock.weeks
      )
    ) {

      plan.firstBlock.weeks =
        [];

    }


    /*
     * Eliminamos semanas duplicadas/inválidas de intentos previos.
     */
    plan.firstBlock.weeks =
      plan.firstBlock.weeks
        .filter(
          week =>
            Number.isInteger(
              number(
                week?.week,
                NaN
              )
            ) &&
            number(
              week?.week,
              0
            ) >= 1 &&
            number(
              week?.week,
              0
            ) <= totalDetailed &&
            Array.isArray(
              week?.days
            ) &&
            week.days.length === 7
        )
        .sort(
          (a, b) =>
            number(a.week) -
            number(b.week)
        );


    // Semana 1 primero (sirve de referencia narrativa para las demás).
    // Semanas 2-4 en paralelo: su progresión numérica ya viene fijada por
    // weeklyTargets (calculado localmente, sin IA), así que no necesitan
    // esperarse entre sí para tener calidad — solo pierden el resumen
    // textual de "la semana justo anterior" en favor de conocer solo la
    // semana 1. Esto reduce la fase de semanas detalladas de ~4 llamadas
    // en serie a ~2 (semana 1, luego el máximo de las 3 restantes en
    // paralelo).

    const pendingWeeks = [];

    for (
      let weekNumber =
        plan.firstBlock.weeks.length +
        1;

      weekNumber <=
        totalDetailed;

      weekNumber++
    ) {
      pendingWeeks.push(weekNumber);
    }


    async function generateWeek(weekNumber) {

      emit(
        onProgress,
        {
          type:
            "week",

          week:
            weekNumber,

          total:
            totalDetailed,

          message:
            `Preparando semana ${weekNumber} de ${totalDetailed}…`
        }
      );


      const previous =
        plan.firstBlock.weeks
          .find(
            week =>
              number(
                week.week
              ) ===
              weekNumber - 1
          ) ||
        plan.firstBlock.weeks
          .find(
            week =>
              number(
                week.week
              ) === 1
          );


      const response =
        await call(
          user,
          {
            action:
              "week",

            profile:
              onboarding,

            master:
              plan,

            weekNumber,

            previousWeekSummary:
              previousWeekSummary(
                previous
              )
          },
          onProgress
        );


      plan.firstBlock.weeks =
        [

          ...plan.firstBlock.weeks
            .filter(
              week =>
                number(
                  week.week
                ) !==
                weekNumber
            ),

          response.week

        ]
          .sort(
            (a, b) =>
              number(
                a.week
              ) -
              number(
                b.week
              )
          );


      plan.generation =
        {

          ...(plan.generation || {}),

          status:
            "generating",

          completedWeeks:
            plan.firstBlock.weeks
              .length,

          totalWeeksInFirstBlock:
            totalDetailed,

          updatedAt:
            new Date()
              .toISOString()

        };


      await CloudSync
        .pushPersonalizedPlan(
          user.uid,
          plan
        );


      emit(
        onProgress,
        {
          type:
            "weekDone",

          week:
            weekNumber,

          total:
            totalDetailed,

          message:
            `✓ Semana ${weekNumber} creada y guardada`
        }
      );

    }


    if (pendingWeeks.length) {

      // La primera semana pendiente va sola: da contexto a las siguientes.
      await generateWeek(pendingWeeks[0]);

      // El resto, en paralelo.
      const rest = pendingWeeks.slice(1);

      if (rest.length) {
        await Promise.all(
          rest.map(generateWeek)
        );
      }

    }


    /* ======================================================================
       4. PLAN LISTO
       ====================================================================== */

    plan.generation =
      {

        ...(plan.generation || {}),

        status:
          "ready",

        coreDone:
          true,

        targetsDone:
          true,

        targetsSource:
          "local",

        completedTargetWeeks:
          plan.weeklyTargets
            .length,

        completedWeeks:
          totalDetailed,

        totalWeeksInFirstBlock:
          totalDetailed,

        completedAt:
          new Date()
            .toISOString(),

        updatedAt:
          new Date()
            .toISOString()

      };


    await CloudSync
      .pushPersonalizedPlan(
        user.uid,
        plan
      );


    emit(
      onProgress,
      {
        type:
          "done",

        message:
          "✓ Plan completo y guardado"
      }
    );


    return plan;

  }


  async function load(user) {

    if (
      !user?.uid
    ) {
      return null;
    }


    return CloudSync
      .pullPersonalizedPlan(
        user.uid
      );

  }


  window.AIPlanService =
    {
      generate,
      load
    };

})();
