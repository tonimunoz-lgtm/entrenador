/* FORJA21 — generación por etapas: core -> targets -> semanas */
(function(){
"use strict";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const emit=(cb,d)=>{if(typeof cb==="function")cb(d);};

async function call(user,payload,onProgress){
  const token=await user.getIdToken(true);
  for(let attempt=0;attempt<6;attempt++){
    const r=await fetch("/api/generate-plan",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
      body:JSON.stringify(payload)
    });
    let b=null;try{b=await r.json();}catch(_){}
    if(r.ok)return b;
    if(r.status===429){
      const s=Math.max(5,Number(b?.retryAfterSeconds||20));
      emit(onProgress,{type:"waiting",seconds:s,message:`Límite gratuito de Groq: continuamos automáticamente en ${s} s…`});
      await sleep((s+1)*1000);continue;
    }
    throw new Error(b?.error||`No se pudo generar el plan (${r.status}).`);
  }
  throw new Error("Groq sigue limitado temporalmente. El progreso guardado no se pierde.");
}

function prevSummary(w){
  if(!w)return "";
  return [`Semana ${w.week}.`,w.focus?`Foco: ${w.focus}.`:"",w.loadNote?`Carga: ${w.loadNote}.`:""]
    .filter(Boolean).join(" ");
}

async function generate(user,onboarding,onProgress){
  if(!user?.uid)throw new Error("No hay sesión iniciada.");
  let saved=null;try{saved=await CloudSync.pullPersonalizedPlan(user.uid);}catch(_){}

  let plan=saved||null;

  // 1 CORE
  if(!plan?.generation?.coreDone){
    emit(onProgress,{type:"core",message:"Analizando objetivos y diseñando las fases…"});
    const b=await call(user,{action:"masterCore",profile:onboarding},onProgress);
    plan={
      ...b.core,
      weeklyTargets:[],
      firstBlock:{
        blockNumber:1,weekFrom:1,weekTo:Math.min(4,Number(b.core.totalWeeks||4)),
        summary:b.core.firstBlockSummary||"",
        progressionRules:b.core.firstBlockProgressionRules||[],
        weeks:[]
      },
      generation:{status:"generating",coreDone:true,targetsDone:false,completedWeeks:0,updatedAt:new Date().toISOString()},
      meta:{...(b.meta||{}),uid:user.uid,email:user.email||"",sourceOnboardingVersion:onboarding.version||1}
    };
    await CloudSync.pushPersonalizedPlan(user.uid,plan);
    emit(onProgress,{type:"coreDone",message:"✓ Fases y estrategia creadas"});
  }

  // 2 TARGETS
  if(!plan.generation?.targetsDone || !Array.isArray(plan.weeklyTargets) || !plan.weeklyTargets.length){
    emit(onProgress,{type:"targets",message:"Creando la progresión semana a semana…"});
    const core={...plan}; delete core.firstBlock; delete core.generation; delete core.meta; delete core.weeklyTargets;
    const b=await call(user,{action:"targets",profile:onboarding,core},onProgress);
    plan.weeklyTargets=b.weeklyTargets;
    plan.generation={...(plan.generation||{}),status:"generating",coreDone:true,targetsDone:true,completedWeeks:plan.firstBlock?.weeks?.length||0,updatedAt:new Date().toISOString()};
    await CloudSync.pushPersonalizedPlan(user.uid,plan);
    emit(onProgress,{type:"targetsDone",message:"✓ Progresión completa creada"});
  }

  // 3 WEEKS
  const total=Math.min(4,Number(plan.totalWeeks||4));
  plan.firstBlock=plan.firstBlock||{blockNumber:1,weekFrom:1,weekTo:total,summary:plan.firstBlockSummary||"",progressionRules:plan.firstBlockProgressionRules||[],weeks:[]};
  plan.firstBlock.weeks=Array.isArray(plan.firstBlock.weeks)?plan.firstBlock.weeks:[];

  for(let n=plan.firstBlock.weeks.length+1;n<=total;n++){
    emit(onProgress,{type:"week",week:n,total,message:`Preparando semana ${n} de ${total}…`});
    const previous=plan.firstBlock.weeks.find(w=>Number(w.week)===n-1);
    const b=await call(user,{action:"week",profile:onboarding,master:plan,weekNumber:n,previousWeekSummary:prevSummary(previous)},onProgress);
    plan.firstBlock.weeks=[...plan.firstBlock.weeks.filter(w=>Number(w.week)!==n),b.week].sort((a,b)=>a.week-b.week);
    plan.generation={...(plan.generation||{}),status:"generating",completedWeeks:plan.firstBlock.weeks.length,totalWeeksInFirstBlock:total,updatedAt:new Date().toISOString()};
    await CloudSync.pushPersonalizedPlan(user.uid,plan);
    emit(onProgress,{type:"weekDone",week:n,total,message:`✓ Semana ${n} creada y guardada`});
  }

  plan.generation={...(plan.generation||{}),status:"ready",completedWeeks:total,totalWeeksInFirstBlock:total,completedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  await CloudSync.pushPersonalizedPlan(user.uid,plan);
  emit(onProgress,{type:"done",message:"✓ Plan completo"});
  return plan;
}

async function load(user){if(!user?.uid)return null;return CloudSync.pullPersonalizedPlan(user.uid);}
window.AIPlanService={generate,load};
})();
