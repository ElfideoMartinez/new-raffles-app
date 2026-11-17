import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const profiles = [
  {slug:'alpha',name:'Alpha One',record:{wins:12,losses:2,draws:0},sources:[{url:'https://example.org/alpha'}],_event:{name:'Z Next',date:'2026-11-21',bouts:[{order:0,opponent:'Beta Two',date:'2026-11-21T18:00Z'}]}},
  {slug:'beta',name:'Beta Two',record:{wins:8,losses:1,draws:0},sources:[{url:'https://example.org/beta'}],_event:{name:'Z Next',date:'2026-11-21',bouts:[{order:0,opponent:'Alpha One',date:'2026-11-21T18:00Z'}]}},
  {slug:'old',name:'Old Card',_event:{name:'A Old',date:'2026-11-14',bouts:[]}},
  {slug:'later',name:'Later Card',_event:{name:'A Later',date:'2026-12-12',bouts:[]}},
];
const topFour = Array.from({length:4},(_,order)=>profiles.slice(0,2).map((p,i)=>({...p,slug:`bout-${order}-${i}`,name:`Fighter ${order} ${i}`,_event:{...p._event,bouts:[{order,opponent:`Fighter ${order} ${1-i}`,date:'2026-11-21T18:00Z'}]}}))).flat();
const moduleUrl = new URL('./weekly-content.mjs', import.meta.url);
test('week rotates across four confirmed ordered bouts with durable subject metadata', async()=>{
  const {buildPlan}=await api();
  const plans=Array.from({length:6},(_,i)=>buildPlan({profiles:topFour,date:`2026-11-${16+i}`}));
  assert.deepEqual(plans.slice(0,5).map(p=>p.stories[0].featuredBout?.order),[0,1,2,3,0]);
  assert.deepEqual(plans[5].stories.map(s=>s.featuredBout.order),[0,1,2,3]);
  assert.deepEqual([...new Set(plans.flatMap(p=>p.stories.map(s=>s.featuredBout.order)))].sort(),[0,1,2,3]);
  for(const plan of plans) {
    assert.deepEqual(plan,buildPlan({profiles:[...topFour].reverse(),date:plan.date}));
    for(const story of plan.stories){assert.ok(story.subject);assert.equal(story.featuredFighters.length,/spotlight|trivia/.test(story.slot)?1:2);assert.equal(story.featuredBout.fighters.length,2);}
  }
  assert.equal(plans[1].stories[1].subject,plans[1].stories[2].subject);
  assert.match(plans[3].feed.input.caption.text,/Fighter 3 0.*Fighter 3 1/);
  assert.equal(plans[3].feed.featuredBout.order,3);
  assert.match(plans[2].stories[1].subject,/Fighter 2 0 vs\. Fighter 2 1/);
});
test('local runner renders due slots without Git and retries only undelivered story notifications', async t => {
  const { run } = await api();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'weekly-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const p of profiles){const dir=path.join(root,'fighters',p.slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'profile.json'),JSON.stringify(p));}
  const render=async (input,destination)=>{fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,'local-render-fixture');};
  const opts={root,date:'2026-11-16',event:'Z Next',render};
  const dry=await run({...opts,dryRun:true,notify:true,send:()=>assert.fail('dry run sent network')});
  assert.equal(dry.status,'dry-run');
  assert.ok(!fs.existsSync(path.join(root,dry.stories[0].path)));
  const first=await run(opts);
  assert.equal(first.status,'rendered');
  assert.ok(first.manifestPath.endsWith('/manifest.json'));
  assert.ok(first.deliveryReceiptsPath.endsWith('/delivery-receipts.json'));
  assert.ok(fs.existsSync(path.join(root,first.feed.path)));
  const sent=[];
  await assert.rejects(()=>run({...opts,notify:true,send:async s=>{sent.push(s.id);if(sent.length===2)throw Object.assign(new Error('temporary'),{deliveryRejected:true});return {message_id:1};}}),/temporary/);
  const retried=await run({...opts,notify:true,send:async s=>{sent.push(s.id);return {message_id:2};}});
  assert.equal(sent.length,4);
  assert.notEqual(sent[0],sent[1]);assert.equal(sent[1],sent[2]);
  await run({...opts,notify:true,send:()=>assert.fail('duplicate send')});
  const changed=path.join(root,'fighters','alpha','profile.json');
  fs.writeFileSync(changed,JSON.stringify({...profiles[0],record:{wins:13,losses:2,draws:0}}));
  const updated=await run({...opts,notify:true,send:()=>assert.fail('changed copy must not resend delivered IDs')});
  assert.notEqual(updated.stories[0].fingerprint,retried.stories[0].fingerprint);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,retried.directory,'manifest.json')));
  assert.equal(manifest.status,'rendered');
  const receipts=JSON.parse(fs.readFileSync(path.join(root,retried.directory,'delivery-receipts.json')));
  assert.equal(Object.keys(receipts).length,3);
  assert.ok(Object.values(receipts).every(r=>r.messageId));
  const cli=spawnSync(process.execPath,[fileURLToPath(moduleUrl),`--root=${root}`,'--date=2026-11-19','--dry-run'],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
  assert.equal(JSON.parse(cli.stdout).feed.template,'feed-matchup-insight');
  const bad=spawnSync(process.execPath,[fileURLToPath(moduleUrl),'--schedule'],{encoding:'utf8'});assert.notEqual(bad.status,0);
});

