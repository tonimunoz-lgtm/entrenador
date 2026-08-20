/* ==========================================================================
   FORJA21 — Plan V2: "Brazos Firmes" (plan de choque de 12 semanas)

   Este fichero define un segundo programa de entrenamiento COMPLETAMENTE
   distinto al de Forja21 (nada de maratón, nada de peso, nada de fases de
   volumen/definición). Se activa en tiempo de ejecución SOLO para la cuenta
   con email beizga80@gmail.com — para el resto de usuarios la app funciona
   exactamente igual que siempre (plan V1, definido en data.js).

   Cómo funciona el interruptor:
   - data.js define PHASES, HR_ZONES, SUPPLEMENTS, etc. como `let` (no
     `const`), para que se puedan reasignar en caliente.
   - Este fichero, cargado justo después de data.js, guarda una "foto" de
     esos valores originales (PLAN_V1_SNAPSHOT) y define el plan V2 aparte.
   - activatePlanV2() / activatePlanV1() reasignan esas variables globales
     por las de un plan o el otro. app.js llama a la que corresponda en
     cuanto sabe qué cuenta ha iniciado sesión (ver handleCloudAuthChange).
   - PLAN_MODE ("v1" | "v2") le dice a app.js qué partes de la interfaz
     (peso, calorías, hitos de carrera, zonas de FC...) no tienen sentido
     para este plan y hay que ocultar.
   ========================================================================== */

const PLAN_V2_EMAIL = "beizga80@gmail.com";
let PLAN_MODE = "v1";

// Foto de los valores originales de data.js, tomada antes de tocar nada.
const PLAN_V1_SNAPSHOT = {
  PROFILE_DEFAULTS, HR_ZONES, MILESTONES, SUPPLEMENTS, WEEKLY_WEIGHTS_BLOQUE1,
  PHASES, TOTAL_PLAN_WEEKS, RACE_WEEK, ZONE_REVIEW_INTERVAL_WEEKS,
  CALORIE_DICTIONARY, SUPPLEMENT_DETAILS,
  getDaySchedule, getPhaseForWeek, getWeightTargetForWeek,
  getAllWeightTargetWeeks, isZoneReviewWeek, trainingDayKeysForWeek
};

/* ---------------------------------------------------------------------
   Copys de bienvenida — texto que cambia entre plan V1 y V2 en las
   pantallas de onboarding / "aún no ha empezado" / "plan completado".
   --------------------------------------------------------------------- */
let PLAN_COPY = {
  welcomeTitle: "Tu entrenador hacia Granollers",
  welcomeDesc: (raceGoal, finalWeight) => `Este plan te lleva en ${PHASES[2] ? PHASES[2].weeks[1] : 22} semanas hasta la <b style="color:var(--text)">Mitja Marató de Granollers</b> (${raceGoal}), pesando ${finalWeight} kg el día de la carrera. Después, dos fases más de construcción muscular y definición te llevan a un físico marcado para finales de junio, con los abdominales visibles.`,
  welcomeBadges: ["🏁 22 de enero · Granollers", "💪 Junio · Definición"],
  preplanDesc: (startD, finalWeight) => `La semana 1 arranca el lunes ${startD}. Objetivo: llegar a la Mitja Marató de Granollers el 24 de enero de 2027 pesando ${finalWeight} kg.`,
  preplanBadges: (startWeight, raceGoal) => [`⚖️ Peso de salida: ${startWeight} kg`, `🏁 ${raceGoal}`],
  finishedTitle: "🏆 Has completado el plan",
  finishedDesc: (startWeight, currentWeight, totalWorkouts) => `Del ${startWeight} kg inicial hasta hoy: ${currentWeight} kg, con ${totalWorkouts} sesiones registradas por el camino. Si quieres seguir entrenando, puedes ajustar la fecha de inicio en Ajustes para repasar cualquier fase del plan desde el Calendario.`
};

const PLAN_V1_COPY_SNAPSHOT = PLAN_COPY;

/* =========================================================================
   PLAN V2 — "Brazos Firmes": plan de choque de 12 semanas
   ========================================================================= */

