/* ==========================================================================
   FORJA21 — Vercel Serverless Function · Groq por etapas · JSON Object Mode

   Variable obligatoria:
     GROQ_API_KEY

   Genera:
     action="master" -> plan maestro
     action="week"   -> una semana detallada

   Esta versión NO usa JSON Schema estricto.
   Usa JSON Object Mode y valida después la estructura en el servidor.
   ========================================================================== */

const MODEL = "openai/gpt-oss-120b";
const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  "AIzaSyCIWY-_Sv-Bi5PHYy-IUKX3LrC0VxMcxGg";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

async function verifyFirebaseToken(idToken) {
  if (!idToken) return null;

  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );

  if (!r.ok) return null;

  const data = await r.json();
  return data.users?.[0] || null;
}


/* ==========================================================================
   PROMPTS
   ========================================================================== */

function systemPrompt() {
  return `Eres el motor de planificación de FORJA21.

Debes generar planificación deportiva individualizada, progresiva, realista y
directamente utilizable por una aplicación.

REGLAS OBLIGATORIAS:
- Devuelve SIEMPRE un único objeto JSON válido.
- No uses Markdown.
- No uses bloques de código.
- No añadas comentarios antes ni después del JSON.
- No diagnostiques lesiones ni enfermedades.
- No inventes datos del usuario.
- Respeta exactamente el cuestionario.
- Prioriza seguridad, recuperación, adherencia y progresión gradual.`;
}


function masterPrompt(profile, email) {
  return `Genera SOLO EL PLAN MAESTRO de FORJA21.

NO desarrolles todavía sesiones diarias.

USUARIO:
${email || ""}

CUESTIONARIO:
${JSON.stringify(profile)}

DEVUELVE EXACTAMENTE UN OBJETO JSON CON ESTA ESTRUCTURA:

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
  "weeklyTargets": [
    {
      "week": 1,
      "focus": "string",
      "trainingSessions": 4,
      "runningKmApprox": 0,
      "weightTargetKg": 0,
      "note": "string"
    }
  ],
  "firstBlockSummary": "string",
  "firstBlockProgressionRules": ["string"]
}

REGLAS:
- Respeta objetivos, prioridad, disponibilidad, experiencia, material y limitaciones.
- Si hay varios objetivos, manda goalPriority[0].
- Determina una periodización coherente para TODA la duración indicada.
- phases debe cubrir de la semana 1 a totalWeeks sin huecos.
- weeklyTargets debe contener TODAS las semanas del plan, una entrada por semana.
- Si correr no forma parte del plan, runningKmApprox debe ser 0.
- Si el peso no es un objetivo o no procede fijarlo semanalmente, weightTargetKg debe ser 0.
- Si existe una prueba con fecha, periodiza hacia ella.
- Incluye descargas cuando corresponda.
- firstBlockSummary y firstBlockProgressionRules describen las semanas 1-4.
- Sé concreto y evita texto redundante.
- athleteName debe salir del cuestionario si existe; si no, usa una cadena vacía.
- generatedFor debe ser el email del usuario.
- startDate debe ser una fecha válida ISO YYYY-MM-DD.
- Devuelve SOLO el JSON.`;
}


function compactMaster(master) {
  return {
    title: master.title,
    startDate: master.startDate,
    totalWeeks: master.totalWeeks,
    primaryGoal: master.primaryGoal,
    secondaryGoals: master.secondaryGoals,
    strategySummary: master.strategySummary,
    phases: master.phases,
    weeklyTargets: master.weeklyTargets,
    firstBlockSummary: master.firstBlockSummary,
    firstBlockProgressionRules: master.firstBlockProgressionRules
  };
}


