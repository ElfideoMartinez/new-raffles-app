#!/usr/bin/env node
// Editorial planning report only: never generates, approves or publishes IG assets.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildCarouselPlan} from './card-carousel.mjs';
import {buildPlan,daySlots,localDate,TIMEZONE} from './weekly-content.mjs';
import puppeteer from 'puppeteer-core';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const addDays=(date,n)=>new Date(Date.parse(`${date}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
const labels={event:'Presentación del evento','anticipated-poll':'Pelea más esperada',spotlight:'Peleador destacado','trivia-question':'Trivia · pregunta','trivia-answer':'Trivia · respuesta',comparison:'Comparación de la pelea','winner-poll':'Pronóstico del ganador','method-question':'Método de victoria',teaser:'Adelanto del análisis',predictions:'Pronósticos',schedule:'Horarios por reconfirmar',countdown:'Cuenta regresiva','final-picks':'Últimos pronósticos','question-box':'Preguntas de la comunidad','final-poll':'Encuesta final','main-card':'Inicio de cartelera principal',reaction:'Reacción tras resultados',recap:'Recap / comunidad','next-opponent':'Próximo rival hipotético'};
const interactions={event:'Preguntas','anticipated-poll':'Encuesta',spotlight:'Informativa','trivia-question':'Cuestionario','trivia-answer':'Respuesta informativa',comparison:'Comparación','winner-poll':'Encuesta','method-question':'Encuesta',teaser:'Informativa',predictions:'Encuesta',schedule:'Informativa',countdown:'Cuenta regresiva solo con hora confirmada','final-picks':'Encuesta','question-box':'Preguntas','final-poll':'Encuesta','main-card':'Informativa',reaction:'Preguntas tras verificación',recap:'Preguntas','next-opponent':'Preguntas'};
export function buildWeeklyReport({profiles=[],gather,date=localDate(),event,root=ROOT,now=new Date(),receipts={}}={}) {
  daySlots(date); // validates the literal date before date arithmetic
  const selected=event??gather?.event;
  if(!selected)throw new Error('No confirmed event: provide _weekly-gather.json or --event');
  if(gather?.partial)throw new Error('Gather is partial; refusing a confirmed-card report');
  const relevant=profiles.filter(p=>p._event?.name===selected&&(!gather?.fighters||gather.event!==selected||gather.fighters.some(f=>f.name===p.name)));
  if(!relevant.length)throw new Error(`No profiles for exact event: ${selected}`);
  const dates=[...new Set(relevant.map(p=>p._event.date))];
  if(dates.length!==1)throw new Error('Conflicting card dates');
  const eventDate=dates[0];
  if(gather?.event===selected&&gather.queryDate&&gather.queryDate!==eventDate)throw new Error('Gather/profile event date mismatch');
  if(gather?.event===selected&&gather.fighters&&gather.fighters.length!==relevant.length)throw new Error('Gather fighter coverage mismatch');
  const monday=addDays(date,-((new Date(`${date}T12:00Z`).getUTCDay()+6)%7));
  const bouts=new Map();
  for(const p of relevant)for(const b of p._event.bouts??[]){
    const opponent=relevant.find(q=>q.name===b.opponent);
    if(!opponent)throw new Error(`Missing confirmed opponent: ${b.opponent}`);
    if(opponent===p||!(opponent._event.bouts??[]).some(other=>other.opponent===p.name&&other.order===b.order))throw new Error(`Nonreciprocal card matchup: ${p.name}`);
    const key=[p.name,opponent.name].sort().join('|');
    if(!bouts.has(key))bouts.set(key,{order:b.order,left:p.name,right:opponent.name,division:b.division??'',scheduledBoutAt:b.date??null});
  }
  const card={fighters:relevant.length,bouts:[...bouts.values()].sort((a,b)=>a.order-b.order)};
  if(card.bouts.length*2!==card.fighters)throw new Error('Card must contain exactly two fighters per bout');
  const pair=card.bouts[0]?`${card.bouts[0].left} vs. ${card.bouts[0].right}`:selected;
  const carousel=buildCarouselPlan({profiles:relevant,event:selected,date:monday,root});
  const days=[],items=[];
  for(let index=0;index<7;index++){
    const date=addDays(monday,index),slots=daySlots(date),plan=buildPlan({profiles:relevant,date,event:selected,root});
    const preparationTime=index===5?'07:00':'12:15';
    const day={date,name:['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][index],preparationTime,items:[]};
    const entries=[...plan.stories.map((s,i)=>({source:s,kind:'story',topic:slots.stories[i].topic})),...(slots.feed?[{source:plan.feed,kind:'feed',topic:slots.feed.id}]:[])];
    if(date===carousel.date)entries.push({source:carousel,kind:'feed',topic:carousel.slot});
    for(const {source,kind,topic} of entries){
      const slot=source?.slot??slots.feed.id;
      const id=source?.id??`${slug(selected)}-${eventDate}:${date}:${slot}`;
      let recommendedPostTime=source?.recommendedTime??slots.feed?.time??'pendiente';
      if(index===5)recommendedPostTime=topic==='main-card'?'Inicio de cartelera principal: pendiente de confirmación':topic==='reaction'?'Después de verificar resultados oficiales':'Antes de primera pelea · hora relativa pendiente de reconfirmar';
      const delivery=receipts[id]??null;
      const item={number:items.length+1,id,date,slot,kind,slideCount:source?.slideCount??1,title:kind==='feed'?(topic==='feed-full-card-carousel'?`Feed · cartelera completa · ${source.slideCount} láminas`:index===0?'Feed · semana de pelea':'Feed · análisis de la pelea'):labels[topic]??topic,subject:source?.subject??(source?.featuredFighters?.length?source.featuredFighters.map(f=>typeof f==='string'?f:f.name).join(' vs. '):topic==='spotlight'||topic.startsWith('trivia')?card.bouts[0]?.left:pair),interaction:source?.interaction?.type??interactions[topic]??(kind==='feed'?'Comentarios':'Encuesta'),recommendedPostTime,preparationTime,review:'pending',publication:kind==='feed'?'auto-scheduled-review-cancel':'manual',scheduling:kind==='feed'?(receipts[id]?.schedule??null):null,elapsed:date<localDate(now)||(date===localDate(now)&&/^\d\d:\d\d$/.test(recommendedPostTime)&&recommendedPostTime<new Intl.DateTimeFormat('en-GB',{timeZone:TIMEZONE,hour:'2-digit',minute:'2-digit',hour12:false}).format(now)),delivery:delivery?{status:'receipt-recorded',...delivery}:{status:'not-recorded'},condition:index===6?'Solo resultados verificados; si faltan, usar preguntas de comunidad sin afirmar resultados.':topic==='reaction'?'Bloqueada hasta verificar resultados oficiales.':topic==='main-card'||topic==='countdown'?'Reconfirmar horario; sin confirmación usar interacción de comunidad.':kind==='feed'&&!source?'Preparación bloqueada: faltan datos verificados.':kind==='feed'?'Programación automática con ventana de revisión / cancelación; confirmar recibo.':'Revisión y aprobación manual antes de publicar.',stickerGuidance:source?.stickerGuidance??null,contentFingerprint:hash(source?.input??source?.inputs??{topic,selected})};
      day.items.push(item);items.push(item);
    }
    days.push(day);
  }
  const counts={stories:items.filter(i=>i.kind==='story').length,feed:items.filter(i=>i.kind==='feed').length,total:items.length,fighters:card.fighters,bouts:card.bouts.length};
  if(counts.total!==new Set(items.map(i=>i.id)).size||counts.total!==counts.stories+counts.feed)throw new Error('Enumeration verification failed');
  const planFingerprint=hash({version:1,event:selected,eventDate,weekStart:monday,card,items:items.map(({elapsed,delivery,scheduling,...i})=>i)});
  return {version:1,account:'@bet.mx.ufc',timezone:TIMEZONE,event:selected,eventDate,weekStart:monday,weekEnd:addDays(monday,6),generatedAt:now.toISOString(),gatherCheckedAt:gather?.checkedAt??null,policy:'Feed: programación automática con ventana de revisión y cancelación. Historias: revisión y publicación manual. Un plan no acredita programación; solo los recibos verificados lo hacen. Horarios de prueba, no picos de audiencia demostrados.',days,items,counts,card,planFingerprint};
}

const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function reportHTML(r){
 const header=title=>`<header><div class="brand">RIFAS MTZ <span>@bet.mx.ufc</span></div><div class="eyebrow">PLAN EDITORIAL · ${r.weekStart} — ${r.weekEnd}</div><h1>${title}</h1><p class="event">${esc(r.event)}</p><div class="stats">${r.counts.stories} historias + ${r.counts.feed} feeds · ${r.counts.total} piezas · ${r.counts.bouts} peleas</div></header><div class="notice">FEED: PROGRAMACIÓN + REVISIÓN / CANCELACIÓN · HISTORIAS: MANUAL</div>`;
 const footer=n=>`<footer>America/Chihuahua · Horarios de prueba, no picos demostrados <span>${n} / 3</span><small>Entregar no acredita aprobación ni publicación. No retropublicar franjas transcurridas.</small></footer>`;
 const day=d=>`<section class="day"><div class="dayhead"><h2>${d.name} <span>${d.date}</span></h2><b>Preparar / entregar ${d.preparationTime}</b></div>${d.items.map(i=>`<article><div class="number">${String(i.number).padStart(2,'0')}</div><div class="copy"><h3><em>${i.kind==='story'?'HISTORIA':'FEED'}</em> ${esc(i.title)}</h3><p>${esc(i.subject)}</p><p><strong>${esc(i.recommendedPostTime)}</strong> · ${esc(i.interaction?.type??i.interaction)}</p><p class="condition">${esc(i.condition)}</p><p class="state">${i.elapsed?'Franja transcurrida':'Planeada'} · Revisión pendiente · ${i.delivery.messageId?`Entrega registrada #${esc(i.delivery.messageId)} (no aprobación)`:'Sin recibo de entrega'} · ${i.kind==='feed'?(i.scheduling?`Programación registrada: ${esc(i.scheduling.state??i.scheduling.status??'consultar recibo')}`:'Programación pendiente de recibo'):'Publicación manual'}</p><code>${esc(i.id)}</code></div></article>`).join('')}</section>`;
 const pages=[`<main class="page">${header('Lunes → Jueves')}${r.days.slice(0,4).map(day).join('')}${footer(1)}</main>`,`<main class="page">${header('Viernes → Domingo')}${r.days.slice(4).map(day).join('')}<aside><b>Sábado: horarios relativos.</b> Una hora de pelea destacada NO confirma el inicio de cartelera principal. Domingo: recap solo con resultados verificados; si faltan, conversación de comunidad.</aside>${footer(2)}</main>`,`<main class="page">${header('Cartelera confirmada')}<p class="intro">${r.card.fighters} peleadores · ${r.card.bouts.length} enfrentamientos · ${r.eventDate}<br>Consulta gather: ${esc(r.gatherCheckedAt??'sin fecha registrada')}</p>${r.card.bouts.map((b,i)=>`<div class="bout"><span>${String(i+1).padStart(2,'0')}</span><div><h2>${esc(b.left)} <b>vs.</b> ${esc(b.right)}</h2><p>${esc(b.division||'División pendiente')}</p></div></div>`).join('')}<aside><h2>Reglas de revisión</h2><p>${esc(r.policy)}</p><p>Reconfirmar cartelera, horarios y derechos de imagen. Este reporte no genera historias ni acredita aprobación.</p><p>Orden del gather, no clasificación principal / preliminar.</p><code>Plan ${r.planFingerprint}</code></aside>${footer(3)}</main>`];
 return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Rifas Mtz · Agenda semanal</title><style>*{box-sizing:border-box}body{margin:0;background:#080a0d;color:#f2f2f4;font-family:Arial,Helvetica,sans-serif}.page{width:1440px;min-height:1920px;padding:48px 60px 100px;position:relative;margin:0 auto 24px;background:radial-gradient(ellipse at top right,#302016 0,transparent 42%),#101318}.brand{font-size:27px;letter-spacing:4px;font-weight:900;color:#ff762f}.brand span{float:right;letter-spacing:1px;color:#d1d2d5;font-size:21px}.eyebrow{font-size:18px;color:#c8c9cb;letter-spacing:2px;margin-top:22px}h1{font-size:60px;line-height:1.05;margin:12px 0}.event{font-size:27px;margin:12px 0 16px}.stats{font-size:25px;color:#ffb488}.notice{background:#ff762f;color:#111;padding:14px 18px;font-size:18px;font-weight:800;margin:22px 0}.day{margin:20px 0;border:1px solid #343940;border-radius:12px;overflow:hidden;background:#161a20}.dayhead{display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:#252a31}.dayhead h2{margin:0;font-size:27px}.dayhead h2 span{font-size:18px;color:#bfc2c7;font-weight:400;margin-left:12px}.dayhead>b{font-size:19px;color:#ff9a61}article{display:flex;gap:15px;padding:11px 18px;border-top:1px solid #30343b}.number{width:43px;flex-shrink:0;color:#ff762f;font-size:29px;font-weight:900}.copy{flex:1;min-width:0}h3{margin:0 0 4px;font-size:23px;line-height:1.2}em{font-size:14px;font-style:normal;color:#ff9a61;border:1px solid #71513e;padding:3px 6px;vertical-align:3px;margin-right:7px}article p{font-size:20px;margin:3px 0;line-height:1.22}.condition{color:#c4c9d0;font-size:17px!important}.state{color:#aeb5bf;font-size:16px!important}article code{display:block;color:#8c96a4;font-size:12px;overflow-wrap:anywhere}strong{color:#ffd8bf}aside{padding:23px;background:#252019;border-left:4px solid #ff762f;font-size:23px;line-height:1.4;margin-top:25px}aside h2{font-size:28px;margin:0}aside p{font-size:21px}aside code{font-size:15px;overflow-wrap:anywhere}footer{position:absolute;bottom:27px;left:60px;right:60px;color:#9fa8b4;font-size:17px;border-top:1px solid #3b414a;padding-top:14px}footer span{float:right;color:#ff9a61}footer small{display:block;font-size:15px;margin-top:8px}.intro{font-size:24px;line-height:1.5;color:#c8cbd1}.bout{display:flex;align-items:center;gap:22px;border-bottom:1px solid #343b44;padding:16px 12px}.bout>span{color:#ff762f;font-size:29px;font-weight:800;width:44px}.bout h2{font-size:27px;margin:0 0 5px}.bout h2 b{font-size:18px;color:#ff9a61;margin:0 9px}.bout p{font-size:19px;color:#aab1bc;margin:0}@media print{.page{page-break-after:always;margin:0}}</style>${pages.join('')}</html>`;
}
export async function renderReport(report,directory){
 fs.mkdirSync(directory,{recursive:true});const html=path.join(directory,'weekly-report.html');fs.writeFileSync(html,reportHTML(report));
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage();await page.setViewport({width:1440,height:1920,deviceScaleFactor:1});
  await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('data:')?r.continue():r.abort());
  await page.setContent(fs.readFileSync(html,'utf8'),{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
  const layoutErrors=await page.evaluate(()=>[...document.querySelectorAll('.page')].flatMap((p,index)=>{const footer=p.querySelector('footer').getBoundingClientRect();return [...p.querySelectorAll('article,aside,.bout')].filter(e=>e.getBoundingClientRect().bottom>footer.top-8||e.scrollWidth>e.clientWidth+1).map(e=>({page:index+1,text:e.textContent.slice(0,80)}));}));
  if(layoutErrors.length)throw new Error(`Report layout overflow: ${JSON.stringify(layoutErrors)}`);
  const images=[],pages=await page.$$('.page');
  for(let i=0;i<pages.length;i++){const file=path.join(directory,`weekly-report-${i+1}.jpg`);await pages[i].screenshot({path:file,type:'jpeg',quality:93});images.push(file);}
  return {html,images,layoutErrors};
 }finally{await browser.close();}
}

const readJSON=(file,fallback=null)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
function saveJSON(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,file);}
function telegramCredentials(){
 const saved={},file=path.join(os.homedir(),'.hermes/scripts/.ufc-telegram.env');
 if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split('\n')){const m=line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m)saved[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
 const token=process.env.TELEGRAM_BOT_TOKEN??saved.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID??saved.TELEGRAM_CHAT_ID;
 if(!token||!chat)throw new Error('Missing Telegram bot environment');return {token,chat};
}
export async function telegramReportSend(image,{report,page,onAccepted=()=>{},credentials=telegramCredentials(),fetchImpl=fetch}={}){
 const {token,chat}=credentials,base=`https://api.telegram.org/bot${token}`;
 const body=new FormData();body.set('chat_id',chat);body.set('photo',new Blob([fs.readFileSync(image)],{type:'image/jpeg'}),path.basename(image));
 body.set('caption',`AGENDA EDITORIAL · ${page}/3\n${report.event}\n${report.weekStart} — ${report.weekEnd}\n${report.counts.stories} historias + ${report.counts.feed} feeds. Feed: programación con revisión / cancelación. Historias: manual. No es una imagen de feed.`.slice(0,1024));
 const response=await fetchImpl(`${base}/sendPhoto`,{method:'POST',body,signal:AbortSignal.timeout(45000)}),data=await response.json();
 if(!response.ok||!data.ok||!data.result?.message_id)throw new Error('Telegram rejected report image');
 const message=data.result,receipt={messageId:message.message_id,chatId:String(message.chat?.id),photoFileId:message.photo?.at(-1)?.file_id,verification:{status:'pending'}};
 onAccepted(receipt); // Persist identity before any subsequent network failure.
 if(String(message.chat?.id)!==String(chat))throw new Error('Telegram returned unexpected target chat');
 if(!receipt.photoFileId)throw new Error('Telegram response missing photo file ID');
 const fileResponse=await fetchImpl(`${base}/getFile?file_id=${encodeURIComponent(receipt.photoFileId)}`,{signal:AbortSignal.timeout(30000)}),file=await fileResponse.json();
 if(!fileResponse.ok||!file.ok||!file.result?.file_path||file.result.file_id!==receipt.photoFileId)throw new Error('Telegram getFile verification failed');
 const download=await fetchImpl(`https://api.telegram.org/file/bot${token}/${file.result.file_path}`,{signal:AbortSignal.timeout(30000)});
 if(!download.ok)throw new Error('Telegram exact returned image download failed');
 const bytes=Buffer.from(await download.arrayBuffer());if(!bytes.length)throw new Error('Telegram returned empty report image');
 const remotePath=image.replace(/\.jpg$/,'.telegram.jpg');fs.writeFileSync(remotePath,bytes);
 receipt.verification={status:'getFile-downloaded',remotePath,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 return receipt;
}
export async function run({root=ROOT,date=localDate(),event,now=new Date(),notify=false,render=renderReport,send=telegramReportSend}={}){
 root=path.resolve(root);const fighters=path.join(root,'fighters'),gather=readJSON(path.join(fighters,'_weekly-gather.json'));
 const profiles=fs.readdirSync(fighters,{withFileTypes:true}).filter(d=>d.isDirectory()&&fs.existsSync(path.join(fighters,d.name,'profile.json'))).map(d=>({...readJSON(path.join(fighters,d.name,'profile.json')),slug:d.name}));
 const initial=buildWeeklyReport({profiles,gather,date,event,root,now});
 const receipts={};
 for(const day of initial.days){const weekly=path.join(root,'instagram-pack/.automation/weekly',`${slug(initial.event)}-${initial.eventDate}`,day.date,'delivery-receipts.json');Object.assign(receipts,readJSON(weekly,{}));}
 const scheduleDir=path.join(root,'instagram-pack/.automation/auto-schedule');
 if(fs.existsSync(scheduleDir))for(const entry of fs.readdirSync(scheduleDir).filter(f=>f.endsWith('.json'))){const receipt=readJSON(path.join(scheduleDir,entry));if(receipt?.id&&initial.items.some(i=>i.id===receipt.id))receipts[receipt.id]={...receipts[receipt.id],schedule:receipt};}
 const report=buildWeeklyReport({profiles,gather,date,event,root,now,receipts});
 const base=path.join(root,'instagram-pack/.automation/weekly-reports',`${slug(report.event)}-${report.eventDate}`,report.weekStart);
 fs.mkdirSync(base,{recursive:true});const lock=path.join(base,'.lock');let fd;
 try{fd=fs.openSync(lock,'wx');}catch{throw new Error(`Report locked; inspect before retrying: ${lock}`);}
 try{
  const directory=path.join(base,report.planFingerprint),manifestPath=path.join(directory,'manifest.json');
  const previous=readJSON(manifestPath);report.manifestPath=manifestPath;
  report.notification=previous?.notification??{status:'not-sent',receipts:[]};
  report.artifacts=await render(report,directory);saveJSON(manifestPath,report);
  if(notify){
   for(let i=0;i<report.artifacts.images.length;i++){
    const prior=report.notification.receipts.find(r=>r.page===i+1);
    if(prior?.verification?.status==='getFile-downloaded')continue;
    if(prior)throw new Error(`Report page ${i+1} has ambiguous/unverified delivery; inspect Telegram before retrying. No automatic resend.`);
    const pending={page:i+1,status:'sending',startedAt:new Date().toISOString()};report.notification.status='in-progress';report.notification.receipts.push(pending);saveJSON(manifestPath,report);
    try{
     const receipt=await send(report.artifacts.images[i],{report,page:i+1,onAccepted:r=>{Object.assign(pending,r,{status:'accepted'});saveJSON(manifestPath,report);}});
     if(!receipt?.messageId||!receipt?.chatId||receipt?.verification?.status!=='getFile-downloaded')throw new Error('Report delivery receipt must include verified message/chat identity');
     Object.assign(pending,receipt,{status:'verified',deliveredAt:new Date().toISOString()});saveJSON(manifestPath,report);
    }catch(error){report.notification.status='needs-inspection';pending.error='Delivery failed or ambiguous; inspect Telegram before retrying.';saveJSON(manifestPath,report);throw new Error(pending.error,{cause:error});}
   }
   report.notification.status='sent';saveJSON(manifestPath,report);
  }
  return report;
 }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
async function main(){
 const opts={},args=process.argv.slice(2);
 for(let i=0;i<args.length;i++){
  const a=args[i];if(a==='--notify')opts.notify=true;
  else if(/^--(date|event|root)(=|$)/.test(a)){const split=a.indexOf('='),key=a.slice(2,split<0?undefined:split),value=split<0?args[++i]:a.slice(split+1);if(!value||value.startsWith('--'))throw new Error(`Missing --${key} value`);opts[key]=value;}
  else throw new Error(`Unknown argument ${a}. Usage: weekly-report.mjs [--notify] [--date=YYYY-MM-DD] [--event=EXACT] [--root=PATH]`);
 }
 const report=await run(opts);console.log(JSON.stringify({event:report.event,counts:report.counts,planFingerprint:report.planFingerprint,manifestPath:report.manifestPath,artifacts:report.artifacts,notification:report.notification},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