test('lost Telegram responses preserve durable intent and block automatic photo or guidance resend', async t => {
  const {run}=await api();
  for(const kind of ['photo','guidance'])await t.test(kind,async t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'ambiguous-delivery-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const render=async(_,dest)=>{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,'image');};
    const opts={root,date:'2026-11-16',render};
    const plan=await run(opts),first=plan.stories[0],receiptPath=path.join(root,plan.deliveryReceiptsPath);
    let photos=0,guidance=0,intent;
    const options={...opts,notify:true,send:async()=>{
      photos++;
      if(kind==='photo'){intent=fs.existsSync(receiptPath)?JSON.parse(fs.readFileSync(receiptPath))[first.id]:null;throw new Error('accepted photo, response lost');}
      return {message_id:42};
    },sendGuidance:async()=>{guidance++;intent=JSON.parse(fs.readFileSync(receiptPath))[first.id];throw new Error('accepted guidance, response lost');}};
    await assert.rejects(()=>run(options),/response lost/);
    await assert.rejects(()=>run({...options,send:async()=>{photos++;return {message_id:99};},sendGuidance:async()=>{guidance++;return {message_id:100};}}),/manual reconciliation/i);
    assert.equal(photos,1,'accepted photo must not be resent');
    assert.equal(guidance,kind==='guidance'?1:0,'accepted guidance must not be resent');
    assert.equal(intent[`${kind}Status`],'sending','intent must exist before the transport is called');
    const receipt=JSON.parse(fs.readFileSync(receiptPath))[first.id];
    assert.equal(receipt[`${kind}Status`],'ambiguous');
    if(kind==='guidance')assert.equal(receipt.messageId,42);
    // An interrupted process leaves sending intent, which is equally unsafe to retry.
    receipt[`${kind}Status`]='sending';fs.writeFileSync(receiptPath,JSON.stringify({[first.id]:receipt}));
    await assert.rejects(()=>run({...options,send:()=>assert.fail('resent interrupted photo'),sendGuidance:()=>assert.fail('resent interrupted guidance')}),/manual reconciliation/i);
  });
});