function weekPrompt(profile, master, weekNumber, previousWeekSummary, email) {
  const target = Array.isArray(master.weeklyTargets)
    ? master.weeklyTargets.find(x => Number(x.week) === Number(weekNumber))
    : null;

  return `Genera SOLO LA SEMANA ${weekNumber} del primer bloque de FORJA21.

USUARIO:
${email || ""}

PLAN MAESTRO:
${JSON.stringify(compactMaster(master))}

OBJETIVO DE ESTA SEMANA:
${JSON.stringify(target || {})}

RESUMEN DE LA SEMANA ANTERIOR:
${previousWeekSummary || "No existe: esta es la primera semana."}

CUESTIONARIO:
${JSON.stringify(profile)}

DEVUELVE EXACTAMENTE UN OBJETO JSON CON ESTA ESTRUCTURA:

{
  "week": ${weekNumber},
  "focus": "string",
  "loadNote": "string",
  "days": [
    {
      "day": "Lunes",
      "type": "strength|running|mobility|rest|cross_training|other",
      "typeLabel": "string",
      "title": "string",
      "objective": "string",
      "durationMin": 60,
      "warmup": "string",
      "mainWork": "string",
      "exercises": [
        {
          "name": "string",
          "sets": "string",
          "reps": "string",
          "rest": "string",
          "intensity": "string",
          "notes": "string"
        }
      ],
      "cardio": {
        "distanceKm": 0,
        "durationMin": 0,
        "pace": "string",
        "heartRate": "string",
        "structure": "string"
      },
      "cooldown": "string",
      "coachingNotes": ["string"],
      "nutrition": {
        "mode": "string",
        "summary": "string",
        "kcalApprox": 0,
        "proteinG": 0,
        "carbsG": 0,
        "fatG": 0,
        "meals": [
          {
            "meal": "string",
            "text": "string",
            "kcalApprox": 0
          }
        ],
        "timingNotes": ["string"]
      },
      "supplements": [
        {
          "name": "string",
          "amount": "string",
          "timing": "string",
          "reason": "string",
          "optional": true
        }
      ]
    }
  ]
}

REGLAS OBLIGATORIAS:
- week debe ser exactamente ${weekNumber}.
- days debe contener EXACTAMENTE 7 elementos.
- Orden exacto: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo.
- Incluye también los días de descanso.
- Respeta días disponibles y duración por sesión.
- No conviertas los 7 días en días duros.
- Cada entrenamiento debe incluir calentamiento, trabajo principal y vuelta a la calma.
- Fuerza/hipertrofia: incluye ejercicios, series, repeticiones, descansos e intensidad/RIR/RPE.
- Carrera: estructura, distancia o duración y ritmo/zona/RPE.
- Si faltan marcas fiables, no inventes ritmos.
- Mantén coherencia con el plan maestro y con la progresión.

NUTRICIÓN:
- Sigue exactamente profile.nutrition.mode.
- Si mode="none":
  summary="";
  kcalApprox=0;
  proteinG=0;
  carbsG=0;
  fatG=0;
  meals=[];
  timingNotes=[].
- Si solo pidió recomendaciones, no crees una dieta rígida.
- Evita déficits extremos y falsa precisión.

SUPLEMENTACIÓN:
- Sigue exactamente profile.supplements.mode.
- Si mode="none", supplements=[].
- Si mode="recommendations", todos deben llevar optional=true.
- No incluyas fármacos, hormonas, sustancias peligrosas ni megadosis.

DÍAS DE DESCANSO:
- exercises=[].
- cardio con valores 0 y cadenas vacías.
- warmup y mainWork pueden ser breves.
- nutrition sigue respetando el modo solicitado.
- supplements sigue respetando el modo solicitado.

Devuelve SOLO el JSON.`;
}


/* ==========================================================================
   GROQ
   ========================================================================== */

function extractJson(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Respuesta vacía.");
  }

  const clean = text
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

  if (first !== -1 && last > first) {
    return JSON.parse(clean.slice(first, last + 1));
  }

  throw new Error("No se encontró un objeto JSON válido.");
}


async function groqRequest({ messages, maxTokens }) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.15,
        max_completion_tokens: maxTokens,
        response_format: {
          type: "json_object"
        }
      })
    }
  );

  let raw = null;
  try {
    raw = await response.json();
  } catch (_) {}

  if (!response.ok) {
    const message =
      raw?.error?.message ||
      raw?.message ||
      `Groq devolvió ${response.status}.`;

    const retryHeader = response.headers.get("retry-after");

    const retryAfterSeconds = retryHeader
      ? Math.max(1, Math.ceil(Number(retryHeader)))
      : null;

    const rateLimited =
      response.status === 429 ||
      /tokens per minute|rate limit|too many requests/i.test(message);

    const tooLarge =
      /request too large/i.test(message);

    if (rateLimited && !tooLarge) {
      const err = new Error("RATE_LIMIT");
      err.code = "RATE_LIMIT";
      err.retryAfterSeconds = retryAfterSeconds || 20;
      err.detail = message;
      throw err;
    }

    if (tooLarge) {
      const err = new Error("REQUEST_TOO_LARGE");
      err.code = "REQUEST_TOO_LARGE";
      err.detail = message;
      throw err;
    }

    const err = new Error(message);
    err.code = String(response.status);
    throw err;
  }

  const text = raw?.choices?.[0]?.message?.content || "";

  return extractJson(text);
}


