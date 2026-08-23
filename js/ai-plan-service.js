/* ========================================================================== 
   FORJA21 — Cliente de generación de planes personalizados
   La API key NO está aquí: vive en la función /api/generate-plan de Vercel.
   ========================================================================== */
(function () {
  "use strict";

  async function generate(user, onboarding) {
    if (!user?.uid) throw new Error("No hay sesión iniciada.");
    if (!onboarding || onboarding.status !== "completed") throw new Error("Completa primero el cuestionario.");

    const token = await user.getIdToken(true);
    const response = await fetch("/api/generate-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ profile: onboarding })
    });

    let body = null;
    try { body = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(body?.error || `No se pudo generar el plan (${response.status}).`);
    if (!body?.plan) throw new Error("La API no devolvió ningún plan.");

    await CloudSync.pushPersonalizedPlan(user.uid, body.plan);
    return body.plan;
  }

  async function load(user) {
    if (!user?.uid) return null;
    return CloudSync.pullPersonalizedPlan(user.uid);
  }

  window.AIPlanService = { generate, load };
})();
