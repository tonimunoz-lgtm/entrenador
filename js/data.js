/* ==========================================================================
   FORJA21 — Datos del plan (entreno, nutrición, peso, suplementación)
   Extraído y estructurado a partir del manual del usuario.
   ========================================================================== */

let PROFILE_DEFAULTS = {
  name: "Atleta",
  startDate: "2026-08-24",          // Lunes de la semana 1 (editable en Ajustes). Las semanas van de lunes a domingo.
  raceDate: "2027-01-24",           // Mitja Marató de Granollers
  raceGoal: "Sub 1h 43min · 4:45–4:50 min/km",
  startWeight: 87.5,
  fcr: 46,                          // frecuencia cardiaca reposo
  fcm: 160,                         // frecuencia cardiaca máxima
  z2max: 126,
  notificationsEnabled: false
};

let HR_ZONES = [
  { key: "z1", label: "Z1 · Muy suave", color: "#6B7784", range: "<115 ppm", min: null, max: 115 },
  { key: "z2", label: "Z2 · Aeróbico (base)", color: "#3E7BFA", range: "115–126 ppm", min: 115, max: 126 },
  { key: "z3", label: "Z3 · Tempo", color: "#22C55E", range: "127–137 ppm", min: 127, max: 137 },
  { key: "z4", label: "Z4 · Umbral", color: "#F5B400", range: "138–148 ppm", min: 138, max: 148 },
  { key: "z5", label: "Z5 · Máximo", color: "#EF4444", range: ">148 ppm", min: 148, max: null }
];

// Hitos fijos del calendario real (no dependen de la semana calculada, son fechas de verdad)
let MILESTONES = [
  { date: "2027-01-24", icon: "🏁", label: "Mitja Marató de Granollers", desc: "Objetivo: sub 1h 43min a 4:45–4:50 min/km, pesando 75.5 kg." },
  { date: "2027-06-24", icon: "🏆", label: "Objetivo final (Sant Joan)", desc: "Cuerpo definido: 71–72 kg, abdominales visibles." }
];

let SUPPLEMENTS = [
  { id: "multi", name: "Multivitamínico", brand: "Supradyn Activo / Multicentrum Hombre", when: "Cada mañana con el desayuno", icon: "sun" },
  { id: "creatina", name: "Creatina monohidrato", brand: "HSN Raw Monohidrato (Creapure)", when: "5 g en agua, en días de gimnasio / calidad / tirada", icon: "bolt" },
  { id: "proteina", name: "Proteína Whey Isolate", brand: "HSN Evowhey Isolate 2.0 / Myprotein Impact Whey Isolate", when: "1 cacito post-entreno (pesas/HIIT)", icon: "shake" },
  { id: "omega3", name: "Omega 3", brand: "EnerZona Omega 3 RX / Solgar Omega 3", when: "2 cápsulas cada noche con la cena", icon: "moon" }
];

/* ---------------------------------------------------------------------
   BLOQUE 1 — Camino a la Mitja de Granollers (semanas 1–22)
   Peso objetivo semana a semana (pesaje: sábado en ayunas)
   --------------------------------------------------------------------- */
let WEEKLY_WEIGHTS_BLOQUE1 = [
  { week: 1, weight: 86.9 }, { week: 2, weight: 86.4 }, { week: 3, weight: 85.8 },
  { week: 4, weight: 85.3, note: "Actualizar peso en Garmin Connect" },
  { week: 5, weight: 84.7 }, { week: 6, weight: 84.2 }, { week: 7, weight: 83.6 },
  { week: 8, weight: 83.1, note: "Fin del bloque caminar-correr puro" },
  { week: 9, weight: 82.5 }, { week: 10, weight: 82.0 }, { week: 11, weight: 81.4 },
  { week: 12, weight: 80.9 },
  { week: 13, weight: 80.3, note: "Actualizar peso en Garmin. Ya corres 14–16 km del tirón" },
  { week: 14, weight: 79.8 }, { week: 15, weight: 79.2 }, { week: 16, weight: 78.7 },
  { week: 17, weight: 78.1 },
  { week: 18, weight: 77.6, note: "Test general de 20 km" },
  { week: 19, weight: 77.0 }, { week: 20, weight: 76.5 },
  { week: 21, weight: 76.0, note: "Semana de descarga profunda / tapering" },
  { week: 22, weight: 75.5, note: "¡Objetivo cumplido! Mitja Marató de Granollers" }
];

/* ---------------------------------------------------------------------
   FASE 3 — Peso objetivo semana a semana (semanas 23–32, Febrero-Abril 2027)
   --------------------------------------------------------------------- */
const WEEKLY_WEIGHTS_FASE3 = [
  { week: 23, weight: 75.5, note: "Post-Granollers — inicio de Fase 3" },
  { week: 24, weight: 75.8 },
  { week: 25, weight: 76.1 },
  { week: 26, weight: 76.4 },
  { week: 27, weight: 76.7, note: "Actualizar peso en Garmin Connect para calibrar calorías" },
  { week: 28, weight: 77.0 },
  { week: 29, weight: 77.3 },
  { week: 30, weight: 77.6 },
  { week: 31, weight: 77.9 },
  { week: 32, weight: 78.5, note: "¡Base muscular lista para la Fase 4!" }
];

/* ---------------------------------------------------------------------
   FASE 4 — Peso objetivo semana a semana (semanas 33–40, Mayo-Junio 2027)
   --------------------------------------------------------------------- */
const WEEKLY_WEIGHTS_FASE4 = [
  { week: 33, weight: 78.5, note: "Inicio de Fase 4 — mes de mayo" },
  { week: 34, weight: 77.6 },
  { week: 35, weight: 76.7 },
  { week: 36, weight: 75.8 },
  { week: 37, weight: 74.9, note: "Inicio de junio" },
  { week: 38, weight: 74.0 },
  { week: 39, weight: 73.1 },
  { week: 40, weight: 71.5, note: "¡Abdominales completamente destapados!" }
];

function getAllWeightTargetWeeks() {
  return [...WEEKLY_WEIGHTS_BLOQUE1, ...WEEKLY_WEIGHTS_FASE3, ...WEEKLY_WEIGHTS_FASE4].map(w => w.week).sort((a, b) => a - b);
}

/* ---------------------------------------------------------------------
   FASES (5 fases a lo largo de todo el plan)
   --------------------------------------------------------------------- */
