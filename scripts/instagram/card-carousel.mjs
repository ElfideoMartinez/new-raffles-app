#!/usr/bin/env node
// Local full-card feed carousel. No publishing, scheduling or Telegram sends.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const TIMEZONE='America/Chihuahua';
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE}).format(new Date());
function validDate(d){if(!/^\d{4}-\d{2}-\d{2}$/.test(d??'')||!Number.isFinite(Date.parse(d))||new Date(`${d}T12:00Z`).toISOString().slice(0,10)!==d)throw new Error(`Invalid date: ${d}`);}
const spanishDate=d=>new Intl.DateTimeFormat('es-MX',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${d}T12:00Z`));
const hour=d=>new Intl.DateTimeFormat('es-MX',{timeZone:TIMEZONE,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d));
export function buildCarouselPlan({profiles=[],event,date=localDate(),root=ROOT}={}){
 validDate(date);
 const events=[...new Set(profiles.filter(p=>p._event?.date>=date).map(p=>p._event.name))].sort((a,b)=>profiles.find(p=>p._event.name===a)._event.date.localeCompare(profiles.find(p=>p._event.name===b)._event.date));
 event??=events[0];
 const relevant=profiles.filter(p=>p._event?.name===event).sort((a,b)=>a.name.localeCompare(b.name));
 if(!relevant.length)throw new Error(`No exact event match: ${event}`);
 const dates=[...new Set(relevant.map(p=>p._event.date))];if(dates.length!==1)throw new Error('Conflicting event dates');
 const eventDate=dates[0];validDate(eventDate);
 const day=new Date(`${eventDate}T12:00Z`).getUTCDay();const daysBack=(day-5+7)%7||7;
 const friday=new Date(Date.parse(`${eventDate}T12:00Z`)-daysBack*86400000).toISOString().slice(0,10);
 const key=`${slug(event)}-${eventDate}`,directory=`instagram-pack/.automation/weekly/${key}/${friday}/feed-full-card-carousel`;
 const map=new Map();
 for(const p of relevant){
  if(p._event.bouts?.length!==1)throw new Error(`Expected one confirmed bout: ${p.name}`);
  const b=p._event.bouts[0],q=relevant.find(q=>q.name===b.opponent);
  if(!q||q===p||q._event.bouts?.[0]?.opponent!==p.name||q._event.bouts[0].order!==b.order)throw new Error(`Nonreciprocal matchup: ${p.name}`);
  if(!Number.isInteger(b.order)||b.order<0)throw new Error('Invalid bout order');
  const old=map.get(b.order);if(old&&![old.left,old.right].includes(p.name))throw new Error('Duplicate bout order');
  if(!old)map.set(b.order,{order:b.order,left:p.name,right:q.name,division:b.division??'',scheduledBoutAt:b.date??null});
 }
 const bouts=[...map.values()].sort((a,b)=>a.order-b.order);
 if(bouts.length*2!==relevant.length||bouts.some((b,i)=>b.order!==i))throw new Error('Incomplete card or noncontiguous order');
 const expected=`https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=${eventDate.replaceAll('-','')}`;
 const provenance=relevant.flatMap(p=>(p.sources??[]).filter(s=>s.url===expected).map(s=>({...s,file:`fighters/${p.slug}/profile.json`,fields:['_event.bouts','_event.date']})));
 const times=bouts.map(b=>b.scheduledBoutAt).filter(t=>t&&/Z$|[+-]\d\d:\d\d$/.test(t)&&Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(a)-Date.parse(b));
 const firstBoutAt=provenance.length===relevant.length?times[0]??null:null;
 const schedule={firstBoutAt,prelimsAt:null,mainCardAt:null,timezone:TIMEZONE,sourceUrl:expected,note:'Los horarios de peleas no verifican la segmentación preliminar / principal. Transmisión local pendiente de confirmar.'};
 const scheduleText=`${firstBoutAt?`Primera pelea: ${hour(firstBoutAt)} · Chihuahua`:'Primera pelea: horario pendiente de confirmar'}\nPreliminares: inicio pendiente de confirmar\nCartelera principal: inicio pendiente de confirmar\nTransmisión en México: pendiente de confirmar\nLos horarios y la cartelera pueden cambiar.`;
 const slides=[{kind:'cover',title:'CARTELERA COMPLETA',subtitle:`${bouts.length} peleas · ${relevant.length} peleadores`,headliners:[bouts[0].left,bouts[0].right],date:spanishDate(eventDate)}];
 for(let i=0;i<bouts.length;i+=4)slides.push({kind:'bouts',title:`PELEAS ${i+1}–${Math.min(i+4,bouts.length)}`,subtitle:'Orden de cartelera · de estelar a apertura',bouts:bouts.slice(i,i+4)});
 slides.push({kind:'schedule',title:'HORARIOS',subtitle:spanishDate(eventDate),body:scheduleText});
 slides.forEach((s,i)=>{s.number=i+1;s.path=`${directory}/slide-${String(i+1).padStart(2,'0')}.jpg`;});
 const paths=slides.map(s=>s.path);
 return {version:1,id:`${key}:${friday}:feed-full-card-carousel`,kind:'feed',slot:'feed-full-card-carousel',account:'@bet.mx.ufc',event,eventDate,date:friday,recommendedDate:friday,recommendedTime:'19:00',recommendedAt:`${friday}T19:00:00-06:00`,timezone:TIMEZONE,subject:`Cartelera completa · ${bouts.length} peleas / ${relevant.length} peleadores`,featuredFighters:relevant.map(p=>p.name),coverFighters:slides[0].headliners,slideCount:slides.length,slides,paths,mediaPaths:paths,path:paths[0],directory,manifestPath:`${directory}/manifest.json`,inputs:slides.map(s=>({...s,event})),schedule,provenance,scheduling:{eligible:provenance.length===relevant.length,policy:'feed-auto-scheduled-with-review-cancel-window',reviewRequired:true,cancelAvailable:true,reason:provenance.length===relevant.length?'Full reciprocal card with exact-date ESPN provenance.':'Missing exact-date ESPN card provenance.'},publicCaption:`${event}\n${spanishDate(eventDate)}\n${bouts.length} peleas, ${relevant.length} peleadores. Desliza para ver la cartelera completa.\n${scheduleText}\n¿Cuál pelea esperas más?\nFuente: ESPN\nPrueba la app: https://rifasmtz.web.app/\n#UFC #RifasMtz`};
}
function portrait(root,p){if(!p?.photo?.file||!p.slug)return '';const base=path.resolve(root,'fighters',p.slug),f=path.resolve(base,p.photo.file);if(!f.startsWith(base+path.sep)||!fs.existsSync(f)||! /\.(png|jpe?g)$/i.test(f))return '';return `data:image/${f.endsWith('.png')?'png':'jpeg'};base64,${fs.readFileSync(f).toString('base64')}`;}
export async function renderCarousel(plan,{root=ROOT,profiles=[]}={}){
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const results=[];
 try{
  const page=await browser.newPage();await page.setViewport({width:1080,height:1350,deviceScaleFactor:1});await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('data:')?r.continue():r.abort());
  for(const s of plan.slides){
   let content=s.kind==='cover'?`<h1>${esc(s.title)}</h1><p class="sub">${esc(s.subtitle)}</p><div class="portraits">${s.headliners.map(name=>{const uri=portrait(root,profiles.find(p=>p.name===name));return `<div>${uri?`<img src="${uri}">`:''}<h2>${esc(name)}</h2></div>`;}).join('')}</div><p class="date">${esc(s.date)}</p>`:s.kind==='bouts'?`<h1>${esc(s.title)}</h1><p class="sub">${esc(s.subtitle)}</p><div class="bouts">${s.bouts.map(b=>`<article data-order="${b.order}"><span>${String(b.order+1).padStart(2,'0')}</span><div><h2>${esc(b.left)} <b>vs.</b><br>${esc(b.right)}</h2><p>${esc(b.division)}</p></div></article>`).join('')}</div>`:`<h1>${esc(s.title)}</h1><p class="sub">${esc(s.subtitle)}</p><div class="schedule">${s.body.split('\n').map(t=>`<p>${esc(t)}</p>`).join('')}</div><aside>Fuente: ESPN · Consulta de cartelera<br>Reconfirma cambios antes del evento.</aside>`;
   const html=`<!doctype html><html lang="es"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#101318;color:#f2f2f4;font-family:Arial,Helvetica,sans-serif}main{width:1080px;height:1350px;padding:56px;position:relative;background:radial-gradient(ellipse at top right,#43251b,transparent 60%),#101318}header{font-size:24px;letter-spacing:3px;color:#ff8954;font-weight:900}.event{font-size:26px;line-height:1.3;color:#cbd0d6;margin:32px 0 22px}h1{font-size:62px;line-height:1.05;margin:22px 0 14px;overflow-wrap:anywhere}.sub{font-size:27px;color:#ffb48c;line-height:1.3}h2{font-size:36px;line-height:1.18;margin:0;overflow-wrap:anywhere}.portraits{display:flex;gap:24px;margin-top:38px}.portraits>div{width:50%;text-align:center}.portraits img{width:100%;height:535px;object-fit:contain;display:block;margin-bottom:22px}.portraits h2{font-size:40px}.date{font-size:32px;color:#ffc4a2;margin-top:48px}.bouts{margin-top:36px}article{display:flex;gap:24px;border-top:1px solid #515156;padding:22px 0;min-height:202px}article span{font-size:30px;color:#ff8954;flex-shrink:0;width:45px}article div{flex:1;min-width:0}article b{font-size:23px;color:#ff8954}article p{font-size:22px;color:#b8c0ca;margin:10px 0 0}.schedule{margin-top:55px}.schedule p{font-size:33px;line-height:1.4;border-bottom:1px solid #4e4441;padding:20px 0;margin:0}aside{font-size:25px;line-height:1.5;color:#b8c0ca;margin-top:42px}footer{position:absolute;bottom:42px;left:56px;right:56px;font-size:23px;color:#ffb48c;border-top:1px solid #59514b;padding-top:20px;display:flex;justify-content:space-between}</style><main><header>RIFAS MTZ · @bet.mx.ufc</header><p class="event">${esc(plan.event)}</p><section>${content}</section><footer><span>DESLIZA · CARTELERA COMPLETA</span><span>${s.number} / ${plan.slideCount}</span></footer></main></html>`;
   const destination=path.resolve(root,s.path);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination.replace('.jpg','.html'),html);
   await page.setContent(html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
   const errors=await page.evaluate(()=>{const footer=document.querySelector('footer').getBoundingClientRect();return [...document.querySelectorAll('section,section *')].filter(e=>e.scrollWidth>e.clientWidth+2||e.getBoundingClientRect().bottom>footer.top-12).map(e=>e.textContent.slice(0,80));});
   if(errors.length)throw new Error(`Carousel layout overflow on slide ${s.number}: ${JSON.stringify(errors)}`);
   await page.screenshot({path:destination,type:'jpeg',quality:94});const bytes=fs.statSync(destination).size;if(bytes>8*1024*1024)throw new Error('Carousel image exceeds 8MB');results.push({path:s.path,width:1080,height:1350,bytes,layoutErrors:errors});
  }
 }finally{await browser.close();}
 return results;
}
export async function verifyCarouselSource(plan,{fetchImpl=fetch}={}){
 const url=plan.schedule.sourceUrl,response=await fetchImpl(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error('ESPN scoreboard verification failed');
 const snapshot=await response.json(),event=snapshot.events?.find(e=>e.name===plan.event&&e.date?.slice(0,10)===plan.eventDate);if(!event)throw new Error('ESPN exact event/date missing');
 const actual=event.competitions??[],planned=plan.slides.flatMap(s=>s.bouts??[]);
 const pair=c=>c.competitors.map(p=>p.athlete.displayName).sort().join('|');
 if(actual.length!==planned.length||planned.some(b=>!actual.some(c=>pair(c)===[b.left,b.right].sort().join('|'))))throw new Error('ESPN current card differs from profiles; gather again');
 const times=actual.map(c=>c.date).filter(t=>Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(a)-Date.parse(b));
 if(times[0]!==plan.schedule.firstBoutAt)throw new Error('ESPN first bout changed; gather again');
 return {url,checkedAt:new Date().toISOString(),eventId:event.id,firstBoutAt:times[0]??null,segmentationVerified:false,note:'Competition date groups are not explicit prelim/main-card labels; no segment times or regional broadcast inferred.',snapshot};
}
export async function run({root=ROOT,date=localDate(),event,notify=false,render=renderCarousel,verify=verifyCarouselSource}={}){
 root=path.resolve(root);const dir=path.join(root,'fighters');const profiles=fs.readdirSync(dir,{withFileTypes:true}).filter(d=>d.isDirectory()&&fs.existsSync(path.join(dir,d.name,'profile.json'))).map(d=>({...JSON.parse(fs.readFileSync(path.join(dir,d.name,'profile.json'),'utf8')),slug:d.name}));
 const plan=buildCarouselPlan({profiles,event,date,root});const target=path.resolve(root,plan.manifestPath);fs.mkdirSync(path.dirname(target),{recursive:true});
 const previous=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):null;
 const checked=await verify(plan);const {snapshot,...sourceVerification}=checked;plan.sourceVerification=sourceVerification;fs.writeFileSync(path.join(path.dirname(target),'espn-scoreboard.json'),JSON.stringify(snapshot,null,2)+'\n');
 plan.artifacts=await render(plan,{root,profiles});plan.status='rendered';plan.notification={status:notify?'requested-external-handler':'not-requested',note:'No external sends; parent workflow owns Telegram and scheduling.'};
 if(previous?.scheduleReceipt)plan.scheduleReceipt=previous.scheduleReceipt;
 if(previous?.scheduleVerification)plan.scheduleVerification=previous.scheduleVerification;
 fs.writeFileSync(target,JSON.stringify(plan,null,2)+'\n');return {...plan,manifestPath:target};
}
async function main(){const opts={};const args=process.argv.slice(2);for(let i=0;i<args.length;i++){const a=args[i];if(a==='--notify')opts.notify=true;else if(/^--(event|date|root)(=|$)/.test(a)){const at=a.indexOf('='),key=a.slice(2,at<0?undefined:at),value=at<0?args[++i]:a.slice(at+1);if(!value||value.startsWith('--'))throw new Error(`Missing --${key}`);opts[key]=value;}else throw new Error(`Unknown argument: ${a}`);}const p=await run(opts);console.log(JSON.stringify({manifestPath:p.manifestPath,id:p.id,slideCount:p.slideCount,mediaPaths:p.mediaPaths,scheduling:p.scheduling,notification:p.notification},null,2));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
