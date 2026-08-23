/* ========================================================================== 
   FORJA21 — Vercel Serverless Function · Generación de plan con Gemini

   Variable de entorno obligatoria en Vercel:
     GEMINI_API_KEY

   La clave nunca llega al navegador.
   ========================================================================== */

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyCIWY-_Sv-Bi5PHYy-IUKX3LrC0VxMcxGg";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

async function verifyFirebaseToken(idToken) {
  if (!idToken) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.users?.[0] || null;
}

function planSchema() {
  const stringArray = { type: "array", items: { type: "string" } };
  const exercise = {
    type: "object",
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
    properties: {
      meal: { type: "string" },
      text: { type: "string" },
      kcalApprox: { type: "integer" }
    },
    required: ["meal", "text", "kcalApprox"]
  };
  const day = {
    type: "object",
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
      cardio: {
        type: "object",
        properties: {
          distanceKm: { type: "number" },
          durationMin: { type: "integer" },
          pace: { type: "string" },
          heartRate: { type: "string" },
          structure: { type: "string" }
        },
        required: ["distanceKm", "durationMin", "pace", "heartRate", "structure"]
      },
      cooldown: { type: "string" },
      coachingNotes: stringArray,
      nutrition: {
        type: "object",
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
        required: ["mode", "summary", "kcalApprox", "proteinG", "carbsG", "fatG", "meals", "timingNotes"]
      },
      supplements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            amount: { type: "string" },
            timing: { type: "string" },
            reason: { type: "string" },
            optional: { type: "boolean" }
          },
          required: ["name", "amount", "timing", "reason", "optional"]
        }
      }
    },
    required: ["day", "type", "typeLabel", "title", "objective", "durationMin", "warmup", "mainWork", "exercises", "cardio", "cooldown", "coachingNotes", "nutrition", "supplements"]
  };

  return {
    type: "object",
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
      milestones: {
        type: "array",
        items: {
          type: "object",
          properties: {
            week: { type: "integer" },
            date: { type: "string" },
            label: { type: "string" },
            target: { type: "string" }
          },
          required: ["week", "date", "label", "target"]
        }
      },
      phases: {
        type: "array",
        items: {
          type: "object",
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
          required: ["id", "name", "weekFrom", "weekTo", "summary", "focus", "progression", "nutritionFocus"]
        }
      },
      weeklyTargets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            week: { type: "integer" },
            focus: { type: "string" },
            trainingSessions: { type: "integer" },
            runningKmApprox: { type: "number" },
            weightTargetKg: { type: "number" },
            note: { type: "string" }
          },
          required: ["week", "focus", "trainingSessions", "runningKmApprox", "weightTargetKg", "note"]
        }
      },
      firstBlock: {
        type: "object",
        properties: {
          blockNumber: { type: "integer" },
          weekFrom: { type: "integer" },
          weekTo: { type: "integer" },
          summary: { type: "string" },
          progressionRules: stringArray,
          weeks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                week: { type: "integer" },
                focus: { type: "string" },
                loadNote: { type: "string" },
                days: { type: "array", items: day }
              },
              required: ["week", "focus", "loadNote", "days"]
            }
          }
        },
        required: ["blockNumber", "weekFrom", "weekTo", "summary", "progressionRules", "weeks"]
      }
    },
    required: ["schemaVersion", "title", "athleteName", "generatedFor", "startDate", "totalWeeks", "primaryGoal", "secondaryGoals", "strategySummary", "safetyNotes", "milestones", "phases", "weeklyTargets", "firstBlock"]
  };
}