let PHASES = [
  {
    id: 1,
    key: "fase1",
    shortLabel: "Fase 1",
    name: "Base Aeróbica, Fuerza y CaCo",
    weeks: [1, 8],
    dateLabel: "Agosto — Octubre 2026",
    weightFrom: 87.5,
    weightTo: 83.1,
    kcal: "1.850 – 1.900 kcal",
    macroFocus: "Proteína alta, hidrato moderado/bajo",
    color: "#3E7BFA",
    summary: "Adaptación articular y control estricto de Zona 2 para evitar fascitis y dolor de cadera. Déficit calórico moderado con recorte de hidratos en días de descanso.",
    focus: ["Control estricto de Zona 2", "Fuerza general 2x/semana", "Caminar-Correr progresivo los sábados"]
  },
  {
    id: 2,
    key: "fase1b",
    shortLabel: "Fase 1B",
    name: "Transición, Fondo y Carga",
    weeks: [9, 13],
    dateLabel: "Octubre — Noviembre 2026",
    weightFrom: 83.1,
    weightTo: 80.3,
    kcal: "1.850 – 1.900 kcal",
    macroFocus: "Proteína alta, hidrato moderado/bajo",
    color: "#2DD4BF",
    summary: "Se eliminan los tramos caminando de los sábados: los rodajes pasan a ser continuos, de 14 a 16 km, en Zona 2 pura. Se mantiene la estructura nutricional, subiendo el agua a 3,5 L/día.",
    focus: ["Rodajes continuos sin caminar", "14–16 km en Zona 2 pura", "Agua 3,5 L/día"]
  },
  {
    id: 3,
    key: "fase2",
    shortLabel: "Fase 2",
    name: "Ritmo Específico Gran Ollers",
    weeks: [14, 22],
    dateLabel: "Noviembre 2026 — Enero 2027",
    weightFrom: 80.3,
    weightTo: 75.5,
    kcal: "2.100 kcal días de calidad · 1.750 kcal días de descanso",
    macroFocus: "Ciclado de hidratos (carga para las series)",
    color: "#8B5CF6",
    summary: "Objetivo: clavar el ritmo de carrera de 4:45–4:50 min/km. Ciclado estricto de hidratos, potencia en el gimnasio y series largas de umbral los viernes.",
    focus: ["Series de umbral (3.000 m) los viernes", "Sentadillas explosivas para la subida a La Garriga", "Tirada larga con bloques de ritmo", "Semana 22: ¡carrera!"],
    raceWeek: 22
  },
  {
    id: 4,
    key: "fase3",
    shortLabel: "Fase 3",
    name: "Construcción Muscular",
    weeks: [23, 32],
    dateLabel: "Febrero — Abril 2027",
    weightFrom: 75.5,
    weightTo: 78.5,
    kcal: "2.450 – 2.500 kcal",
    macroFocus: "Superávit neto. Carbohidratos altos",
    color: "#FB923C",
    summary: "Subida controlada de músculo neto (~300 g/semana): 4 días de gimnasio de hipertrofia (8–10 repeticiones), running regenerativo en Zona 2, y vacío abdominal cada mañana en ayunas para mantener la cintura estrecha mientras ganas volumen.",
    focus: ["Hipertrofia 8–10 repeticiones", "Vacío abdominal diario en ayunas", "Plátano post-entreno obligatorio", "Arroz y pasta se mantienen al mediodía"]
  },
  {
    id: 5,
    key: "fase4",
    shortLabel: "Fase 4",
    name: "El Destape Final y Abdominales",
    weeks: [33, 40],
    dateLabel: "Mayo — Junio 2027",
    weightFrom: 78.5,
    weightTo: 71.5,
    kcal: "1.650 – 1.700 kcal",
    macroFocus: "Restricción estricta. Hidratos cero por la tarde",
    color: "#EC4899",
    summary: "Bajada definitiva hasta 71–72 kg reales. Corte de hidratos a partir de las 16:00, agua a 4 L/día y HIIT en cinta tras las pesas pesadas para máxima definición.",
    focus: ["Hidratos solo en desayuno y comida", "HIIT post-pesas (10x30s Z5 + 1' caminando)", "Agua 4 L/día", "Cena clínica de definición"]
  }
];

// El plan tiene una duración fija — más allá de esta semana se considera completado.
let TOTAL_PLAN_WEEKS = PHASES[PHASES.length - 1].weeks[1];
let RACE_WEEK = PHASES.find(p => p.raceWeek)?.raceWeek || 22;

// Cada cuántas semanas conviene revisar las zonas de FC (FCR/FCM cambian con la forma física)
let ZONE_REVIEW_INTERVAL_WEEKS = 4;
function isZoneReviewWeek(weekNumber) {
  return weekNumber >= 1 && (weekNumber - 1) % ZONE_REVIEW_INTERVAL_WEEKS === 0;
}

/* ---------------------------------------------------------------------
   HORARIO SEMANAL — FASE 1 y 1B (semanas 1–13)
   Cada día: tipo, entreno, comidas, suplementos del día
   --------------------------------------------------------------------- */

const MEALS_GREEN = { // Lunes, Miércoles, Domingo
  label: "Menú limpio (bajo en hidratos)",
  zoneColor: "#22C55E",
  totalKcal: 945,
  macros: { protein: 95, carbs: 60, fat: 30 },
  items: [
    { meal: "Desayuno", text: "Tortilla de 1 huevo entero + 2 claras. Café solo.", kcal: 115 },
    { meal: "Comida", text: "200 g de pechuga de pollo a la plancha + 250 g de brócoli al vapor + 40 g (en seco) de arroz integral.", kcal: 455 },
    { meal: "Merienda", text: "1 yogur griego ligero (0%) + 20 g de nueces naturales.", kcal: 180 },
    { meal: "Cena", text: "Crema de calabacín y puerro (sin nata) + 150 g de merluza al horno con limón.", kcal: 195 }
  ]
};

const MEALS_YELLOW = { // Martes, Jueves — gimnasio de fuerza
  label: "Menú de energía muscular",
  zoneColor: "#F5B400",
  totalKcal: 1880,
  macros: { protein: 155, carbs: 160, fat: 55 },
  items: [
    { meal: "Desayuno", text: "40 g de copos de avena cocidos con agua + 1 manzana + canela. Café solo.", kcal: 320 },
    { meal: "Comida", text: "200 g de lomo de cerdo magro (o ternera) + 60 g (en seco) de pasta integral o quinoa + ensalada grande. Toma los 5 g de Creatina en agua.", kcal: 620 },
    { meal: "Merienda (1h antes de entrenar)", text: "1 plátano + 3 lonchas de pavo. Café solo.", kcal: 190 },
    { meal: "Post-entreno", text: "1 batido de proteína Whey Isolate con agua fría, justo al acabar las pesas.", kcal: 110 },
    { meal: "Cena", text: "Revuelto de 3 claras y 1 huevo entero con champiñones (o gambas) + 1 tomate aliñado.", kcal: 310 },
    { meal: "Extra del día", text: "Aceite de cocinar, el Omega 3 de la noche y otros extras sueltos.", kcal: 330 }
  ]
};

const MEALS_ORANGE = { // Viernes — carrera de calidad
  label: "Menú de carga rápida",
  zoneColor: "#FB923C",
  totalKcal: 995,
  macros: { protein: 80, carbs: 115, fat: 25 },
  items: [
    { meal: "Desayuno", text: "1 tostada integral con tomate triturado y 50 g de requesón. Café solo.", kcal: 165 },
    { meal: "Comida", text: "200 g de pechuga de pavo + 250 g de patata cocida + espárragos. Toma los 5 g de Creatina.", kcal: 460 },
    { meal: "Merienda (1h antes de correr)", text: "2 tortitas de arroz con una cucharada de crema de cacahuete pura.", kcal: 195 },
    { meal: "Cena", text: "150 g de sepia (o emperador) a la plancha con ajo y perejil + caldo de verduras limpio.", kcal: 175 }
  ]
};