const PROFILE_DEFAULTS_V2 = {
  name: "Atleta",
  startDate: "2026-08-24",
  raceDate: null,
  raceGoal: "Piel tersa y brazo firme en 12 semanas",
  startWeight: null,
  fcr: null, fcm: null, z2max: null,
  notificationsEnabled: false
};

const SUPPLEMENTS_V2 = [
  { id: "creatina3", name: "Creatina Creapure", when: "Todos los días (entrenes o no) — con un vaso de agua, en cualquier momento (ej. desayuno). Días de entreno, también puedes tomarla en el batido post-ejercicio.", icon: "bolt" },
  { id: "proteina", name: "Proteína Whey Isolate", when: "Solo lunes, miércoles y viernes — 1 batido con agua justo al acabar de correr (post-entreno inmediato).", icon: "shake" },
  { id: "omega3", name: "Omega 3", when: "Todos los días — junto con la comida principal o la cena.", icon: "moon" }
];

const SUPPLEMENT_DETAILS_V2 = [
  {
    id: "proteina",
    name: "Proteína de suero (Whey Isolate)",
    brand: "La marca que ya tengas — aislado (isolate) de suero",
    dose: "1 cacito con agua, justo al acabar de correr",
    fn: "Nutre la piel floja del brazo de inmediato y evita la flacidez tras el ejercicio.",
    kcal: 110,
    kcalNote: "Solo lunes, miércoles y viernes."
  },
  {
    id: "creatina3",
    name: "Creatina Creapure",
    brand: "Cualquier creatina monohidrato con sello Creapure",
    dose: "3 gramos diarios, todos los días de la semana",
    fn: "Hidrata el músculo por dentro. Hace que el brazo se vea firme y terso, no hinchado. Funciona por acumulación, por eso se toma todos los días.",
    kcal: 0,
    kcalNote: "Prácticamente sin calorías."
  },
  {
    id: "omega3",
    name: "Omega 3",
    brand: "1–2 cápsulas según dosis del fabricante",
    dose: "Todos los días, junto con la comida principal o la cena",
    fn: "Potente antiinflamatorio celular. Mejora la elasticidad de la piel y ayuda a movilizar las grasas rebeldes.",
    kcal: 10,
    kcalNote: "Grasa Omega 3 — calorías insignificantes."
  }
];

function daySupplementsV2({ proteina = false } = {}) {
  const list = ["creatina3", "omega3"];
  if (proteina) list.push("proteina");
  return list;
}

// Guía de nutrición — no hay menús con calorías, es una pauta cualitativa
// que aplica todos los días por igual (evitar hidratos refinados y azúcar
// a partir de la tarde, cenar siempre proteína magra + verde).
const MEALS_V2 = {
  label: "Cena limpia",
  zoneColor: "#3E7BFA",
  items: [
    { meal: "Evitar (sobre todo por la tarde)", text: "Carbohidratos refinados (pan blanco, pasta blanca, arroz blanco, harinas, masas de pizza, cereales refinados), azúcares ocultos y ultraprocesados (yogures de sabores, galletas incluso \"integrales\", barritas, salsas industriales, zumos envasados), refrescos (incluso Zero) y alcohol." },
    { meal: "Opción 1", text: "Filete de merluza, bacalao o lenguado a la plancha con espárragos trigueros y calabacín salteado." },
    { meal: "Opción 2", text: "Tortilla francesa de 2 huevos enteros y una clara con champiñones y espinacas." },
    { meal: "Opción 3", text: "Pechuga de pollo o pavo a la plancha con ensalada grande de lechuga, pepino y canónigos (1 cucharada de aceite de oliva y limón)." }
  ]
};

const V2_WEEKLY_REVIEW_NOTE = "Cada domingo, revisa 3 cosas: ¿completaste los 3 días de fuerza + cardio y los días de caminata? ¿cenaste limpio toda la semana y tomaste creatina y omega 3 sin falta? ¿las últimas repeticiones de cada ejercicio costaban de verdad? (si no, acorta el agarre de la goma el próximo lunes).";

