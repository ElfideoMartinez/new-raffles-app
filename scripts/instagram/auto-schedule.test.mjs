import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import * as scheduler from './auto-schedule.mjs';

const NOW = Date.parse('2026-11-17T18:00:00Z');
function fixture(t) {
  const root=fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(),'auto-schedule-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'one.jpg'), Buffer.from([0xff,0xd8,0xff,0xd9]));
  fs.writeFileSync(path.join(root,'two.jpg'), Buffer.from([0xff,0xd8,0xff,0xd8]));
  return {root, manifest:{account:'@bet.mx.ufc',date:'2026-11-19',timezone:'America/Chihuahua',feed:{id:'event:2026-11-19:feed',kind:'feed',path:'one.jpg',recommendedTime:'19:00',publicCaption:'Prueba la app: https://rifasmtz.web.app/'}}};
}
test('normalizes weekly and direct carousel manifests preserving order, ignores manual stories', t => {
  assert.equal(typeof scheduler.normalizeManifest,'function');
  const {root,manifest}=fixture(t);
  const [feed]=scheduler.normalizeManifest({...manifest,stories:[{id:'manual'}]}, {root});
  assert.equal(feed.scheduledAt,'2026-11-19T19:00:00-06:00');
  assert.deepEqual(feed.mediaPaths,[path.join(root,'one.jpg')]);
  const [carousel]=scheduler.normalizeManifest({id:'carousel',scheduledAt:'2026-11-20T19:00:00-06:00',mediaPaths:['two.jpg','one.jpg'],caption:'Caption'}, {root});
  assert.deepEqual(carousel.mediaPaths,[path.join(root,'two.jpg'),path.join(root,'one.jpg')]);
  assert.deepEqual(scheduler.normalizeManifest({stories:[{path:'one.jpg'}]},{root}),[]);
  assert.throws(()=>scheduler.normalizeManifest({...manifest,account:'@elfideomartinez'},{root}),/account/i);
  assert.throws(()=>scheduler.normalizeManifest({feeds:[{...manifest.feed,kind:'story'}]},{root}),/story/i);
});
function mockApi() {
  const calls=[]; let post;
  const transport=async (endpoint,{method='GET',body,key}={})=>{
    calls.push({endpoint,method,body,key});
    if (method!=='GET') assert.ok(key,'every write has idempotency key');
    if (endpoint==='/media') return {uploadUrl:`https://api.antwork.io/uploads/${calls.length}`};
    if (method==='PUT') return {mediaId:'m'+calls.length,url:`https://cdn.test/${calls.length}.jpg`};
    if (endpoint==='/posts') {
      assert.equal(body.draft,true); assert.deepEqual(body.accounts,[scheduler.ACCOUNT]);
      assert.equal(body.workspaceId,scheduler.WORKSPACE);
      assert.equal(body.options.instagram.publishType,'post');
      post={id:'post123',status:'draft',accountId:scheduler.ACCOUNT,workspaceId:scheduler.WORKSPACE,mediaUrls:body.media,text:body.text,readiness:{publishBlocker:null}};
      return {posts:[{id:post.id,status:'accepted'}]};
    }
    if (endpoint.endsWith('/schedule')) {post.status='scheduled';post.scheduledFor=body.scheduledFor; return post;}
    if (endpoint==='/posts/post123') return structuredClone(post);
    throw new Error('Unexpected '+endpoint);
  };
  return {transport,calls,get post(){return post;}};
}
test('schedules carousel draft with exact GET readbacks and durable per-feed dedupe', async t=>{
  assert.equal(typeof scheduler.scheduleManifest,'function');
  const {root,manifest}=fixture(t), api=mockApi();
  manifest.feed.mediaPaths=['one.jpg','two.jpg'];
  const options={root,transport:api.transport,now:()=>NOW};
  const [r]=await scheduler.scheduleManifest(manifest,options);
  assert.equal(r.state,'scheduled'); assert.equal(r.postId,'post123');
  assert.equal(r.verifiedStatus,'scheduled'); assert.equal(r.uploads.length,2);
  assert.equal(r.scheduledFor,'2026-11-20T01:00:00.000Z');
  assert.equal(r.reviewHoursAtSchedule,55);
  assert.match(r.editUrl,/compose\?postId=post123$/);
  assert.ok(fs.existsSync(r.receiptPath));
  const writes=api.calls.filter(c=>c.method!=='GET').length;
  await scheduler.scheduleManifest(manifest,options);
  assert.equal(api.calls.filter(c=>c.method!=='GET').length,writes);
  assert.equal(api.calls.at(-1).endpoint,'/posts/post123');
});

