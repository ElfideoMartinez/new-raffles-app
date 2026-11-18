import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildPostingCards,renderPostingCards,writePostingCards} from './posting-cards.mjs';
const makeRoot=()=>fs.mkdtempSync(path.join(process.env.TMPDIR??os.tmpdir(),'posting-cards-'));
test('pairs numbered slots with their exact local image and caption, without claiming unprepared items are ready',()=>{
 const root=makeRoot();try{
  const item={id:'event:2026-11-18:story-winner-poll',number:7,date:'2026-11-18',slot:'story-winner-poll',kind:'story',title:'Encuesta',subject:'Alpha vs. Beta',recommendedPostTime:'19:00',preparationTime:'12:15',stickerGuidance:'Añadir encuesta',delivery:{status:'not-recorded'}};
  const feed={...item,id:'event:2026-11-19:feed-thursday-comparison',number:8,date:'2026-11-19',slot:'feed-thursday-comparison',kind:'feed',title:'Análisis',recommendedPostTime:'19:00'};
  const report={event:'Test event',eventDate:'2026-11-21',weekStart:'2026-11-16',weekEnd:'2026-11-22',items:[item,feed]};
  const daily=path.join(root,'instagram-pack/.automation/weekly/test-event-2026-11-21/2026-11-18');fs.mkdirSync(path.join(daily,item.slot),{recursive:true});
  const image=path.join(daily,item.slot,'story.jpg');fs.writeFileSync(image,'image');
  fs.writeFileSync(path.join(daily,'manifest.json'),JSON.stringify({event:{name:'Test event',date:'2026-11-21'},date:item.date,stories:[{id:item.id,slot:item.slot,path:path.relative(root,image),publicCaption:'Caption exacto #UFC',stickerGuidance:'Añadir encuesta'}]}));
  const cards=buildPostingCards({root,report});
  assert.equal(cards[0].number,7);assert.equal(cards[0].caption,'Caption exacto #UFC');assert.equal(cards[0].image,image);assert.match(cards[0].status,/ENTREGAR|REVISAR/i);assert.equal(cards[0].guidance,'Añadir encuesta');
  assert.equal(cards[1].image,null);assert.equal(cards[1].caption,null);assert.match(cards[1].status,/SIN PREPARAR/);
  const html=renderPostingCards({report,cards,root});
  assert.match(html,/#07/);assert.match(html,/Caption exacto #UFC/);assert.match(html,/data:image\/jpeg;base64/);assert.match(html,/SIN PREPARAR/);
  assert.doesNotMatch(html,/undefined/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('exports date-named folders with downloadable story JPGs and a small-screen handoff',()=>{
 const root=makeRoot();try{
  const id='event:2026-11-18:story-winner-poll',date='2026-11-18';
  const report={event:'Test event',eventDate:'2026-11-21',weekStart:'2026-11-16',weekEnd:'2026-11-22',manifestPath:path.join(root,'instagram-pack/.automation/weekly-reports/report/manifest.json'),items:[{id,number:7,date,slot:'story-winner-poll',kind:'story',title:'Encuesta',subject:'Alpha vs. Beta',recommendedPostTime:'19:00',preparationTime:'12:15',delivery:{status:'not-recorded'}}]};
  const day=path.join(root,'instagram-pack/.automation/weekly/test-event-2026-11-21',date);fs.mkdirSync(path.join(day,'story-winner-poll'),{recursive:true});
  const image=path.join(day,'story-winner-poll/story.jpg');fs.writeFileSync(image,'story-image-bytes');
  fs.writeFileSync(path.join(day,'manifest.json'),JSON.stringify({date,event:{name:'Test event',date:'2026-11-21'},stories:[{id,path:path.relative(root,image),publicCaption:'Texto público'}]}));
  const result=writePostingCards({root,report});
  assert.match(result.file,/posting-cards\/test-event-2026-11-21\/index\.html$/);
  const exported=path.join(path.dirname(result.file),'2026-11-18-07-story-winner-poll.jpg');
  assert.deepEqual(fs.readFileSync(exported),fs.readFileSync(image));
  const html=fs.readFileSync(result.file,'utf8');
  assert.match(html,/href="2026-11-18-07-story-winner-poll.jpg" download/);
  assert.match(html,/src="data:image\/jpeg;base64,[A-Za-z0-9+/=]+"/,'preview must not depend on local file URL permissions');
  assert.match(html,/viewport/);assert.match(html,/@media\(max-width:650px\)/);
  assert.equal(result.ready,1);
  assert.ok(fs.existsSync(result.zip),'downloadable bundle includes page and story files');
  assert.ok(fs.statSync(result.zip).size>0);
  assert.ok(fs.existsSync(path.join(path.dirname(result.file),'.content-sha256')));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('uses Antwork receipt for scheduled status and never substitutes the story caption for a carousel',()=>{
 const root=makeRoot();try{const id='event:2026-11-20:feed-full-card-carousel';const report={event:'Test event',eventDate:'2026-11-21',weekStart:'2026-11-16',weekEnd:'2026-11-22',items:[{id,number:15,date:'2026-11-20',slot:'feed-full-card-carousel',kind:'feed',title:'Cartelera',recommendedPostTime:'19:00',scheduling:{state:'scheduled',verifiedStatus:'scheduled',postId:'post-123',caption:'Caption del carrusel',media:[{file:'slide1.jpg'}]},delivery:{status:'not-recorded'}}]};
  const cards=buildPostingCards({root,report});assert.equal(cards[0].caption,'Caption del carrusel');assert.match(cards[0].status,/PROGRAMADO/);assert.match(cards[0].status,/post-123/);
  const daily=path.join(root,'instagram-pack/.automation/weekly/test-event-2026-11-21/2026-11-20/feed-full-card-carousel');fs.mkdirSync(daily,{recursive:true});fs.writeFileSync(path.join(daily,'slide-01.jpg'),'image');fs.writeFileSync(path.join(daily,'manifest.json'),JSON.stringify({id,publicCaption:'Caption nuevo, distinto',path:path.relative(root,path.join(daily,'slide-01.jpg'))}));
  const revised=buildPostingCards({root,report})[0];assert.equal(revised.caption,'Caption del carrusel');assert.match(revised.status,/REVISAR DIFERENCIA/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