const PHASES_V2 = [
  {
    id: 1,
    key: "choque12",
    shortLabel: "Plan de choque",
    name: "Brazos Firmes — Plan de Choque (12 semanas)",
    weeks: [1, 12],
    dateLabel: "12 semanas · 3 meses",
    weightFrom: null,
    weightTo: null,
    kcal: "Déficit ligero, más estricto por la tarde-noche",
    color: "#3E7BFA",
    summary: "12 semanas — el tiempo biológico que necesita el cuerpo para remodelar tejido muscular y contraer la piel. Combina fuerza con gomas, cardio suave en Zona 2 y una cena limpia cada noche para eliminar el efecto \"ala de murciélago\": el tríceps gana volumen magro que actúa como relleno natural, estirando la piel colgada.",
    focus: [
      "Fuerza con gomas + cardio suave, 3x/semana (lun/mié/vie)",
      "Creatina y Omega 3 todos los días, entrenes o no",
      "Proteína Whey solo los días de entreno, post-ejercicio inmediato",
      "Cena limpia siempre: proteína magra + verde, cero hidratos refinados por la tarde",
      "8.000–10.000 pasos los días de descanso activo (martes y jueves)"
    ]
  }
];

const WEEKLY_SCHEDULE_V2 = {
  mon: {
    dow: 1, label: "Lunes", type: "gym", typeLabel: "Fuerza + Cardio Z2 (55 min)",
    training: {
      title: "Sesión completa (55 min)",
      detail: "Calentamiento articular (5 min): círculos de hombros adelante y atrás, cruces de brazos por delante del pecho, subir y bajar los brazos estirados, y 2 min de trote muy suave para elevar la temperatura.",
      exercises: [
        { name: "Extensiones tras nuca con goma", sets: "4 x 15 por brazo", rest: "60s", note: "Pisa la goma, pásala por detrás de la espalda, codo pegado a la oreja sin moverse. Sube en 1s, baja muy lento en 3s." },
        { name: "Patada de tríceps con goma", sets: "4 x 12 por brazo", rest: "60s", note: "Engancha la goma en una puerta, tronco inclinado, codo pegado al costado sin moverse. Aprieta 1s atrás y vuelve despacio." },
        { name: "Flexiones de tríceps en sofá o pared", sets: "3 x 10–12", rest: "90s", note: "Manos a la anchura de los hombros. Los codos no se abren al bajar — rozan las costillas. Cuerpo firme como una tabla." }
      ],
      cardio: "Inmediatamente después de las flexiones: 30 minutos de carrera muy suave en Zona 2 — debes poder mantener una conversación sin ahogarte (\"test del habla\")."
    },
    meals: MEALS_V2, supplements: daySupplementsV2({ proteina: true })
  },
  tue: {
    dow: 2, label: "Martes", type: "active", typeLabel: "Descanso activo — caminar",
    training: { title: "Caminar a ritmo alegre", detail: "Cero entrenamientos de fuerza, cero carrera. Objetivo: 8.000–10.000 pasos en el móvil o reloj — puedes dividirlo en dos paseos de 30 minutos." },
    meals: MEALS_V2, supplements: daySupplementsV2({ proteina: false })
  },
  wed: {
    dow: 3, label: "Miércoles", type: "gym", typeLabel: "Fuerza + Cardio Z2 (55 min)",
    training: {
      title: "Sesión completa (55 min)",
      detail: "Calentamiento articular (5 min): círculos de hombros adelante y atrás, cruces de brazos por delante del pecho, subir y bajar los brazos estirados, y 2 min de trote muy suave para elevar la temperatura.",
      exercises: [
        { name: "Extensiones tras nuca con goma", sets: "4 x 15 por brazo", rest: "60s", note: "Sube en 1s, baja muy lento en 3s. Codo pegado a la oreja, no se mueve." },
        { name: "Patada de tríceps con goma", sets: "4 x 12 por brazo", rest: "60s", note: "Codo pegado al costado todo el recorrido. Aprieta 1s atrás y vuelve despacio." },
        { name: "Flexiones de tríceps en sofá o pared", sets: "3 x 10–12", rest: "90s", note: "Codos rozan las costillas al bajar. Cuerpo firme como una tabla." }
      ],
      cardio: "Inmediatamente después: 30 minutos de carrera muy suave en Zona 2 (\"test del habla\")."
    },
    meals: MEALS_V2, supplements: daySupplementsV2({ proteina: true })
  },
  thu: {
    dow: 4, label: "Jueves", type: "active", typeLabel: "Descanso activo — caminar",
    training: { title: "Caminar a ritmo alegre", detail: "Cero entrenamientos de fuerza, cero carrera. Objetivo: 8.000–10.000 pasos — puedes dividirlo en dos paseos de 30 minutos." },
    meals: MEALS_V2, supplements: daySupplementsV2({ proteina: false })
  },
  fri: {
    dow: 5, label: "Viernes", type: "gym", typeLabel: "Fuerza + Cardio Z2 (55 min)",
    training: {
      title: "Sesión completa (55 min)",
      detail: "Calentamiento articular (5 min): círculos de hombros adelante y atrás, cruces de brazos por delante del pecho, subir y bajar los brazos estirados, y 2 min de trote muy suave para elevar la temperatura.",
      exercises: [
        { name: "Extensiones tras nuca con goma", sets: "4 x 15 por brazo", rest: "60s", note: "Sube en 1s, baja muy lento en 3s. Codo pegado a la oreja, no se mueve." },
        { name: "Patada de tríceps con goma", sets: "4 x 12 por brazo", rest: "60s", note: "Codo pegado al costado todo el recorrido. Aprieta 1s atrás y vuelve despacio." },
        { name: "Flexiones de tríceps en sofá o pared", sets: "3 x 10–12", rest: "90s", note: "Codos rozan las costillas al bajar. Cuerpo firme como una tabla." }
      ],
      cardio: "Inmediatamente después: 30 minutos de carrera muy suave en Zona 2 (\"test del habla\")."
    },
    meals: MEALS_V2, supplements: daySupplementsV2({ proteina: true })
  },
  sat: {
    dow: 6, label: "Sábado", type: "active", typeLabel: "Descanso activo flexible o familiar",
    training: { title: "Movimiento libre", detail: "Paseo largo por la naturaleza, ruta de senderismo suave o bici — mínimo 60 minutos de movimiento libre, para liberar estrés y reducir el cortisol (la hormona que acumula grasa)." },
    meals: MEALS_V2, supplements: daySupplementsV2({ proteina: false })
  },
  sun: {
    dow: 0, label: "Domingo", type: "rest", typeLabel: "Descanso total y recuperación",
    training: { title: "Descanso total", detail: "Recuperación absoluta de músculos y piel. Cero obligación de pasos o ejercicio. Buen día para dejar cocinadas y organizadas las proteínas de las cenas de la semana." },
    meals: MEALS_V2, supplements: daySupplementsV2({ proteina: false }), note: V2_WEEKLY_REVIEW_NOTE
  }
};