test('external unschedule creates a permanent tombstone, even if artwork also changed', async t=>{
  const {root,manifest}=fixture(t),api=mockApi(), options={root,transport:api.transport,now:()=>NOW};
  const [first]=await scheduler.scheduleManifest(manifest,options);
  api.post.status='draft';
  fs.writeFileSync(path.join(root,'one.jpg'),'new artwork');
  const [canceled]=await scheduler.scheduleManifest(manifest,options);
  assert.equal(canceled.state,'canceled');assert.ok(canceled.canceledAt);
  const count=api.calls.length;
  await scheduler.scheduleManifest(manifest,options);
  assert.equal(api.calls.length,count,'tombstone is never silently approved');
  assert.ok(JSON.parse(fs.readFileSync(first.receiptPath)).canceledAt);
});
test('changed artwork flags needsReview and never replaces the scheduled post', async t=>{
  const {root,manifest}=fixture(t),api=mockApi(),options={root,transport:api.transport,now:()=>NOW};
  await scheduler.scheduleManifest(manifest,options);
  const writes=api.calls.filter(c=>c.method!=='GET').length;
  fs.writeFileSync(path.join(root,'one.jpg'),'changed');
  const [r]=await scheduler.scheduleManifest(manifest,options);
  assert.equal(r.needsReview,true);assert.equal(r.state,'scheduled');
  assert.equal(api.calls.filter(c=>c.method!=='GET').length,writes);
});
test('partial create failure saves postId before readback error, resumes without a duplicate',async t=>{
  const {root,manifest}=fixture(t),api=mockApi();let fail=true;
  const transport=async (endpoint,options)=>{
    if (endpoint==='/posts/post123' && fail) {fail=false;throw new Error('network unavailable');}
    return api.transport(endpoint,options);
  };
  const [first]=await scheduler.scheduleManifest(manifest,{root,transport,now:()=>NOW});
  assert.match(first.error,/network/);
  const saved=JSON.parse(fs.readFileSync(first.receiptPath));
  assert.equal(saved.postId,'post123');assert.ok(saved.uploads[0].url);
  const [second]=await scheduler.scheduleManifest(manifest,{root,transport,now:()=>NOW});
  assert.equal(second.state,'scheduled');assert.equal(second.needsReview,false);assert.equal(second.lastError,undefined);
  assert.equal(api.calls.filter(c=>c.endpoint==='/posts').length,1);
});
test('mixed week skips past or <6h slots without uploading; dry-run writes nothing',async t=>{
  const {root,manifest}=fixture(t),api=mockApi();
  const week={feeds:[{...manifest.feed,id:'Monday',scheduledAt:'2026-11-16T19:00:00-06:00'},{...manifest.feed,id:'short',scheduledAt:'2026-11-17T17:59:59-06:00'},{...manifest.feed,scheduledAt:'2026-11-19T19:00:00-06:00'}]};
  const before=fs.readdirSync(root);
  const dry=await scheduler.scheduleManifest(week,{root,dryRun:true,now:()=>NOW});
  assert.deepEqual(dry.map(r=>r.state),['skipped','skipped','dry-run']);
  assert.deepEqual(fs.readdirSync(root),before);
  const live=await scheduler.scheduleManifest(week,{root,transport:api.transport,now:()=>NOW});
  assert.deepEqual(live.map(r=>r.state),['skipped','skipped','scheduled']);
  assert.equal(api.calls.filter(c=>c.endpoint==='/media').length,1);
});