const MEALS_LONGRUN = { // Sábado — tirada larga
  label: "Menú de la tirada larga",
  zoneColor: "#EF4444",
  totalKcal: 1000,
  macros: { protein: 85, carbs: 100, fat: 30 },
  items: [
    { meal: "Pre-carrera (60 min antes)", text: "1 café solo cargado + 1 plátano (o tostada con miel).", kcal: 110 },
    { meal: "Durante", text: "Agua con una pastilla de electrolitos (Isostar o 226ers), a partir de los 60 min.", kcal: 0 },
    { meal: "Comida (post-tirada)", text: "100 g (en seco) de arroz o pasta integral + 200 g de salmón a la plancha + verduras. Toma los 5 g de Creatina.", kcal: 490 },
    { meal: "Merienda", text: "200 g de queso fresco batido 0% con arándanos.", kcal: 150 },
    { meal: "Cena", text: "Tortilla francesa de 2 huevos con una lata de atún al natural.", kcal: 250 }
  ]
};

const MEALS_SUNDAY_NIGHT_NOTE = "Cena suave para dormir bien: tortilla francesa de 2 huevos con atún natural + infusión de manzanilla o poleo-menta.";

function daySupplements({ multi = true, creatina = false, proteina = false, omega3 = true } = {}) {
  const list = [];
  if (multi) list.push("multi");
  if (creatina) list.push("creatina");
  if (proteina) list.push("proteina");
  if (omega3) list.push("omega3");
  return list;
}

// Base weekly schedule shared by Fase 1 y Fase 1B (1B solo cambia el sábado, ver abajo)
const WEEKLY_SCHEDULE_BASE = {
  mon: {
    dow: 1, label: "Lunes", type: "rest", typeLabel: "Descanso total",
    training: {
      title: "Rutina espalda sana",
      detail: "Cero impacto. Rutina postural antes de dormir:",
      items: [
        { name: "Gato-Camello", note: "12 repeticiones" },
        { name: "Estiramiento piramidal", note: "30 segundos por lado" }
      ]
    },
    meals: MEALS_GREEN, supplements: daySupplements()
  },
  tue: {
    dow: 2, label: "Martes", type: "gym", typeLabel: "Gimnasio · Torso + escudo cervical",
    training: {
      title: "Fuerza (45 min)",
      exercises: [
        { name: "Jalón al pecho (polea alta)", sets: "3 x 10", rest: "90s", note: "Barra al pecho, nunca detrás del cuello." },
        { name: "Remo sentado (polea baja, agarre cerrado)", sets: "3 x 10", rest: "90s", note: "Junta escápulas." },
        { name: "Press de banca con mancuernas", sets: "3 x 8", rest: "90s" },
        { name: "Plancha frontal isométrica", sets: "3 x 45s", rest: "60s" }
      ]
    },
    meals: MEALS_YELLOW, supplements: daySupplements({ creatina: true, proteina: true })
  },
  wed: {
    dow: 3, label: "Miércoles", type: "active", typeLabel: "Descanso activo",
    training: { title: "Caminar", detail: "30–40 minutos a ritmo ligero, por la tarde." },
    meals: MEALS_GREEN, supplements: daySupplements()
  },
  thu: {
    dow: 4, label: "Jueves", type: "gym", typeLabel: "Gimnasio (pierna) + Cardio Z2",
    training: {
      title: "Fuerza (30 min) + Cinta",
      exercises: [
        { name: "Prensa de piernas inclinada", sets: "3 x 10", rest: "90s", note: "Empuja con los talones." },
        { name: "Zancadas estáticas con mancuernas", sets: "3 x 8 por pierna", rest: "60s" },
        { name: "Elevación de talones en escalón (gemelos)", sets: "4 x 12", rest: "45s", note: "Baja muy lento para evitar fascitis." }
      ],
      cardio: "Cinta inmediatamente después: 35 min (sem. 1–4) → sube a 45 min (sem. 5–8). Inclinación 1.0%. Mantener Garmin en Zona 2 (115–126 ppm)."
    },
    meals: MEALS_YELLOW, supplements: daySupplements({ creatina: true, proteina: true })
  },
  fri: {
    dow: 5, label: "Viernes", type: "quality", typeLabel: "Carrera de calidad (corta)",
    training: {
      title: "Ritmo (40 min)",
      blocks: [
        { range: "Min 0–10", text: "Trote de calentamiento → Zona 2 (115–126 ppm)." },
        { range: "Min 10–30 (tempo)", text: "Sem. 1–4: Zona 3 (127–137 ppm) a ~5:10 min/km. Sem. 5–8: 4 series de 3 min en Zona 4 (138–148 ppm) a ~4:55 min/km, recuperando 2 min en Zona 2." },
        { range: "Min 30–40", text: "Trote de enfriamiento → Zona 2." }
      ]
    },
    meals: MEALS_ORANGE, supplements: daySupplements({ creatina: true })
  },
  sat: {
    dow: 6, label: "Sábado", type: "long", typeLabel: "Tirada larga (exterior)",
    isWeighDay: true,
    training: {
      title: "Fondo — mantener siempre Zona 2 (115–126 ppm)",
      byWeek: {
        1: "12 km (corre 8 min / camina 1 min)", 2: "13 km (CaCo)", 3: "14 km (CaCo)", 4: "12 km continuo, sin caminar",
        5: "15 km continuo", 6: "16 km continuo", 7: "17 km (máximo volumen)", 8: "12 km (descarga)",
        9: "14 km continuo Z2", 10: "15 km continuo Z2", 11: "15 km continuo Z2", 12: "16 km continuo Z2", 13: "16 km continuo Z2"
      }
    },
    meals: MEALS_LONGRUN, supplements: daySupplements({ creatina: true })
  },
  sun: {
    dow: 0, label: "Domingo", type: "rest", typeLabel: "Descanso total",
    training: { title: "Descanso total", detail: "Sin entreno. Aprovecha para dormir bien." },
    meals: MEALS_GREEN, supplements: daySupplements(), note: MEALS_SUNDAY_NIGHT_NOTE
  }
};

// Fase 2 (semanas 14–22): modificaciones sobre martes, jueves, viernes y sábado
const PHASE2_LONGRUN_BY_WEEK = {
  14: "16 km (10 km suaves + 6 km finales a 4:45 min/km)",
  15: "17 km (10 km suaves + 7 km finales a 4:45 min/km)",
  16: "18 km (10 km suaves + 8 km finales a 4:45 min/km)",
  17: "19 km (9 km suaves + 10 km finales a 4:45 min/km)",
  18: "20 km · Test general (10 km suaves + 10 km a 4:45 min/km)",
  19: "16 km con 8 km a ritmo objetivo",
  20: "14 km con 6 km a ritmo objetivo",
  21: "12 km suaves (descarga absoluta / tapering)",
  22: "Activación suave 15–20 min + un par de progresiones cortas. Nada de kilómetros de más — mañana es la carrera."
};

