/* FORJA21 — Groq por etapas, objetivos semanales en bloques */

const MODEL = "openai/gpt-oss-120b";

const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  "AIzaSyCIWY-_Sv-Bi5PHYy-IUKX3LrC0VxMcxGg";


function json(res, status, body) {
  res
    .status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8");

  res.setHeader("Cache-Control", "no-store");

  return res.end(JSON.stringify(body));
}


async function verifyFirebaseToken(idToken) {

  if (!idToken) return null;

  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        idToken
      })
    }
  );

  if (!r.ok) return null;

  const data = await r.json();

  return data.users?.[0] || null;
}


function systemPrompt() {

  return `Eres el motor de planificación de FORJA21.

Devuelve siempre UN único objeto JSON válido.
No utilices Markdown.
No añadas explicaciones fuera del JSON.
Respeta estrictamente los datos del usuario.
No inventes lesiones, marcas, disponibilidad ni material.
Prioriza progresión gradual, recuperación, seguridad y adherencia.`;

}


function extractJson(text) {

  const clean = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch (_) {}

  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");

  if (first >= 0 && last > first) {
    return JSON.parse(
      clean.slice(first, last + 1)
    );
  }

  throw new Error(
    "La IA no devolvió un JSON válido."
  );
}


async function groqOnce(prompt, maxTokens) {

  const r = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization":
          `Bearer ${process.env.GROQ_API_KEY}`
      },

      body: JSON.stringify({

        model: MODEL,

        messages: [
          {
            role: "system",
            content: systemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],

        temperature: 0.1,

        max_completion_tokens: maxTokens,

        // openai/gpt-oss-120b es un modelo "razonador": por defecto (reasoning_effort
        // "medium") gasta una parte importante del propio max_completion_tokens en
        // pensar antes de escribir el JSON final. Con las respuestas largas que pide
        // este endpoint (una semana completa con comidas, ejercicios y suplementos),
        // ese razonamiento se comía casi todo el presupuesto de tokens, el JSON salía
        // cortado a mitad, y Groq lo rechazaba con "Failed to validate JSON. Please
        // adjust your prompt." Bajamos el esfuerzo de razonamiento al mínimo: esta
        // tarea es rellenar una plantilla, no resolver un problema complejo.
        reasoning_effort: "low",

        response_format: {
          type: "json_object"
        }

      })
    }
  );


  let raw = null;

  try {
    raw = await r.json();
  } catch (_) {}


  if (!r.ok) {

    const message =
      raw?.error?.message ||
      raw?.message ||
      `Groq devolvió ${r.status}.`;

    const tooLarge =
      /request too large/i.test(message);

    const limited =
      r.status === 429 ||
      /tokens per minute|rate limit|too many requests/i.test(message);

    const invalidJson =
      /failed to validate json|failed_generation|invalid json|json_validate_failed/i.test(message);


    const e = new Error(message);


    if (tooLarge) {

      e.code = "REQUEST_TOO_LARGE";

    } else if (limited) {

      e.code = "RATE_LIMIT";

      const retryHeader =
        Number(
          r.headers.get("retry-after")
        );

      e.retryAfterSeconds =
        Number.isFinite(retryHeader) &&
        retryHeader > 0
          ? Math.ceil(retryHeader)
          : 20;

    } else if (invalidJson) {

      // Fallo de generación de Groq: el modelo no completó un JSON válido dentro
      // del presupuesto de tokens (normalmente porque la respuesta pedida era muy
      // larga). Es un fallo puntual — casi siempre desaparece si se reintenta.
      e.code = "INVALID_JSON";

    } else {

      e.code =
        String(r.status);

    }


    throw e;

  }


  const content =
    raw?.choices?.[0]?.message?.content ||
    "";


  return extractJson(content);

}


