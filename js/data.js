/* ==========================================================================
   FORJA21 — Datos del plan (entreno, nutrición, peso, suplementación)
   Extraído y estructurado a partir del manual del usuario.
   ========================================================================== */

const PROFILE_DEFAULTS = {
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

const HR_ZONES = [
  { key: "z1", label: "Z1 · Muy suave", color: "#6B7784", range: "<115 ppm", min: null, max: 115 },
  { key: "z2", label: "Z2 · Aeróbico (base)", color: "#3E7BFA", range: "115–126 ppm", min: 115, max: 126 },
  { key: "z3", label: "Z3 · Tempo", color: "#22C55E", range: "127–137 ppm", min: 127, max: 137 },
  { key: "z4", label: "Z4 · Umbral", color: "#F5B400", range: "138–148 ppm", min: 138, max: 148 },
  { key: "z5", label: "Z5 · Máximo", color: "#EF4444", range: ">148 ppm", min: 148, max: null }
];

// Hitos fijos del calendario real (no dependen de la semana calculada, son fechas de verdad)
const MILESTONES = [
  { date: "2027-01-24", icon: "🏁", label: "Mitja Marató de Granollers", desc: "Objetivo: sub 1h 43min a 4:45–4:50 min/km, pesando 75.5 kg." },
  { date: "2027-06-24", icon: "🏆", label: "Objetivo final (Sant Joan)", desc: "Cuerpo definido: 71–72 kg, abdominales visibles." }
];

const SUPPLEMENTS = [
  { id: "multi", name: "Multivitamínico", brand: "Supradyn Activo / Multicentrum Hombre", when: "Cada mañana con el desayuno", icon: "sun" },
  { id: "creatina", name: "Creatina monohidrato", brand: "HSN Raw Monohidrato (Creapure)", when: "5 g en agua, en días de gimnasio / calidad / tirada", icon: "bolt" },
  { id: "proteina", name: "Proteína Whey Isolate", brand: "HSN Evowhey Isolate 2.0 / Myprotein Impact Whey Isolate", when: "1 cacito post-entreno (pesas/HIIT)", icon: "shake" },
  { id: "omega3", name: "Omega 3", brand: "EnerZona Omega 3 RX / Solgar Omega 3", when: "2 cápsulas cada noche con la cena", icon: "moon" }
];

/* ---------------------------------------------------------------------
   BLOQUE 1 — Camino a la Mitja de Granollers (semanas 1–22)
   Peso objetivo semana a semana (pesaje: sábado en ayunas)
   --------------------------------------------------------------------- */
const WEEKLY_WEIGHTS_BLOQUE1 = [
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
   FASES (5 fases a lo largo de todo el plan)
   --------------------------------------------------------------------- */
const PHASES = [
  {
    id: 1,
    key: "fase1",
    name: "Base Aeróbica, Fuerza y CaCo",
    weeks: [1, 8],
    dateLabel: "Agosto — Octubre 2026",
    weightFrom: 87.5,
    weightTo: 83.1,
    kcal: "1.800 – 1.900 kcal",
    summary: "Adaptación articular y control estricto de Zona 2 para evitar fascitis y dolor de cadera. Déficit calórico moderado con recorte de hidratos en días de descanso.",
    focus: ["Control estricto de Zona 2", "Fuerza general 2x/semana", "Caminar-Correr progresivo los sábados"]
  },
  {
    id: 2,
    key: "fase1b",
    name: "Transición, Fondo y Carga",
    weeks: [9, 13],
    dateLabel: "Octubre — Noviembre 2026",
    weightFrom: 83.1,
    weightTo: 80.3,
    kcal: "1.800 – 1.900 kcal",
    summary: "Se eliminan los tramos caminando de los sábados: los rodajes pasan a ser continuos, de 14 a 16 km, en Zona 2 pura. Se mantiene la estructura nutricional, subiendo el agua a 3,5 L/día.",
    focus: ["Rodajes continuos sin caminar", "14–16 km en Zona 2 pura", "Agua 3,5 L/día"]
  },
  {
    id: 3,
    key: "fase2",
    name: "Ritmo Específico Gran Ollers",
    weeks: [14, 22],
    dateLabel: "Noviembre 2026 — Enero 2027",
    weightFrom: 80.3,
    weightTo: 75.5,
    kcal: "≈2.100 kcal días de calidad · ≈1.700 kcal días de descanso",
    summary: "Objetivo: clavar el ritmo de carrera de 4:45–4:50 min/km. Ciclado estricto de hidratos, potencia en el gimnasio y series largas de umbral los viernes.",
    focus: ["Series de umbral (3.000 m) los viernes", "Sentadillas explosivas para la subida a La Garriga", "Tirada larga con bloques de ritmo", "Semana 22: ¡carrera!"],
    raceWeek: 22
  },
  {
    id: 4,
    key: "fase3",
    name: "Construcción Muscular",
    weeks: [23, 32],
    dateLabel: "Febrero — Abril 2027",
    weightFrom: 75.5,
    weightTo: 78.5,
    kcal: "≈2.400 kcal (normocalórica)",
    summary: "Subida controlada de músculo neto: 2 días de carrera suave (8–10 km) y 4 días de gimnasio pesado (series de 4x8–10 repeticiones). Introducción diaria del vacío abdominal en ayunas.",
    focus: ["4 días de gimnasio pesado", "2 días de carrera suave", "Vacío abdominal diario en ayunas"]
  },
  {
    id: 5,
    key: "fase4",
    name: "El Destape Final y Abdominales",
    weeks: [33, 40],
    dateLabel: "Mayo — Junio 2027",
    weightFrom: 78.5,
    weightTo: 71.5,
    kcal: "≈1.600 – 1.700 kcal",
    summary: "Bajada definitiva hasta 71–72 kg reales. Corte de hidratos a partir de las 16:00, agua a 4 L/día y HIIT en cinta tras las pesas pesadas para máxima definición.",
    focus: ["Hidratos solo en desayuno y comida", "HIIT post-pesas (10x30s Z5 + 1' caminando)", "Agua 4 L/día", "Cena clínica de definición"]
  }
];

// El plan tiene una duración fija — más allá de esta semana se considera completado.
const TOTAL_PLAN_WEEKS = PHASES[PHASES.length - 1].weeks[1];
const RACE_WEEK = PHASES.find(p => p.raceWeek)?.raceWeek || 22;

// Cada cuántas semanas conviene revisar las zonas de FC (FCR/FCM cambian con la forma física)
const ZONE_REVIEW_INTERVAL_WEEKS = 4;
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
  items: [
    { meal: "Desayuno", text: "Tortilla de 1 huevo entero + 2 claras. Café solo." },
    { meal: "Comida", text: "200 g de pechuga de pollo a la plancha + 250 g de brócoli al vapor + 40 g (en seco) de arroz integral." },
    { meal: "Merienda", text: "1 yogur griego ligero (0%) + 20 g de nueces naturales." },
    { meal: "Cena", text: "Crema de calabacín y puerro (sin nata) + 150 g de merluza al horno con limón." }
  ]
};

const MEALS_YELLOW = { // Martes, Jueves — gimnasio de fuerza
  label: "Menú de energía muscular",
  zoneColor: "#F5B400",
  items: [
    { meal: "Desayuno", text: "40 g de copos de avena cocidos con agua + 1 manzana + canela. Café solo." },
    { meal: "Comida", text: "200 g de lomo de cerdo magro (o ternera) + 60 g (en seco) de pasta integral o quinoa + ensalada grande. Toma los 5 g de Creatina en agua." },
    { meal: "Merienda (1h antes de entrenar)", text: "1 plátano + 3 lonchas de pavo. Café solo." },
    { meal: "Post-entreno", text: "1 batido de proteína Whey Isolate con agua fría, justo al acabar las pesas." },
    { meal: "Cena", text: "Revuelto de 3 claras y 1 huevo entero con champiñones (o gambas) + 1 tomate aliñado." }
  ]
};

const MEALS_ORANGE = { // Viernes — carrera de calidad
  label: "Menú de carga rápida",
  zoneColor: "#FB923C",
  items: [
    { meal: "Desayuno", text: "1 tostada integral con tomate triturado y 50 g de requesón. Café solo." },
    { meal: "Comida", text: "200 g de pechuga de pavo + 250 g de patata cocida + espárragos. Toma los 5 g de Creatina." },
    { meal: "Merienda (1h antes de correr)", text: "2 tortitas de arroz con una cucharada de crema de cacahuete pura." },
    { meal: "Cena", text: "150 g de sepia (o emperador) a la plancha con ajo y perejil + caldo de verduras limpio." }
  ]
};

const MEALS_LONGRUN = { // Sábado — tirada larga
  label: "Menú de la tirada larga",
  zoneColor: "#EF4444",
  items: [
    { meal: "Pre-carrera (60 min antes)", text: "1 café solo cargado + 1 plátano (o tostada con miel)." },
    { meal: "Durante", text: "Agua con una pastilla de electrolitos (Isostar o 226ers), a partir de los 60 min." },
    { meal: "Comida (post-tirada)", text: "100 g (en seco) de arroz o pasta integral + 200 g de salmón a la plancha + verduras. Toma los 5 g de Creatina." },
    { meal: "Merienda", text: "200 g de queso fresco batido 0% con arándanos." },
    { meal: "Cena", text: "Tortilla francesa de 2 huevos con una lata de atún al natural." }
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
    training: { title: "Rutina espalda sana", detail: "Cero impacto. Rutina postural antes de dormir: 12 repeticiones de Gato-Camello + 30 segundos de estiramiento piramidal por lado." },
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
  items: [
    { meal: "Desayuno (3h antes)", text: "Tostadas con miel o mermelada + un plátano + café solo. Nada nuevo ni raro — lo de siempre en tus tiradas largas." },
    { meal: "Pre-salida (30–45 min antes)", text: "Un gel o media barrita energética + agua." },
    { meal: "Durante la carrera", text: "Un gel cada 45 min aprox. + agua o bebida isotónica en los avituallamientos." },
    { meal: "Justo al terminar", text: "El batido de proteína Whey Isolate + un plátano, dentro de los primeros 30 minutos." },
    { meal: "Comida de recuperación", text: "Plato copioso con hidratos y proteína — pasta o arroz con pollo o salmón. Hoy toca disfrutar la comida sin restricción." }
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

// Menú general de referencia para Fase 3 (Construcción Muscular) — no hay calendario día a día
const MEALS_FASE3 = {
  label: "Menú tipo de hipertrofia (~2.400 kcal)",
  zoneColor: "#F5B400",
  items: [
    { meal: "Desayuno", text: "Tortilla de 2 huevos enteros + 2 claras + 1 tostada integral grande con medio aguacate, sal y limón. Café con leche desnatada." },
    { meal: "Comida", text: "220 g de ternera magra, pavo o pollo + 90 g (en seco) de arroz, pasta o quinoa + verduras salteadas con aceite de oliva. Toma los 5 g de Creatina." },
    { meal: "Merienda (pre-pesas)", text: "60 g de copos de avena con leche desnatada o de almendras + 1 cacito de proteína Whey Isolate." },
    { meal: "Post-entreno", text: "1 plátano maduro inmediatamente al terminar las pesas pesadas." },
    { meal: "Cena", text: "200 g de salmón, dorada o lubina al horno + puré de calabaza o verduras asadas." }
  ]
};

// Menú general de referencia para Fase 4 (Destape Final) — no hay calendario día a día
const MEALS_FASE4 = {
  label: "Las 4 reglas de oro de la definición (~1.600–1.700 kcal)",
  zoneColor: "#EF4444",
  items: [
    { meal: "Regla 1", text: "Bloqueo de hidratos a partir de las 16:00 — avena, arroz o patata solo en el desayuno y la comida de mediodía." },
    { meal: "Regla 2 · Merienda", text: "1 café solo + 40 g de almendras o nueces naturales, 1h antes del gimnasio (nada de plátano ni tortitas de arroz)." },
    { meal: "Entreno", text: "Pesas pesadas para proteger el músculo + HIIT en cinta al terminar: 10 ciclos de 30s a máxima velocidad (Z5) + 1 min caminando." },
    { meal: "Regla 3 · Cena clínica", text: "Un pote entero de claras de huevo (tortilla o revuelto con espinacas), o bien 200 g de pescado blanco a la plancha con espárragos verdes." },
    { meal: "Regla 4 · Agua", text: "Sube el consumo de agua a 4 litros diarios de forma estricta para eliminar la retención subcutánea." }
  ]
};

/* ---------------------------------------------------------------------
   FICHAS DE SUPLEMENTACIÓN (detalladas, para la pestaña de referencia)
   --------------------------------------------------------------------- */
const SUPPLEMENT_DETAILS = [
  {
    id: "proteina",
    name: "Aislado de proteína de suero (Whey Isolate)",
    brand: "HSN Evowhey Isolate 2.0 · Myprotein Impact Whey Isolate",
    dose: "1 cacito (30 g de producto, ≈26 g de proteína pura)",
    fn: "Bloquea el catabolismo muscular provocado por la pérdida rápida de peso: aseguras perder grasa de la cintura y no músculo de espalda o brazos."
  },
  {
    id: "creatina",
    name: "Monohidrato de creatina",
    brand: "HSN Raw Monohidrato de Creatina · Nutrisport Creatina (siempre con sello Creapure)",
    dose: "5 g diarios (1 cacito raso), mezclado en agua o con la comida",
    fn: "Hidratación celular interna. Protección para cadera, tendón de Aquiles y fascia plantar frente al aumento de kilómetros."
  },
  {
    id: "omega3",
    name: "Omega 3 de alta concentración",
    brand: "EnerZona Omega 3 RX · Solgar Omega 3 Alta Concentración",
    dose: "2 cápsulas junto con la cena",
    fn: "Antiinflamatorio natural enfocado a reducir rigidez y dolor cervical y de espalda alta al dormir."
  },
  {
    id: "multi",
    name: "Multivitamínico completo",
    brand: "Supradyn Activo · Multicentrum Hombre",
    dose: "1 comprimido cada mañana con el desayuno",
    fn: "Magnesio y vitamina D3 para reducir el cortisol, mejorar el sueño y sostener el metabolismo energético."
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
  return WEEKLY_WEIGHTS_BLOQUE1.find(w => w.week === weekNumber) || null;
}

function getDaySchedule(weekNumber, dayKey) {
  const base = WEEKLY_SCHEDULE_BASE[dayKey];
  const phase = getPhaseForWeek(weekNumber);
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

  if (phase.key === "fase3" || phase.key === "fase4") {
    day.isGeneralPhase = true;
    day.type = "general";
    day.typeLabel = phase.name;
    day.meals = phase.key === "fase3" ? MEALS_FASE3 : MEALS_FASE4;
    day.supplements = daySupplements({ creatina: true, proteina: true });
    day.note = null;
  }

  return day;
}

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const JS_DOW_TO_KEY = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 0: "sun" };

// Nº de días de entreno "activo" (no descanso) programados en una semana normal
function trainingDayKeysForWeek(weekNumber) {
  if (weekNumber === RACE_WEEK) return ["tue", "thu", "fri", "sun"];
  return ["tue", "thu", "fri", "sat"];
}
