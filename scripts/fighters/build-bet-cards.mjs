#!/usr/bin/env node
// Prepare local, reviewable UFC bet candidates. This never calls createBet.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const record=p=>p.record?.wins==null?'Pendiente':`${p.record.wins}-${p.record.losses??0}${p.record.draws?`-${p.record.draws}`:''}`;

export function buildCardData(fightersDir=path.join(ROOT,'fighters')){
  const gather=JSON.parse(fs.readFileSync(path.join(fightersDir,'_weekly-gather.json'),'utf8'));
  if(gather.partial||gather.failures?.length)throw new Error('Partial research: bet candidates blocked');
  if(!gather.event||!gather.eventDate||!gather.queryDate||!Array.isArray(gather.fighters))throw new Error('Incomplete gather receipt');
  const eventDate=gather.eventDate.slice(0,10);
  const people=fs.readdirSync(fightersDir,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(fightersDir,e.name,'profile.json'))).map(e=>({slug:e.name,profile:JSON.parse(fs.readFileSync(path.join(fightersDir,e.name,'profile.json'),'utf8'))})).filter(x=>x.profile._event?.name===gather.event&&x.profile._event?.date===gather.queryDate);
  if(people.length!==gather.fighters.length||people.some(x=>!gather.fighters.some(f=>f.name===x.profile.name)))throw new Error('Gather roster/profile mismatch');
  const byName=new Map(people.map(x=>[x.profile.name,x]));
  const matchups=[];
  for(const item of people){
    for(const bout of item.profile._event.bouts??[]){
      const other=byName.get(bout.opponent);
      if(!other||!other.profile._event.bouts?.some(b=>b.opponent===item.profile.name&&b.order===bout.order))throw new Error(`Nonreciprocal bout: ${item.profile.name}`);
      if(item.profile.name.localeCompare(other.profile.name)>0)continue;
      if(!Number.isInteger(bout.order)||bout.order<0||!bout.date||Number.isNaN(Date.parse(bout.date))||bout.date.slice(0,10)!==eventDate)throw new Error('Missing or invalid bout order/time');
      const id=`${slug(gather.event)}-${eventDate}-${bout.order}`;
      matchups.push({id,order:bout.order,a:item.profile.name,b:other.profile.name,recordA:record(item.profile),recordB:record(other.profile),division:bout.division??'',date:bout.date,image:'',photoA:item.profile.photo?.file&&fs.existsSync(path.join(fightersDir,item.slug,item.profile.photo.file))?path.join(fightersDir,item.slug,item.profile.photo.file):null,photoB:other.profile.photo?.file&&fs.existsSync(path.join(fightersDir,other.slug,other.profile.photo.file))?path.join(fightersDir,other.slug,other.profile.photo.file):null,photoLicenseA:item.profile.photo?.license??null,photoLicenseB:other.profile.photo?.license??null});
    }
  }
  matchups.sort((a,b)=>a.order-b.order);
  if(!matchups.length||new Set(matchups.map(m=>m.order)).size!==matchups.length)throw new Error('Missing/duplicate bout order');
  return {version:1,event:gather.event,eventDate,checkedAt:gather.checkedAt??null,matchups};
}

export async function renderCard(card,outDir,{chrome=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}={}){
  const template=fs.readFileSync(path.join(ROOT,'scripts/instagram/templates/bet-vs.html'),'utf8');
  fs.mkdirSync(path.join(outDir,'images'),{recursive:true});
  const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-first-run','--no-default-browser-check']});
  try{
    const page=await browser.newPage();
    await page.setViewport({width:1080,height:1350,deviceScaleFactor:1});
    await page.setRequestInterception(true);
    page.on('request',req=>/^https?:/.test(req.url())?req.abort():req.continue());
    for(const matchup of card.matchups){
      const portrait=file=>file?`<img alt="" src="data:image/${file.toLowerCase().endsWith('.png')?'png':'jpeg'};base64,${fs.readFileSync(file).toString('base64')}">`:'<span class="missing">Retrato pendiente</span>';
      let html=template.replaceAll('{{EVENT}}',escape(card.event)).replaceAll('{{A}}',escape(matchup.a)).replaceAll('{{B}}',escape(matchup.b)).replaceAll('{{RECORD_A}}',escape(matchup.recordA)).replaceAll('{{RECORD_B}}',escape(matchup.recordB)).replaceAll('{{PHOTO_A}}',portrait(matchup.photoA)).replaceAll('{{PHOTO_B}}',portrait(matchup.photoB)).replaceAll('{{DATE}}',escape(card.eventDate));
      await page.setContent(html,{waitUntil:'load'});
      await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
      const file=`images/${matchup.id}.jpg`;
      await page.screenshot({path:path.join(outDir,file),type:'jpeg',quality:88});
      matchup.image=`/bet-cards/${file}`;
    }
    await page.close();
  }finally{await browser.close();}
  const publish={...card,matchups:card.matchups.map(({photoA,photoB,photoLicenseA,photoLicenseB,...m})=>({...m,photoReviewRequired:Boolean(photoA||photoB),photoLicenses:[photoLicenseA,photoLicenseB]}))};
  fs.writeFileSync(path.join(outDir,'latest.json'),JSON.stringify(publish,null,2)+'\n');
  return publish;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const card=buildCardData();
  // Data remains local until a separate, explicitly authorized Hosting deploy.
  renderCard(card,path.join(ROOT,'public/bet-cards')).then(c=>console.log(JSON.stringify({event:c.event,count:c.matchups.length,output:'public/bet-cards/latest.json'}))).catch(e=>{console.error(e);process.exitCode=1;});
}
