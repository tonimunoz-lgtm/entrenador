/* ==========================================================================
   FORJA21 — Vercel Serverless Function · Groq por etapas

   Variable obligatoria:
     GROQ_API_KEY

   Genera:
     action="master" -> plan maestro
     action="week"   -> una semana detallada

   La división por etapas permite trabajar dentro del Free Tier de Groq
   sin sacrificar el nivel de detalle del plan.
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

const stringArray = { type: "array", items: { type: "string" } };

function masterSchema() {
  const milestone = {
    type: "object",
    additionalProperties: false,
    properties: {
      week: { type: "integer" },
      date: { type: "string" },
      label: { type: "string" },
      target: { type: "string" }
    },
    required: ["week", "date", "label", "target"]
  };

  const phase = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      weekFrom: { type: "integer" },
      weekTo: { type: "integer" },
      summary: { type: "string" },
      focus: stringArray,
      progression: { type: "string" },
      nutritionFocus: { type: "string" }
    },
    required: [
      "id", "name", "weekFrom", "weekTo", "summary",
      "focus", "progression", "nutritionFocus"
    ]
  };

  const weeklyTarget = {
    type: "object",
    additionalProperties: false,
    properties: {
      week: { type: "integer" },
      focus: { type: "string" },
      trainingSessions: { type: "integer" },
      runningKmApprox: { type: "number" },
      weightTargetKg: { type: "number" },
      note: { type: "string" }
    },
    required: [
      "week", "focus", "trainingSessions",
      "runningKmApprox", "weightTargetKg", "note"
    ]
  };

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      schemaVersion: { type: "integer" },
      title: { type: "string" },
      athleteName: { type: "string" },
      generatedFor: { type: "string" },
      startDate: { type: "string" },
      totalWeeks: { type: "integer" },
      primaryGoal: { type: "string" },
      secondaryGoals: stringArray,
      strategySummary: { type: "string" },
      safetyNotes: stringArray,
      milestones: { type: "array", items: milestone },
      phases: { type: "array", items: phase },
      weeklyTargets: { type: "array", items: weeklyTarget },
      firstBlockSummary: { type: "string" },
      firstBlockProgressionRules: stringArray
    },
    required: [
      "schemaVersion", "title", "athleteName", "generatedFor", "startDate",
      "totalWeeks", "primaryGoal", "secondaryGoals", "strategySummary",
      "safetyNotes", "milestones", "phases", "weeklyTargets",
      "firstBlockSummary", "firstBlockProgressionRules"
    ]
  };
}

function weekSchema() {
  const exercise = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      sets: { type: "string" },
      reps: { type: "string" },
      rest: { type: "string" },
      intensity: { type: "string" },
      notes: { type: "string" }
    },
    required: ["name", "sets", "reps", "rest", "intensity", "notes"]
  };

  const meal = {
    type: "object",
    additionalProperties: false,
    properties: {
      meal: { type: "string" },
      text: { type: "string" },
      kcalApprox: { type: "integer" }
    },
    required: ["meal", "text", "kcalApprox"]
  };

  const cardio = {
    type: "object",
    additionalProperties: false,
    properties: {
      distanceKm: { type: "number" },
      durationMin: { type: "integer" },
      pace: { type: "string" },
      heartRate: { type: "string" },
      structure: { type: "string" }
    },
    required: ["distanceKm", "durationMin", "pace", "heartRate", "structure"]
  };

  const nutrition = {
    type: "object",
    additionalProperties: false,
    properties: {
      mode: { type: "string" },
      summary: { type: "string" },
      kcalApprox: { type: "integer" },
      proteinG: { type: "integer" },
      carbsG: { type: "integer" },
      fatG: { type: "integer" },
      meals: { type: "array", items: meal },
      timingNotes: stringArray
    },
    required: [
      "mode", "summary", "kcalApprox", "proteinG",
      "carbsG", "fatG", "meals", "timingNotes"
    ]
  };

  const supplement = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      amount: { type: "string" },
      timing: { type: "string" },
      reason: { type: "string" },
      optional: { type: "boolean" }
    },
    required: ["name", "amount", "timing", "reason", "optional"]
  };

  const day = {
    type: "object",
    additionalProperties: false,
    properties: {
      day: { type: "string" },
      type: { type: "string" },
      typeLabel: { type: "string" },
      title: { type: "string" },
      objective: { type: "string" },
      durationMin: { type: "integer" },
      warmup: { type: "string" },
      mainWork: { type: "string" },
      exercises: { type: "array", items: exercise },
      cardio,
      cooldown: { type: "string" },
      coachingNotes: stringArray,
      nutrition,
      supplements: { type: "array", items: supplement }
    },
    required: [
      "day", "type", "typeLabel", "title", "objective", "durationMin",
      "warmup", "mainWork", "exercises", "cardio", "cooldown",
      "coachingNotes", "nutrition", "supplements"
    ]
  };

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      week: { type: "integer" },
      focus: { type: "string" },
      loadNote: { type: "string" },
      days: { type: "array", items: day }
    },
    required: ["week", "focus", "loadNote", "days"]
  };
}

function systemPrompt() {
  return `Eres el motor de planificación de FORJA21.
Generas planes deportivos individualizados, progresivos, realistas y directamente utilizables por una app.
Respeta estrictamente el cuestionario.
No diagnostiques lesiones ni enfermedades.
No inventes datos del usuario.
Prioriza seguridad, recuperación, adherencia y progresión.
Devuelve exclusivamente JSON conforme al esquema solicitado.`;
}

function masterPrompt(profile, email) {
  return `Genera SOLO EL PLAN MAESTRO de FORJA21. No desarrolles todavía los días concretos.

USUARIO: ${email || ""}

REGLAS:
- Escribe en español claro y concreto.
- Respeta objetivos, prioridad, disponibilidad, experiencia, material y limitaciones.
- Si hay varios objetivos, manda goalPriority[0].
- Determina una periodización coherente para TODA la duración.
- phases debe cubrir desde semana 1 hasta totalWeeks, sin huecos.
- weeklyTargets debe incluir TODAS las semanas.
- Si correr no forma parte del plan: runningKmApprox=0.
- Si el peso no debe ser objetivo semanal: weightTargetKg=0.
- Si existe una prueba con fecha, periodiza hacia ella.
- La progresión debe ser gradual e incluir descarga cuando proceda.
- Nutrición y suplementación solo influyen al nivel pedido por el cuestionario.
- firstBlockSummary y firstBlockProgressionRules describen las semanas 1-4.
- Sé útil pero conciso: esta etapa es la arquitectura del plan, no las sesiones diarias.

CUESTIONARIO:
${JSON.stringify(profile)}`;
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

USUARIO: ${email || ""}

PLAN MAESTRO:
${JSON.stringify(compactMaster(master))}

OBJETIVO DE ESTA SEMANA:
${JSON.stringify(target || {})}

RESUMEN DE LA SEMANA ANTERIOR:
${previousWeekSummary || "No existe: esta es la primera semana."}

REGLAS:
- week debe ser exactamente ${weekNumber}.
- days debe contener EXACTAMENTE 7 elementos, lunes a domingo y en ese orden.
- Respeta los días disponibles y la duración por sesión declarados.
- Los días no entrenables deben seguir apareciendo como descanso/recuperación.
- No conviertas los 7 días en días duros.
- Cada sesión debe ser muy concreta: calentamiento, trabajo principal y vuelta a la calma.
- Fuerza/hipertrofia: ejercicios, series, repeticiones, descansos e intensidad/RIR/RPE.
- Carrera: estructura, distancia o duración y ritmo/zona/RPE. Si faltan marcas fiables, NO inventes ritmos.
- Ajusta volumen e intensidad al nivel real.
- Mantén coherencia con la semana anterior y con la progresión del bloque.
- No repitas explicaciones largas idénticas cada día.

NUTRICIÓN:
- Sigue exactamente profile.nutrition.mode.
- Si mode="none": summary="", kcal/macros=0, meals=[], timingNotes=[].
- Si solo pidió recomendaciones, no crees una dieta rígida.
- Evita falsa precisión si faltan datos y evita déficits extremos.

SUPLEMENTACIÓN:
- Sigue exactamente profile.supplements.mode.
- Si mode="none": supplements=[].
- Si mode="recommendations": optional=true siempre.
- No incluyas fármacos, hormonas, sustancias peligrosas ni megadosis.

CUESTIONARIO DEL USUARIO:
${JSON.stringify(profile)}`;
}

async function callGroq({ messages, schema, schemaName, maxTokens }) {
  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.2,
      max_completion_tokens: maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema
        }
      }
    })
  });

  let raw = null;
  try { raw = await groqRes.json(); } catch (_) {}

  if (!groqRes.ok) {
    const message =
      raw?.error?.message ||
      raw?.message ||
      `Groq devolvió ${groqRes.status}.`;

    const retryHeader = groqRes.headers.get("retry-after");
    const retryAfterSeconds = retryHeader
      ? Math.max(1, Math.ceil(Number(retryHeader)))
      : null;

    const rateLimited =
      groqRes.status === 429 ||
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
    err.code = String(groqRes.status);
    throw err;
  }

  const text = raw?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Groq devolvió una respuesta vacía.");

  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error("Groq devolvió un JSON que no se pudo interpretar.");
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Método no permitido." });
  }

  if (!process.env.GROQ_API_KEY) {
    return json(res, 500, {
      error: "Falta GROQ_API_KEY en las variables de entorno de Vercel."
    });
  }

  try {
    const authHeader = String(req.headers.authorization || "");
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const firebaseUser = await verifyFirebaseToken(idToken);

    if (!firebaseUser) {
      return json(res, 401, {
        error: "Sesión no válida. Vuelve a iniciar sesión."
      });
    }

    const profile = req.body?.profile;
    if (!profile || profile.status !== "completed" || !profile.consent) {
      return json(res, 400, {
        error: "El cuestionario no está completo."
      });
    }

    const action = String(req.body?.action || "master");

    if (action === "master") {
      const master = await callGroq({
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: masterPrompt(profile, firebaseUser.email) }
        ],
        schema: masterSchema(),
        schemaName: "forja21_master_plan",
        maxTokens: 1800
      });

      if (
        !Array.isArray(master.phases) ||
        !master.phases.length ||
        !Array.isArray(master.weeklyTargets) ||
        !master.weeklyTargets.length
      ) {
        return json(res, 502, {
          error: "La IA devolvió un plan maestro incompleto."
        });
      }

      return json(res, 200, {
        master,
        meta: {
          provider: "groq",
          model: MODEL,
          generatedAt: new Date().toISOString()
        }
      });
    }

    if (action === "week") {
      const master = req.body?.master;
      const weekNumber = Number(req.body?.weekNumber);
      const previousWeekSummary = String(req.body?.previousWeekSummary || "");

      if (!master || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 4) {
        return json(res, 400, {
          error: "Datos de generación semanal no válidos."
        });
      }

      const maxWeek = Math.min(4, Number(master.totalWeeks || 0));
      if (weekNumber > maxWeek) {
        return json(res, 400, {
          error: "La semana solicitada queda fuera del primer bloque."
        });
      }

      const week = await callGroq({
        messages: [
          { role: "system", content: systemPrompt() },
          {
            role: "user",
            content: weekPrompt(
              profile,
              master,
              weekNumber,
              previousWeekSummary,
              firebaseUser.email
            )
          }
        ],
        schema: weekSchema(),
        schemaName: `forja21_week_${weekNumber}`,
        maxTokens: 2600
      });

      if (
        Number(week.week) !== weekNumber ||
        !Array.isArray(week.days) ||
        week.days.length !== 7
      ) {
        return json(res, 502, {
          error: `La IA no generó correctamente la semana ${weekNumber}.`
        });
      }

      return json(res, 200, { week });
    }

    return json(res, 400, {
      error: "Acción de generación desconocida."
    });

  } catch (err) {
    console.error("FORJA21 generate-plan error", err);

    if (err?.code === "RATE_LIMIT") {
      return json(res, 429, {
        error: "Groq necesita esperar antes de continuar con la siguiente etapa.",
        retryAfterSeconds: err.retryAfterSeconds || 20,
        detail: err.detail || ""
      });
    }

    if (err?.code === "REQUEST_TOO_LARGE") {
      return json(res, 413, {
        error: "Esta etapa sigue siendo demasiado grande para el límite gratuito de Groq.",
        detail: err.detail || ""
      });
    }

    if (err?.code === "401") {
      return json(res, 502, {
        error: "La GROQ_API_KEY no es válida."
      });
    }

    return json(res, 500, {
      error: err?.message || "Error interno generando la planificación."
    });
  }
};
