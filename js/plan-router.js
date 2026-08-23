/* ========================================================================== 
   FORJA21 — Enrutador de planes por usuario

   OBJETIVO:
   - Toni (login cuyo identificador/email empieza por "toni.munoz") conserva
     exactamente el plan V1 existente en data.js.
   - beizga80@gmail.com conserva exactamente el plan V2 existente.
   - Cualquier otro usuario autenticado entra en el nuevo sistema personalizado.

   IMPORTANTE: este fichero NO modifica los planes legacy. Solo decide qué
   camino debe seguir cada cuenta una vez Firebase ha resuelto la sesión.
   ========================================================================== */

const LEGACY_TONI_LOGIN = "toni.munoz";
const LEGACY_BEIZGA_EMAIL = "beizga80@gmail.com";

let CURRENT_USER_PLAN_ROUTE = "anonymous";

function normalizeLogin(value) {
  return String(value || "").trim().toLowerCase();
}

function isToniLegacyLogin(email) {
  const login = normalizeLogin(email);
  if (!login) return false;
  const localPart = login.includes("@") ? login.split("@")[0] : login;
  return localPart === LEGACY_TONI_LOGIN;
}

function getUserPlanRoute(email) {
  const login = normalizeLogin(email);

  if (isToniLegacyLogin(login)) return "legacy-toni";
  if (login === LEGACY_BEIZGA_EMAIL) return "legacy-beizga";
  return "personalized";
}

function applyPlanRoute(user) {
  if (!user) {
    CURRENT_USER_PLAN_ROUTE = "anonymous";
    // Al cerrar sesión dejamos el V1 como estado neutro, igual que ocurría antes.
    if (typeof applyPlanForEmail === "function") applyPlanForEmail(null);
    return CURRENT_USER_PLAN_ROUTE;
  }

  CURRENT_USER_PLAN_ROUTE = getUserPlanRoute(user.email);

  if (CURRENT_USER_PLAN_ROUTE === "legacy-beizga") {
    // Mismo camino que antes, sin tocar ni un dato del V2.
    if (typeof applyPlanForEmail === "function") applyPlanForEmail(user.email);
    return CURRENT_USER_PLAN_ROUTE;
  }

  if (CURRENT_USER_PLAN_ROUTE === "legacy-toni") {
    // Toni continúa exactamente con data.js (V1).
    if (typeof applyPlanForEmail === "function") applyPlanForEmail(null);
    return CURRENT_USER_PLAN_ROUTE;
  }

  // Usuarios nuevos: dejamos las variables legacy en V1 como estado seguro,
  // pero NO se mostrará ni se copiará ese plan. Su interfaz irá por el nuevo
  // onboarding personalizado.
  if (typeof activatePlanV1 === "function") activatePlanV1();
  PLAN_MODE = "personalized";
  return CURRENT_USER_PLAN_ROUTE;
}

function isLegacyPlanRoute() {
  return CURRENT_USER_PLAN_ROUTE === "legacy-toni" || CURRENT_USER_PLAN_ROUTE === "legacy-beizga";
}

window.ForjaPlanRouter = {
  get route() { return CURRENT_USER_PLAN_ROUTE; },
  getUserPlanRoute,
  applyPlanRoute,
  isLegacyPlanRoute,
  isToniLegacyLogin
};
