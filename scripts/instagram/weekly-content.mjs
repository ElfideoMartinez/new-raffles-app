#!/usr/bin/env node
// Local, approval-required editorial drafts. Never schedules or publishes.
export function selectEvent(profiles, date, exact, past = false) {
  validDate(date);
  const events = new Map();
  for (const p of profiles) {
    const e = p._event;
    if (!e?.name || !e.date) continue;
    validDate(e.date);
    if (events.has(e.name) && events.get(e.name).date !== e.date) throw new Error(`Conflicting event dates: ${e.name}`);
    events.set(e.name, {name:e.name,date:e.date});
  }
  if (exact !== undefined) {
    if (!events.has(exact)) throw new Error(`No exact event match: ${exact}`);
    if (past && events.get(exact).date >= date) throw new Error(`Future/current event rejected for recap: ${exact}`);
    if (!past && events.get(exact).date < date) throw new Error(`Past/stale event rejected: ${exact}`);
    return events.get(exact);
  }
  return [...events.values()].filter(e=>past?e.date<date:e.date>=date).sort((a,b)=>(past?b.date.localeCompare(a.date):a.date.localeCompare(b.date))||a.name.localeCompare(b.name))[0] ?? null;
}
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE,'../..');
const slugify = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc = s => String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const record = p => p?.record && ['wins','losses','draws'].every(k=>Number.isInteger(p.record[k]??(k==='draws'?0:NaN))&&(p.record[k]??0)>=0) ? `${p.record.wins}-${p.record.losses}-${p.record.draws??0}` : null;
const spanishDate = date => new Intl.DateTimeFormat('es-MX',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${date}T12:00:00Z`));
function sourceLabel(profiles) {
  const labels=profiles.flatMap(p=>(p.sources??[]).flatMap(s=>{
    try {
      const url=new URL(s.url);
      if(!['https:','http:'].includes(url.protocol))return [];
      const host=url.hostname.replace(/^www\./,'');
      if(host==='espn.com'||host.endsWith('.espn.com'))return ['ESPN'];
      if((host==='ufc.com'||host==='ufcespanol.com')&&url.pathname.startsWith('/athlete/'))return ['UFC · atletas'];
      return [host];
    } catch { return []; }
  }));
  return `Fuente: ${[...new Set(labels)].sort().join(' · ')||'sin datos verificados'}`;
}
function portrait(root,p) {
  const file=p.photo?.file;
  if (!file || !/\.(png|jpe?g)$/i.test(file)) return '';
  const dir=path.resolve(root,'fighters',p.slug);
  const target=path.resolve(dir,file);
  if (!target.startsWith(dir+path.sep) || !fs.existsSync(target)) return '';
  return `data:image/${/\.png$/i.test(file)?'png':'jpeg'};base64,${fs.readFileSync(target).toString('base64')}`;
}
export function buildPlan({profiles,date=localDate(),event:exact,root=ROOT}) {
  const slots=daySlots(date);
  const event=selectEvent(profiles,date,exact,slots.day===0);
  const relevant=profiles.filter(p=>!event||p._event?.name===event.name).sort((a,b)=>a.slug.localeCompare(b.slug));
  const ordered=[...relevant].sort((a,b)=>(a._event?.bouts?.[0]?.order??999)-(b._event?.bouts?.[0]?.order??999)||a.slug.localeCompare(b.slug));
  // Reciprocal profile entries confirm the pairing; order alone does not establish a card segment.
  const confirmedBouts=[];
  for(const p of ordered)for(const b of p._event?.bouts??[]) {
    if(!Number.isInteger(b.order)||b.order<0||b.order>3||confirmedBouts.some(x=>x.order===b.order))continue;
    const opponent=relevant.find(q=>q.name===b.opponent&&(q._event?.bouts??[]).some(other=>other.order===b.order&&other.opponent===p.name));
    if(opponent)confirmedBouts.push({order:b.order,left:p,right:opponent});
  }
  confirmedBouts.sort((a,b)=>a.order-b.order);
  const assignedOrder=[0,0,1,2,3,0,0][slots.day];
  let left,right,bout,pair,observed,comparison;
  function selectPair(order) {
    const selected=confirmedBouts.find(b=>b.order===order)??confirmedBouts[0];
    left=selected?.left??ordered[0];right=selected?.right??null;
    bout=selected??left?._event?.bouts?.[0];
    pair=right?`${left.name} vs. ${right.name}`:left?.name??'Comunidad UFC';
    observed=left&&record(left)?`${left.name}: ${record(left)}`:'Récord no disponible';
    comparison=right&&record(right)?`${observed} · ${right.name}: ${record(right)}`:observed;
  }
  selectPair(assignedOrder);
  const subjectMetadata=()=>({subject:left?.name??'Comunidad UFC',featuredFighters:[left,right].filter(Boolean).map(p=>({slug:p.slug,name:p.name})),featuredBout:right?{order:bout.order,label:pair,fighters:[left.slug,right.slug]}:null});
  const days=event?(Date.parse(event.date)-Date.parse(date))/86400000:null;
  const active=event&&days>=0&&days<=6;
  const mode=active?'event':'evergreen';
  const key=event?`${slugify(event.name)}-${event.date}`:'evergreen';
  const base=`instagram-pack/.automation/weekly/${key}/${date}`;
  const provenance=relevant.map(p=>({file:`fighters/${p.slug}/profile.json`,fields:['_event','record','photo'],sources:p.sources??[],photo:p.photo??null}));
  const missingPortraits=relevant.filter(p=>!portrait(root,p)).map(p=>p.slug);
  const side=p=>({slug:p.slug,name:esc(p.name),initials:esc(p.initials??p.name.split(/\s+/).map(w=>w[0]).join('').slice(0,2)),photoDataUri:portrait(root,p),record:record(p)??'Récord no disponible'});
  const eventTimes=[...new Set(relevant.flatMap(p=>(p._event?.bouts??[]).map(b=>b.date)).filter(d=>d&&/[TZ]|[+-]\d\d:\d\d$/.test(d)&&Number.isFinite(Date.parse(d))))].sort((a,b)=>Date.parse(a)-Date.parse(b));
  const eventTime=eventTimes[0]??null;

  const inputs=(id,template,kind)=>({slug:`weekly-${key}-${date}-${id}`,only:kind,locale:'es-MX',brand:{name:'Rifas Mtz',handle:'@bet.mx.ufc'},templates:{[kind]:path.join(HERE,'templates',`${template}.html`)},event:{kicker:active?'PRÓXIMO EVENTO':'ARCHIVO UFC',title:esc(event?.name??'Comunidad UFC')},cta:'Participa en historias',caption:{text:'Prueba la app: https://rifasmtz.web.app/',hashtags:'#UFC #RifasMtz'}});
  function content(topic) {

    const question={template:'story-survey',headline:'¿Tu favorito?',sub:pair,lines:right?[{label:'A',value:left.name},{label:'B',value:right.name}]:[{label:'A',value:'Golpeo'},{label:'B',value:'Grappling'}],guidance:'Añadir manualmente sticker Encuesta con las dos opciones de la imagen.'};
    const info={template:'story-trivia',headline:active?'UFC':'MMA',sub:active?event.name:'Archivo de peleadores',context:active?spanishDate(event.date):'¿Qué peleador no te pierdes cuando compite?',lines:[{text:observed}],guidance:'Añadir manualmente sticker Preguntas: ¿qué pelea te interesa?'};
    switch(topic) {
      case 'event': return info;
      case 'spotlight': return {...info,headline:record(left)?String(left.record.wins):'MMA',sub:left?.name??'Comunidad UFC',context:record(left)?'Victorias profesionales de MMA, no solo UFC.':'Perfil pendiente; comparte tu peleador favorito.'};
      case 'trivia-question': return {...question,headline:'¿Cuántas victorias?',sub:left?.name??'¿Tu estilo favorito?',lines:record(left)?[{label:'A',value:String(left.record.wins)},{label:'B',value:String(left.record.wins+1)}]:question.lines,guidance:'Añadir sticker Cuestionario; la respuesta se revela en la siguiente historia.'};
      case 'trivia-answer': return {...info,headline:record(left)?String(left.record.wins):'MMA',sub:'Respuesta',context:record(left)?`Victorias profesionales de MMA de ${left.name}, no solo UFC.`:'Dato pendiente; no se inventa una respuesta.'};
      case 'comparison': case 'teaser': return {...info,headline:'VS',sub:pair,context:comparison};
      case 'winner-poll': case 'final-picks': case 'final-poll': return {...question,template:right?'story-matchup-poll':question.template};
      case 'predictions': return {...info,template:right?'story-matchup-hype':info.template,headline:'SUBE LA EMOCIÓN',sub:'¿Cuánto esperas esta pelea?',context:active?spanishDate(event.date):'Comunidad UFC'};
      case 'method-question': return {...question,headline:'¿Por qué vía?',lines:[{label:'A',value:'KO / sumisión'},{label:'B',value:'Decisión'}]};
      case 'main-card': return {...info,headline:'CARTELERA',context:'¿Qué pelea no te quieres perder?',guidance:'Inicio de cartelera principal pendiente: no anunciar un horario sin confirmación explícita.'};
      case 'schedule': return {...info,headline:active?'DÍA DE UFC':'MMA',context:active?spanishDate(event.date):'¿Qué pelea recomendarías para ver de nuevo?',guidance:'Añadir recordatorio solo después de reconfirmar el horario. Los horarios de peleas pueden cambiar.'};
      case 'countdown': return {...question,headline:active?'Cuenta regresiva':'¿Qué prefieres?',guidance:active&&eventTime?`Añadir manualmente sticker Cuenta regresiva para ${eventTime} (${TIMEZONE}); reconfirmar hora antes de publicar.`:'Sin hora confirmada: usar Encuesta, no cuenta regresiva.'};
      case 'question-box': return {...question,headline:'Tu pregunta',guidance:'Añadir manualmente sticker Preguntas: ¿qué quieres ver de esta cartelera?'};
      case 'recap': return {...question,template:'story-trivia',headline:'Comunidad',sub:event?`Después de ${event.name}`:'Comunidad UFC',context:'¿Qué pelea volverías a ver?',lines:[{text:'¿Prefieres el intercambio de pie o la técnica en el suelo?'}],guidance:'Añadir sticker Preguntas: ¿qué pelea volverías a ver? No afirmar resultados sin verificación.'};
      case 'reaction': return {...info,headline:'TU MOMENTO',sub:'La comunidad opina',context:'¿Qué momento de la cartelera te gustaría comentar?',guidance:'Resultados pendientes de verificar; no afirmar ganadores sin resultado oficial.'};
      case 'next-opponent': return {...question,headline:'¿Qué sigue?',sub:'Rivales hipotéticos, no anuncios',guidance:'Añadir manualmente sticker Preguntas: ¿qué rival te gustaría ver? No afirmar un combate confirmado.'};
      case 'anticipated-poll': return {...question,template:active&&right?'story-matchup-poll':'story-interactive-quiz',headline:'¿La más esperada?',sub:active?'¿Es la pelea que más esperas?':'¿Qué estilo prefieres?',lines:[{label:'A',value:active?'La destacada':'Golpeo'},{label:'B',value:active?'Otra pelea':'Grappling'}],guidance:'No confundir interés por la pelea con un pronóstico.'};
      default: return question;
    }
  }
  const stories=slots.stories.map((slot,i)=>{
    selectPair(slots.day===6?i:assignedOrder);
    const metadata=subjectMetadata();
    if(['spotlight','trivia-question','trivia-answer'].includes(slot.topic))metadata.featuredFighters=metadata.featuredFighters.slice(0,1);
    else metadata.subject=pair;
    const c=content(slot.topic), input=inputs(slot.id,c.template,'story');
    const safeZone={x:140,y:1380,width:800,height:230,canvasWidth:1080,canvasHeight:1920};
    let interaction={type:'question',prompt:'¿Qué pelea te interesa?',native:true,safeZone};
    if(['winner-poll','final-picks','final-poll','method-question','anticipated-poll'].includes(slot.topic))interaction={...interaction,type:'poll',prompt:c.headline,options:c.lines.map(l=>l.value)};
    if(['spotlight','predictions'].includes(slot.topic))interaction={...interaction,type:'emoji_slider',prompt:slot.topic==='spotlight'?'¿Cuánto te emociona verlo pelear?':'¿Cuánto esperas esta pelea?',emoji:'🔥'};
    if(slot.topic==='trivia-question'&&record(left))interaction={...interaction,type:'quiz',prompt:`¿Cuántas victorias profesionales tiene ${left.name}?`,options:c.lines.map(l=>l.value),correctOptionIndex:0};
    if(slot.topic==='trivia-answer')interaction.prompt='¿Qué otro dato te gustaría conocer?';
    if(['question-box','next-opponent','recap','reaction','main-card'].includes(slot.topic))interaction.prompt=slot.topic==='next-opponent'?'¿Qué rival te gustaría ver?':slot.topic==='question-box'?'¿Qué quieres saber de esta cartelera?':c.context??c.headline;
    if(slot.topic==='countdown') {
      const confirmed=left?._event?.countdown;
      if(active&&confirmed?.confirmed===true&&confirmed.checkedAt===date&&/^https:\/\//.test(confirmed.sourceUrl??'')&&confirmed.label&&Number.isFinite(Date.parse(confirmed.at))&&confirmed.at.slice(0,10)>=date) {
        interaction={...interaction,type:'countdown',prompt:confirmed.label,targetAt:confirmed.at,timezone:TIMEZONE,sourceUrl:confirmed.sourceUrl,checkedAt:confirmed.checkedAt};
        c.headline='CUENTA REGRESIVA';c.sub=confirmed.label;c.lines=[];
      } else {interaction={...interaction,type:'emoji_slider',prompt:'¿Cuánto esperas esta cartelera?',emoji:'🔥'};c.headline='YA SE ACERCA';c.sub=active?event.name:'Comunidad UFC';c.lines=[];}
    }
    interaction.manualInstructions=`Añadir manualmente el sticker nativo ${interaction.type}: ${interaction.prompt}${interaction.options?` · ${interaction.options.join(' / ')}`:''}${interaction.emoji?` · ${interaction.emoji}`:''}${interaction.targetAt?` · ${interaction.targetAt} (${TIMEZONE})`:''}. Colocarlo en el área limpia x=140, y=1380, 800×230; no está incrustado en la imagen.`;
    c.guidance=interaction.manualInstructions;
    if(interaction.type==='quiz')c.guidance+=` Respuesta correcta: ${interaction.options[interaction.correctOptionIndex]}. Si Cuestionario no está disponible, usar Encuesta y revelar la respuesta en la siguiente historia.`;
    if(slot.topic==='countdown'&&interaction.type!=='countdown')c.guidance+=' Sin hora confirmada hoy: no añadir Cuenta regresiva.';
    if(slot.topic==='main-card')c.guidance+=' Inicio de cartelera principal pendiente: no anunciar horario.';
    if(slot.topic==='reaction')c.guidance+=' Resultados pendientes de verificar: no afirmar ganadores.';
    if(!c.template.startsWith('story-matchup-'))c.template=interaction.type==='quiz'||slot.topic==='anticipated-poll'?'story-interactive-quiz':['question-box','recap'].includes(slot.topic)?'story-interactive-question':'story-interactive-info';
    if(slot.topic==='spotlight'&&left){c.template='story-portrait-spotlight';input.fighter=side(left);}
    const trivia=left&&['trivia-question','trivia-answer'].includes(slot.topic);
    if(trivia){
      c.template='story-portrait-trivia';input.fighter=side(left);
      if(slot.topic==='trivia-question'){
        delete input.fighter.record;
        c.context='Victorias profesionales de MMA, no solo UFC. Respuesta en la siguiente historia.';
        c.lines=[];
      }
    }
    input.templates.story=path.join(HERE,'templates',`${c.template}.html`);
    if(slots.day===4&&i===1)c.guidance+=' Tras publicar el feed aprobado, compartir el feed manualmente en historias; no se publica automáticamente.';
    input.story={headline:esc(c.headline),sub:esc(c.sub),context:esc(c.context),prompt:esc(interaction.prompt),source:esc(sourceLabel(relevant)),lines:c.lines.map(l=>Object.fromEntries(Object.entries(l).map(([k,v])=>[k,esc(v)])))};
    if(trivia)input.story.reveal=slot.topic==='trivia-answer';
    input.caption.text=`${c.headline}\n${c.sub}\n${c.context??''}\n${slot.topic==='trivia-question'?'':c.template.startsWith('story-matchup-')?comparison:observed}\n${active?`${event.name} · ${spanishDate(event.date)}\n`:''}${sourceLabel(trivia?[left]:relevant)}\n@bet.mx.ufc`;
    if(c.template.startsWith('story-matchup-'))input.matchup={left:side(left),right:side(right),center:'VS'};
    return {...metadata,id:`${key}:${date}:${slot.id}`,kind:'story',slot:slot.id,template:c.template,path:`${base}/${slot.id}/story.jpg`,interaction,publicCaption:input.caption.text,recommendedTime:slot.time,recommendedAt:slot.topic==='main-card'?'Inicio de cartelera principal pendiente de confirmación':slot.time?`${date} ${slot.time} ${TIMEZONE}`:eventTime?`${eventTime} · ${['antes de primera pelea','antes de primera pelea','reconfirmar cartelera principal','tras verificar resultados'][i]}`:'Pendiente de horario confirmado',stickerGuidance:c.guidance,input};
  });
  selectPair(assignedOrder);
  let feed=null;
  if(slots.feed&&active&&left&&right&&record(left)&&record(right)) {
    const template=slots.day===1?'feed-vs':'feed-matchup-insight';
    const input=inputs(slots.feed.id,template,'feed');
    const side=p=>({name:esc(p.name),initials:esc(p.initials??p.name.split(/\s+/).map(w=>w[0]).join('').slice(0,2)),photoDataUri:portrait(root,p),record:record(p),stats:[{label:'Récord',value:record(p)}]});
    input.matchup={left:side(left),right:side(right),center:'VS',label:slots.day===1?'SEMANA DE PELEA':'COMPARACIÓN DE RÉCORDS',insights:[{icon:'VS',text:esc(`${left.name}: ${left.record.wins} victorias; ${right.name}: ${right.record.wins}.`)},{icon:'=',text:esc(`Derrotas: ${left.record.losses} vs. ${right.record.losses}. Empates: ${left.record.draws??0} vs. ${right.record.draws??0}.`)},{icon:'i',text:'Récord profesional recopilado, no solo UFC. No predice el resultado.'}]};
    input.caption.text=`${pair}\n${event.name} · ${spanishDate(event.date)}\n${comparison}\nRécord profesional de MMA, no solo UFC; no es una predicción.\n${sourceLabel(relevant)}\nPrueba la app: https://rifasmtz.web.app/`;
    input.cta='Compara los récords';
    feed={...subjectMetadata(),subject:pair,id:`${key}:${date}:${slots.feed.id}`,slot:slots.feed.id,template,path:`${base}/${slots.feed.id}/feed.jpg`,recommendedTime:'19:00',input};
  }
  if(slots.feed&&!active) {
    const featured=[...profiles].sort((a,b)=>a.slug.localeCompare(b.slug)).find(p=>record(p)&&sourceLabel([p])!=='Fuente: sin datos verificados');
    if(featured) {
      const template='feed-funfact';
      const input=inputs(slots.feed.id,template,'feed');
      input.event={kicker:'ARCHIVO UFC',title:'Comunidad UFC'};
      input.funfact={heading:esc(featured.name),items:[{icon:'W',text:esc(`${featured.record.wins} victorias profesionales.`)},{icon:'L',text:esc(`${featured.record.losses} derrotas · ${featured.record.draws??0} empates.`)},{icon:'i',text:'Récord profesional de MMA, no solo UFC.'}],source:esc(sourceLabel([featured]))};
      input.caption.text=`${featured.name}: ${record(featured)}\nRécord profesional de MMA, no solo UFC.\n${sourceLabel([featured])}\n¿Qué pelea suya recomiendas?\nPrueba la app: https://rifasmtz.web.app/`;
      input.cta='¿Qué pelea recomiendas?';
      feed={id:`${key}:${date}:${slots.feed.id}`,slot:slots.feed.id,template,path:`${base}/${slots.feed.id}/feed.jpg`,recommendedTime:'19:00',input};
      if(!provenance.some(p=>p.file===`fighters/${featured.slug}/profile.json`))provenance.push({file:`fighters/${featured.slug}/profile.json`,fields:['record'],sources:featured.sources});
    }
  }
  for(const item of stories)item.manualGuidance=`REVISIÓN · aprobación y publicación manual\n${item.slot} · ${item.recommendedAt}\n${item.stickerGuidance}`;
  if(feed){feed.kind='feed';feed.publicCaption=`${feed.input.caption.text}\n\n${feed.input.caption.hashtags}`;feed.manualGuidance=`REVISIÓN · feed para aprobación y publicación manual\n${date} ${feed.recommendedTime} ${TIMEZONE}\n${slots.day===4?'Compartir manualmente en historias después de publicar.':''} No se programa ni publica automáticamente.`;}
  return {version:2,account:'@bet.mx.ufc',timezone:TIMEZONE,date,event,eventDate:event?.date??null,mode,approvalRequired:true,publishing:'manual approval required; no scheduling or publishing',directory:base,manifestPath:`${base}/manifest.json`,deliveryReceiptsPath:`${base}/delivery-receipts.json`,stories,feed,provenance,missingPortraits,coverage:{fighters:relevant.length,sourcedProfiles:relevant.filter(p=>p.sources?.length).length,featuredMatchup:right?[left.slug,right.slug]:[]},unresolved:['Reconfirmar cambios de cartelera y horarios antes de publicar.','Verificar derechos de imágenes © UFC antes de publicar.',...(slots.feed&&!feed?['Feed omitido: faltan una pareja con récords o un récord profesional con fuente para contenido de archivo.']:[])],feedReshareGuidance:slots.day===4?'Tras publicar el feed aprobado, compartirlo manualmente en historias; este pack no lo publica.':null};
}
function saveJson(file,data) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=`${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp,JSON.stringify(data,null,2)+'\n');fs.renameSync(temp,file);
}
function readJson(file,fallback) { return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback; }
async function renderLocal(input,destination,inputPath) {
  const result=spawnSync(process.execPath,[path.join(HERE,'generate.mjs'),inputPath],{cwd:ROOT,encoding:'utf8',env:process.env});
  if(result.status!==0)throw new Error(`Render failed: ${result.stderr||result.stdout}`);
  const source=path.join(ROOT,'instagram-pack/out',input.slug);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  for(const name of [`${input.only}.jpg`,'caption.txt','manifest.json'])fs.copyFileSync(path.join(source,name),path.join(path.dirname(destination),name));
}
async function telegramSend(story,root,guidance=false) {
  const envPath=path.join(os.homedir(),'.hermes/scripts/.ufc-telegram.env');
  const saved={};
  if(fs.existsSync(envPath))for(const line of fs.readFileSync(envPath,'utf8').split('\n')){
    const match=line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);if(match)saved[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');
  }
  const token=process.env.TELEGRAM_BOT_TOKEN||saved.TELEGRAM_BOT_TOKEN;
  const chat=process.env.TELEGRAM_CHAT_ID||saved.TELEGRAM_CHAT_ID;
  if(!token||!chat)throw new Error('Telegram credentials missing');
  const body=new FormData();body.set('chat_id',chat);
  if(guidance)body.set('text',story.manualGuidance);
  else {body.set('caption',story.publicCaption.slice(0,1024));body.set('photo',new Blob([fs.readFileSync(path.join(root,story.path))],{type:'image/jpeg'}),`${story.kind}.jpg`);}
  let response;
  try { response=await fetch(`https://api.telegram.org/bot${token}/${guidance?'sendMessage':'sendPhoto'}`,{method:'POST',body,signal:AbortSignal.timeout(30000)}); }
  catch { throw new Error('Telegram delivery ambiguous; inspect chat before retrying (Bot API has no idempotency key).'); }
  const data=await response.json();
  // Only an explicit Bot API rejection proves that Telegram did not accept the send.
  if(data?.ok===false)throw Object.assign(new Error(`Telegram rejected story: ${data.description??response.status}`),{deliveryRejected:true});
  if(!response.ok||data?.ok!==true||!data.result?.message_id)throw new Error('Telegram delivery ambiguous; manual reconciliation required (invalid response).');
  return data.result;
}
export async function run({root=ROOT,date=localDate(),event,dryRun=false,notify=false,render=renderLocal,send=telegramSend,sendGuidance}={}) {
  root=path.resolve(root);
  const fightersDir=path.join(root,'fighters');
  const profiles=fs.existsSync(fightersDir)?fs.readdirSync(fightersDir,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(fightersDir,e.name,'profile.json'))).map(e=>({...readJson(path.join(fightersDir,e.name,'profile.json')),slug:e.name})):[];
  const plan=buildPlan({root,profiles,date,event});
  const dir=path.join(root,plan.directory);fs.mkdirSync(dir,{recursive:true});
  // Exclusive lock protects concurrent cron/manual retries; stale locks require inspection.
  const lock=path.join(dir,'.lock');let fd;
  try{fd=fs.openSync(lock,'wx');}catch{throw new Error(`Weekly pack is locked: ${lock}`);}
  try {
    const manifestPath=path.join(dir,'manifest.json');
    const previous=readJson(manifestPath,null);
    for(const item of [...plan.stories,...(plan.feed?[plan.feed]:[])]) {
      const destination=path.join(root,item.path);const inputPath=path.join(path.dirname(destination),'input.json');
      const fingerprint=createHash('sha256').update(JSON.stringify(item.input)).update(fs.readFileSync(item.input.templates[item.input.only])).digest('hex');
      item.fingerprint=fingerprint;
      saveJson(inputPath,item.input);
      if(!dryRun) {
        const old=[...(previous?.stories??[]),...(previous?.feed?[previous.feed]:[])].find(p=>p.id===item.id);
        if(old?.fingerprint!==fingerprint||!fs.existsSync(destination))await render(item.input,destination,inputPath);
        if(!fs.existsSync(destination))throw new Error(`Renderer did not create ${destination}`);
      }
    }
    plan.status=dryRun?'dry-run':'rendered';
    const publicPlan=JSON.parse(JSON.stringify(plan));
    for(const item of [...publicPlan.stories,...(publicPlan.feed?[publicPlan.feed]:[])])delete item.input;
    // A dry-run never downgrades an existing rendered manifest.
    if(!dryRun||!previous)saveJson(manifestPath,publicPlan);
    if(notify&&!dryRun) {
      const receiptPath=path.join(dir,'delivery-receipts.json');const receipts=readJson(receiptPath,{});
      const guidance=sendGuidance??(send===telegramSend?((item,base)=>telegramSend(item,base,true)):null);
      async function deliver(story,kind,transport) {
        const receipt=receipts[story.id]??={fingerprint:story.fingerprint};
        const idKey=kind==='photo'?'messageId':'guidanceMessageId',statusKey=`${kind}Status`;
        if(receipt[idKey])return; // Preserve compatibility with existing successful receipts.
        if(receipt[statusKey]&&receipt[statusKey]!=='rejected')throw new Error(`Telegram ${kind} ${story.id} requires manual reconciliation; inspect chat and ${receiptPath} before retrying.`);
        receipt[statusKey]='sending';receipt[`${kind}AttemptedAt`]=new Date().toISOString();
        saveJson(receiptPath,receipts); // Persist intent before any external side effect.
        try {
          const result=await transport(story,root);
          if(!result?.message_id)throw new Error(`Telegram ${kind} response missing message_id`);
          receipt[idKey]=result.message_id;receipt[statusKey]='delivered';
          if(kind==='photo'){receipt.chatId=result.chat?.id??null;receipt.deliveredAt=new Date().toISOString();}
          saveJson(receiptPath,receipts);
        } catch(error) {
          receipt[statusKey]=error?.deliveryRejected===true?'rejected':'ambiguous';saveJson(receiptPath,receipts);
          throw error;
        }
      }
      for(const story of [...plan.stories,...(plan.feed?[plan.feed]:[])]) {
        await deliver(story,'photo',send);
        if(guidance)await deliver(story,'guidance',guidance);
      }
    }
    return publicPlan;
  } finally {fs.closeSync(fd);fs.unlinkSync(lock);}
}
async function main() {
  const opts={};
  for(const arg of process.argv.slice(2)) {
    if(arg==='--notify')opts.notify=true;
    else if(arg==='--dry-run')opts.dryRun=true;
    else if(/^--(date|event|root)=.+/.test(arg)){const at=arg.indexOf('=');opts[arg.slice(2,at)]=arg.slice(at+1);}
    else throw new Error(`Unknown argument: ${arg}. Usage: weekly-content.mjs [--date=YYYY-MM-DD] [--event=EXACT] [--root=PATH] [--dry-run] [--notify]`);
  }
  console.log(JSON.stringify(await run(opts),null,2));
}

export const TIMEZONE = 'America/Chihuahua';
export function localDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
}
function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date) throw new Error(`Invalid date: ${date}`);
  return date;
}
export function daySlots(date) {
  validDate(date);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const topics = [
    ['recap','next-opponent'], ['event','anticipated-poll'], ['spotlight','trivia-question','trivia-answer'],
    ['comparison','winner-poll','method-question'], ['teaser','predictions'],
    ['schedule','countdown','final-picks','question-box'], ['schedule','final-poll','main-card','reaction'],
  ][day];
  return {day, stories:topics.map((topic,i)=>({id:`story-${topic}`,topic,time:day===6?null:day===1||day===4||day===5&&i<2?'13:00':'19:00'})),
    feed:day===1?{id:'feed-monday-fightweek',time:'19:00'}:day===4?{id:'feed-thursday-comparison',time:'19:00'}:null};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