// Menú del sábado antes de la carrera — carga de hidratos, nada de experimentos
const MEALS_PRE_RACE = {
  label: "Carga de hidratos pre-carrera",
  zoneColor: "#FFD84D",
  items: [
    { meal: "Nota", text: "Hoy toca cargar hidratos, no quemarlos: sube la comida del mediodía a 100 g (en seco) de pasta o arroz. Cena ligera en hidratos de fácil digestión (arroz blanco, pasta, patata) y evita fibra o grasa en exceso — nada nuevo que pueda sentar mal mañana." },
    { meal: "Antes de dormir", text: "Deja preparados el desayuno, el dorsal, la ropa y los geles para mañana." }
  ]
};

// Menú específico del día de carrera (domingo, semana 22)
const MEALS_RACE_DAY = {
  label: "Día de carrera",
  zoneColor: "#FFD84D",
  totalKcal: 1550,
  macros: { protein: 95, carbs: 230, fat: 30 },
  items: [
    { meal: "Desayuno (3h antes)", text: "Tostadas con miel o mermelada + un plátano + café solo. Nada nuevo ni raro — lo de siempre en tus tiradas largas.", kcal: 330 },
    { meal: "Pre-salida (30–45 min antes)", text: "Un gel o media barrita energética + agua.", kcal: 100 },
    { meal: "Durante la carrera", text: "Un gel cada 45 min aprox. + agua o bebida isotónica en los avituallamientos.", kcal: 200 },
    { meal: "Justo al terminar", text: "El batido de proteína Whey Isolate + un plátano, dentro de los primeros 30 minutos.", kcal: 220 },
    { meal: "Comida de recuperación", text: "Plato copioso con hidratos y proteína — pasta o arroz con pollo o salmón. Hoy toca disfrutar la comida sin restricción.", kcal: 700 }
  ]
};

const WEEKLY_SCHEDULE_PHASE2_OVERRIDES = {
  tue: {
    typeLabel: "Gimnasio de potencia + Core oblicuos",
    training: {
      title: "Fuerza-potencia (40 min)",
      exercises: [
        { name: "Sentadillas explosivas con mancuernas", sets: "3 x 8", rest: "90s", note: "Baja en 3s, sube explosivo en 1s — potencia para la subida a La Garriga." },
        { name: "Plancha lateral isométrica", sets: "3 x 30s por lado", rest: "45s", note: "Trabaja oblicuos sin forzar el cuello." },
        { name: "Jalón al pecho (polea alta)", sets: "3 x 10", rest: "90s" },
        { name: "Remo sentado", sets: "3 x 10", rest: "90s" }
      ]
    }
  },
  thu: {
    typeLabel: "Gimnasio (pierna) + Cardio Z2 ampliada",
    training: {
      title: "Fuerza (30 min) + Cinta ampliada",
      exercises: [
        { name: "Prensa de piernas inclinada", sets: "3 x 10", rest: "90s" },
        { name: "Zancadas estáticas con mancuernas", sets: "3 x 8 por pierna", rest: "60s" },
        { name: "Elevación de talones en escalón", sets: "4 x 12", rest: "45s" }
      ],
      cardio: "Cinta: 50 minutos continuos clavados en Zona 2 (115–126 ppm)."
    }
  },
  fri: {
    typeLabel: "Series largas de umbral (clave)",
    training: {
      title: "Umbral (≈70 min)",
      blocks: [
        { range: "Calentamiento", text: "10 minutos suaves, Zona 2." },
        { range: "Series", text: "3 series de 3.000 m a 4:40–4:45 min/km (el pulso entrará en Zona 4, 138–148 ppm), con 3 min de trote suave de recuperación entre series." },
        { range: "Enfriamiento", text: "10 minutos suaves." }
      ],
      note: "Café doble 45 minutos antes de entrenar."
    }
  },
  sat: {
    training: { title: "Tirada larga con bloques de ritmo — Zona 2 + tramo a ritmo objetivo", byWeek: PHASE2_LONGRUN_BY_WEEK }
  }
};

// Menús de Fase 2 (ciclado de hidratos por tipo de día)
const MEALS_PHASE2_LOAD = { // Martes, Viernes, Sábado — días de carga
  label: "Día de carga (más hidratos)",
  zoneColor: "#F5B400",
  items: [
    { meal: "Nota", text: "La comida del mediodía incluye 100 g (en seco) de pasta o arroz integral — tu cuerpo consume mucho glucógeno con las series de 3.000 m." }
  ]
};
const MEALS_PHASE2_LOW = { // Lunes, Miércoles, Domingo — recorte de hidratos
  label: "Día de recorte (menos hidratos)",
  zoneColor: "#22C55E",
  items: [
    { meal: "Nota", text: "Recorta el hidrato del mediodía a solo 30 g de arroz o 150 g de patata, aumentando la verdura, para tirar de la grasa abdominal residual." }
  ]
};

/* ---------------------------------------------------------------------
   FASE 3 — Construcción Muscular (semanas 23–32, Febrero-Abril 2027)
   Calendario día a día completo.
   --------------------------------------------------------------------- */

const FASE3_RULES_NOTE = "Las 3 normas del volumen neto: el arroz y la pasta se mantienen al mediodía (a diferencia de la Fase 4, aquí sí necesitas hidratos por la tarde para mover pesos pesados), no te saltes el vacío abdominal cada mañana en ayunas (mantiene el transverso tenso mientras ganas volumen), y el plátano post-entreno es obligatorio para abrir la puerta celular a la proteína.";

const MEALS_FASE3_MON = { // Lunes, Martes — días de pesos fuertes
  label: "Menú de hipertrofia",
  zoneColor: "#F5B400",
  totalKcal: 2480,
  macros: { protein: 175, carbs: 270, fat: 65 },
  items: [
    { meal: "Desayuno", text: "Tortilla de 2 huevos enteros + 2 claras + 1 tostada integral grande con medio aguacate chafado. Café con un chorro de leche desnatada.", kcal: 490 },
    { meal: "Comida", text: "220 g de pechuga de pavo a la plancha + 90 g (en seco) de arroz integral + un plato grande de verduras salteadas (calabacín, champiñones) con aceite de oliva.", kcal: 740 },
    { meal: "Merienda (pre-entreno, 17:00)", text: "Un bol con 60 g de copos de avena mezclados con leche desnatada y un cacito de proteína Whey Isolate.", kcal: 430 },
    { meal: "Post-entreno", text: "1 plátano maduro inmediatamente al terminar las pesas.", kcal: 110 },
    { meal: "Cena", text: "200 g de filete de salmón al horno + puré de calabaza con un chorrito de aceite de oliva.", kcal: 450 },
    { meal: "Extra del día", text: "Aceites de cocinar, la Creatina y el Omega 3.", kcal: 260 }
  ]
};

const MEALS_FASE3_TUE = { // Martes, Jueves (mismo menú)
  label: "Menú de hipertrofia",
  zoneColor: "#F5B400",
  totalKcal: 2350,
  macros: { protein: 175, carbs: 235, fat: 65 },
  items: [
    { meal: "Desayuno", text: "Mismo desayuno del huevo y el aguacate.", kcal: 490 },
    { meal: "Comida", text: "220 g de filete de ternera magra + 90 g (en seco) de pasta integral + ensalada variada con tomate. Toma la Creatina aquí.", kcal: 660 },
    { meal: "Merienda", text: "El mismo bol de avena con leche y proteína.", kcal: 430 },
    { meal: "Post-entreno", text: "1 plátano maduro.", kcal: 110 },
    { meal: "Cena", text: "200 g de dorada o lubina al horno con patatas panadera y cebolla.", kcal: 400 },
    { meal: "Extra del día", text: "Aceites de cocinar y el Omega 3.", kcal: 260 }
  ]
};

