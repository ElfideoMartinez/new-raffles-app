import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const load=()=>import('./card-carousel.mjs');
const event='UFC Test: Alpha vs. Beta';
const source='https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=20261121';
const profiles=Array.from({length:22},(_,i)=>({slug:`fighter-${i}`,name:`Fighter ${i}`,sources:[{url:source,checked:'2026-11-17'}],_event:{name:event,date:'2026-11-21',bouts:[{order:Math.floor(i/2),opponent:`Fighter ${i%2?i-1:i+1}`,division:'Light Heavyweight',date:i<12?'2026-11-21T18:00Z':'2026-11-21T15:00Z'}]}}));
export {profiles,event};
test('rejects incomplete reciprocal cards and invalid dates without fabricating schedule',async()=>{
 const {buildCarouselPlan}=await load();
 assert.throws(()=>buildCarouselPlan({profiles:profiles.slice(1),event,date:'2026-11-17'}),/reciprocal/);
 assert.throws(()=>buildCarouselPlan({profiles,event,date:'2026-02-30'}),/Invalid date/);
 const p=buildCarouselPlan({profiles:profiles.map(p=>({...p,sources:[]})),event,date:'2026-11-17'});
 assert.equal(p.schedule.firstBoutAt,null);assert.equal(p.scheduling.eligible,false);
});
test('real Chrome renders all five 1080×1350 JPEGs without overflow',async()=>{
 const {buildCarouselPlan,renderCarousel}=await load();
 const root=fs.mkdtempSync(path.join(process.env.TMPDIR??os.tmpdir(),'carousel-render-'));
 try{const p=buildCarouselPlan({profiles,event,date:'2026-11-17',root});const results=await renderCarousel(p,{root,profiles});assert.equal(results.length,5);for(const r of results){assert.equal(r.width,1080);assert.equal(r.height,1350);assert.deepEqual(r.layoutErrors,[]);const b=fs.readFileSync(path.join(root,r.path));assert.equal(b.readUInt16BE(0),0xffd8);assert.ok(b.length>10000);}}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('live-source verifier matches exact full card and refuses implied segmentation',async()=>{
 const {verifyCarouselSource,buildCarouselPlan}=await load();assert.equal(typeof verifyCarouselSource,'function');
 const p=buildCarouselPlan({profiles,event,date:'2026-11-17'});
 const snapshot={events:[{id:'123',name:event,date:'2026-11-21T15:00Z',competitions:Array.from({length:11},(_,i)=>({id:String(i),date:i<6?'2026-11-21T18:00Z':'2026-11-21T15:00Z',competitors:[{athlete:{displayName:`Fighter ${i*2}`}},{athlete:{displayName:`Fighter ${i*2+1}`}}]}))}]};
 const checked=await verifyCarouselSource(p,{fetchImpl:async()=>({ok:true,json:async()=>snapshot})});
 assert.equal(checked.eventId,'123');assert.equal(checked.firstBoutAt,'2026-11-21T15:00Z');assert.equal(checked.segmentationVerified,false);assert.deepEqual(checked.snapshot,snapshot);
 await assert.rejects(verifyCarouselSource(p,{fetchImpl:async()=>({ok:true,json:async()=>({events:[]})})}),/exact event/);
});
test('runner stores direct feed manifest and source snapshot; notify never sends externally',async()=>{
 const {run}=await load();const root=fs.mkdtempSync(path.join(process.env.TMPDIR??os.tmpdir(),'carousel-run-'));
 try{for(const p of profiles){const dir=path.join(root,'fighters',p.slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'profile.json'),JSON.stringify(p));}
 const render=async p=>p.paths.map(path=>({path,width:1080,height:1350}));
 const verify=async()=>({url:source,checkedAt:'2026-11-17T20:00Z',snapshot:{events:[]}});
 const p=await run({root,event,date:'2026-11-17',notify:true,render,verify});
 const stored=JSON.parse(fs.readFileSync(p.manifestPath,'utf8'));assert.equal(stored.kind,'feed');assert.equal(stored.date,'2026-11-20');assert.equal(stored.recommendedAt,'2026-11-20T19:00:00-06:00');assert.equal(stored.notification.status,'requested-external-handler');assert.ok(fs.existsSync(path.join(path.dirname(p.manifestPath),'espn-scoreboard.json')));assert.equal(stored.mediaPaths.length,5);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('full-card planner covers 11 bouts once, in official order, as one Friday feed with five slides',async()=>{
 const {buildCarouselPlan}=await load();
 const p=buildCarouselPlan({profiles:[...profiles].reverse(),event,date:'2026-11-17'});
 assert.equal(p.kind,'feed');assert.equal(p.slot,'feed-full-card-carousel');
 assert.equal(p.date,'2026-11-20');assert.equal(p.recommendedTime,'19:00');
 assert.equal(p.recommendedAt,'2026-11-20T19:00:00-06:00');
 assert.match(p.id,/:2026-11-20:feed-full-card-carousel$/);
 assert.deepEqual(p.slides.filter(s=>s.kind==='bouts').map(s=>s.bouts.length),[4,4,3]);
 assert.deepEqual(p.slides.flatMap(s=>s.bouts??[]).map(b=>b.order),Array.from({length:11},(_,i)=>i));
 assert.equal(p.slides.length,5);assert.deepEqual(p.coverFighters,['Fighter 0','Fighter 1']);
 assert.equal(p.mediaPaths.length,5);assert.deepEqual(p.paths,p.mediaPaths);
 assert.equal(p.schedule.firstBoutAt,'2026-11-21T15:00Z');
 assert.equal(p.schedule.mainCardAt,null);assert.equal(p.schedule.prelimsAt,null);
 assert.match(p.slides.at(-1).body,/pendiente/i);assert.doesNotMatch(p.publicCaption,/apuest|Paramount|12:00/i);
 assert.ok(p.provenance.some(s=>s.url===source));assert.equal(p.scheduling.eligible,true);
});