test('Bot API explicit rejection is retryable but lost or malformed responses require reconciliation', async t=>{
  const {run}=await api();
  const originalFetch=globalThis.fetch,token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN='offline-test';process.env.TELEGRAM_CHAT_ID='test';
  t.after(()=>{globalThis.fetch=originalFetch;if(token===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=token;if(chat===undefined)delete process.env.TELEGRAM_CHAT_ID;else process.env.TELEGRAM_CHAT_ID=chat;});
  for(const kind of ['photo','guidance'])for(const failure of ['rejected','timeout','invalid-json','missing-id'])await t.test(`${kind} ${failure}`,async t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'telegram-response-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const render=async(_,dest)=>{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,'image');};
    const opts={root,date:'2026-11-16',render},plan=await run(opts),receiptPath=path.join(root,plan.deliveryReceiptsPath);
    let calls=0;
    globalThis.fetch=async url=>{
      calls++;
      if(kind==='photo'||url.endsWith('/sendMessage')){
        if(failure==='timeout')throw new Error('accepted but timed out');
        return {ok:failure!=='rejected',status:failure==='rejected'?429:200,json:async()=>{
          if(failure==='invalid-json')throw new SyntaxError('lost body');
          return failure==='rejected'?{ok:false,description:'Too Many Requests'}:{ok:true,result:{}};
        }};
      }
      return {ok:true,json:async()=>({ok:true,result:{message_id:42}})};
    };
    await assert.rejects(()=>run({...opts,notify:true}));
    assert.equal(JSON.parse(fs.readFileSync(receiptPath))[plan.stories[0].id][`${kind}Status`],failure==='rejected'?'rejected':'ambiguous');
    const before=calls;
    globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({ok:true,result:{message_id:100+calls}})};};
    if(failure==='rejected'){
      await run({...opts,notify:true});
      assert.equal(calls-before,kind==='photo'?4:3,'retry only rejected send and never-attempted slots');
    }else{
      await assert.rejects(()=>run({...opts,notify:true}),/manual reconciliation/i);
      assert.equal(calls,before);
    }
  });
});

test('Sunday discusses the most recent past event, never a future result', async () => {
  const { buildPlan } = await api();
  const sunday=buildPlan({profiles,date:'2026-11-15'});
  assert.equal(sunday.event.name,'A Old');
  assert.equal(sunday.mode,'evergreen');
  assert.match(sunday.stories[0].input.story.headline,/pregunta|comunidad/i);
  assert.doesNotMatch(JSON.stringify(sunday.stories.map(s=>s.input)),/Resultados pendientes|Z Next|Verificación pendiente/);
  const empty=buildPlan({profiles:profiles.filter(p=>p._event.date>'2026-11-15'),date:'2026-11-15'});
  assert.equal(empty.event,null);
  assert.match(empty.stories[0].input.story.headline,/pregunta|comunidad/i);
});

test('public copy uses Spanish dates and named sources while keeping provenance', async () => {
  const { buildPlan } = await api();
  const sourced=profiles.map(p=>({...p,sources:[{url:'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard'},{url:'https://www.ufcespanol.com/athlete/alpha',note:'UFC athlete page'}]}));
  const mon=buildPlan({profiles:sourced,date:'2026-11-16'});
  assert.match(mon.stories[0].input.story.context,/21 de noviembre de 2026/);
  assert.match(mon.stories[0].input.story.source,/ESPN/);
  assert.match(mon.stories[0].input.story.source,/UFC/);
  assert.doesNotMatch(JSON.stringify(mon.stories.map(s=>s.input)),/ver manifest|perfiles recopilados|perfil recopilado|Fecha confirmada en perfiles/);
  assert.match(mon.feed.input.caption.text,/21 de noviembre de 2026/);
  assert.match(mon.provenance[0].sources[0].url,/espn/);
  for(const date of ['2027-01-04','2027-01-07','2026-12-14']) {
    const plan=buildPlan({profiles:sourced,date});
    assert.equal(plan.feed.template,'feed-funfact');
    assert.match(plan.feed.input.funfact.source,/ESPN/);
    assert.match(JSON.stringify(plan.feed.input.funfact.items),/12/);
    assert.ok(plan.provenance.some(p=>p.file==='fighters/alpha/profile.json'));
  }
});

test('evergreen feed requires a complete valid record and a usable source', async () => {
  const { buildPlan } = await api();
  const fighter=profiles[0];
  for(const change of [{sources:[]},{sources:[{url:'not a URL'}]},{record:{wins:12,losses:2,draws:-1}},{record:{wins:12,losses:2,draws:1.5}}]) {
    assert.equal(buildPlan({profiles:[{...fighter,...change}],date:'2027-01-04'}).feed,null);
  }
  const sunday=buildPlan({profiles,date:'2026-11-15'}).stories[0].input.story;
  assert.ok(sunday.lines.every(line=>line.text),'trivia template needs text rows');
});