const MEALS_FASE3_WED = { // Miércoles, Domingo
  label: "Menú de mantenimiento energético",
  zoneColor: "#22C55E",
  totalKcal: 1780,
  macros: { protein: 140, carbs: 175, fat: 55 },
  items: [
    { meal: "Desayuno", text: "Tortilla de 2 huevos enteros + 2 claras + 1 tostada integral con miel y queso fresco.", kcal: 380 },
    { meal: "Comida", text: "220 g de pechuga de pollo + 250 g de patata hervida + un plato grande de brócoli al vapor.", kcal: 580 },
    { meal: "Merienda", text: "200 g de queso fresco batido 0% con un puñado de nueces y un toque de canela.", kcal: 250 },
    { meal: "Cena", text: "Tortilla francesa de 3 huevos con dos latas de atún al natural + crema de verduras limpia.", kcal: 480 },
    { meal: "Extra del día", text: "Aceites de cocinar y el Omega 3.", kcal: 90 }
  ]
};

const MEALS_FASE3_SAT = { // Sábado — carga limpia de fin de semana
  label: "Carga limpia de fin de semana",
  zoneColor: "#FFD84D",
  totalKcal: 1700,
  macros: { protein: 115, carbs: 195, fat: 45 },
  items: [
    { meal: "Desayuno", text: "Tortilla francesa de 2 huevos enteros con 1 tostada integral con aceite de oliva.", kcal: 280 },
    { meal: "Comida", text: "Un buen plato de pasta integral (90 g en seco) con carne picada de pollo o ternera magra y tomate natural.", kcal: 570 },
    { meal: "Merienda", text: "200 g de yogur griego 0% con arándanos y un puñado de almendras.", kcal: 300 },
    { meal: "Cena", text: "200 g de merluza o bacalao a la plancha con una patata hervida pequeña y espárragos verdes.", kcal: 300 },
    { meal: "Extra del día", text: "Aceites de cocinar, la Creatina y el Omega 3.", kcal: 250 }
  ]
};

const WEEKLY_SCHEDULE_FASE3 = {
  mon: {
    dow: 1, label: "Lunes", type: "gym", typeLabel: "Gimnasio (Torso: Pecho/Tríceps) + Vacuum",
    training: {
      title: "Fuerza — hipertrofia (45 min)",
      items: [
        { name: "Vacío abdominal (Stomach Vacuum)", note: "3 series de 30 segundos, en ayunas por la mañana. Expulsa el aire, mete la tripa escondiendo el ombligo bajo las costillas y aguanta." }
      ],
      exercises: [
        { name: "Press de banca inclinado con mancuernas", sets: "4 x 8", rest: "90s", note: "Pecho alto. La última repetición de cada serie tiene que costar de verdad." },
        { name: "Press de banca plano con barra o mancuernas", sets: "4 x 10", rest: "90s" },
        { name: "Cruces en polea (aperturas)", sets: "3 x 10", rest: "60s" },
        { name: "Extensión de tríceps en polea alta", sets: "4 x 10", rest: "60s" }
      ]
    },
    meals: MEALS_FASE3_MON, supplements: daySupplements({ creatina: true, proteina: true }), note: FASE3_RULES_NOTE
  },
  tue: {
    dow: 2, label: "Martes", type: "gym", typeLabel: "Gimnasio (Piernas completas) + Vacuum",
    training: {
      title: "Fuerza — hipertrofia (45 min)",
      items: [
        { name: "Vacío abdominal (Stomach Vacuum)", note: "3 series de 30 segundos, en ayunas por la mañana." }
      ],
      exercises: [
        { name: "Prensa de piernas inclinada", sets: "4 x 8", rest: "90s", note: "Sube el peso respecto a fases anteriores." },
        { name: "Extensiones de cuádriceps en máquina", sets: "4 x 10", rest: "60s" },
        { name: "Curl de femoral tumbado", sets: "4 x 10", rest: "60s" },
        { name: "Elevación de talones en escalón (gemelos)", sets: "4 x 15", rest: "45s", note: "Muy importante para mantener a raya la fascia." }
      ]
    },
    meals: MEALS_FASE3_TUE, supplements: daySupplements({ creatina: true, proteina: true }), note: FASE3_RULES_NOTE
  },
  wed: {
    dow: 3, label: "Miércoles", type: "quality", typeLabel: "Running regenerativo Z2 + Vacuum",
    training: {
      title: "Carrera suave (45 min)",
      items: [
        { name: "Vacío abdominal (Stomach Vacuum)", note: "3 series de 30 segundos, en ayunas por la mañana." }
      ],
      detail: "Cero cinta, mejor al exterior si puedes. Rodaje completamente libre y suave de 8–10 km. El único objetivo es mantener la aguja del Garmin clavada en Zona 2 (115–126 ppm) — mantiene tu capacidad aeróbica sin interferir con el crecimiento muscular."
    },
    meals: MEALS_FASE3_WED, supplements: daySupplements({ creatina: true }), note: FASE3_RULES_NOTE
  },
  thu: {
    dow: 4, label: "Jueves", type: "gym", typeLabel: "Gimnasio (Torso: Espalda/Bíceps) + Vacuum",
    training: {
      title: "Fuerza — hipertrofia (45 min)",
      items: [
        { name: "Vacío abdominal (Stomach Vacuum)", note: "3 series de 30 segundos, en ayunas por la mañana." }
      ],
      exercises: [
        { name: "Jalón al pecho en polea alta (agarre amplio)", sets: "4 x 8", rest: "90s", note: "Día vital para dar aspecto de \"V\" a la espalda." },
        { name: "Remo en polea baja o remo con barra", sets: "4 x 10", rest: "90s" },
        { name: "Elevaciones laterales con mancuernas", sets: "4 x 12", rest: "60s", note: "Da redondez al hombro." },
        { name: "Curl de bíceps alterno con mancuernas", sets: "4 x 10", rest: "60s" }
      ]
    },
    meals: MEALS_FASE3_TUE, supplements: daySupplements({ creatina: true, proteina: true }), note: FASE3_RULES_NOTE
  },
  fri: {
    dow: 5, label: "Viernes", type: "gym", typeLabel: "Gimnasio (Hombro/Core) + Running Z2 corto",
    training: {
      title: "Entreno híbrido (60 min totales)",
      items: [
        { name: "Vacío abdominal (Stomach Vacuum)", note: "3 series de 30 segundos, en ayunas por la mañana." }
      ],
      exercises: [
        { name: "Press militar con mancuernas", sets: "3 x 10", rest: "60s" },
        { name: "Plancha frontal isométrica", sets: "3 x 60s", rest: "45s", note: "A muerte." }
      ],
      cardio: "Inmediatamente después de los pesos: 30 minutos de carrera muy suave en Zona 2 (115–126 ppm). Evita que acumules grasa del superávit calórico en la zona abdominal."
    },
    meals: MEALS_ORANGE, supplements: daySupplements({ creatina: true, proteina: true }), note: FASE3_RULES_NOTE
  },
  sat: {
    dow: 6, label: "Sábado", type: "active", typeLabel: "Descanso activo o paseo largo",
    isWeighDay: true,
    training: { title: "Paseo largo", detail: "Cero gimnasio, cero running. Sal a caminar de una hora a hora y media a ritmo tranquilo para quemar calorías extra sin estresar el músculo." },
    meals: MEALS_FASE3_SAT, supplements: daySupplements({ creatina: true }), note: FASE3_RULES_NOTE
  },
  sun: {
    dow: 0, label: "Domingo", type: "rest", typeLabel: "Descanso total",
    training: { title: "Descanso total", detail: "Cero actividad. Recuperación muscular total — tus músculos crecen cuando descansas, no cuando entrenas." },
    meals: MEALS_FASE3_WED, supplements: daySupplements(), note: FASE3_RULES_NOTE
  }
};

