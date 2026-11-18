import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function exportHandoff({root,report,cards}){
 const directory=path.join(root,'instagram-pack','posting-cards',`${slug(report.event)}-${report.eventDate}`);
 const staging=`${directory}.new-${process.pid}`;
 fs.mkdirSync(staging,{recursive:true});
 const downloads={};
 for(const card of cards.filter(c=>c.ready)){
  const folder=staging;fs.mkdirSync(folder,{recursive:true});
  downloads[card.id]=card.images.map((image,i)=>{
   const name=`${card.date}-${String(card.number).padStart(2,'0')}-${card.id.split(':').at(-1)}${card.images.length>1?`-${String(i+1).padStart(2,'0')}`:''}.jpg`;
   const dest=path.join(folder,name);fs.copyFileSync(image,dest);return name;
  });
 }
 const image=(file,relative)=>`<img loading="lazy" src="data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}" alt="Imagen para esta pieza">`;
 const prepared=cards.filter(c=>c.ready).length;
 const groups=[...new Set(cards.map(c=>c.date))].map(date=>({date,items:cards.filter(c=>c.date===date)}));
 const article=card=>{
  const links=downloads[card.id]??[];
  return `<article class="card"><div class="art">${links.length?image(card.image,links[0]):'<div class="empty">Todavía sin imagen</div>'}${card.kind==='story'&&links.length?`<a class="download" href="${esc(links[0])}" download="${esc(path.basename(links[0]))}">⬇ Descargar historia JPG</a>`:''}${links.length>1?`<p>Carrusel · ${links.length} láminas en orden</p><div class="slides">${card.images.map((file,i)=>image(file,links[i])).join('')}</div>`:''}</div><div class="content"><b class="number">#${String(card.number).padStart(2,'0')} · ${card.kind==='story'?'HISTORIA':'FEED'}</b><h3>${esc(card.title)}</h3><p>${esc(card.subject)} · ${esc(card.postingTime)} hora Chihuahua</p><small>Preparar/entregar: ${esc(card.preparationTime)}</small><p class="status">${esc(card.status)}</p>${card.kind==='story'?`<strong>Caption de esta historia</strong><pre>${esc(card.caption??'Pendiente; no copies el caption de otra historia.')}</pre>${card.caption?`<button data-copy="${esc(card.id)}">Copiar caption</button>`:''}${card.guidance?`<p><b>Sticker manual (no copiar al caption):</b> ${esc(card.guidance)}</p>`:''}`:`<p><a href="${esc(card.editUrl??'#')}" ${card.editUrl?'':'aria-disabled="true"'}>Ver detalles del post en Antwork</a></p>`}<small>Entrega Telegram: ${esc(card.delivery??'sin recibo')}</small></div></article>`;
 };
 const html=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Historias · ${esc(report.event)}</title><style>*{box-sizing:border-box}body{font-family:system-ui,Arial;background:#101318;color:#f3f3f3;margin:0;padding:20px;line-height:1.45}header,main{max-width:1000px;margin:auto}h1{margin:6px 0}p{margin:10px 0}small,.muted{color:#b4bdc7}.day{color:#ffab79;border-bottom:1px solid #4a4e54;padding:10px 0;margin:25px 0 10px}.card{display:grid;grid-template-columns:minmax(180px,280px) minmax(0,1fr);gap:18px;background:#1b2026;border:1px solid #41474e;border-radius:12px;padding:16px;margin:12px 0;overflow-wrap:anywhere}.art img{width:100%;height:auto;display:block;border-radius:8px}.empty{padding:32px 10px;background:#272d33;text-align:center;border-radius:8px}.number{font-size:25px;color:#ff935c}h3{margin:4px 0;font-size:22px}.status{background:#343c43;padding:8px;border-radius:5px;font-weight:700}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#11171b;padding:12px;border-radius:5px;font:inherit}.download,button{display:block;background:#ff955c;color:#151515;padding:12px;border-radius:7px;text-align:center;text-decoration:none;font-weight:700;border:0;min-height:44px;margin-top:12px;cursor:pointer}a{color:#ffae7e}.slides{display:flex;gap:8px;overflow:auto}.slides img{width:65px;flex:none}summary{cursor:pointer;padding:12px 0;min-height:44px}details .card{opacity:.8}[aria-disabled]{pointer-events:none;color:#b4bdc7}@media(max-width:650px){body{padding:12px}.card{grid-template-columns:minmax(0,1fr)}.art{max-width:350px}.day{position:sticky;top:0;background:#101318;z-index:2}h1{font-size:28px}pre{font-size:15px}}</style><header><small>@bet.mx.ufc · hora Chihuahua</small><h1>Historias para publicar</h1><p>${esc(report.event)} · ${esc(report.weekStart)}—${esc(report.weekEnd)}</p><p>${prepared} piezas preparadas de ${cards.length} planeadas. Los huecos son fechas futuras o piezas todavía no generadas; no son imágenes perdidas. Historias: se preparan cada día y tú las publicas. Feeds: revísalos en Antwork.</p><p class="muted">Las horas son propuestas. Revisa datos, horarios y derechos antes de publicar. Esta página no publica nada.</p></header><main>${groups.map(({date,items})=>{const ready=items.filter(c=>c.ready),pending=items.filter(c=>!c.ready);return `<section><h2 class="day">${esc(date)} · ${ready.length} preparadas / ${items.length} planeadas</h2>${ready.map(article).join('')}${pending.length?`<details><summary>${pending.length} pieza(s) todavía sin preparar · mostrar plan</summary>${pending.map(article).join('')}</details>`:''}</section>`}).join('')}</main><script>const captions=${JSON.stringify(Object.fromEntries(cards.map(c=>[c.id,c.caption]))).replaceAll('<','\\u003c')};document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(captions[b.dataset.copy]);b.textContent='Copiado';setTimeout(()=>b.textContent='Copiar caption',1800)});</script></html>`;
 const file=path.join(directory,'index.html');fs.writeFileSync(path.join(staging,'index.html'),html);
 const contentHash=createHash('sha256');
 for(const name of fs.readdirSync(staging).filter(n=>n==='index.html'||n.endsWith('.jpg')).sort())contentHash.update(name).update(fs.readFileSync(path.join(staging,name)));
 const digest=contentHash.digest('hex');fs.writeFileSync(path.join(staging,'.content-sha256'),digest+'\n');
 const priorDigest=fs.existsSync(path.join(directory,'.content-sha256'))?fs.readFileSync(path.join(directory,'.content-sha256'),'utf8').trim():null;
 if(priorDigest===digest&&fs.existsSync(`${directory}.zip`)){
  fs.rmSync(staging,{recursive:true,force:true});return {file,zip:`${directory}.zip`,cards:cards.length,ready:prepared,scheduled:cards.filter(c=>c.status.startsWith('PROGRAMADO')).length,unchanged:true};
 }
 if(fs.existsSync(directory))fs.rmSync(directory,{recursive:true,force:true});
 fs.renameSync(staging,directory);
 const zip=`${directory}.zip`;
 if(fs.existsSync(zip))fs.unlinkSync(zip);
 const result=spawnSync('zip',['-q','-r',zip,path.basename(directory)],{cwd:path.dirname(directory),encoding:'utf8'});
 if(result.status!==0)throw new Error(`Could not create downloadable bundle: ${result.stderr||result.error?.message}`);
 return {file,zip,cards:cards.length,ready:prepared,scheduled:cards.filter(c=>c.status.startsWith('PROGRAMADO')).length};
}