async function groq(prompt, maxTokens) {

  const attempts = [
    maxTokens,
    Math.round(maxTokens * 1.5),
    Math.round(maxTokens * 2)
  ];

  let lastErr = null;

  for (let i = 0; i < attempts.length; i++) {

    try {

      return await groqOnce(prompt, attempts[i]);

    } catch (err) {

      lastErr = err;

      // Solo merece la pena reintentar cuando el fallo es de generación
      // (JSON incompleto o inválido de Groq). Límites de tasa o payload
      // demasiado grande no se arreglan reintentando con más tokens.
      if (err?.code !== "INVALID_JSON" || i === attempts.length - 1) throw err;

    }

  }

  throw lastErr;

}


/* ==========================================================================
   PLAN MAESTRO
   ========================================================================== */

function corePrompt(profile, email) {

  return `Genera SOLO la estructura maestra de FORJA21.

NO generes objetivos semanales.
NO generes sesiones diarias.

USUARIO:
${email || ""}

CUESTIONARIO:
${JSON.stringify(profile)}

Devuelve:

{
  "schemaVersion": 1,
  "title": "string",
  "athleteName": "string",
  "generatedFor": "string",
  "startDate": "YYYY-MM-DD",
  "totalWeeks": 12,
  "primaryGoal": "string",
  "secondaryGoals": ["string"],
  "strategySummary": "string",
  "safetyNotes": ["string"],

  "milestones": [
    {
      "week": 1,
      "date": "YYYY-MM-DD",
      "label": "string",
      "target": "string"
    }
  ],

  "phases": [
    {
      "id": 1,
      "name": "string",
      "weekFrom": 1,
      "weekTo": 4,
      "summary": "string",
      "focus": ["string"],
      "progression": "string",
      "nutritionFocus": "string"
    }
  ],

  "firstBlockSummary": "string",

  "firstBlockProgressionRules": [
    "string"
  ]
}


REGLAS:

- Respeta la duración solicitada.
- phases debe cubrir desde semana 1 hasta totalWeeks.
- No debe haber huecos entre fases.
- Respeta objetivo principal y secundarios.
- Respeta experiencia, disponibilidad, material y limitaciones.
- Si hay fecha objetivo, periodiza hacia ella.
- Introduce semanas de descarga cuando corresponda.
- NO devuelvas weeklyTargets.
- NO desarrolles días concretos.

Devuelve solamente JSON.`;

}


function validateCore(core) {

  const total =
    Number(core?.totalWeeks);


  if (
    !Number.isInteger(total) ||
    total < 1
  ) {

    throw new Error(
      "El plan maestro no contiene una duración válida."
    );

  }


  if (
    !Array.isArray(core?.phases) ||
    !core.phases.length
  ) {

    throw new Error(
      "El plan maestro no contiene fases."
    );

  }


  return core;

}


/* ==========================================================================
   OBJETIVOS SEMANALES POR BLOQUES
   ========================================================================== */

function targetsBatchPrompt(
  profile,
  core,
  weekFrom,
  weekTo,
  previousTargets
) {

  const phaseSummary =
    Array.isArray(core.phases)
      ? core.phases.map(p => ({
          name: p.name,
          weekFrom: p.weekFrom,
          weekTo: p.weekTo,
          focus: p.focus,
          progression: p.progression
        }))
      : [];


  return `Genera SOLO los objetivos semanales de FORJA21
desde la semana ${weekFrom} hasta la semana ${weekTo}.

PLAN MAESTRO:

${JSON.stringify({
  startDate: core.startDate,
  totalWeeks: core.totalWeeks,
  primaryGoal: core.primaryGoal,
  secondaryGoals: core.secondaryGoals,
  strategySummary: core.strategySummary,
  phases: phaseSummary
})}


OBJETIVOS SEMANALES YA GENERADOS:

${JSON.stringify(previousTargets || [])}


CUESTIONARIO:

${JSON.stringify(profile)}


Devuelve EXACTAMENTE:

{
  "weeklyTargets": [
    {
      "week": ${weekFrom},
      "focus": "string",
      "trainingSessions": 4,
      "runningKmApprox": 0,
      "weightTargetKg": 0,
      "note": "string"
    }
  ]
}


REGLAS OBLIGATORIAS:

- Devuelve EXACTAMENTE ${weekTo - weekFrom + 1} elementos.
- Deben corresponder exclusivamente a las semanas ${weekFrom} a ${weekTo}.
- No incluyas semanas anteriores.
- No incluyas semanas posteriores.
- "week" debe coincidir exactamente con la semana correspondiente.
- Mantén continuidad con los objetivos semanales ya generados.
- Respeta las fases del plan maestro.
- trainingSessions debe respetar la disponibilidad del usuario.
- runningKmApprox=0 si correr no forma parte del plan.
- weightTargetKg=0 si no procede marcar peso semanal.
- La progresión debe ser gradual.
- Si existe descarga dentro de estas semanas, debe reflejarse.
- Evita repetir exactamente el mismo texto en todas las semanas.

Devuelve solamente JSON.`;

}