function getDaySchedule_V2(weekNumber, dayKey) {
  const base = WEEKLY_SCHEDULE_V2[dayKey];
  if (!base) return null;
  const day = JSON.parse(JSON.stringify(base));
  day.key = dayKey;
  day.weekNumber = weekNumber;
  day.phase = PHASES_V2[0];
  return day;
}
function getPhaseForWeek_V2() { return PHASES_V2[0]; }
function getWeightTargetForWeek_V2() { return null; }
function getAllWeightTargetWeeks_V2() { return []; }
function isZoneReviewWeek_V2() { return false; }
function trainingDayKeysForWeek_V2() { return ["mon", "wed", "fri"]; }

const PLAN_V2_COPY = {
  welcomeTitle: "Tu plan de choque: Brazos Firmes",
  welcomeDesc: () => `12 semanas de fuerza con gomas, cardio suave en Zona 2 y cena limpia cada noche para eliminar el efecto "ala de murciélago" — piel más tersa y pegada al brazo, tríceps con volumen magro y mejor forma general.`,
  welcomeBadges: ["💪 12 semanas", "🎯 Piel firme y tersa"],
  preplanDesc: (startD) => `La semana 1 arranca el lunes ${startD}. Objetivo: 12 semanas de constancia para notar el cambio en la piel del brazo.`,
  preplanBadges: () => [`💪 Plan de choque de 12 semanas`, `🎯 Fuerza + cena limpia`],
  finishedTitle: "🏆 Has completado las 12 semanas",
  finishedDesc: (startWeight, currentWeight, totalWorkouts) => `${totalWorkouts} sesiones registradas por el camino. Si quieres mantener el resultado, puedes seguir repitiendo el mismo ciclo semanal desde el Calendario.`
};