test('transport authenticates only API, preserves every idempotency key and validates upload host',async()=>{
  assert.equal(typeof scheduler.createTransport,'function');
  const requests=[];
  const transport=scheduler.createTransport({apiKey:'secret',fetchImpl:async(url,init)=>{
    requests.push({url,init});return new Response(JSON.stringify({ok:true}),{status:200});
  }});
  await transport('/posts',{method:'POST',body:{draft:true},key:'stable'});
  await transport('https://api.antwork.io/uploads/ticket',{method:'PUT',raw:Buffer.from('x'),mimeType:'image/jpeg',key:'upload'});
  assert.equal(requests[0].init.headers.Authorization,'Bearer secret');
  assert.equal(requests[1].init.headers.Authorization,undefined);
  assert.equal(requests[1].init.headers['Idempotency-Key'],'upload');
  await assert.rejects(()=>transport('https://evil.test/uploads/x',{method:'PUT'}),/upload host/i);
});
test('Telegram notice uses composer URL, exact Chihuahua time and honest manual cancel instructions; ambiguous sends never repeat',async t=>{
  assert.equal(typeof scheduler.notifyScheduled,'function');
  const {root,manifest}=fixture(t),api=mockApi();
  const [receipt]=await scheduler.scheduleManifest(manifest,{root,transport:api.transport,now:()=>NOW});
  const messages=[];
  const telegram=async body=>{messages.push(body);return {ok:true,result:{message_id:42,chat:{id:5262019985},text:body.text}};};
  await scheduler.notifyScheduled(receipt,{telegram,now:()=>NOW});
  await scheduler.notifyScheduled(JSON.parse(fs.readFileSync(receipt.receiptPath)),{telegram,now:()=>NOW});
  assert.equal(messages.length,1);
  assert.match(messages[0].text,/2026-11-19.*19:00/);
  assert.match(messages[0].text,/6 horas/);
  assert.match(messages[0].text,/desprogramar/i);
  assert.equal(messages[0].reply_markup.inline_keyboard[0][0].url,receipt.editUrl);
  assert.equal(messages[0].reply_markup.inline_keyboard[0][0].callback_data,undefined);
  const saved=JSON.parse(fs.readFileSync(receipt.receiptPath));delete saved.notification;fs.writeFileSync(receipt.receiptPath,JSON.stringify(saved));
  await assert.rejects(()=>scheduler.notifyScheduled({...saved,receiptPath:receipt.receiptPath},{telegram:async()=>{throw new Error('timeout');},now:()=>NOW}),/timeout/);
  await assert.rejects(()=>scheduler.notifyScheduled({...JSON.parse(fs.readFileSync(receipt.receiptPath)),receiptPath:receipt.receiptPath},{telegram,now:()=>NOW}),/ambiguous/i);
});

test('CLI dry-run emits parseable receipt summary without credentials or writes',t=>{
  const {root,manifest}=fixture(t);
  manifest.feed.scheduledAt=new Date(Date.now()+48*3600000).toISOString();
  const file=path.join(root,'manifest.json');fs.writeFileSync(file,JSON.stringify(manifest));
  const output=spawnSync(process.execPath,[new URL('./auto-schedule.mjs',import.meta.url).pathname,`--manifest=${file}`,`--root=${root}`,'--dry-run','--notify'],{encoding:'utf8'});
  assert.equal(output.status,0,output.stderr+output.stdout);
  const result=JSON.parse(output.stdout);
  assert.equal(result.minimumReviewHours,6);assert.equal(result.receipts[0].state,'dry-run');
  assert.equal(fs.existsSync(path.join(root,'instagram-pack')),false);
});
test('ambiguous one-time PUT blocks automatic retry, keeps ticket and write key',async t=>{
  const {root,manifest}=fixture(t),api=mockApi();let puts=0;
  const transport=async(endpoint,options)=>{
    if(options?.method==='PUT') {puts++;throw new Error('PUT timeout');}
    return api.transport(endpoint,options);
  };
  const [first]=await scheduler.scheduleManifest(manifest,{root,transport,now:()=>NOW});
  assert.match(first.error,/timeout/);
  const saved=JSON.parse(fs.readFileSync(first.receiptPath));
  assert.ok(saved.uploads[0].ticket.uploadUrl);assert.ok(saved.writes['put:0'].key);
  const [second]=await scheduler.scheduleManifest(manifest,{root,transport,now:()=>NOW});
  assert.match(second.error,/one-time/);assert.equal(puts,1);
});
test('readback with wrong account never schedules',async t=>{
  const {root,manifest}=fixture(t),api=mockApi();
  const transport=async(endpoint,options)=>{
    const result=await api.transport(endpoint,options);
    return endpoint==='/posts/post123'?{...result,accountId:'wrong'}:result;
  };
  const [r]=await scheduler.scheduleManifest(manifest,{root,transport,now:()=>NOW});
  assert.match(r.error,/account/);assert.ok(r.postId);
  assert.equal(api.calls.some(c=>c.endpoint.endsWith('/schedule')),false);
});
test('existing scheduled post with media objects reconciles without a write',async t=>{
  const {root,manifest}=fixture(t),api=mockApi();
  await scheduler.scheduleManifest(manifest,{root,transport:api.transport,now:()=>NOW});
  api.post.mediaUrls=api.post.mediaUrls.map(url=>({url}));
  const before=api.calls.length;
  const [r]=await scheduler.scheduleManifest(manifest,{root,transport:api.transport,now:()=>NOW});
  assert.equal(r.error,undefined);assert.equal(api.calls.length,before+1);
});