function buildPrompt(profile, email) {
  return `Eres el motor de planificación de FORJA21. Debes crear una planificación deportiva personalizada extremadamente concreta y utilizable por una aplicación.

REGLAS DE CALIDAD:
- Escribe en español claro y directo.
- Respeta estrictamente disponibilidad, días, material, experiencia y preferencias del usuario.
- Si hay varios objetivos, prioriza goalPriority[0] y compatibiliza los demás sin comprometer recuperación.
- Construye un PLAN MAESTRO para toda la duración y un PRIMER BLOQUE DETALLADO de exactamente 4 semanas (o menos si el plan total dura menos).
- En el primer bloque incluye LOS 7 DÍAS de cada semana. Los días sin entrenamiento deben figurar como descanso/recuperación.
- Cada sesión debe tener calentamiento, trabajo principal, ejercicios con series/repeticiones/descanso/intensidad, vuelta a la calma y notas cuando aplique.
- Para carrera, utiliza ritmos o zonas prudentes según los datos disponibles. Si faltan marcas fiables, usa percepción de esfuerzo o zonas conversacionales en lugar de inventar marcas de competición.
- No inventes diagnósticos ni afirmes tratar lesiones.
- La progresión debe ser gradual. Incluye descarga cuando corresponda.
- La nutrición SOLO debe aparecer con el nivel pedido por profile.nutrition.mode. Si es 'none', deja summary vacío, kcal/macros en 0, meals vacío y timingNotes vacío.
- No plantees déficits calóricos extremos ni pérdidas rápidas de peso. Prioriza proteína suficiente y rendimiento/recuperación.
- La suplementación SOLO debe aparecer según profile.supplements.mode. Si es 'none', lista vacía. Si es 'recommendations', todo debe llevar optional=true. Si es 'integrated', puede aparecer calendarizada, pero sigue siendo recomendación y nunca medicación.
- Limita suplementos a opciones comunes y con evidencia razonable; evita sustancias de riesgo, hormonas, fármacos o megadosis.
- Si faltan datos para calcular kcal con sensatez o el usuario no pidió plan nutricional detallado, evita falsa precisión y usa 0 en kcal/macros cuando corresponda.
- weeklyTargets debe incluir TODAS las semanas del plan maestro, aunque sea de forma resumida. Si el peso no es objetivo o no procede fijarlo, usa 0.
- firstBlock.weeks debe contener semanas 1 a 4 y cada semana 7 días.
- El resultado debe ser JSON conforme al esquema, sin texto fuera del JSON.

USUARIO AUTENTICADO: ${email || ""}
PERFIL / CUESTIONARIO:
${JSON.stringify(profile, null, 2)}
`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Método no permitido" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return json(res, 500, { error: "Falta GEMINI_API_KEY en las variables de entorno de Vercel." });
  }

  try {
    const authHeader = String(req.headers.authorization || "");
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const firebaseUser = await verifyFirebaseToken(idToken);
    if (!firebaseUser) return json(res, 401, { error: "Sesión no válida. Vuelve a iniciar sesión." });

    const profile = req.body?.profile;
    if (!profile || profile.status !== "completed" || !profile.consent) {
      return json(res, 400, { error: "El cuestionario no está completo." });
    }

    const prompt = buildPrompt(profile, firebaseUser.email);
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 32768,
          responseMimeType: "application/json",
          responseSchema: planSchema()
        }
      })
    });

    const raw = await geminiRes.json();
    if (!geminiRes.ok) {
      console.error("Gemini error", raw);
      return json(res, 502, { error: raw?.error?.message || "Gemini no pudo generar el plan." });
    }

    const text = raw?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    if (!text) return json(res, 502, { error: "Gemini devolvió una respuesta vacía." });

    let plan;
    try { plan = JSON.parse(text); }
    catch (_) { return json(res, 502, { error: "La IA devolvió un plan que no se pudo interpretar." }); }

    // Validaciones mínimas del contrato de la app.
    if (!Array.isArray(plan.phases) || !Array.isArray(plan.firstBlock?.weeks) || !plan.firstBlock.weeks.length) {
      return json(res, 502, { error: "El plan generado está incompleto. Inténtalo de nuevo." });
    }

    plan.meta = {
      model: MODEL,
      generatedAt: new Date().toISOString(),
      uid: firebaseUser.localId,
      email: firebaseUser.email || "",
      sourceOnboardingVersion: profile.version || 1
    };

    return json(res, 200, { plan });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: "Error interno generando la planificación." });
  }
}