test('matchup poll and hype slider carry both portraits, full names and professional records into durable templates', async t => {
  const {buildPlan}=await api();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'portrait-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const pair=profiles.slice(0,2).map(p=>({...p,photo:{file:'photo.png'}}));
  for(const p of pair){const dir=path.join(root,'fighters',p.slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'photo.png'),`portrait-${p.slug}`);}
  const poll=buildPlan({profiles:pair,root,date:'2026-11-18'}).stories.find(s=>s.slot==='story-winner-poll');
  const hype=buildPlan({profiles:pair,root,date:'2026-11-19'}).stories.find(s=>s.slot==='story-predictions');
  assert.equal(poll.template,'story-matchup-poll');
  assert.equal(hype.template,'story-matchup-hype');
  for(const item of [poll,hype]) {
    const html=fs.readFileSync(item.input.templates.story,'utf8');
    for(const side of ['left','right']) {
      const fighter=item.input.matchup[side];
      assert.ok(fighter.photoDataUri.startsWith('data:image/png;base64,'));
      assert.equal(fighter.name,side==='left'?'Alpha One':'Beta Two');
      assert.equal(fighter.record,side==='left'?'12-2-0':'8-1-0');
      for(const key of ['photoDataUri','name','record'])assert.ok(html.includes(`matchup.${side}.${key}`));
    }
    assert.match(html,/class="sticker-space"/);
    assert.doesNotMatch(html,/sticker_note|stickerGuidance|interaction.manual/);
  }
});

test('weekly stories expose varied native interactions with clean reserved safe zones and public artwork', async () => {
  const {buildPlan}=await api();
  const plans=Array.from({length:7},(_,i)=>buildPlan({profiles,date:`2026-11-${16+i}`}));
  const items=plans.flatMap(p=>p.stories);
  assert.deepEqual([...new Set(items.map(s=>s.interaction?.type))].sort(),['emoji_slider','poll','question','quiz']);
  for(const item of items) {
    const interaction=item.interaction;
    assert.ok(interaction.prompt);
    assert.equal(interaction.native,true);
    assert.ok(interaction.manualInstructions);
    const z=interaction.safeZone;
    assert.ok(z.x>=60&&z.y>=250&&z.x+z.width<=1020&&z.y+z.height<=1670);
    assert.ok(fs.readFileSync(item.input.templates.story,'utf8').includes('class="sticker-space"'));
    assert.doesNotMatch(JSON.stringify(item.input),/REVISIÓN|Verificación pendiente|no hay resultados confirmados|Añadir manualmente|sticker_note|reconfirmar cambios antes de publicar/i);
    assert.doesNotMatch(item.publicCaption,/revisión|añadir|sticker|publicación manual|pendiente/i);
  }
  const quiz=items.find(s=>s.interaction.type==='quiz').interaction;
  assert.equal(quiz.options[quiz.correctOptionIndex],'12');
  const confirmed=profiles.map(p=>({...p,_event:{...p._event,countdown:{confirmed:true,at:'2026-11-21T18:00:00Z',label:'Primera pelea',sourceUrl:'https://www.ufc.com/event/example',checkedAt:'2026-11-20'}}}));
  const countdown=buildPlan({profiles:confirmed,date:'2026-11-20'}).stories.find(s=>s.slot==='story-countdown').interaction;
  assert.equal(countdown.type,'countdown');
  assert.equal(countdown.targetAt,'2026-11-21T18:00:00Z');
  const expired=buildPlan({profiles:confirmed,date:'2026-11-21'});
  assert.ok(expired.stories.every(s=>s.interaction.type!=='countdown'));
});