async function callGroqWithRepair({ prompt, maxTokens, kind }) {
  const baseMessages = [
    {
      role: "system",
      content: systemPrompt()
    },
    {
      role: "user",
      content: prompt
    }
  ];

  try {
    return await groqRequest({
      messages: baseMessages,
      maxTokens
    });
  } catch (err) {
    if (
      err?.code === "RATE_LIMIT" ||
      err?.code === "REQUEST_TOO_LARGE" ||
      err?.code === "401" ||
      err?.code === "403"
    ) {
      throw err;
    }

    console.warn(`Primer intento JSON fallido (${kind}). Reintentando...`, err);

    const repairMessages = [
      ...baseMessages,
      {
        role: "user",
        content:
          "IMPORTANTE: el intento anterior no produjo JSON válido. Repite la respuesta desde cero. Devuelve únicamente UN objeto JSON válido, sin Markdown, sin explicaciones y sin texto adicional."
      }
    ];

    return groqRequest({
      messages: repairMessages,
      maxTokens
    });
  }
}


/* ==========================================================================
   VALIDACIONES
   ========================================================================== */

function validateMaster(master) {
  if (!master || typeof master !== "object") {
    throw new Error("El plan maestro no es un objeto válido.");
  }

  const totalWeeks = Number(master.totalWeeks);

  if (!Number.isInteger(totalWeeks) || totalWeeks < 1) {
    throw new Error("El plan maestro no contiene una duración válida.");
  }

  if (!Array.isArray(master.phases) || !master.phases.length) {
    throw new Error("El plan maestro no contiene fases.");
  }

  if (!Array.isArray(master.weeklyTargets) || !master.weeklyTargets.length) {
    throw new Error("El plan maestro no contiene objetivos semanales.");
  }

  if (master.weeklyTargets.length !== totalWeeks) {
    throw new Error(
      `El plan maestro debía contener ${totalWeeks} objetivos semanales y ha devuelto ${master.weeklyTargets.length}.`
    );
  }

  return master;
}


function normalizeDay(day, expectedName) {
  return {
    day: day?.day || expectedName,
    type: day?.type || "rest",
    typeLabel: day?.typeLabel || "",
    title: day?.title || "",
    objective: day?.objective || "",
    durationMin: Number.isFinite(Number(day?.durationMin))
      ? Math.max(0, Math.round(Number(day.durationMin)))
      : 0,
    warmup: day?.warmup || "",
    mainWork: day?.mainWork || "",
    exercises: Array.isArray(day?.exercises) ? day.exercises : [],
    cardio: {
      distanceKm: Number(day?.cardio?.distanceKm || 0),
      durationMin: Math.max(0, Math.round(Number(day?.cardio?.durationMin || 0))),
      pace: day?.cardio?.pace || "",
      heartRate: day?.cardio?.heartRate || "",
      structure: day?.cardio?.structure || ""
    },
    cooldown: day?.cooldown || "",
    coachingNotes: Array.isArray(day?.coachingNotes)
      ? day.coachingNotes
      : [],
    nutrition: {
      mode: day?.nutrition?.mode || "none",
      summary: day?.nutrition?.summary || "",
      kcalApprox: Math.max(0, Math.round(Number(day?.nutrition?.kcalApprox || 0))),
      proteinG: Math.max(0, Math.round(Number(day?.nutrition?.proteinG || 0))),
      carbsG: Math.max(0, Math.round(Number(day?.nutrition?.carbsG || 0))),
      fatG: Math.max(0, Math.round(Number(day?.nutrition?.fatG || 0))),
      meals: Array.isArray(day?.nutrition?.meals)
        ? day.nutrition.meals
        : [],
      timingNotes: Array.isArray(day?.nutrition?.timingNotes)
        ? day.nutrition.timingNotes
        : []
    },
    supplements: Array.isArray(day?.supplements)
      ? day.supplements
      : []
  };
}