function validateTargetsBatch(
  data,
  weekFrom,
  weekTo
) {

  if (
    !Array.isArray(
      data?.weeklyTargets
    )
  ) {

    throw new Error(
      "La IA no devolvió objetivos semanales."
    );

  }


  const expected =
    weekTo -
    weekFrom +
    1;


  if (
    data.weeklyTargets.length !==
    expected
  ) {

    throw new Error(
      `Se esperaban ${expected} objetivos semanales ` +
      `para las semanas ${weekFrom}-${weekTo} y se recibieron ` +
      `${data.weeklyTargets.length}.`
    );

  }


  return data.weeklyTargets.map(
    (target, index) => {

      const week =
        weekFrom +
        index;


      return {

        week,

        focus:
          target?.focus ||
          "",

        trainingSessions:
          Math.max(
            0,
            Math.round(
              Number(
                target?.trainingSessions ||
                0
              )
            )
          ),

        runningKmApprox:
          Number(
            target?.runningKmApprox ||
            0
          ),

        weightTargetKg:
          Number(
            target?.weightTargetKg ||
            0
          ),

        note:
          target?.note ||
          ""

      };

    }
  );

}


/* ==========================================================================
   SEMANA DETALLADA
   ========================================================================== */

function compactMaster(master) {

  return {

    title:
      master.title,

    startDate:
      master.startDate,

    totalWeeks:
      master.totalWeeks,

    primaryGoal:
      master.primaryGoal,

    secondaryGoals:
      master.secondaryGoals,

    strategySummary:
      master.strategySummary,

    phases:
      master.phases,

    weeklyTargets:
      master.weeklyTargets,

    firstBlockSummary:
      master.firstBlockSummary,

    firstBlockProgressionRules:
      master.firstBlockProgressionRules

  };

}


