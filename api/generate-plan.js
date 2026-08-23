/* ==========================================================================
   FORJA21 — Vercel Serverless Function · Generación de plan con Groq

   Variable de entorno obligatoria en Vercel:
     GROQ_API_KEY

   La clave nunca llega al navegador.

   Toni y Beizga NO pasan por este endpoint: este generador pertenece
   únicamente al sistema de usuarios personalizados.
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
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      FIREBASE_WEB_API_KEY
    )}`,
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

function planSchema() {
  const stringArray = {
    type: "array",
    items: { type: "string" }
  };

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

  const week = {
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

  const firstBlock = {
    type: "object",
    additionalProperties: false,
    properties: {
      blockNumber: { type: "integer" },
      weekFrom: { type: "integer" },
      weekTo: { type: "integer" },
      summary: { type: "string" },
      progressionRules: stringArray,
      weeks: { type: "array", items: week }
    },
    required: [
      "blockNumber", "weekFrom", "weekTo",
      "summary", "progressionRules", "weeks"
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
      firstBlock
    },
    required: [
      "schemaVersion", "title", "athleteName", "generatedFor", "startDate",
      "totalWeeks", "primaryGoal", "secondaryGoals", "strategySummary",
      "safetyNotes", "milestones", "phases", "weeklyTargets", "firstBlock"
    ]
  };
}

function buildSystemPrompt() {
  return `Eres el motor de planificación de FORJA21.

Tu trabajo es convertir el cuestionario de una persona en una planificación
deportiva individualizada, progresiva y directamente utilizable por una app.

PRINCIPIOS:
- Prioriza seguridad, recuperación, adherencia y progresión gradual.
- No diagnostiques enfermedades ni lesiones.
- No sustituyas consejo médico o dietético profesional cuando sea necesario.
- No inventes marcas, lesiones, disponibilidad, material ni preferencias.
- Si faltan datos, utiliza criterios conservadores.
- Devuelve EXCLUSIVAMENTE el JSON exigido por el esquema.
- No escribas Markdown ni comentarios fuera del JSON.`;
}

function buildPrompt(profile, email) {
  return `CREA LA PLANIFICACIÓN PERSONALIZADA DE FORJA21.

REGLAS DE CALIDAD:
- Escribe en español claro, concreto y útil.
- Respeta estrictamente disponibilidad, días, duración por sesión, material, experiencia y preferencias.
- Si existen varios objetivos, prioriza goalPriority[0] y compatibiliza los demás sin comprometer recuperación.
- Crea un PLAN MAESTRO para TODA la duración indicada.
- Crea además un PRIMER BLOQUE DETALLADO de exactamente 4 semanas, salvo que el plan completo dure menos de 4.
- firstBlock.weekFrom debe ser 1.
- firstBlock.weekTo debe ser 4 si totalWeeks >= 4.
- firstBlock.weeks debe contener las semanas 1, 2, 3 y 4 si totalWeeks >= 4.
- Cada semana del primer bloque debe contener exactamente LOS 7 DÍAS.
- Los días sin entrenamiento también deben aparecer como descanso, movilidad o recuperación.
- No conviertas todos los días en entrenamiento.

DETALLE DE ENTRENAMIENTO:
- Cada sesión debe indicar objetivo, duración, calentamiento, trabajo principal y vuelta a la calma.
- En fuerza/hipertrofia especifica ejercicios, series, repeticiones, descanso e intensidad/RIR/RPE cuando proceda.
- En carrera especifica estructura, duración/distancia y ritmo, zona o RPE.
- Si faltan marcas fiables para carrera, usa RPE, zonas o ritmo conversacional; no inventes ritmos de competición.
- Ajusta el volumen al nivel real declarado.
- Introduce progresión gradual y descargas cuando correspondan.
- Si existe una fecha objetivo, periodiza hacia ella.

NUTRICIÓN:
- Respeta exactamente profile.nutrition.mode.
- Si mode es "none": summary="", kcal/macros=0, meals=[] y timingNotes=[].
- Si solo pidió recomendaciones, no conviertas la respuesta en una dieta rígida.
- Si pidió planificación detallada y existen datos suficientes, puedes estimar kcal/macros con prudencia.
- No plantees déficits extremos ni pérdidas rápidas de peso.
- Prioriza rendimiento, proteína suficiente, recuperación e hidratación.
- Si no hay datos suficientes para una cifra razonable, usa 0 en lugar de falsa precisión.

SUPLEMENTACIÓN:
- Respeta exactamente profile.supplements.mode.
- Si mode es "none": supplements=[].
- Si mode es "recommendations": todos los suplementos deben llevar optional=true.
- Si mode es "integrated", pueden calendarizarse, pero siguen siendo recomendaciones.
- No recomiendes fármacos, hormonas, sustancias peligrosas ni megadosis.
- Prioriza únicamente opciones comunes con evidencia razonable cuando tengan sentido para el objetivo.

PLAN MAESTRO:
- phases debe cubrir desde la semana 1 hasta totalWeeks sin huecos.
- weeklyTargets debe contener TODAS las semanas del plan.
- Si correr no forma parte del plan, runningKmApprox=0.
- Si el peso no es un objetivo o no es prudente fijar una cifra semanal, weightTargetKg=0.
- milestones debe contener solo hitos útiles.

ECONOMÍA DE RESPUESTA:
- El JSON debe ser detallado, pero evita repetir explicaciones idénticas cada día.
- En días de descanso utiliza campos breves y arrays vacíos cuando proceda.
- Mantén coachingNotes normalmente entre 1 y 3 elementos.
- Mantén las comidas solo con el nivel de detalle que el usuario haya solicitado.

USUARIO AUTENTICADO:
${email || ""}

PERFIL / CUESTIONARIO:
${JSON.stringify(profile, null, 2)}`;
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

    if (!profile || profile.status !== "completed" || !profile.consent) {
      return json(res, 400, {
        error: "El cuestionario no está completo."
      });
    }

    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: buildPrompt(profile, firebaseUser.email) }
          ],
          temperature: 0.25,
          max_completion_tokens: 6000,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "forja21_training_plan",
              strict: true,
              schema: planSchema()
            }
          }
        })
      }
    );

    let raw;

    try {
      raw = await groqRes.json();
    } catch (_) {
      return json(res, 502, {
        error: "Groq devolvió una respuesta que el servidor no pudo interpretar."
      });
    }

    if (!groqRes.ok) {
      console.error("Groq error", raw);

      const groqMessage =
        raw?.error?.message ||
        raw?.message ||
        "Groq no pudo generar el plan.";

      if (groqRes.status === 401) {
        return json(res, 502, {
          error: "La GROQ_API_KEY no es válida. Revisa la variable de entorno en Vercel."
        });
      }

      if (groqRes.status === 403) {
        return json(res, 502, {
          error: "Groq ha rechazado el acceso al modelo. Revisa los permisos del proyecto o de la API key."
        });
      }

      if (groqRes.status === 429) {
        return json(res, 429, {
          error: "Se ha alcanzado temporalmente el límite gratuito de Groq. Espera un poco y vuelve a intentarlo.",
          detail: groqMessage
        });
      }

      return json(res, 502, { error: groqMessage });
    }

    const text = raw?.choices?.[0]?.message?.content || "";

    if (!text) {
      return json(res, 502, {
        error: "Groq devolvió una respuesta vacía."
      });
    }

    let plan;

    try {
      plan = typeof text === "string" ? JSON.parse(text) : text;
    } catch (err) {
      console.error("No se pudo parsear JSON Groq", err, text);
      return json(res, 502, {
        error: "La IA devolvió un plan que no se pudo interpretar."
      });
    }

    if (
      !Array.isArray(plan.phases) ||
      !plan.phases.length ||
      !Array.isArray(plan.weeklyTargets) ||
      !Array.isArray(plan.firstBlock?.weeks) ||
      !plan.firstBlock.weeks.length
    ) {
      return json(res, 502, {
        error: "El plan generado está incompleto. Inténtalo de nuevo."
      });
    }

    const expectedWeeks = Math.min(4, Number(plan.totalWeeks || 0));

    if (plan.firstBlock.weeks.length !== expectedWeeks) {
      return json(res, 502, {
        error: "La IA no generó correctamente las primeras semanas del plan. Inténtalo de nuevo."
      });
    }

    const badWeek = plan.firstBlock.weeks.find(
      w => !Array.isArray(w.days) || w.days.length !== 7
    );

    if (badWeek) {
      return json(res, 502, {
        error: "Una de las semanas generadas no contiene los 7 días. Inténtalo de nuevo."
      });
    }

    plan.meta = {
      provider: "groq",
      model: MODEL,
      generatedAt: new Date().toISOString(),
      uid: firebaseUser.localId,
      email: firebaseUser.email || "",
      sourceOnboardingVersion: profile.version || 1
    };

    return json(res, 200, { plan });

  } catch (err) {
    console.error("FORJA21 generate-plan error", err);

    return json(res, 500, {
      error: "Error interno generando la planificación."
    });
  }
};