test('Telegram sends public photo captions separately from manual guidance and dedupes each feed and message receipt', async t => {
  const {run}=await api();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const p of profiles){const d=path.join(root,'fighters',p.slug);fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'profile.json'),JSON.stringify(p));}
  const render=async(_,dest)=>{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,'image');};
  const photos=[],messages=[];
  const options={root,date:'2026-11-16',render,notify:true,send:async item=>{photos.push(item);return {message_id:photos.length};},sendGuidance:async item=>{messages.push(item.id);if(messages.length===2)throw Object.assign(new Error('guidance failed'),{deliveryRejected:true});return {message_id:100+messages.length};}};
  await assert.rejects(()=>run(options),/guidance failed/);
  const done=await run({...options,sendGuidance:async item=>{messages.push(item.id);return {message_id:100+messages.length};}});
  assert.equal(photos.length,3);
  assert.equal(photos.filter(s=>s.kind==='feed').length,1);
  assert.equal(messages.length,4);
  assert.equal(messages[1],messages[2]);
  for(const item of photos){assert.ok(item.publicCaption);assert.ok(item.manualGuidance);assert.doesNotMatch(item.publicCaption,/revisión|añadir|sticker|publicación manual/i);}
  await run({...options,send:()=>assert.fail('duplicate photo'),sendGuidance:()=>assert.fail('duplicate guidance')});
  const receipts=JSON.parse(fs.readFileSync(path.join(root,done.deliveryReceiptsPath)));
  assert.equal(Object.keys(receipts).length,3);
  assert.ok(receipts[done.feed.id].guidanceMessageId);
  // Exercise the actual Bot API payload construction with transport mocked only.
  const originalFetch=globalThis.fetch;
  const token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN='offline-test';process.env.TELEGRAM_CHAT_ID='test';
  t.after(()=>{globalThis.fetch=originalFetch;if(token===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=token;if(chat===undefined)delete process.env.TELEGRAM_CHAT_ID;else process.env.TELEGRAM_CHAT_ID=chat;});
  const calls=[];
  globalThis.fetch=async(url,opts)=>{calls.push({url,body:opts.body});return {ok:true,json:async()=>({ok:true,result:{message_id:200+calls.length}})};};
  await run({root,date:'2026-11-19',render,notify:true});
  assert.equal(calls.filter(c=>c.url.endsWith('/sendPhoto')).length,3);
  assert.equal(calls.filter(c=>c.url.endsWith('/sendMessage')).length,3);
  assert.ok(calls.filter(c=>c.url.endsWith('/sendPhoto')).every(c=>!String(c.body.get('caption')).match(/revisión|sticker|añadir/i)));
});

test('rendered story geometry keeps native sticker space clear and all copy inside Instagram safe bounds', async () => {
  const {default:puppeteer}=await import('puppeteer-core');
  const {default:vm}=await import('node:vm');
  const {buildPlan}=await api();
  const source=fs.readFileSync(new URL('./generate.mjs',import.meta.url),'utf8');
  const fill=vm.runInNewContext(source.slice(source.indexOf('function fill('),source.indexOf('function readTemplate('))+';fill');
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try {
    for(const date of ['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-22'])for(const story of buildPlan({profiles,date}).stories){
      const page=await browser.newPage();await page.setViewport({width:1080,height:1920});
      await page.setContent(fill(fs.readFileSync(story.input.templates.story,'utf8'),story.input));
      const errors=await page.evaluate(()=>{
        const zone=document.querySelector('.sticker-space').getBoundingClientRect();
        return [...document.querySelectorAll('body *')].filter(e=>!e.children.length&&e.textContent.trim()).flatMap(e=>{
          const r=e.getBoundingClientRect(),text=e.textContent;
          return [r.x<60||r.right>1020||r.y<250||r.bottom>1670||e.scrollWidth>e.clientWidth+1?`outside: ${text}`:null,r.x<zone.right&&r.right>zone.x&&r.y<zone.bottom&&r.bottom>zone.y?`sticker collision: ${text}`:null].filter(Boolean);
        });
      });
      await page.close();assert.deepEqual(errors,[],`${date} ${story.slot}`);
    }
  } finally {await browser.close();}
});