function weekPrompt(
  profile,
  master,
  weekNumber,
  previousWeekSummary,
  email
) {

  const target =
    master.weeklyTargets?.find(
      target =>
        Number(target.week) ===
        Number(weekNumber)
    ) || {};


  return `Genera SOLO la semana ${weekNumber} del plan FORJA21.


USUARIO:

${email || ""}


PLAN MAESTRO:

${JSON.stringify(
  compactMaster(master)
)}


OBJETIVO DE ESTA SEMANA:

${JSON.stringify(target)}


RESUMEN DE LA SEMANA ANTERIOR:

${previousWeekSummary || "No existe: esta es la primera semana."}


CUESTIONARIO:

${JSON.stringify(profile)}


Devuelve:

{
  "week": ${weekNumber},
  "focus": "string",
  "loadNote": "string",

  "days": [

    {
      "day": "Lunes",

      "type":
        "strength|running|mobility|rest|cross_training|other",

      "typeLabel":
        "string",

      "title":
        "string",

      "objective":
        "string",

      "durationMin":
        60,

      "warmup":
        "string",

      "mainWork":
        "string",

      "exercises": [
        {
          "name":
            "string",

          "sets":
            "string",

          "reps":
            "string",

          "rest":
            "string",

          "intensity":
            "string",

          "notes":
            "string"
        }
      ],

      "cardio": {

        "distanceKm":
          0,

        "durationMin":
          0,

        "pace":
          "string",

        "heartRate":
          "string",

        "structure":
          "string"

      },

      "cooldown":
        "string",

      "coachingNotes": [
        "string"
      ],

      "nutrition": {

        "mode":
          "string",

        "summary":
          "string",

        "kcalApprox":
          0,

        "proteinG":
          0,

        "carbsG":
          0,

        "fatG":
          0,

        "meals": [
          {
            "meal":
              "string",

            "text":
              "string",

            "kcalApprox":
              0
          }
        ],

        "timingNotes": [
          "string"
        ]

      },

      "supplements": [
        {
          "name":
            "string",

          "amount":
            "string",

          "timing":
            "string",

          "reason":
            "string",

          "optional":
            true
        }
      ]

    }

  ]

}


REGLAS:

- EXACTAMENTE 7 días.
- Orden: lunes, martes, miércoles, jueves, viernes, sábado, domingo.
- Incluye días de descanso.
- Respeta días disponibles.
- Respeta duración disponible por sesión.
- No conviertas toda la semana en sesiones duras.
- Fuerza: ejercicios, series, repeticiones, descanso e intensidad.
- Carrera: duración/distancia y ritmo, zona o RPE.
- No inventes ritmos si faltan datos.
- Nutrición y suplementos deben respetar exactamente el cuestionario.

Si nutrition.mode="none":

- summary=""
- kcalApprox=0
- proteinG=0
- carbsG=0
- fatG=0
- meals=[]
- timingNotes=[]

Si supplements.mode="none":

- supplements=[]

Devuelve solamente JSON.`;

}


