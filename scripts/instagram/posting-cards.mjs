#!/usr/bin/env node
// Read-only posting handoff: exact local artwork + copy, never publishes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {exportHandoff} from './posting-handoff.mjs';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const read=file=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
function localImage(root,relative){
 if(!relative||typeof relative!=='string')return null;
 const file=path.resolve(root,relative);
 if(!file.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(file)||!file.endsWith('.jpg'))return null;
 return file;
}
export function buildPostingCards({root=ROOT,report}){
 const base=path.join(root,'instagram-pack/.automation/weekly',`${slug(report.event)}-${report.eventDate}`);
 return report.items.map(item=>{
  const daily=read(path.join(base,item.date,'manifest.json'));
  const source=[...(daily?.stories??[]),...(daily?.feed?[daily.feed]:[])].find(s=>s.id===item.id);
  const carousel=item.slot==='feed-full-card-carousel'?read(path.join(base,item.date,'feed-full-card-carousel','manifest.json')):null;
  const candidate=source??(carousel?.id===item.id?carousel:null);
  const files=(candidate?.mediaPaths??(candidate?.path?[candidate.path]:[])).map(p=>localImage(root,p)).filter(Boolean);
  const receipt=item.scheduling;
  const scheduled=receipt?.state==='scheduled'&&receipt?.verifiedStatus==='scheduled'&&receipt?.postId;
  const caption=scheduled?receipt.caption??null:candidate?.publicCaption??receipt?.caption??null;
  const ready=files.length>0&&Boolean(caption)&&(!candidate?.mediaPaths||files.length===candidate.mediaPaths.length);
  const captionChanged=Boolean(scheduled&&candidate?.publicCaption&&candidate.publicCaption!==receipt.caption);
  const mediaChanged=Boolean(scheduled&&files.length&&receipt?.media?.length&&(
    files.length!==receipt.media.length||files.some((file,i)=>receipt.media[i]?.sha256!==createHash('sha256').update(fs.readFileSync(file)).digest('hex'))));
  const status=captionChanged||mediaChanged?'REVISAR DIFERENCIA · arte o caption local distinto al programado':scheduled?`PROGRAMADO EN ANTWORK · ${receipt.postId} · revisar/cancelar`:!ready?'SIN PREPARAR · no usar todavía':item.kind==='story'?'LISTO PARA REVISAR · publicación manual':'LISTO PARA REVISAR · confirmar programación';
  return {number:item.number,id:item.id,date:item.date,slot:item.slot,kind:item.kind,title:item.title,subject:item.subject,postingTime:item.recommendedPostTime,preparationTime:item.preparationTime,image:ready?files[0]:null,images:ready?files:[],caption:ready?caption:receipt?.caption??null,guidance:candidate?.stickerGuidance??item.stickerGuidance??null,status,ready,editUrl:receipt?.editUrl??null,delivery:item.delivery?.messageId??null};
 });
}
export function renderPostingCards({report,cards,root=ROOT}){
 const picture=file=>`<img loading="lazy" src="data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}" alt="Arte para esta publicación">`;
 return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tarjetas para publicar · ${esc(report.event)}</title><style>*{box-sizing:border-box}body{font-family:system-ui,Arial;background:#101318;color:#f3f3f3;margin:0;padding:24px;line-height:1.45}header{max-width:1100px;margin:auto auto 24px}h1{margin:4px 0}small,.muted{color:#aeb7c2}main{max-width:1100px;margin:auto}.day{margin:28px 0 10px;color:#ffae7f;border-bottom:1px solid #454952;padding-bottom:8px}.card{display:grid;grid-template-columns:minmax(190px,300px) 1fr;gap:20px;background:#1a1e25;border:1px solid #3a4048;border-radius:14px;padding:16px;margin:16px 0}.art img{display:block;width:100%;height:auto;border-radius:8px}.empty{background:#252a32;padding:60px 12px;text-align:center;border-radius:8px;color:#b9c0c8}.num{font-size:27px;font-weight:900;color:#ff8e51}.status{display:inline-block;background:#333e45;padding:6px 10px;border-radius:6px;font-weight:700;margin:10px 0}h2{margin:4px 0;font-size:23px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:#11151a;border:1px solid #343b43;padding:14px;border-radius:8px}a{color:#ffab79}button{background:#ff8e51;color:#151515;border:0;border-radius:6px;padding:8px 12px;font-weight:700;cursor:pointer}.thumbs{display:flex;gap:8px;overflow:auto;margin-top:8px}.thumbs img{width:65px;flex:none}@media(max-width:650px){body{padding:12px}.card{grid-template-columns:1fr}.art{max-width:330px}}</style><header><small>@bet.mx.ufc · America/Chihuahua</small><h1>Tarjetas para publicar</h1><p>${esc(report.event)} · ${esc(report.weekStart)}—${esc(report.weekEnd)}</p><p class="muted">Cada número corresponde a la agenda. Imagen y caption van juntos; las horas son propuestas. Verifica datos y derechos antes de publicar. Este archivo no publica ni programa nada.</p></header><main>${cards.map((c,i)=>`${i===0||cards[i-1].date!==c.date?`<h2 class="day">${esc(c.date)}</h2>`:''}<article class="card" id="p${c.number}"><div class="art">${c.image?picture(c.image):'<div class="empty">Imagen aún no preparada</div>'}${c.images.length>1?`<small>Carrusel · ${c.images.length} láminas, en este orden:</small><div class="thumbs">${c.images.map(picture).join('')}</div>`:''}</div><div><div class="num">#${String(c.number).padStart(2,'0')} · ${c.kind==='story'?'HISTORIA':'FEED'}</div><h2>${esc(c.title)}</h2><div>${esc(c.subject)} · ${esc(c.postingTime)} hora Chihuahua</div><small>Preparar/entregar: ${esc(c.preparationTime)}</small><div class="status">${esc(c.status)}</div>${c.editUrl?`<p><a href="${esc(c.editUrl)}">Revisar / desprogramar en Antwork</a></p>`:''}<strong>Caption para este arte</strong><pre>${esc(c.caption??'Pendiente de preparación; no copiar un caption de otra pieza.')}</pre>${c.caption?`<button data-copy="${i}">Copiar caption</button>`:''}${c.guidance?`<p><strong>Instrucciones privadas (no copiar al caption):</strong><br>${esc(c.guidance)}</p>`:''}<small>Archivo: ${esc(c.image?path.relative(root,c.image):'pendiente')} · Entrega Telegram: ${esc(c.delivery??'sin recibo')}</small></div></article>`).join('')}</main><script>const captions=${JSON.stringify(cards.map(c=>c.caption))};document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(captions[Number(b.dataset.copy)]);b.textContent='Copiado';setTimeout(()=>b.textContent='Copiar caption',1800)});</script></html>`;
}
export function writePostingCards({root=ROOT,report}){
 const cards=buildPostingCards({root,report});return exportHandoff({root,report,cards});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const reportPath=process.argv[2];if(!reportPath)throw new Error('Usage: node scripts/instagram/posting-cards.mjs REPORT_MANIFEST.json');
 const report=read(path.resolve(reportPath));if(!report?.items)throw new Error('Invalid report manifest');
 console.log(JSON.stringify(writePostingCards({report}),null,2));
}