/* ---------------------------------------------------------------------
   Activación / restauración del plan
   --------------------------------------------------------------------- */
function activatePlanV2() {
  PROFILE_DEFAULTS = PROFILE_DEFAULTS_V2;
  HR_ZONES = [];
  MILESTONES = [];
  SUPPLEMENTS = SUPPLEMENTS_V2;
  SUPPLEMENT_DETAILS = SUPPLEMENT_DETAILS_V2;
  WEEKLY_WEIGHTS_BLOQUE1 = [];
  PHASES = PHASES_V2;
  TOTAL_PLAN_WEEKS = 12;
  RACE_WEEK = -1;
  ZONE_REVIEW_INTERVAL_WEEKS = 999999;
  CALORIE_DICTIONARY = {};
  getDaySchedule = getDaySchedule_V2;
  getPhaseForWeek = getPhaseForWeek_V2;
  getWeightTargetForWeek = getWeightTargetForWeek_V2;
  getAllWeightTargetWeeks = getAllWeightTargetWeeks_V2;
  isZoneReviewWeek = isZoneReviewWeek_V2;
  trainingDayKeysForWeek = trainingDayKeysForWeek_V2;
  PLAN_COPY = PLAN_V2_COPY;
  PLAN_MODE = "v2";
}

function activatePlanV1() {
  PROFILE_DEFAULTS = PLAN_V1_SNAPSHOT.PROFILE_DEFAULTS;
  HR_ZONES = PLAN_V1_SNAPSHOT.HR_ZONES;
  MILESTONES = PLAN_V1_SNAPSHOT.MILESTONES;
  SUPPLEMENTS = PLAN_V1_SNAPSHOT.SUPPLEMENTS;
  SUPPLEMENT_DETAILS = PLAN_V1_SNAPSHOT.SUPPLEMENT_DETAILS;
  WEEKLY_WEIGHTS_BLOQUE1 = PLAN_V1_SNAPSHOT.WEEKLY_WEIGHTS_BLOQUE1;
  PHASES = PLAN_V1_SNAPSHOT.PHASES;
  TOTAL_PLAN_WEEKS = PLAN_V1_SNAPSHOT.TOTAL_PLAN_WEEKS;
  RACE_WEEK = PLAN_V1_SNAPSHOT.RACE_WEEK;
  ZONE_REVIEW_INTERVAL_WEEKS = PLAN_V1_SNAPSHOT.ZONE_REVIEW_INTERVAL_WEEKS;
  CALORIE_DICTIONARY = PLAN_V1_SNAPSHOT.CALORIE_DICTIONARY;
  getDaySchedule = PLAN_V1_SNAPSHOT.getDaySchedule;
  getPhaseForWeek = PLAN_V1_SNAPSHOT.getPhaseForWeek;
  getWeightTargetForWeek = PLAN_V1_SNAPSHOT.getWeightTargetForWeek;
  getAllWeightTargetWeeks = PLAN_V1_SNAPSHOT.getAllWeightTargetWeeks;
  isZoneReviewWeek = PLAN_V1_SNAPSHOT.isZoneReviewWeek;
  trainingDayKeysForWeek = PLAN_V1_SNAPSHOT.trainingDayKeysForWeek;
  PLAN_COPY = PLAN_V1_COPY_SNAPSHOT;
  PLAN_MODE = "v1";
}

// Decide qué plan activar según el email de la cuenta que ha iniciado sesión.
// Se llama desde app.js en cuanto Firebase resuelve quién eres.
function applyPlanForEmail(email) {
  const shouldBeV2 = (email || "").toLowerCase() === PLAN_V2_EMAIL;
  if (shouldBeV2 && PLAN_MODE !== "v2") activatePlanV2();
  else if (!shouldBeV2 && PLAN_MODE !== "v1") activatePlanV1();
}