/* ---------------------------------------------------------------------
   FASE 4 — El Destape Final (semanas 33–40, Mayo-Junio 2027)
   Calendario día a día completo.
   --------------------------------------------------------------------- */

const FASE4_RULES_NOTE = "Las 3 normas innegociables de esta fase: cero hidratos a partir de las 16:00 (avena, arroz, pasta y patata fuera de la vista), la cena se pesa al gramo sin salsas ni aceites de más, y 4 litros de agua al día para eliminar el líquido subcutáneo.";

const MEALS_FASE4_CLEAN = { // Lunes, Miércoles, Domingo
  label: "Menú de vaciado (bajo en hidratos)",
  zoneColor: "#22C55E",
  totalKcal: 940,
  macros: { protein: 100, carbs: 55, fat: 40 },
  items: [
    { meal: "Desayuno", text: "Tortilla de 3 claras de huevo + 1 café solo (sin tostada).", kcal: 45 },
    { meal: "Comida", text: "200 g de pechuga de pollo a la plancha + 300 g de brócoli al vapor + 30 g (en seco) de arroz integral.", kcal: 425 },
    { meal: "Merienda (17:00)", text: "40 g de nueces naturales + 1 café solo (sin hidratos).", kcal: 245 },
    { meal: "Cena", text: "200 g de lluç (merluza) a la plancha con un raig de limón + ensalada de espinacas frescos.", kcal: 165 },
    { meal: "Extra del día", text: "Aceites de cocinar y el Omega 3.", kcal: 60 }
  ]
};

const MEALS_FASE4_GYM = { // Martes, Jueves — gimnasio pesado + HIIT
  label: "Menú de energía para pesos pesados",
  zoneColor: "#F5B400",
  totalKcal: 1650,
  macros: { protein: 160, carbs: 90, fat: 45 },
  items: [
    { meal: "Desayuno", text: "40 g de copos de avena cocidos con agua y canela + 1 café solo.", kcal: 210 },
    { meal: "Comida", text: "200 g de ternera magra + 50 g (en seco) de pasta integral + ensalada verde.", kcal: 560 },
    { meal: "Merienda (16:30, 1h antes del gimnasio)", text: "40 g de almendras naturales + 1 café solo.", kcal: 260 },
    { meal: "Post-entreno", text: "Tu batido de proteína Whey Isolate con agua fría.", kcal: 110 },
    { meal: "Cena de máxima definición", text: "Un pote entero de claras de huevo (en tortilla o revuelto) con espinacas frescos.", kcal: 190 },
    { meal: "Extra del día", text: "La Creatina y el Omega 3.", kcal: 320 }
  ]
};

const MEALS_FASE4_FRI = { // Viernes — brazos/core + running Z2 corto
  label: "Menú de brazos y running suave",
  zoneColor: "#FB923C",
  totalKcal: 1220,
  macros: { protein: 140, carbs: 105, fat: 40 },
  items: [
    { meal: "Desayuno", text: "1 tostada integral con tomate triturado y 50 g de requesón desnatado + café solo.", kcal: 155 },
    { meal: "Comida", text: "200 g de pavo + 200 g de patata al horno + espárragos verdes.", kcal: 440 },
    { meal: "Merienda (16:30)", text: "40 g de nueces naturales + 1 café solo.", kcal: 245 },
    { meal: "Post-running", text: "Tu batido de proteína Whey Isolate.", kcal: 110 },
    { meal: "Cena de máxima definición", text: "200 g de lenguado o rape a la plancha + 8-10 espárragos verdes a la plancha.", kcal: 170 },
    { meal: "Extra del día", text: "La Creatina y el Omega 3.", kcal: 100 }
  ]
};

const MEALS_FASE4_SAT = { // Sábado — cardio quemador exterior + pesaje
  label: "Menú del cardio quemador",
  zoneColor: "#FFD84D",
  totalKcal: 965,
  macros: { protein: 105, carbs: 100, fat: 35 },
  items: [
    { meal: "Pre-running (en ayunas)", text: "1 café solo grande. Sin sólidos.", kcal: 5 },
    { meal: "Comida (post-carrera)", text: "200 g de salmón a la plancha + un plato gigante de ensalada verde variada + 40 g (en seco) de arroz integral.", kcal: 545 },
    { meal: "Merienda", text: "200 g de queso fresco batido 0% con un puñado de arándanos.", kcal: 150 },
    { meal: "Cena", text: "Tortilla francesa de 2 huevos enteros con una lata de atún al natural.", kcal: 250 },
    { meal: "Extra del día", text: "La Creatina y el Omega 3.", kcal: 15 }
  ]
};