test('Tuesday spotlight renders one official portrait rather than another text-only card', async t => {
  const {buildPlan}=await api();const root=fs.mkdtempSync(path.join(os.tmpdir(),'spotlight-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const fighter={...profiles[0],photo:{file:'photo.png'}};const dir=path.join(root,'fighters',fighter.slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'photo.png'),'portrait');
  const item=buildPlan({root,profiles:[fighter,profiles[1]],date:'2026-11-17'}).stories[0];
  assert.equal(item.template,'story-portrait-spotlight');
  assert.equal(item.input.fighter.name,'Alpha One');assert.equal(item.input.fighter.record,'12-2-0');assert.match(item.input.fighter.photoDataUri,/^data:image\/png/);
  const html=fs.readFileSync(item.input.templates.story,'utf8');
  for(const key of ['name','record','photoDataUri'])assert.ok(html.includes(`fighter.${key}`));
  assert.match(html,/class="sticker-space"/);
});

test('template changes invalidate cached artwork without resending delivered IDs', async t => {
  const {run}=await api();const root=fs.mkdtempSync(path.join(os.tmpdir(),'template-cache-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const dir=path.join(root,'fighters','alpha');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'profile.json'),JSON.stringify(profiles[0]));
  let count=0;const render=async(_,dest)=>{count++;fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,'image');};
  const opts={root,date:'2026-11-17',render};
  const first=await run(opts);await run(opts);assert.equal(count,3);
  const manifestPath=path.join(root,first.manifestPath),manifest=JSON.parse(fs.readFileSync(manifestPath));
  // A previous template digest must not be accepted even with unchanged input JSON.
  manifest.stories[0].fingerprint='old-template-digest';fs.writeFileSync(manifestPath,JSON.stringify(manifest));
  await run(opts);assert.equal(count,4);
  // Fingerprints include actual template bytes, not only the filename/input.
  const {createHash}=await import('node:crypto');const input=JSON.parse(fs.readFileSync(path.join(root,first.stories[0].path.replace('story.jpg','input.json'))));
  const expected=createHash('sha256').update(JSON.stringify(input)).update(fs.readFileSync(input.templates.story)).digest('hex');
  assert.equal(first.stories[0].fingerprint,expected);
});

test('Tuesday quiz and reveal use the same single portrait without leaking the answer into question copy', async t=>{
  const {buildPlan}=await api();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'trivia-portrait-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const fighters=topFour.map(p=>({...p,photo:{file:'photo.png',source_url:`https://www.ufc.com/athlete/${p.slug}`}}));
  for(const p of fighters){const dir=path.join(root,'fighters',p.slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'photo.png'),'portrait');}
  const plan=buildPlan({profiles:fighters,root,date:'2026-11-17'});
  const question=plan.stories.find(s=>s.slot==='story-trivia-question'),answer=plan.stories.find(s=>s.slot==='story-trivia-answer');
  for(const item of [question,answer]){
    assert.equal(item.template,'story-portrait-trivia');
    assert.equal(item.input.fighter.name,'Fighter 1 0');
    assert.match(item.input.fighter.photoDataUri,/^data:image\/png;base64,/);
    const html=fs.readFileSync(item.input.templates.story,'utf8');
    assert.match(html,/fighter.photoDataUri/);assert.match(html,/fighter.name/);assert.match(html,/object-fit:contain/);
    assert.match(html,/class="sticker-space"/);
  }
  assert.equal(question.input.fighter.record,undefined);
  assert.doesNotMatch(JSON.stringify({story:question.input.story,caption:question.publicCaption}),/12|12-2-0|Respuesta correcta/);
  assert.equal(question.input.story.reveal,false);
  assert.equal(answer.input.story.reveal,true);
  assert.match(answer.publicCaption,/12-2-0/);
  assert.equal(answer.input.fighter.record,'12-2-0');
});
const api = async () => { assert.ok(fs.existsSync(moduleUrl), 'weekly-content implementation must exist'); return import(moduleUrl); };

test('daily plans are deterministic, sourced, distinct, and honest when data is pending', async () => {
  const { buildPlan } = await api();
  const mon = buildPlan({profiles,date:'2026-11-16'});
  const thu = buildPlan({profiles,date:'2026-11-19'});
  assert.deepEqual(mon, buildPlan({profiles:[...profiles].reverse(),date:'2026-11-16'}));
  assert.equal(mon.approvalRequired,true);
  assert.equal(mon.event.date,'2026-11-21');
  assert.notEqual(mon.feed.id,thu.feed.id);
  assert.equal(mon.feed.template,'feed-vs');
  assert.equal(thu.feed.template,'feed-matchup-insight');
  assert.match(thu.stories.at(-1).stickerGuidance,/compartir.*feed.*manualmente/i);
  assert.match(JSON.stringify(thu.feed.input.matchup.insights),/12.*8/);
  assert.doesNotMatch(JSON.stringify(mon),/primera vez|first meeting/i);
  assert.ok(mon.provenance.some(p=>p.file==='fighters/alpha/profile.json'));
  assert.deepEqual(mon.missingPortraits,['alpha','beta']);
  for(let i=0;i<7;i++) {
    const plan = buildPlan({profiles,date:`2026-11-${16+i}`});
    assert.ok(new Set(plan.stories.map(s=>s.template)).size>=2);
    assert.ok(plan.stories.every(s=>s.stickerGuidance && s.path));
  }
  const sat=buildPlan({profiles,date:'2026-11-21'});
  assert.ok(sat.stories.every(s=>s.recommendedAt));
  assert.match(JSON.stringify(sat.stories.at(-1)),/pendiente/i);
  assert.match(sat.stories.find(s=>s.slot==='story-main-card').stickerGuidance,/cartelera principal.*pendiente/i);
  assert.match(sat.stories.find(s=>s.slot==='story-main-card').recommendedAt,/pendiente/i);
  const empty=buildPlan({profiles:[],date:'2026-11-16'});
  assert.equal(empty.feed,null);
  assert.equal(empty.stories.length,2);
  const evergreen = buildPlan({profiles,date:'2027-01-04'});
  assert.equal(evergreen.mode,'evergreen');
  assert.doesNotMatch(JSON.stringify(evergreen.stories),/semana de pelea|este sábado/i);
  assert.equal(evergreen.feed.template,'feed-funfact');
  assert.match(JSON.stringify(buildPlan({profiles,date:'2026-11-22'}).stories),/Comunidad/);
});


test('Chihuahua dates and all seven editorial day slots follow the proposal', async () => {
  const { localDate, daySlots } = await api();
  assert.equal(localDate(new Date('2026-11-17T02:00:00Z')), '2026-11-16');
  const expected = [[2,'19:00'],[3,null],[3,null],[2,'19:00'],[4,null],[4,null],[2,null]];
  for (let i=0;i<7;i++) {
    const slots = daySlots(`2026-11-${16+i}`);
    assert.equal(slots.stories.length, expected[i][0]);
    assert.equal(slots.feed?.time ?? null, expected[i][1]);
  }
  assert.deepEqual(daySlots('2026-11-20').stories.map(s=>s.time), ['13:00','13:00','19:00','19:00']);
  assert.ok(daySlots('2026-11-21').stories.every(s=>s.time === null));
  assert.throws(()=>daySlots('2026-02-30'), /date/i);
});


test('event selection is chronological, exact, and rejects stale or conflicting data', async () => {
  const { selectEvent } = await api();
  assert.equal(selectEvent(profiles,'2026-11-16').name, 'Z Next');
  assert.equal(selectEvent(profiles,'2026-11-16','A Later').date,'2026-12-12');
  assert.throws(()=>selectEvent(profiles,'2026-11-16','Next'),/exact/i);
  assert.throws(()=>selectEvent(profiles,'2026-11-16','A Old'),/past|stale/i);
  assert.equal(selectEvent(profiles,'2027-01-01'),null);
  assert.throws(()=>selectEvent([...profiles,{_event:{name:'Z Next',date:'2026-11-22'}}],'2026-11-16'),/conflict/i);
});