function normalizeWeek(
  raw,
  weekNumber
) {

  const dayNames = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo"
  ];

  const normalizeDayName = value =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const aliases = {
    lunes: 0,
    monday: 0,
    martes: 1,
    tuesday: 1,
    miercoles: 2,
    wednesday: 2,
    jueves: 3,
    thursday: 3,
    viernes: 4,
    friday: 4,
    sabado: 5,
    saturday: 5,
    domingo: 6,
    sunday: 6
  };

  const incomingDays =
    Array.isArray(raw?.days)
      ? raw.days
      : [];

  const slots =
    new Array(7).fill(null);

  const leftovers = [];

  for (const day of incomingDays) {
    const key = normalizeDayName(day?.day);

    const index =
      Object.prototype.hasOwnProperty.call(
        aliases,
        key
      )
        ? aliases[key]
        : -1;

    if (
      index >= 0 &&
      !slots[index]
    ) {
      slots[index] = day;
    } else {
      leftovers.push(day);
    }
  }

  for (const day of leftovers) {
    const freeIndex =
      slots.findIndex(
        item => !item
      );

    if (freeIndex === -1) {
      break;
    }

    slots[freeIndex] = day;
  }

  function makeRestDay(dayName) {
    return {
      day: dayName,
      type: "rest",
      typeLabel: "Descanso",
      title: "Descanso / recuperación",
      objective:
        "Favorecer la recuperación y llegar en buenas condiciones a la siguiente sesión.",
      durationMin: 0,
      warmup: "",
      mainWork:
        "Descanso. Opcionalmente, paseo suave o movilidad ligera si apetece.",
      exercises: [],
      cardio: {
        distanceKm: 0,
        durationMin: 0,
        pace: "",
        heartRate: "",
        structure: ""
      },
      cooldown: "",
      coachingNotes: [
        "Prioriza descanso, hidratación y sueño."
      ],
      nutrition: {
        mode: "none",
        summary: "",
        kcalApprox: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        meals: [],
        timingNotes: []
      },
      supplements: []
    };
  }

  const days = slots.map(
    (day, index) => {

      const source =
        day ||
        makeRestDay(
          dayNames[index]
        );

      return {
        day: dayNames[index],

        type:
          source?.type ||
          "rest",

        typeLabel:
          source?.typeLabel ||
          (
            source?.type === "rest"
              ? "Descanso"
              : ""
          ),

        title:
          source?.title ||
          (
            source?.type === "rest"
              ? "Descanso / recuperación"
              : ""
          ),

        objective:
          source?.objective ||
          "",

        durationMin:
          Math.max(
            0,
            Math.round(
              Number(
                source?.durationMin ||
                0
              )
            )
          ),

        warmup:
          source?.warmup ||
          "",

        mainWork:
          source?.mainWork ||
          "",

        exercises:
          Array.isArray(
            source?.exercises
          )
            ? source.exercises
            : [],

        cardio: {
          distanceKm:
            Number(
              source?.cardio?.distanceKm ||
              0
            ),

          durationMin:
            Math.max(
              0,
              Math.round(
                Number(
                  source?.cardio?.durationMin ||
                  0
                )
              )
            ),

          pace:
            source?.cardio?.pace ||
            "",

          heartRate:
            source?.cardio?.heartRate ||
            "",

          structure:
            source?.cardio?.structure ||
            ""
        },

        cooldown:
          source?.cooldown ||
          "",

        coachingNotes:
          Array.isArray(
            source?.coachingNotes
          )
            ? source.coachingNotes
            : [],

        nutrition: {
          mode:
            source?.nutrition?.mode ||
            "none",

          summary:
            source?.nutrition?.summary ||
            "",

          kcalApprox:
            Math.max(
              0,
              Math.round(
                Number(
                  source?.nutrition?.kcalApprox ||
                  0
                )
              )
            ),

          proteinG:
            Math.max(
              0,
              Math.round(
                Number(
                  source?.nutrition?.proteinG ||
                  0
                )
              )
            ),

          carbsG:
            Math.max(
              0,
              Math.round(
                Number(
                  source?.nutrition?.carbsG ||
                  0
                )
              )
            ),

          fatG:
            Math.max(
              0,
              Math.round(
                Number(
                  source?.nutrition?.fatG ||
                  0
                )
              )
            ),

          meals:
            Array.isArray(
              source?.nutrition?.meals
            )
              ? source.nutrition.meals
              : [],

          timingNotes:
            Array.isArray(
              source?.nutrition?.timingNotes
            )
              ? source.nutrition.timingNotes
              : []
        },

        supplements:
          Array.isArray(
            source?.supplements
          )
            ? source.supplements
            : []
      };
    }
  );

  return {
    week: weekNumber,
    focus:
      raw?.focus ||
      "",
    loadNote:
      raw?.loadNote ||
      "",
    days
  };
}