const WEEKLY_SCHEDULE_FASE4 = {
  mon: {
    dow: 1, label: "Lunes", type: "rest", typeLabel: "Descanso total + vaciado metabólico",
    training: { title: "Descanso total", detail: "Cero running, cero gimnasio — descanso total para que las articulaciones se recuperen. Reparte los 4 litros de agua a lo largo del día: es clave para eliminar la retención del bajo vientre." },
    meals: MEALS_FASE4_CLEAN, supplements: daySupplements(), note: FASE4_RULES_NOTE
  },
  tue: {
    dow: 2, label: "Martes", type: "gym", typeLabel: "Gimnasio (Torso pesado) + HIIT cinta",
    training: {
      title: "Fuerza (40 min)",
      exercises: [
        { name: "Press militar con mancuernas (hombro)", sets: "4 x 6", rest: "90s" },
        { name: "Jalón al pecho pesado", sets: "4 x 6", rest: "90s" },
        { name: "Press de banca con mancuernas", sets: "3 x 8", rest: "90s" }
      ],
      cardio: "Quema post-pesos (HIIT en cinta): 5 min de calentamiento + 10 ciclos de 30 segundos a máxima velocidad (Zona 5, roja) + 1 minuto caminando lento + 5 min de enfriamiento."
    },
    meals: MEALS_FASE4_GYM, supplements: daySupplements({ creatina: true, proteina: true }), note: FASE4_RULES_NOTE
  },
  wed: {
    dow: 3, label: "Miércoles", type: "active", typeLabel: "Descanso activo + vacío abdominal",
    training: {
      title: "Vacío abdominal + caminar",
      items: [
        { name: "Vacío abdominal (Stomach Vacuum)", note: "4 series de 30 segundos, en ayunas por la mañana, expulsando el aire y metiendo la tripa hacia dentro." }
      ],
      detail: "Por la tarde, camina 30–40 minutos a ritmo suave."
    },
    meals: MEALS_FASE4_CLEAN, supplements: daySupplements(), note: FASE4_RULES_NOTE
  },
  thu: {
    dow: 4, label: "Jueves", type: "gym", typeLabel: "Gimnasio (Pierna pesada) + HIIT cinta",
    training: {
      title: "Fuerza (35 min)",
      exercises: [
        { name: "Prensa de piernas inclinada", sets: "4 x 8", rest: "90s", note: "Pesado." },
        { name: "Elevación de talones (gemelos) en escalón", sets: "4 x 15", rest: "45s" },
        { name: "Pájaros / Bird-dog (core)", sets: "3 x 12", rest: "lentas", note: "Repeticiones muy lentas y controladas." }
      ],
      cardio: "Quema post-pesos (HIIT en cinta): el mismo bloque que el martes — 10 ciclos de 30 segundos a tope (Zona 5) + 1 minuto caminando."
    },
    meals: MEALS_FASE4_GYM, supplements: daySupplements({ creatina: true, proteina: true }), note: FASE4_RULES_NOTE
  },
  fri: {
    dow: 5, label: "Viernes", type: "gym", typeLabel: "Gimnasio (Brazos/Core) + Running Z2 corto",
    training: {
      title: "Fuerza (30 min)",
      exercises: [
        { name: "Curl de bíceps con mancuerna", sets: "3 x 10", rest: "60s" },
        { name: "Extensión de tríceps en polea", sets: "3 x 10", rest: "60s" },
        { name: "Plancha frontal isométrica", sets: "3 x 60s", rest: "45s", note: "Aprieta glúteos y abdomen a tope." }
      ],
      cardio: "Running en cinta o exterior: 30 minutos muy suaves, aguja clavada en Zona 2 (115–126 ppm). Vacía los ácidos grasos que liberó el HIIT de ayer."
    },
    meals: MEALS_FASE4_FRI, supplements: daySupplements({ creatina: true, proteina: true }), note: FASE4_RULES_NOTE
  },
  sat: {
    dow: 6, label: "Sábado", type: "long", typeLabel: "Running cardio quemador (exterior)",
    isWeighDay: true,
    training: {
      title: "Cardio quemador — 45 min",
      blocks: [
        { range: "Min 0–15", text: "Zona 2 (115–126 ppm)." },
        { range: "Min 15–35", text: "Zona 3 (127–137 ppm) — ritmo alegre." },
        { range: "Min 35–45", text: "Zona 2 (115–126 ppm) — vuelta a la calma." }
      ]
    },
    meals: MEALS_FASE4_SAT, supplements: daySupplements({ creatina: true }), note: FASE4_RULES_NOTE
  },
  sun: {
    dow: 0, label: "Domingo", type: "rest", typeLabel: "Descanso total",
    training: { title: "Descanso total", detail: "Cero actividad. Pasea con la familia de forma relajada." },
    meals: MEALS_FASE4_CLEAN, supplements: daySupplements(), note: FASE4_RULES_NOTE
  }
};

/* ---------------------------------------------------------------------
   DICCIONARIO DE CALORÍAS — referencia rápida (pesos en crudo/seco,
   que es como se pesan en la báscula de cocina)
   --------------------------------------------------------------------- */
let CALORIE_DICTIONARY = {
  proteinas: {
    title: "🥩 Las proteínas (el tejido de tu músculo)",
    items: [
      { name: "Pechuga de pollo / pavo (200 g)", kcal: 220, macro: "46 g proteína / 4 g grasa / 0 g hidratos" },
      { name: "Filete de ternera magra (200 g)", kcal: 260, macro: "44 g proteína / 8 g grasa / 0 g hidratos" },
      { name: "Merluza / bacalao / lenguado (200 g)", kcal: 150, macro: "34 g proteína / 2 g grasa / 0 g hidratos", note: "La proteína más limpia — la de referencia en Fase 4." },
      { name: "Salmón atlántico al horno (200 g)", kcal: 360, macro: "40 g proteína / 22 g grasa (Omega 3) / 0 g hidratos" },
      { name: "Claras de huevo líquidas (pote de 250 g)", kcal: 125, macro: "27 g proteína / 0 g grasa / 0 g hidratos", note: "El arma secreta del destape." },
      { name: "Huevo entero (unidad grande)", kcal: 80, macro: "7 g proteína / 6 g grasa / 0 g hidratos" },
      { name: "1 cacito de proteína Whey Isolate (30 g)", kcal: 110, macro: "26 g proteína / 0,5 g grasa / 0,5 g hidratos" }
    ]
  },
  hidratos: {
    title: "🌾 Los carbohidratos (la gasolina de tus series)",
    items: [
      { name: "Arroz / pasta integral — ración pequeña (40 g, Fase 1)", kcal: 145 },
      { name: "Arroz / pasta integral — ración media (60 g, Fase 1/2)", kcal: 215 },
      { name: "Arroz / pasta integral — ración de carga (90 g, Fase 3)", kcal: 325 },
      { name: "Copos de avena — ración de 40 g", kcal: 150 },
      { name: "Copos de avena — ración de 60 g", kcal: 225 },
      { name: "Patata blanca cruda — ración de 200 g", kcal: 170 },
      { name: "Patata blanca cruda — ración de 250 g", kcal: 212 },
      { name: "Plátano maduro (unidad mediana, sin piel)", kcal: 110, macro: "26 g hidratos rápidos" }
    ]
  },
  grasas: {
    title: "🥑 Grasas saludables y suplementos",
    items: [
      { name: "Nueces / almendras naturales (40 g, un puñado generoso)", kcal: 245, note: "Muy calóricas — hay que pesarlas exactas." },
      { name: "Cucharada sopera de AOVE (10 ml)", kcal: 90, note: "Dos cucharadas de más en la ensalada suman 180 kcal sin darte cuenta." },
      { name: "Medio aguacate mediano (≈70 g de pulpa)", kcal: 115 }
    ]
  },
  leche: {
    title: "☕ La leche del café — comparativa",
    note: "Con un chorrito de ~40 ml por taza (2 tazas al día = 80 ml totales):",
    items: [
      { name: "Leche entera de vaca (80 ml)", kcal: 52 },
      { name: "Leche desnatada de vaca (80 ml)", kcal: 28 },
      { name: "Leche de almendras ZERO (80 ml)", kcal: 11, note: "Cero azúcar — la recomendada para la Fase 4." }
    ]
  }
};

/* ---------------------------------------------------------------------
   FICHAS DE SUPLEMENTACIÓN (detalladas, para la pestaña de referencia)
   --------------------------------------------------------------------- */