test('provenance check timestamps do not mark an already-scheduled post changed',async t=>{
  const {root,manifest}=fixture(t),api=mockApi();
  const source=path.join(root,'source.json');
  fs.writeFileSync(source,JSON.stringify({record:'24-3-0',sources:[{url:'https://example.test/fact',checked:'2026-11-17'}]}));
  manifest.provenance=[{file:'source.json',record:'24-3-0',sources:[{url:'https://example.test/fact',checked:'2026-11-17'}]}];
  const [first]=await scheduler.scheduleManifest(manifest,{root,transport:api.transport,now:()=>NOW});
  assert.equal(first.state,'scheduled');
  const writes=api.calls.filter(c=>c.method!=='GET').length;
  fs.writeFileSync(source,JSON.stringify({record:'24-3-0',sources:[{url:'https://example.test/fact',checked:'2026-11-18'}]}));
  manifest.provenance=[{file:'source.json',record:'24-3-0',sources:[{url:'https://example.test/fact',checked:'2026-11-18'}]}];
  const [r]=await scheduler.scheduleManifest(manifest,{root,transport:api.transport,now:()=>NOW});
  assert.equal(r.state,'scheduled');assert.equal(r.needsReview,false);
  assert.equal(api.calls.filter(c=>c.method!=='GET').length,writes);
});
test('factual source changes still require review when rendered artwork is unchanged',async t=>{
  const {root,manifest}=fixture(t),api=mockApi();
  const source=path.join(root,'source.json');
  fs.writeFileSync(source,JSON.stringify({record:'24-3-0'}));manifest.provenance=[{file:'source.json',record:'24-3-0'}];
  await scheduler.scheduleManifest(manifest,{root,transport:api.transport,now:()=>NOW});
  fs.writeFileSync(source,JSON.stringify({record:'25-3-0'}));
  manifest.provenance=[{file:'source.json',record:'25-3-0'}];
  const [r]=await scheduler.scheduleManifest(manifest,{root,transport:api.transport,now:()=>NOW});
  assert.equal(r.needsReview,true);assert.ok(r.observedFingerprint);
});
test('schedule response timeout reconciles accepted remote schedule without replay',async t=>{
  const {root,manifest}=fixture(t),api=mockApi();
  const transport=async(endpoint,options)=>{
    const result=await api.transport(endpoint,options);
    if (endpoint.endsWith('/schedule')) throw new Error('timeout after acceptance');
    return result;
  };
  const [first]=await scheduler.scheduleManifest(manifest,{root,transport,now:()=>NOW});
  assert.match(first.error,/timeout/);
  const [r]=await scheduler.scheduleManifest(manifest,{root,transport,now:()=>NOW});
  assert.equal(r.state,'scheduled');assert.equal(r.needsReview,false);assert.equal(r.lastError,undefined);
  assert.equal(api.calls.filter(c=>c.endpoint.endsWith('/schedule')).length,1);
});

test('future review window requires an explicit offset and at least 6 actual hours, never catch-up', () => {
  assert.equal(typeof scheduler.reviewWindow, 'function');
  assert.equal(scheduler.reviewWindow('2026-11-17T18:00:00-06:00', NOW).scheduledFor, '2026-11-18T00:00:00.000Z');
  for (const at of ['2026-11-16T19:00:00-06:00', '2026-11-17T17:59:59-06:00', '2026-11-19T19:00:00', 'garbage']) {
    assert.throws(() => scheduler.reviewWindow(at, NOW), /offset|6|invalid/i);
  }
});