module.exports =
  async function handler(
    req,
    res
  ) {

    if (
      req.method !==
      "POST"
    ) {

      res.setHeader(
        "Allow",
        "POST"
      );

      return json(
        res,
        405,
        {
          error:
            "Método no permitido."
        }
      );

    }


    if (
      !process.env.GROQ_API_KEY
    ) {

      return json(
        res,
        500,
        {
          error:
            "Falta GROQ_API_KEY en Vercel."
        }
      );

    }


    try {

      const authHeader =
        String(
          req.headers.authorization ||
          ""
        );


      const user =
        await verifyFirebaseToken(

          authHeader.startsWith(
            "Bearer "
          )

            ? authHeader.slice(7)

            : ""

        );


      if (!user) {

        return json(
          res,
          401,
          {
            error:
              "Sesión no válida."
          }
        );

      }


      const profile =
        req.body?.profile;


      if (
        !profile ||
        profile.status !==
          "completed" ||
        !profile.consent
      ) {

        return json(
          res,
          400,
          {
            error:
              "El cuestionario no está completo."
          }
        );

      }


      const action =
        String(
          req.body?.action ||
          "masterCore"
        );


      /* ------------------------------------------------------------------
         PLAN MAESTRO
         ------------------------------------------------------------------ */

      if (
        action ===
        "masterCore"
      ) {

        const core =
          validateCore(

            await groq(

              corePrompt(
                profile,
                user.email
              ),

              2200

            )

          );


        return json(
          res,
          200,
          {

            core,

            meta: {

              provider:
                "groq",

              model:
                MODEL,

              generatedAt:
                new Date()
                  .toISOString()

            }

          }
        );

      }


      /* ------------------------------------------------------------------
         OBJETIVOS SEMANALES POR BLOQUE
         ------------------------------------------------------------------ */

      if (
        action ===
        "targetsBatch"
      ) {

        const core =
          req.body?.core;


        validateCore(core);


        const total =
          Number(
            core.totalWeeks
          );


        const weekFrom =
          Number(
            req.body?.weekFrom
          );


        const weekTo =
          Number(
            req.body?.weekTo
          );


        if (
          !Number.isInteger(
            weekFrom
          ) ||
          !Number.isInteger(
            weekTo
          ) ||
          weekFrom < 1 ||
          weekTo < weekFrom ||
          weekTo > total ||
          weekTo - weekFrom + 1 > 4
        ) {

          return json(
            res,
            400,
            {
              error:
                "Bloque de objetivos semanales no válido."
            }
          );

        }


        const previousTargets =
          Array.isArray(
            req.body?.previousTargets
          )
            ? req.body.previousTargets
            : [];


        const data =
          await groq(

            targetsBatchPrompt(
              profile,
              core,
              weekFrom,
              weekTo,
              previousTargets
            ),

            1600

          );


        const weeklyTargets =
          validateTargetsBatch(
            data,
            weekFrom,
            weekTo
          );


        return json(
          res,
          200,
          {
            weeklyTargets
          }
        );

      }


      /* ------------------------------------------------------------------
         SEMANA DETALLADA
         ------------------------------------------------------------------ */

      if (
        action ===
        "week"
      ) {

        const master =
          req.body?.master;


        const weekNumber =
          Number(
            req.body?.weekNumber
          );


        if (
          !master ||
          !Number.isInteger(
            weekNumber
          ) ||
          weekNumber < 1 ||
          weekNumber >
            Math.min(
              4,
              Number(
                master.totalWeeks ||
                0
              )
            )
        ) {

          return json(
            res,
            400,
            {
              error:
                "Semana no válida."
            }
          );

        }


        const rawWeek =
          await groq(

            weekPrompt(
              profile,
              master,
              weekNumber,
              String(
                req.body?.previousWeekSummary ||
                ""
              ),
              user.email
            ),

            6000

          );


        const week =
          normalizeWeek(
            rawWeek,
            weekNumber
          );


        return json(
          res,
          200,
          {
            week
          }
        );

      }


      return json(
        res,
        400,
        {
          error:
            "Acción desconocida."
        }
      );


    } catch (err) {

      console.error(
        "FORJA21 generate-plan",
        err
      );


      if (
        err?.code ===
        "RATE_LIMIT"
      ) {

        return json(
          res,
          429,
          {

            error:
              "Groq necesita esperar antes de continuar.",

            retryAfterSeconds:
              err.retryAfterSeconds ||
              20

          }
        );

      }


      if (
        err?.code ===
        "REQUEST_TOO_LARGE"
      ) {

        return json(
          res,
          413,
          {

            error:
              "Esta etapa es demasiado grande para el límite gratuito de Groq.",

            detail:
              err.message

          }
        );

      }


      if (
        err?.code ===
        "INVALID_JSON"
      ) {

        // Groq no logró completar un JSON válido ni tras los reintentos internos
        // (groqOnce con más presupuesto de tokens cada vez). Se trata como algo
        // temporal: el cliente ya sabe reintentar automáticamente ante un 429.
        return json(
          res,
          429,
          {

            error:
              "La IA ha tardado en generar un plan válido — reintentando automáticamente.",

            retryAfterSeconds: 5

          }
        );

      }


      return json(
        res,
        500,
        {
          error:
            err?.message ||
            "Error interno generando la planificación."
        }
      );

    }

  };
