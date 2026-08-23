/* ========================================================================== 
   FORJA21 — Onboarding personalizado

   Solo se utiliza para usuarios cuyo ForjaPlanRouter.route === "personalized".
   Toni y Beizga nunca pasan por este fichero.

   En este paso todavía NO generamos el plan con IA. Recogemos y validamos los
   datos necesarios y los guardamos en Firestore bajo:
     users/{uid}/personalized/onboarding
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_PREFIX = "forja21_personalized_onboarding_";
  const DAY_OPTIONS = [
    ["mon", "L"], ["tue", "M"], ["wed", "X"], ["thu", "J"],
    ["fri", "V"], ["sat", "S"], ["sun", "D"]
  ];

  const GOALS = [
    ["race", "🏃", "Preparar una carrera", "5K, 10K, media, maratón, trail…"],
    ["fat_loss", "⚖️", "Perder grasa / peso", "Reducir peso de forma progresiva"],
    ["muscle", "💪", "Ganar masa muscular", "Hipertrofia y mejora estética"],
    ["strength", "🏋️", "Ganar fuerza", "Mejorar marcas y rendimiento"],
    ["fitness", "❤️", "Mantenerme en forma", "Salud, energía y condición general"],
    ["endurance", "⚡", "Mejorar resistencia", "Correr más o aguantar mejor"],
    ["mobility", "🧘", "Movilidad / bienestar", "Moverme mejor y sentirme mejor"],
    ["other", "🎯", "Otro objetivo", "Describe exactamente lo que buscas"]
  ];

  let ctx = null;

  function blankData() {
    return {
      version: 1,
      status: "draft",
      step: 0,
      profile: {
        name: "", age: "", sexForEnergy: "", heightCm: "", weightKg: ""
      },
      goals: [],
      goalPriority: [],
      goalDetails: {
        race: { distance: "", raceDate: "", target: "", terrain: "road" },
        fat_loss: { targetWeightKg: "", targetDate: "" },
        muscle: { priorityAreas: "", targetDate: "" },
        strength: { priorityLifts: "", targetDate: "" },
        other: { description: "" }
      },
      background: {
        trainingLevel: "beginner",
        sessionsPerWeekNow: "0",
        runningKmWeek: "0",
        longestRunKm: "0",
        recentRaceMarks: "",
        strengthExperience: "none",
        currentRoutine: ""
      },
      availability: {
        days: [],
        sessionsPerWeekWanted: "4",
        minutesPerSession: "60",
        preferredTime: "any",
        locations: [],
        equipment: "",
        fixedConstraints: ""
      },
      recovery: {
        sleepHours: "7",
        dailyActivity: "medium",
        physicalLimitations: "",
        exercisesToAvoid: ""
      },
      nutrition: {
        mode: "recommendations",
        dietaryStyle: "omnivore",
        mealsPerDay: "",
        foodsAvoid: "",
        notes: ""
      },
      supplements: {
        mode: "recommendations",
        current: "",
        notes: ""
      },
      preferences: {
        planStartDate: "",
        planHorizon: "goal_based",
        horizonWeeks: "12",
        detailLevel: "high",
        hardPreferences: ""
      },
      consent: false
    };
  }

  function localKey(uid) { return STORAGE_PREFIX + uid; }

  function saveDraftLocal() {
    if (!ctx?.user?.uid) return;
    localStorage.setItem(localKey(ctx.user.uid), JSON.stringify(ctx.data));
  }

  function loadDraftLocal(uid) {
    try {
      return JSON.parse(localStorage.getItem(localKey(uid)) || "null");
    } catch (_) { return null; }
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function selected(v, current) { return v === current ? "selected" : ""; }
  function checked(v) { return v ? "checked" : ""; }
  function has(arr, v) { return Array.isArray(arr) && arr.includes(v); }

  function header(title, desc) {
    const pct = Math.round(((ctx.step + 1) / ctx.steps.length) * 100);
    return `
      <div class="personalized-head">
        <div class="hero-eyebrow">Tu planificación · ${ctx.step + 1}/${ctx.steps.length}</div>
        <h2>${title}</h2>
        <p>${desc}</p>
        <div class="po-progress"><i style="width:${pct}%"></i></div>
      </div>`;
  }

  function field(label, html, help = "") {
    return `<div class="field"><label>${label}</label>${html}${help ? `<small class="po-help">${help}</small>` : ""}</div>`;
  }

  function textInput(name, value, attrs = "") {
    return `<input name="${name}" value="${esc(value)}" ${attrs}>`;
  }

  function selectInput(name, value, options) {
    return `<select name="${name}">${options.map(([v,l]) => `<option value="${v}" ${selected(v,value)}>${l}</option>`).join("")}</select>`;
  }

  function textarea(name, value, placeholder = "") {
    return `<textarea name="${name}" rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
  }

  function stepProfile() {
    const d = ctx.data.profile;
    return header("Primero, tú", "Necesito una base mínima para ajustar volumen, recuperación y, si la eliges, nutrición.") + `
      <div class="card po-card">
        ${field("¿Cómo te llamas?", textInput("name", d.name, 'required placeholder="Tu nombre"'))}
        <div class="po-grid-2">
          ${field("Edad", textInput("age", d.age, 'type="number" min="14" max="90" placeholder="Ej. 34"'))}
          ${field("Sexo para estimaciones energéticas", selectInput("sexForEnergy", d.sexForEnergy, [["","Prefiero no indicarlo"],["male","Hombre"],["female","Mujer"]]), "Solo se usaría si pides cálculos nutricionales.")}
        </div>
        <div class="po-grid-2">
          ${field("Altura (cm)", textInput("heightCm", d.heightCm, 'type="number" min="120" max="230" placeholder="Ej. 178"'))}
          ${field("Peso actual (kg)", textInput("weightKg", d.weightKg, 'type="number" min="30" max="300" step="0.1" placeholder="Ej. 82.5"'))}
        </div>
      </div>`;
  }

  function stepGoals() {
    const d = ctx.data;
    const cards = GOALS.map(([id,icon,title,sub]) => `
      <label class="po-choice ${has(d.goals,id) ? "selected" : ""}">
        <input type="checkbox" name="goals" value="${id}" ${checked(has(d.goals,id))}>
        <span class="po-choice-icon">${icon}</span><span><b>${title}</b><small>${sub}</small></span>
      </label>`).join("");
    return header("¿Qué quieres conseguir?", "Puedes marcar más de un objetivo. Después podremos decidir cuál manda cuando entren en conflicto.") + `
      <div class="po-choice-grid">${cards}</div>
      <p class="po-help po-center">Selecciona uno o varios objetivos.</p>`;
  }

  function stepGoalDetails() {
    const d = ctx.data;
    let html = header("Concretemos los objetivos", "Cuanto más claro sea el destino, mejor podremos construir las fases y los ritmos de progresión.");

    if (has(d.goals,"race")) {
      const r=d.goalDetails.race;
      html += `<div class="card po-card"><h4>🏃 Carrera</h4>
        <div class="po-grid-2">
          ${field("Distancia", selectInput("race.distance",r.distance,[["","Selecciona"],["5k","5 km"],["10k","10 km"],["half","Media maratón"],["marathon","Maratón"],["trail","Trail / montaña"],["other","Otra"]]))}
          ${field("Fecha de la prueba", textInput("race.raceDate",r.raceDate,'type="date"'))}
        </div>
        ${field("Objetivo de marca o simplemente terminar", textInput("race.target",r.target,'placeholder="Ej. sub 1h45 / terminar cómodo"'))}
        ${field("Terreno principal", selectInput("race.terrain",r.terrain,[["road","Asfalto"],["trail","Montaña / trail"],["track","Pista"],["mixed","Mixto"]]))}
      </div>`;
    }
    if (has(d.goals,"fat_loss")) {
      const x=d.goalDetails.fat_loss;
      html += `<div class="card po-card"><h4>⚖️ Pérdida de grasa / peso</h4><div class="po-grid-2">
        ${field("Peso objetivo aproximado (kg)", textInput("fat_loss.targetWeightKg",x.targetWeightKg,'type="number" step="0.1" min="30" max="300"'))}
        ${field("¿Tienes una fecha objetivo?", textInput("fat_loss.targetDate",x.targetDate,'type="date"'))}
      </div></div>`;
    }
    if (has(d.goals,"muscle")) {
      const x=d.goalDetails.muscle;
      html += `<div class="card po-card"><h4>💪 Masa muscular</h4>
        ${field("Zonas prioritarias", textInput("muscle.priorityAreas",x.priorityAreas,'placeholder="Ej. brazos, espalda y hombros"'))}
        ${field("Fecha objetivo si existe", textInput("muscle.targetDate",x.targetDate,'type="date"'))}
      </div>`;
    }
    if (has(d.goals,"strength")) {
      const x=d.goalDetails.strength;
      html += `<div class="card po-card"><h4>🏋️ Fuerza</h4>
        ${field("Ejercicios o capacidades prioritarias", textInput("strength.priorityLifts",x.priorityLifts,'placeholder="Ej. sentadilla, press banca, dominadas…"'))}
        ${field("Fecha objetivo si existe", textInput("strength.targetDate",x.targetDate,'type="date"'))}
      </div>`;
    }
    if (has(d.goals,"other")) {
      html += `<div class="card po-card"><h4>🎯 Otro objetivo</h4>${field("Descríbelo",textarea("other.description",d.goalDetails.other.description,"Cuéntame exactamente qué quieres conseguir."))}</div>`;
    }

    if (d.goals.length > 1) {
      const items = d.goals.map(id => {
        const g=GOALS.find(x=>x[0]===id); return `<option value="${id}" ${selected(id,d.goalPriority[0])}>${g?g[2]:id}</option>`;
      }).join("");
      html += `<div class="card po-card"><h4>¿Cuál es el objetivo principal?</h4><p class="phase-summary">Si dos objetivos chocan, este tendrá prioridad.</p><select name="primaryGoal" style="margin-top:10px">${items}</select></div>`;
    }
    return html;
  }

  function stepBackground() {
    const d=ctx.data.background;
    const running = has(ctx.data.goals,"race") || has(ctx.data.goals,"endurance");
    const strength = has(ctx.data.goals,"muscle") || has(ctx.data.goals,"strength");
    return header("¿De dónde partes?", "No quiero darte un plan de principiante si ya entrenas bien, ni uno avanzado si todavía estás construyendo la base.") + `
      <div class="card po-card">
        ${field("Nivel general", selectInput("trainingLevel",d.trainingLevel,[["beginner","Principiante / vuelvo tras un parón"],["intermediate","Intermedio"],["advanced","Avanzado"]]))}
        ${field("Sesiones que haces ahora por semana", textInput("sessionsPerWeekNow",d.sessionsPerWeekNow,'type="number" min="0" max="14"'))}
        ${running ? `<div class="po-grid-2">${field("Km de carrera por semana",textInput("runningKmWeek",d.runningKmWeek,'type="number" min="0" max="250" step="1"'))}${field("Tirada más larga reciente (km)",textInput("longestRunKm",d.longestRunKm,'type="number" min="0" max="100" step="0.1"'))}</div>${field("Marcas recientes",textarea("recentRaceMarks",d.recentRaceMarks,"Ej. 5K 24:30, 10K 51:20, media 1:55…"))}` : ""}
        ${strength ? field("Experiencia de fuerza",selectInput("strengthExperience",d.strengthExperience,[["none","Ninguna o muy poca"],["basic","Conozco ejercicios básicos"],["intermediate","Entreno fuerza regularmente"],["advanced","Avanzada"]])) : ""}
        ${field("¿Qué estás haciendo actualmente?",textarea("currentRoutine",d.currentRoutine,"Ej. 3 días de gimnasio + 2 días de carrera. Describe lo que sea relevante."))}
      </div>`;
  }

  function stepAvailability() {
    const d=ctx.data.availability;
    return header("Tu semana real", "Un buen plan tiene que caber en tu vida. Prefiero 4 días que puedas cumplir que 6 imposibles.") + `
      <div class="card po-card">
        <label class="po-label">¿Qué días puedes entrenar?</label>
        <div class="po-days">${DAY_OPTIONS.map(([v,l])=>`<label class="${has(d.days,v)?"selected":""}"><input type="checkbox" name="days" value="${v}" ${checked(has(d.days,v))}><span>${l}</span></label>`).join("")}</div>
        <div class="po-grid-2" style="margin-top:16px">
          ${field("Sesiones por semana deseadas",textInput("sessionsPerWeekWanted",d.sessionsPerWeekWanted,'type="number" min="1" max="14" required'))}
          ${field("Minutos habituales por sesión",textInput("minutesPerSession",d.minutesPerSession,'type="number" min="15" max="240" step="5"'))}
        </div>
        ${field("Momento preferido",selectInput("preferredTime",d.preferredTime,[["any","Me da igual"],["morning","Mañana"],["midday","Mediodía"],["evening","Tarde / noche"]]))}
        <label class="po-label">¿Dónde puedes entrenar?</label>
        <div class="po-inline-checks">
          ${[["gym","Gimnasio"],["home","Casa"],["outdoors","Exterior"],["track","Pista"],["pool","Piscina"]].map(([v,l])=>`<label><input type="checkbox" name="locations" value="${v}" ${checked(has(d.locations,v))}> ${l}</label>`).join("")}
        </div>
        ${field("Material disponible",textarea("equipment",d.equipment,"Ej. gimnasio completo; en casa mancuernas hasta 20 kg, bandas y banco…"))}
        ${field("Restricciones fijas de horario",textarea("fixedConstraints",d.fixedConstraints,"Ej. los martes solo 30 min; domingos puedo hacer tirada larga; viernes imposible…"))}
      </div>`;
  }

  function stepRecovery() {
    const d=ctx.data.recovery;
    return header("Recuperación y límites", "El plan también debe saber cuándo no conviene apretar.") + `
      <div class="card po-card">
        <div class="po-grid-2">
          ${field("Horas de sueño habituales",textInput("sleepHours",d.sleepHours,'type="number" min="3" max="12" step="0.5"'))}
          ${field("Actividad diaria",selectInput("dailyActivity",d.dailyActivity,[["low","Mayormente sentado/a"],["medium","Me muevo bastante"],["high","Trabajo o vida muy activa"]]))}
        </div>
        ${field("Limitaciones físicas relevantes",textarea("physicalLimitations",d.physicalLimitations,"Opcional. Ej. molestias de rodilla al correr, hombro sensible en press…"),"No hace falta indicar diagnósticos médicos; solo aquello que deba respetar el entrenamiento.")}
        ${field("Ejercicios o actividades que quieres evitar",textarea("exercisesToAvoid",d.exercisesToAvoid,"Ej. no quiero burpees / no puedo entrenar en bicicleta…"))}
      </div>`;
  }

  function stepNutrition() {
    const d=ctx.data.nutrition;
    return header("Nutrición", "Tú decides hasta dónde entra la alimentación en el plan.") + `
      <div class="card po-card">
        ${field("¿Qué quieres que haga el plan con la nutrición?",selectInput("mode",d.mode,[["none","No incluir nutrición"],["recommendations","Solo recomendaciones"],["training_timing","Recomendaciones + qué comer alrededor del entreno"],["detailed","Plan nutricional detallado con ejemplos"]]))}
        <div data-nutrition-extra>
          ${field("Estilo de alimentación",selectInput("dietaryStyle",d.dietaryStyle,[["omnivore","Omnívora"],["vegetarian","Vegetariana"],["vegan","Vegana"],["pescatarian","Pescetariana"],["other","Otra / flexible"]]))}
          ${field("Comidas al día que prefieres",textInput("mealsPerDay",d.mealsPerDay,'type="number" min="1" max="8" placeholder="Opcional"'))}
          ${field("Alimentos que no quieres incluir",textarea("foodsAvoid",d.foodsAvoid,"Por preferencias, intolerancias conocidas o simplemente porque no te gustan."))}
          ${field("Otras preferencias de nutrición",textarea("notes",d.notes,"Ej. desayuno muy rápido, como fuera de casa, no quiero pesar alimentos…"))}
        </div>
      </div>`;
  }

  function stepSupplements() {
    const d=ctx.data.supplements;
    return header("Suplementación", "También puedes dejarla completamente fuera o pedir que se integre como en tu plan actual.") + `
      <div class="card po-card">
        ${field("¿Cómo quieres tratar los suplementos?",selectInput("mode",d.mode,[["none","No incluir suplementos"],["recommendations","Solo recomendaciones opcionales"],["integrated","Integrarlos en el calendario cuando tengan sentido"]]))}
        <div data-supp-extra>
          ${field("¿Qué tomas actualmente?",textarea("current",d.current,"Ej. creatina 5 g/día, proteína cuando no llego con comida…"))}
          ${field("Preferencias o comentarios",textarea("notes",d.notes,"Ej. prefiero el mínimo posible / no quiero estimulantes…"))}
        </div>
      </div>`;
  }

  function stepPreferences() {
    const d=ctx.data.preferences;
    const monday = (()=>{ const x=new Date(); const day=x.getDay(); x.setDate(x.getDate()+((8-day)%7||7)); return x.toISOString().slice(0,10); })();
    if(!d.planStartDate) d.planStartDate=monday;
    return header("Cómo quieres el plan", "Últimos detalles antes de construir la planificación.") + `
      <div class="card po-card">
        ${field("Fecha de inicio",textInput("planStartDate",d.planStartDate,'type="date" required'))}
        ${field("Duración",selectInput("planHorizon",d.planHorizon,[["goal_based","Hasta mi objetivo o fecha principal"],["weeks","Número concreto de semanas"],["ongoing","Sin fecha final: mantenimiento continuo"]]))}
        <div data-weeks>${field("Semanas",textInput("horizonWeeks",d.horizonWeeks,'type="number" min="4" max="104"'))}</div>
        ${field("Nivel de detalle",selectInput("detailLevel",d.detailLevel,[["high","Muy detallado: calentamientos, ejercicios, series, descansos, ritmos y notas"],["medium","Detallado pero más compacto"]]))}
        ${field("Cosas que el plan debe respetar sí o sí",textarea("hardPreferences",d.hardPreferences,"Ej. no entrenar piernas el viernes; mantener pádel el miércoles; quiero dos días de descanso…"))}
      </div>`;
  }

  function goalLabel(id) { const g=GOALS.find(x=>x[0]===id); return g?g[2]:id; }

  function stepReview() {
    const d=ctx.data;
    return header("Revisa tu perfil", "Esto será lo que recibirá el generador de planificación. Luego podremos modificarlo si cambian tus objetivos.") + `
      <div class="card po-card po-review">
        <h4>${esc(d.profile.name || "Atleta")}</h4>
        <p><b>Objetivos:</b> ${d.goals.map(goalLabel).join(" · ")}</p>
        <p><b>Prioridad:</b> ${goalLabel(d.goalPriority[0] || d.goals[0])}</p>
        <p><b>Disponibilidad:</b> ${d.availability.sessionsPerWeekWanted} sesiones/semana · ${d.availability.minutesPerSession} min habituales</p>
        <p><b>Días:</b> ${d.availability.days.length ? d.availability.days.join(", ").toUpperCase() : "sin días fijos"}</p>
        <p><b>Nutrición:</b> ${esc(d.nutrition.mode)}</p>
        <p><b>Suplementos:</b> ${esc(d.supplements.mode)}</p>
        <p><b>Inicio:</b> ${esc(d.preferences.planStartDate)}</p>
      </div>
      <label class="po-consent"><input type="checkbox" name="consent" ${checked(d.consent)}> <span>Confirmo que los datos son correctos y quiero utilizarlos para crear mi planificación.</span></label>
      <div class="card po-warning"><b>Importante</b><p>La planificación será una ayuda de entrenamiento y bienestar, no sustituye valoración médica ni tratamiento profesional. Si existe una lesión, enfermedad, embarazo, medicación o una situación clínica relevante, debe revisarse con un profesional sanitario.</p></div>`;
  }

  function bindDynamicUI(form) {
    form.querySelectorAll('.po-choice input[type="checkbox"]').forEach(input=>{
      input.addEventListener("change",()=>input.closest(".po-choice").classList.toggle("selected",input.checked));
    });
    form.querySelectorAll('.po-days input[type="checkbox"]').forEach(input=>{
      input.addEventListener("change",()=>input.closest("label").classList.toggle("selected",input.checked));
    });
  }

  function collect(form) {
    const fd=new FormData(form), d=ctx.data;
    const set=(obj,key,name=key)=>{ if(fd.has(name)) obj[key]=fd.get(name); };
    switch(ctx.step){
      case 0:
        ["name","age","sexForEnergy","heightCm","weightKg"].forEach(k=>set(d.profile,k)); break;
      case 1:
        d.goals=fd.getAll("goals");
        d.goalPriority=d.goalPriority.filter(x=>d.goals.includes(x));
        if(!d.goalPriority.length && d.goals.length) d.goalPriority=[d.goals[0]];
        break;
      case 2:
        if(fd.has("primaryGoal")){ const p=fd.get("primaryGoal"); d.goalPriority=[p,...d.goals.filter(x=>x!==p)]; }
        [["race",["distance","raceDate","target","terrain"]],["fat_loss",["targetWeightKg","targetDate"]],["muscle",["priorityAreas","targetDate"]],["strength",["priorityLifts","targetDate"]],["other",["description"]]].forEach(([g,keys])=>keys.forEach(k=>set(d.goalDetails[g],k,`${g}.${k}`)));
        break;
      case 3:
        Object.keys(d.background).forEach(k=>set(d.background,k)); break;
      case 4:
        d.availability.days=fd.getAll("days"); d.availability.locations=fd.getAll("locations");
        ["sessionsPerWeekWanted","minutesPerSession","preferredTime","equipment","fixedConstraints"].forEach(k=>set(d.availability,k)); break;
      case 5:
        Object.keys(d.recovery).forEach(k=>set(d.recovery,k)); break;
      case 6:
        Object.keys(d.nutrition).forEach(k=>set(d.nutrition,k)); break;
      case 7:
        Object.keys(d.supplements).forEach(k=>set(d.supplements,k)); break;
      case 8:
        Object.keys(d.preferences).forEach(k=>set(d.preferences,k)); break;
      case 9:
        d.consent=fd.get("consent") === "on"; break;
    }
    d.step=ctx.step;
    saveDraftLocal();
  }

  function validateStep() {
    const d=ctx.data;
    if(ctx.step===0 && !d.profile.name.trim()) return "Escribe tu nombre.";
    if(ctx.step===1 && !d.goals.length) return "Selecciona al menos un objetivo.";
    if(ctx.step===4 && Number(d.availability.sessionsPerWeekWanted)<1) return "Indica cuántas sesiones puedes hacer.";
    if(ctx.step===9 && !d.consent) return "Confirma que quieres utilizar estos datos para crear el plan.";
    return null;
  }

  async function finish() {
    const payload={
      ...ctx.data,
      status:"completed",
      completedAt: new Date().toISOString(),
      userEmail: ctx.user.email || ""
    };
    ctx.data=payload;
    saveDraftLocal();
    try {
      await CloudSync.pushPersonalizedOnboarding(ctx.user.uid,payload);
      renderCompleted();
    } catch(e) {
      console.error(e);
      if(typeof showToast==="function") showToast("No se pudo guardar el cuestionario en la nube");
    }
  }

  function renderCompleted() {
    document.querySelector("#bottomnav").style.display="none";
    document.querySelector("#routeBar").innerHTML="";
    const stats=document.querySelector("#statStrip"); if(stats) stats.innerHTML="";
    document.querySelector("#topbarSub").textContent="Perfil listo";
    document.querySelector("#view").innerHTML=`
      <div class="hero">
        <div class="hero-eyebrow">Perfil personalizado guardado</div>
        <div class="hero-title">Ya tengo lo necesario para construir tu plan</div>
        <p class="hero-desc">Tus objetivos, disponibilidad, experiencia, nutrición y suplementación están guardados en tu cuenta.</p>
        <div class="badge-row"><span class="badge">✓ Cuestionario completo</span><span class="badge">☁️ Guardado</span></div>
      </div>
      <div class="card po-card">
        <h4>Siguiente paso</h4>
        <p class="phase-summary" style="margin-top:6px">Aquí conectaremos la IA para convertir este perfil en una planificación completa con fases, semanas, sesiones, ejercicios, nutrición y suplementación según lo que hayas elegido.</p>
        <button class="btn" id="editPersonalizedProfile" style="margin-top:14px">Revisar mis respuestas</button>
      </div>`;
    document.querySelector("#editPersonalizedProfile")?.addEventListener("click",()=>{ ctx.step=0; ctx.data.status="draft"; renderStep(); });
  }

  function renderStep() {
    document.querySelector("#bottomnav").style.display="none";
    document.querySelector("#routeBar").innerHTML="";
    const stats=document.querySelector("#statStrip"); if(stats) stats.innerHTML="";
    document.querySelector("#topbarSub").textContent="Configura tu plan";
    const renderer=ctx.steps[ctx.step];
    document.querySelector("#view").innerHTML=`<form id="personalizedOnboardingForm" class="po-wrap">${renderer()}<div class="po-actions">${ctx.step>0?'<button type="button" class="btn" id="poBack">Atrás</button>':""}<button type="submit" class="btn btn-primary">${ctx.step===ctx.steps.length-1?"Guardar perfil":"Continuar"}</button></div></form>`;
    const form=document.querySelector("#personalizedOnboardingForm");
    bindDynamicUI(form);
    document.querySelector("#poBack")?.addEventListener("click",()=>{ collect(form); ctx.step=Math.max(0,ctx.step-1); renderStep(); window.scrollTo(0,0); });
    form.addEventListener("submit",async e=>{
      e.preventDefault(); collect(form);
      const error=validateStep(); if(error){ if(typeof showToast==="function") showToast(error); return; }
      if(ctx.step===ctx.steps.length-1){ await finish(); return; }
      ctx.step++; ctx.data.step=ctx.step; saveDraftLocal(); renderStep(); window.scrollTo(0,0);
    });
  }

  async function start(user) {
    if(!user?.uid) return;
    let cloud=null;
    try { cloud=await CloudSync.pullPersonalizedOnboarding(user.uid); } catch(e){ console.warn("No se pudo leer onboarding personalizado",e); }
    const local=loadDraftLocal(user.uid);
    const data=cloud || local || blankData();
    ctx={ user, data, step:Number(data.step)||0, steps:[stepProfile,stepGoals,stepGoalDetails,stepBackground,stepAvailability,stepRecovery,stepNutrition,stepSupplements,stepPreferences,stepReview] };
    if(data.status==="completed"){ renderCompleted(); return; }
    ctx.step=Math.min(Math.max(ctx.step,0),ctx.steps.length-1);
    renderStep();
  }

  window.PersonalizedOnboarding={ start };
})();
