/* ==========================================================================
   FORJA21 — Generación Groq por etapas

   1. Estructura maestra
   2. Objetivos semanales en bloques de máximo 4
   3. Semana 1
   4. Semana 2
   5. Semana 3
   6. Semana 4

   Todo se guarda progresivamente.
   ========================================================================== */

(function () {

  "use strict";


  const sleep =
    ms =>
      new Promise(
        resolve =>
          setTimeout(
            resolve,
            ms
          )
      );


  function emit(
    callback,
    data
  ) {

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
      await user.getIdToken(
        true
      );


    for (
      let attempt = 0;
      attempt < 8;
      attempt++
    ) {

      const response =
        await fetch(
          "/api/generate-plan",
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${token}`

            },

            body:
              JSON.stringify(
                payload
              )

          }
        );


      let body =
        null;


      try {

        body =
          await response.json();

      } catch (_) {}


      if (
        response.ok
      ) {

        return body;

      }


      if (
        response.status ===
        429
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

            type:
              "waiting",

            seconds,

            message:
              `Límite gratuito de Groq: continuamos automáticamente en ${seconds} s…`

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
      "Groq sigue limitado temporalmente. El progreso guardado no se pierde."
    );

  }


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


  function getCoreFromPlan(
    plan
  ) {

    const core =
      { ...plan };


    delete core.weeklyTargets;
    delete core.firstBlock;
    delete core.generation;
    delete core.meta;


    return core;

  }


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
       1. PLAN MAESTRO
       ====================================================================== */

    if (
      !plan?.generation?.coreDone
    ) {

      emit(
        onProgress,
        {

          type:
            "core",

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
              Number(
                core.totalWeeks ||
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

          completedTargetWeeks:
            0,

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
       2. OBJETIVOS SEMANALES EN BLOQUES DE 4
       ====================================================================== */

    const totalWeeks =
      Number(
        plan.totalWeeks ||
        0
      );


    if (
      !Array.isArray(
        plan.weeklyTargets
      )
    ) {

      plan.weeklyTargets =
        [];

    }


    if (
      !plan.generation?.targetsDone ||
      plan.weeklyTargets.length <
        totalWeeks
    ) {

      let completed =
        plan.weeklyTargets.length;


      /*
       * Si hay datos incompletos de una prueba anterior,
       * conservamos únicamente el tramo consecutivo
       * desde la semana 1.
       */

      const ordered =
        [...plan.weeklyTargets]
          .sort(
            (a, b) =>
              Number(a.week) -
              Number(b.week)
          );


      const validPrefix =
        [];


      for (
        let week = 1;
        week <= ordered.length;
        week++
      ) {

        const found =
          ordered.find(
            item =>
              Number(item.week) ===
              week
          );


        if (!found) {
          break;
        }


        validPrefix.push(
          found
        );

      }


      plan.weeklyTargets =
        validPrefix;


      completed =
        validPrefix.length;


      while (
        completed <
        totalWeeks
      ) {

        const weekFrom =
          completed +
          1;


        const weekTo =
          Math.min(
            weekFrom + 3,
            totalWeeks
          );


        emit(
          onProgress,
          {

            type:
              "targets",

            weekFrom,

            weekTo,

            totalWeeks,

            message:
              `Creando progresión: semanas ${weekFrom}–${weekTo} de ${totalWeeks}…`

          }
        );


        const core =
          getCoreFromPlan(
            plan
          );


        const response =
          await call(
            user,
            {

              action:
                "targetsBatch",

              profile:
                onboarding,

              core,

              weekFrom,

              weekTo,

              previousTargets:
                plan.weeklyTargets

            },
            onProgress
          );


        plan.weeklyTargets =
          [
            ...plan.weeklyTargets,
            ...response.weeklyTargets
          ]
            .sort(
              (a, b) =>
                Number(a.week) -
                Number(b.week)
            );


        completed =
          plan.weeklyTargets
            .length;


        plan.generation =
          {

            ...(plan.generation || {}),

            status:
              "generating",

            coreDone:
              true,

            targetsDone:
              completed ===
              totalWeeks,

            completedTargetWeeks:
              completed,

            completedWeeks:
              plan.firstBlock?.weeks?.length ||
              0,

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
              "targetsBatchDone",

            weekFrom,

            weekTo,

            completed,

            totalWeeks,

            message:
              `✓ Objetivos de semanas ${weekFrom}–${weekTo} guardados`

          }
        );

      }


      plan.generation =
        {

          ...(plan.generation || {}),

          targetsDone:
            true,

          completedTargetWeeks:
            totalWeeks,

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
            "targetsDone",

          message:
            "✓ Progresión de todo el plan completada"

        }
      );

    }


    /* ======================================================================
       3. PRIMERAS CUATRO SEMANAS DETALLADAS
       ====================================================================== */

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


    for (
      let weekNumber =
        plan.firstBlock.weeks.length +
        1;

      weekNumber <=
        totalDetailed;

      weekNumber++
    ) {

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
              Number(week.week) ===
              weekNumber - 1
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
                Number(
                  week.week
                ) !==
                weekNumber
            ),

          response.week

        ]
          .sort(
            (a, b) =>
              Number(a.week) -
              Number(b.week)
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

        completedTargetWeeks:
          totalWeeks,

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


  async function load(
    user
  ) {

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
