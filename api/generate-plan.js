/* FORJA21 — Groq por etapas, plan maestro dividido */
const MODEL = "openai/gpt-oss-120b";
const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  "AIzaSyCIWY-_Sv-Bi5PHYy-IUKX3LrC0VxMcxGg";

function json(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  return res.end(JSON.stringify(body));
}

async function verifyFirebaseToken(idToken){
  if(!idToken) return null;
  const r=await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
    {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken})}
  );
  if(!r.ok) return null;
  const data=await r.json();
  return data.users?.[0]||null;
}

function systemPrompt(){
  return `Eres el motor de planificación de FORJA21.
Devuelve siempre UN único objeto JSON válido, sin Markdown ni texto adicional.
Respeta estrictamente los datos del usuario.
No inventes lesiones, marcas ni disponibilidad.
Prioriza seguridad, recuperación, adherencia y progresión gradual.`;
}

function extractJson(text){
  const clean=String(text||"").trim()
    .replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
  try{return JSON.parse(clean);}catch(_){}
  const a=clean.indexOf("{"), b=clean.lastIndexOf("}");
  if(a>=0 && b>a) return JSON.parse(clean.slice(a,b+1));
  throw new Error("La IA no devolvió un JSON válido.");
}

async function groq(prompt,maxTokens){
  const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${process.env.GROQ_API_KEY}`
    },
    body:JSON.stringify({
      model:MODEL,
      messages:[
        {role:"system",content:systemPrompt()},
        {role:"user",content:prompt}
      ],
      temperature:0.15,
      max_completion_tokens:maxTokens,
      response_format:{type:"json_object"}
    })
  });

  let raw=null; try{raw=await r.json();}catch(_){}
  if(!r.ok){
    const msg=raw?.error?.message||raw?.message||`Groq devolvió ${r.status}`;
    const tooLarge=/request too large/i.test(msg);
    const limited=r.status===429 || /tokens per minute|rate limit|too many requests/i.test(msg);
    const e=new Error(msg);
    if(tooLarge) e.code="REQUEST_TOO_LARGE";
    else if(limited){e.code="RATE_LIMIT"; e.retryAfterSeconds=20;}
    else e.code=String(r.status);
    throw e;
  }
  return extractJson(raw?.choices?.[0]?.message?.content||"");
}

function corePrompt(profile,email){
  return `Genera SOLO la estructura maestra de FORJA21. NO generes weeklyTargets ni semanas detalladas.

USUARIO: ${email||""}
CUESTIONARIO: ${JSON.stringify(profile)}

Devuelve:
{
 "schemaVersion":1,
 "title":"string",
 "athleteName":"string",
 "generatedFor":"string",
 "startDate":"YYYY-MM-DD",
 "totalWeeks":12,
 "primaryGoal":"string",
 "secondaryGoals":["string"],
 "strategySummary":"string",
 "safetyNotes":["string"],
 "milestones":[{"week":1,"date":"YYYY-MM-DD","label":"string","target":"string"}],
 "phases":[{
   "id":1,"name":"string","weekFrom":1,"weekTo":4,
   "summary":"string","focus":["string"],"progression":"string","nutritionFocus":"string"
 }],
 "firstBlockSummary":"string",
 "firstBlockProgressionRules":["string"]
}

REGLAS:
- Usa la duración pedida por el usuario.
- phases cubre de la semana 1 a totalWeeks sin huecos.
- Respeta prioridad de objetivos, disponibilidad, experiencia, material y limitaciones.
- Si hay fecha de competición, periodiza hacia ella.
- Incluye descarga cuando proceda.
- NO incluyas weeklyTargets.
- Devuelve solo JSON.`;
}

function targetsPrompt(profile,core){
  return `Genera SOLO los objetivos semanales del siguiente plan maestro.

PLAN:
${JSON.stringify({
  startDate:core.startDate,
  totalWeeks:core.totalWeeks,
  primaryGoal:core.primaryGoal,
  secondaryGoals:core.secondaryGoals,
  strategySummary:core.strategySummary,
  phases:core.phases
})}

CUESTIONARIO:
${JSON.stringify(profile)}

Devuelve exactamente:
{
 "weeklyTargets":[
   {
    "week":1,
    "focus":"string",
    "trainingSessions":4,
    "runningKmApprox":0,
    "weightTargetKg":0,
    "note":"string"
   }
 ]
}

REGLAS:
- Debe haber EXACTAMENTE ${Number(core.totalWeeks)||1} elementos.
- Las semanas deben ir de 1 a ${Number(core.totalWeeks)||1}, sin saltos ni duplicados.
- trainingSessions respeta disponibilidad.
- runningKmApprox=0 si correr no forma parte del objetivo.
- weightTargetKg=0 si no procede fijar un objetivo de peso semanal.
- Mantén coherencia con phases.
- Devuelve solo JSON.`;
}

function compactMaster(master){
  return {
    title:master.title,startDate:master.startDate,totalWeeks:master.totalWeeks,
    primaryGoal:master.primaryGoal,secondaryGoals:master.secondaryGoals,
    strategySummary:master.strategySummary,phases:master.phases,
    weeklyTargets:master.weeklyTargets,
    firstBlockSummary:master.firstBlockSummary,
    firstBlockProgressionRules:master.firstBlockProgressionRules
  };
}

function weekPrompt(profile,master,n,prev,email){
  const target=master.weeklyTargets?.find(x=>Number(x.week)===n)||{};
  return `Genera SOLO la semana ${n} de FORJA21.

USUARIO:${email||""}
PLAN:${JSON.stringify(compactMaster(master))}
OBJETIVO SEMANAL:${JSON.stringify(target)}
SEMANA ANTERIOR:${prev||"No existe"}
CUESTIONARIO:${JSON.stringify(profile)}

Devuelve:
{
 "week":${n},
 "focus":"string",
 "loadNote":"string",
 "days":[
  {
   "day":"Lunes",
   "type":"strength|running|mobility|rest|cross_training|other",
   "typeLabel":"string",
   "title":"string",
   "objective":"string",
   "durationMin":60,
   "warmup":"string",
   "mainWork":"string",
   "exercises":[{"name":"string","sets":"string","reps":"string","rest":"string","intensity":"string","notes":"string"}],
   "cardio":{"distanceKm":0,"durationMin":0,"pace":"string","heartRate":"string","structure":"string"},
   "cooldown":"string",
   "coachingNotes":["string"],
   "nutrition":{"mode":"string","summary":"string","kcalApprox":0,"proteinG":0,"carbsG":0,"fatG":0,
      "meals":[{"meal":"string","text":"string","kcalApprox":0}],"timingNotes":["string"]},
   "supplements":[{"name":"string","amount":"string","timing":"string","reason":"string","optional":true}]
  }
 ]
}

REGLAS:
- EXACTAMENTE 7 días en orden lunes-domingo.
- Respeta días disponibles y duración.
- Días de descanso también aparecen.
- Fuerza: ejercicios, series, repeticiones, descanso e intensidad.
- Carrera: duración/distancia y ritmo/zona/RPE; no inventes ritmos.
- Nutrición y suplementos respetan exactamente lo pedido.
- Si nutrición=none: valores 0, textos vacíos y arrays vacíos.
- Si suplementos=none: supplements=[].
- Devuelve solo JSON.`;
}

function validateCore(x){
  if(!x||!Number.isInteger(Number(x.totalWeeks))||Number(x.totalWeeks)<1) throw new Error("El plan maestro no contiene una duración válida.");
  if(!Array.isArray(x.phases)||!x.phases.length) throw new Error("El plan maestro no contiene fases.");
  return x;
}
function validateTargets(x,total){
  if(!Array.isArray(x?.weeklyTargets)) throw new Error("La IA no devolvió objetivos semanales.");
  if(x.weeklyTargets.length!==total) throw new Error(`Se esperaban ${total} objetivos semanales y se recibieron ${x.weeklyTargets.length}.`);
  return x.weeklyTargets.map((t,i)=>({
    week:i+1,
    focus:t?.focus||"",
    trainingSessions:Math.max(0,Math.round(Number(t?.trainingSessions||0))),
    runningKmApprox:Number(t?.runningKmApprox||0),
    weightTargetKg:Number(t?.weightTargetKg||0),
    note:t?.note||""
  }));
}
function normWeek(w,n){
  if(!Array.isArray(w?.days)||w.days.length!==7) throw new Error(`La semana ${n} no contiene exactamente 7 días.`);
  const names=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
  return {
    week:n,focus:w.focus||"",loadNote:w.loadNote||"",
    days:w.days.map((d,i)=>({
      day:names[i],type:d?.type||"rest",typeLabel:d?.typeLabel||"",
      title:d?.title||"",objective:d?.objective||"",
      durationMin:Math.max(0,Math.round(Number(d?.durationMin||0))),
      warmup:d?.warmup||"",mainWork:d?.mainWork||"",
      exercises:Array.isArray(d?.exercises)?d.exercises:[],
      cardio:{
        distanceKm:Number(d?.cardio?.distanceKm||0),
        durationMin:Math.max(0,Math.round(Number(d?.cardio?.durationMin||0))),
        pace:d?.cardio?.pace||"",heartRate:d?.cardio?.heartRate||"",structure:d?.cardio?.structure||""
      },
      cooldown:d?.cooldown||"",
      coachingNotes:Array.isArray(d?.coachingNotes)?d.coachingNotes:[],
      nutrition:{
        mode:d?.nutrition?.mode||"none",summary:d?.nutrition?.summary||"",
        kcalApprox:Math.max(0,Math.round(Number(d?.nutrition?.kcalApprox||0))),
        proteinG:Math.max(0,Math.round(Number(d?.nutrition?.proteinG||0))),
        carbsG:Math.max(0,Math.round(Number(d?.nutrition?.carbsG||0))),
        fatG:Math.max(0,Math.round(Number(d?.nutrition?.fatG||0))),
        meals:Array.isArray(d?.nutrition?.meals)?d.nutrition.meals:[],
        timingNotes:Array.isArray(d?.nutrition?.timingNotes)?d.nutrition.timingNotes:[]
      },
      supplements:Array.isArray(d?.supplements)?d.supplements:[]
    }))
  };
}

module.exports=async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return json(res,405,{error:"Método no permitido."});}
  if(!process.env.GROQ_API_KEY) return json(res,500,{error:"Falta GROQ_API_KEY en Vercel."});
  try{
    const auth=String(req.headers.authorization||"");
    const user=await verifyFirebaseToken(auth.startsWith("Bearer ")?auth.slice(7):"");
    if(!user) return json(res,401,{error:"Sesión no válida."});
    const profile=req.body?.profile;
    if(!profile||profile.status!=="completed"||!profile.consent) return json(res,400,{error:"El cuestionario no está completo."});

    const action=String(req.body?.action||"masterCore");

    if(action==="masterCore"){
      const core=validateCore(await groq(corePrompt(profile,user.email),1400));
      return json(res,200,{core,meta:{provider:"groq",model:MODEL,generatedAt:new Date().toISOString()}});
    }

    if(action==="targets"){
      const core=req.body?.core;
      validateCore(core);
      const total=Number(core.totalWeeks);
      const data=await groq(targetsPrompt(profile,core),Math.min(2200,700+total*85));
      const weeklyTargets=validateTargets(data,total);
      return json(res,200,{weeklyTargets});
    }

    if(action==="week"){
      const master=req.body?.master,n=Number(req.body?.weekNumber);
      if(!master||!Number.isInteger(n)||n<1||n>Math.min(4,Number(master.totalWeeks||0))) return json(res,400,{error:"Semana no válida."});
      const w=await groq(weekPrompt(profile,master,n,String(req.body?.previousWeekSummary||""),user.email),2400);
      return json(res,200,{week:normWeek(w,n)});
    }

    return json(res,400,{error:"Acción desconocida."});
  }catch(err){
    console.error("FORJA21 generate-plan",err);
    if(err?.code==="RATE_LIMIT") return json(res,429,{error:"Groq necesita esperar antes de continuar.",retryAfterSeconds:err.retryAfterSeconds||20});
    if(err?.code==="REQUEST_TOO_LARGE") return json(res,413,{error:"Esta etapa es demasiado grande para el límite gratuito.",detail:err.message});
    return json(res,500,{error:err?.message||"Error interno generando la planificación."});
  }
};