let SUPPLEMENT_DETAILS = [
  {
    id: "proteina",
    name: "Aislado de proteína de suero (Whey Isolate)",
    brand: "HSN Evowhey Isolate 2.0 · Myprotein Impact Whey Isolate",
    dose: "1 cacito (30 g de producto, ≈26 g de proteína pura)",
    fn: "Bloquea el catabolismo muscular provocado por la pérdida rápida de peso: aseguras perder grasa de la cintura y no músculo de espalda o brazos.",
    kcal: 110,
    kcalNote: "Ya contabilizadas en el post-entreno de cada día."
  },
  {
    id: "creatina",
    name: "Monohidrato de creatina",
    brand: "HSN Raw Monohidrato de Creatina · Nutrisport Creatina (siempre con sello Creapure)",
    dose: "5 g diarios (1 cacito raso), mezclado en agua o con la comida",
    fn: "Hidratación celular interna. Protección para cadera, tendón de Aquiles y fascia plantar frente al aumento de kilómetros.",
    kcal: 0,
    kcalNote: "Prácticamente sin calorías."
  },
  {
    id: "omega3",
    name: "Omega 3 de alta concentración",
    brand: "EnerZona Omega 3 RX · Solgar Omega 3 Alta Concentración",
    dose: "2 cápsulas junto con la cena",
    fn: "Antiinflamatorio natural enfocado a reducir rigidez y dolor cervical y de espalda alta al dormir.",
    kcal: 10,
    kcalNote: "Grasa Omega 3 — ya incluidas en el \"extra del día\" de cada menú."
  },
  {
    id: "multi",
    name: "Multivitamínico completo",
    brand: "Supradyn Activo · Multicentrum Hombre",
    dose: "1 comprimido cada mañana con el desayuno",
    fn: "Magnesio y vitamina D3 para reducir el cortisol, mejorar el sueño y sostener el metabolismo energético.",
    kcal: 0,
    kcalNote: "Sin calorías."
  }
];


/* ---------------------------------------------------------------------
   Resolución de textos que dependían de "semana 1-4 / 5-8" — ahora se
   calcula la semana real y se muestra solo el bloque que corresponde.
   --------------------------------------------------------------------- */
function fase1CardioText(week) {
  return week <= 4
    ? "Cinta inmediatamente después: 35 minutos. Inclinación 1.0%. Mantener Garmin en Zona 2 (115–126 ppm)."
    : "Cinta inmediatamente después: 45 minutos. Inclinación 1.0%. Mantener Garmin en Zona 2 (115–126 ppm).";
}
function fase1TempoBlock(week) {
  if (week <= 4) {
    return { range: "Min 10–30 (tempo)", text: "Zona 3 (127–137 ppm) a ~5:10 min/km.", pace: "5:10" };
  }
  return { range: "Min 10–30 (series)", text: "4 series de 3 min en Zona 4 (138–148 ppm) a ~4:55 min/km, recuperando 2 min en Zona 2 entre series.", pace: "4:55" };
}

function getPhaseForWeek(weekNumber) {
  return PHASES.find(p => weekNumber >= p.weeks[0] && weekNumber <= p.weeks[1]) || PHASES[PHASES.length - 1];
}

function getWeightTargetForWeek(weekNumber) {
  return WEEKLY_WEIGHTS_BLOQUE1.find(w => w.week === weekNumber)
    || WEEKLY_WEIGHTS_FASE3.find(w => w.week === weekNumber)
    || WEEKLY_WEIGHTS_FASE4.find(w => w.week === weekNumber)
    || null;
}

function getDaySchedule(weekNumber, dayKey) {
  const phase = getPhaseForWeek(weekNumber);
  const source = phase.key === "fase4" ? WEEKLY_SCHEDULE_FASE4 : phase.key === "fase3" ? WEEKLY_SCHEDULE_FASE3 : WEEKLY_SCHEDULE_BASE;
  const base = source[dayKey];
  if (!base) return null;

  // Clona superficialmente
  let day = JSON.parse(JSON.stringify(base));
  day.key = dayKey;
  day.weekNumber = weekNumber;
  day.phase = phase;

  if (phase.key === "fase2" && WEEKLY_SCHEDULE_PHASE2_OVERRIDES[dayKey]) {
    const ov = WEEKLY_SCHEDULE_PHASE2_OVERRIDES[dayKey];
    day = { ...day, ...ov, training: { ...day.training, ...ov.training } };
    // Menús ciclados de fase 2
    if (["tue", "fri", "sat"].includes(dayKey)) day.meals = MEALS_PHASE2_LOAD;
    if (["mon", "wed", "sun"].includes(dayKey)) day.meals = MEALS_PHASE2_LOW;
  }

  if (day.training && day.training.byWeek) {
    day.training.todayDistance = day.training.byWeek[weekNumber] || null;
  }

  // Resuelve los textos "semana 1-4 / 5-8" a un único bloque según la semana real,
  // y añade el ritmo objetivo explícito para poder comparar contra el registro.
  if ((phase.key === "fase1" || phase.key === "fase1b")) {
    if (dayKey === "thu" && day.training) {
      day.training.cardio = fase1CardioText(weekNumber);
    }
    if (dayKey === "fri" && day.training && day.training.blocks) {
      const tempo = fase1TempoBlock(weekNumber);
      day.training.blocks[1] = { range: tempo.range, text: tempo.text };
      day.training.targetPace = tempo.pace;
    }
  }
  if (phase.key === "fase2" && dayKey === "fri") {
    day.training.targetPace = "4:42";
  }
  if (phase.key === "fase2" && dayKey === "sat" && weekNumber !== RACE_WEEK) {
    day.training.targetPace = "4:45";
  }

  // La carrera real (Mitja Marató de Granollers) cae en domingo — nunca se hace
  // tirada larga el día antes, así que el sábado de la semana de carrera pasa a
  // ser un día de activación suave, y el contenido de la carrera se mueve al domingo.
  if (weekNumber === RACE_WEEK) {
    if (dayKey === "sat") {
      day.typeLabel = "Activación pre-carrera";
      day.type = "active";
      day.training = {
        title: "Activación suave (15–20 min)",
        detail: "Trote muy suave + 2-3 progresiones cortas de 15-20s para activar piernas sin fatigar. Deja el dorsal, la ropa y el desayuno de mañana preparados esta noche."
      };
      day.isWeighDay = true;
      day.meals = MEALS_PRE_RACE;
    }
    if (dayKey === "sun") {
      day.typeLabel = "¡Carrera! Mitja Marató de Granollers";
      day.type = "race";
      day.isWeighDay = false;
      day.note = null;
      day.training = {
        title: "Día de carrera — 21,1 km",
        detail: "Sal controlado los primeros 3 km — con la adrenalina es fácil salir demasiado rápido. Busca tu ritmo de crucero cuanto antes y guarda algo de energía para la subida final hacia La Garriga.",
        todayDistance: "21,1 km · Mitja Marató de Granollers",
        targetPace: "4:47"
      };
      day.meals = MEALS_RACE_DAY;
    }
  }

  return day;
}

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const JS_DOW_TO_KEY = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 0: "sun" };

// Nº de días de entreno "activo" (no descanso) programados en una semana normal
function trainingDayKeysForWeek(weekNumber) {
  if (weekNumber === RACE_WEEK) return ["tue", "thu", "fri", "sun"];
  const phase = getPhaseForWeek(weekNumber);
  if (phase.key === "fase3") return ["mon", "tue", "wed", "thu", "fri"];
  return ["tue", "thu", "fri", "sat"];
}