function validateAndNormalizeWeek(week, weekNumber) {
  if (!week || typeof week !== "object") {
    throw new Error(`La semana ${weekNumber} no es válida.`);
  }

  if (!Array.isArray(week.days) || week.days.length !== 7) {
    throw new Error(
      `La semana ${weekNumber} no contiene exactamente 7 días.`
    );
  }

  const names = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo"
  ];

  return {
    week: weekNumber,
    focus: week.focus || "",
    loadNote: week.loadNote || "",
    days: week.days.map((day, index) =>
      normalizeDay(day, names[index])
    )
  };
}


/* ==========================================================================
   ENDPOINT
   ========================================================================== */

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, {
      error: "Método no permitido."
    });
  }

  if (!process.env.GROQ_API_KEY) {
    return json(res, 500, {
      error: "Falta GROQ_API_KEY en las variables de entorno de Vercel."
    });
  }

  try {
    const authHeader = String(req.headers.authorization || "");

    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    const firebaseUser = await verifyFirebaseToken(idToken);

    if (!firebaseUser) {
      return json(res, 401, {
        error: "Sesión no válida. Vuelve a iniciar sesión."
      });
    }

    const profile = req.body?.profile;

    if (
      !profile ||
      profile.status !== "completed" ||
      !profile.consent
    ) {
      return json(res, 400, {
        error: "El cuestionario no está completo."
      });
    }

    const action = String(req.body?.action || "master");


    /* ----------------------------------------------------------------------
       PLAN MAESTRO
       ---------------------------------------------------------------------- */

    if (action === "master") {
      const master = await callGroqWithRepair({
        prompt: masterPrompt(
          profile,
          firebaseUser.email
        ),
        maxTokens: 1600,
        kind: "master"
      });

      validateMaster(master);

      return json(res, 200, {
        master,
        meta: {
          provider: "groq",
          mode: "json_object",
          model: MODEL,
          generatedAt: new Date().toISOString()
        }
      });
    }


    /* ----------------------------------------------------------------------
       SEMANA
       ---------------------------------------------------------------------- */

    if (action === "week") {
      const master = req.body?.master;
      const weekNumber = Number(req.body?.weekNumber);

      const previousWeekSummary =
        String(req.body?.previousWeekSummary || "");

      if (
        !master ||
        !Number.isInteger(weekNumber) ||
        weekNumber < 1 ||
        weekNumber > 4
      ) {
        return json(res, 400, {
          error: "Datos de generación semanal no válidos."
        });
      }

      const maxWeek =
        Math.min(
          4,
          Number(master.totalWeeks || 0)
        );

      if (weekNumber > maxWeek) {
        return json(res, 400, {
          error:
            "La semana solicitada queda fuera del primer bloque."
        });
      }

      const rawWeek = await callGroqWithRepair({
        prompt: weekPrompt(
          profile,
          master,
          weekNumber,
          previousWeekSummary,
          firebaseUser.email
        ),
        maxTokens: 2400,
        kind: `week_${weekNumber}`
      });

      const week =
        validateAndNormalizeWeek(
          rawWeek,
          weekNumber
        );

      return json(res, 200, {
        week
      });
    }


    return json(res, 400, {
      error: "Acción de generación desconocida."
    });

  } catch (err) {
    console.error(
      "FORJA21 generate-plan error",
      err
    );

    if (err?.code === "RATE_LIMIT") {
      return json(res, 429, {
        error:
          "Groq necesita esperar antes de continuar con la siguiente etapa.",
        retryAfterSeconds:
          err.retryAfterSeconds || 20,
        detail:
          err.detail || ""
      });
    }

    if (err?.code === "REQUEST_TOO_LARGE") {
      return json(res, 413, {
        error:
          "Esta etapa sigue siendo demasiado grande para el límite gratuito de Groq.",
        detail:
          err.detail || ""
      });
    }

    if (err?.code === "401") {
      return json(res, 502, {
        error:
          "La GROQ_API_KEY no es válida."
      });
    }

    if (err?.code === "403") {
      return json(res, 502, {
        error:
          "Groq ha rechazado el acceso al modelo."
      });
    }

    return json(res, 500, {
      error:
        err?.message ||
        "Error interno generando la planificación."
    });
  }
};
