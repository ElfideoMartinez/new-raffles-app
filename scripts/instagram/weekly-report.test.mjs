import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const modulePath = new URL('./weekly-report.mjs', import.meta.url);
const load = () => import(modulePath.href);
const profiles = ['Alpha One','Beta Two'].map((name,i)=>({slug:i?'beta-two':'alpha-one',name,record:{wins:10,losses:2,draws:0},sources:[{url:'https://www.ufc.com/athlete/example'}],_event:{name:'Test Fight Night',date:'2026-11-21',bouts:[{order:0,opponent:i?'Alpha One':'Beta Two',date:'2026-11-21T18:00Z'}]}}));
const options={profiles,date:'2026-11-17',now:new Date('2026-11-17T20:00:00Z'),gather:{event:'Test Fight Night',queryDate:'2026-11-21',fighters:profiles.map(p=>({name:p.name})),partial:false}};
test('enumerates every real story and both feed slots Monday through Sunday without generating story images', async()=>{
  assert.ok(fs.existsSync(modulePath),'weekly-report API must exist');
  const {buildWeeklyReport}=await load();
  const report=buildWeeklyReport(options);
  assert.equal(report.weekStart,'2026-11-16');
  assert.equal(report.weekEnd,'2026-11-22');
  assert.equal(report.days.length,7);
  const {daySlots}=await import('./weekly-content.mjs');
  assert.equal(report.counts.stories,report.days.reduce((n,d)=>n+daySlots(d.date).stories.length,0));
  assert.equal(report.counts.feed,3);
  assert.equal(report.counts.total,23);
  const carousel=report.items.find(i=>i.slot==='feed-full-card-carousel');
  assert.equal(carousel.date,'2026-11-20');assert.equal(carousel.slideCount,3);
  assert.equal(carousel.recommendedPostTime,'19:00');
  assert.ok(report.items.filter(i=>i.kind==='feed').every(i=>i.publication==='auto-scheduled-review-cancel'));
  assert.match(report.policy,/cancel/i);
  const receipt={state:'scheduled',postId:'real-test-id',verifiedAt:'2026-11-17T20:00Z',scheduledFor:'2026-11-21T01:00:00Z'};
  const withReceipt=buildWeeklyReport({...options,receipts:{[carousel.id]:{schedule:receipt}}});
  assert.deepEqual(withReceipt.items.find(i=>i.id===carousel.id).scheduling,receipt);
  assert.equal(withReceipt.planFingerprint,report.planFingerprint);
  assert.equal(report.counts.total,report.items.length);
  assert.equal(new Set(report.items.map(i=>i.id)).size,report.items.length);
  assert.deepEqual(report.items.map(i=>i.number),report.items.map((_,i)=>i+1));
  assert.ok(report.items.every(i=>i.review==='pending'&&(i.kind==='feed'?i.publication==='auto-scheduled-review-cancel':i.publication==='manual')&&i.subject&&i.interaction));
  assert.equal(report.days[5].preparationTime,'07:00');
  assert.ok(report.days.filter((_,i)=>i!==5).every(d=>d.preparationTime==='12:15'));
  assert.ok(report.days[5].items.every(i=>i.recommendedPostTime.includes('pendiente')||i.recommendedPostTime.includes('primera pelea')||i.recommendedPostTime.includes('verificar')));
  assert.ok(report.days[6].items.every(i=>i.condition.includes('resultados verificados')&&i.condition.includes('comunidad')));
  assert.equal(report.card.bouts.length,1);
  assert.equal(report.card.fighters,2);
});
test('renders a self-contained three-page numbered report with no clipped content in real Chrome',async()=>{
  const {buildWeeklyReport,renderReport}=await load();
  assert.equal(typeof renderReport,'function','real report renderer must exist');
  const root=fs.mkdtempSync(path.join(process.env.TMPDIR??os.tmpdir(),'weekly-report-render-'));
  try {
    const report=buildWeeklyReport({...options,root});
    const artifacts=await renderReport(report,root);
    assert.equal(artifacts.images.length,3);
    assert.ok(fs.readFileSync(artifacts.html,'utf8').includes('Cartelera confirmada'));
    for(const image of artifacts.images)assert.ok(fs.statSync(image).size>10000);
    assert.deepEqual(artifacts.layoutErrors,[]);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('fails closed on nonreciprocal card matchups',async()=>{
 const {buildWeeklyReport}=await load();const broken=structuredClone(profiles);broken[1]._event.bouts[0].opponent='Beta Two';
 assert.throws(()=>buildWeeklyReport({...options,profiles:broken}),/reciprocal/);
});
test('Telegram sends only report images and reads back the exact returned file and target',async()=>{
 const {telegramReportSend}=await load();assert.equal(typeof telegramReportSend,'function');
 const root=fs.mkdtempSync(path.join(process.env.TMPDIR??os.tmpdir(),'weekly-report-telegram-'));
 try{
  const image=path.join(root,'page.jpg');fs.writeFileSync(image,Buffer.from([255,216,255,217]));
  const calls=[];let accepted;
  const fetchImpl=async(url,options)=>{calls.push(url);if(url.endsWith('/sendPhoto')){assert.equal(options.body.get('chat_id'),'123');return {ok:true,json:async()=>({ok:true,result:{message_id:91,chat:{id:123},photo:[{file_id:'EXACT_ID'}]}})};}if(url.includes('/getFile?'))return {ok:true,json:async()=>({ok:true,result:{file_id:'EXACT_ID',file_path:'photos/exact.jpg'}})};return {ok:true,arrayBuffer:async()=>Uint8Array.from([255,216,255,217]).buffer};};
  const result=await telegramReportSend(image,{report:await (await load()).buildWeeklyReport(options),page:1,credentials:{token:'MOCK',chat:'123'},fetchImpl,onAccepted:r=>accepted=r.messageId});
  assert.equal(accepted,91);assert.equal(result.verification.status,'getFile-downloaded');assert.ok(calls[1].endsWith('file_id=EXACT_ID'));assert.ok(calls[2].endsWith('/photos/exact.jpg'));assert.equal(result.chatId,'123');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('fingerprint is stable across time and delivery receipts but changes for a revised card',async()=>{
 const {buildWeeklyReport}=await load();
 const first=buildWeeklyReport(options);
 const later=buildWeeklyReport({...options,now:new Date('2026-11-18T22:00Z'),receipts:{[first.items[0].id]:{messageId:8}}});
 assert.equal(later.planFingerprint,first.planFingerprint);
 assert.equal(later.items[0].delivery.messageId,8);
 const revised=structuredClone(profiles);revised[0].record.wins++;
 assert.notEqual(buildWeeklyReport({...options,profiles:revised}).planFingerprint,first.planFingerprint);
 assert.throws(()=>buildWeeklyReport({...options,gather:{...options.gather,partial:true}}),/partial/);
});
test('runner stores numbered manifest, resumes per-page receipts, dedupes unchanged reports and sends revisions only',async()=>{
 const {run}=await load();assert.equal(typeof run,'function','report runner must exist');
 const root=fs.mkdtempSync(path.join(process.env.TMPDIR??os.tmpdir(),'weekly-report-run-'));
 let sends=0;
 try{
  fs.mkdirSync(path.join(root,'fighters'),{recursive:true});
  fs.writeFileSync(path.join(root,'fighters/_weekly-gather.json'),JSON.stringify(options.gather));
  for(const p of profiles){fs.mkdirSync(path.join(root,'fighters',p.slug));fs.writeFileSync(path.join(root,'fighters',p.slug,'profile.json'),JSON.stringify(p));}
  const render=async(r,d)=>{fs.mkdirSync(d,{recursive:true});const html=path.join(d,'report.html');fs.writeFileSync(html,'test report');const images=[1,2,3].map(n=>{const p=path.join(d,`${n}.jpg`);fs.writeFileSync(p,'test');return p;});return {html,images};};
  const send=async()=>{sends++;return {messageId:sends,chatId:'123',verification:{status:'getFile-downloaded'}};};
  const args={root,date:options.date,now:options.now,render,send};
  const local=await run(args);assert.equal(sends,0);assert.equal(local.notification.status,'not-sent');
  const receiptDir=path.join(root,'instagram-pack/.automation/auto-schedule');fs.mkdirSync(receiptDir,{recursive:true});
  const feedId=local.items.find(i=>i.slot==='feed-full-card-carousel').id;
  fs.writeFileSync(path.join(receiptDir,'actual.json'),JSON.stringify({id:feedId,state:'scheduled',postId:'verified-real-test',verifiedAt:'2026-11-17T20:00Z',scheduledFor:'2026-11-21T01:00:00Z'}));
  const loaded=await run(args);assert.equal(loaded.items.find(i=>i.id===feedId).scheduling.postId,'verified-real-test');
  const first=await run({...args,notify:true});assert.equal(sends,3);assert.equal(first.notification.status,'sent');
  await run({...args,notify:true});assert.equal(sends,3);
  const revised=structuredClone(profiles[0]);revised.record.wins++;
  fs.writeFileSync(path.join(root,'fighters',revised.slug,'profile.json'),JSON.stringify(revised));
  const next=await run({...args,notify:true});assert.equal(sends,6);assert.notEqual(next.planFingerprint,first.planFingerprint);
  assert.equal(next.notification.receipts.length,3);
  assert.equal(JSON.parse(fs.readFileSync(next.manifestPath)).counts.total,next.items.length);
  const changed=structuredClone(revised);changed.record.wins++;
  fs.writeFileSync(path.join(root,'fighters',changed.slug,'profile.json'),JSON.stringify(changed));
  let ambiguousCalls=0;const ambiguous=async()=>{ambiguousCalls++;throw new Error('timeout');};
  await assert.rejects(run({...args,notify:true,send:ambiguous}),/inspect Telegram/);
  await assert.rejects(run({...args,notify:true,send:ambiguous}),/ambiguous\/unverified/);
  assert.equal(ambiguousCalls,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
