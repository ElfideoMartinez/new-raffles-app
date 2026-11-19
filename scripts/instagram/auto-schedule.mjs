#!/usr/bin/env node
/** Feed-only Antwork scheduler. Never publishes immediately or consumes Telegram callbacks. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const ACCOUNT='gUi1o3IWQLG6ws6vHnYi';
export const WORKSPACE='tUp47gQT6TMIUL6JZYnK';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash = value => createHash('sha256').update(value).digest('hex');
export function normalizeManifest(manifest, {root=ROOT}={}) {
  const plan=manifest.plan ?? manifest;
  for (const p of [manifest,plan]) if (p.account && !['@bet.mx.ufc',ACCOUNT].includes(p.account)) throw new Error('Unexpected account');
  const feeds=plan.feeds ?? (plan.feed?[plan.feed]:plan.mediaPaths?[plan]:[]);
  const ids=new Set();
  return feeds.filter(Boolean).map(feed=>{
    if (feed.kind && !['feed','carousel'].includes(feed.kind)) throw new Error('Story scheduling forbidden');
    if (feed.account && !['@bet.mx.ufc',ACCOUNT].includes(feed.account)) throw new Error('Unexpected account');
    if (!feed.id || ids.has(feed.id)) throw new Error('Unique durable feed.id required');
    ids.add(feed.id);
    let scheduledAt=feed.scheduledAt ?? feed.scheduledFor;
    if (!scheduledAt && plan.date && feed.recommendedTime) {
      if ((plan.timezone ?? 'America/Chihuahua') !== 'America/Chihuahua') throw new Error('Provide explicit offset for other timezones');
      scheduledAt=`${plan.date}T${feed.recommendedTime}:00-06:00`;
    }
    const mediaPaths=(feed.mediaPaths ?? (feed.path?[feed.path]:[])).map(p=>path.resolve(root,p));
    if (!mediaPaths.length || mediaPaths.length>10) throw new Error('Require 1–10 feed images');
    let caption=feed.publicCaption ?? feed.caption;
    if (caption && typeof caption==='object') caption=[caption.text,caption.hashtags].filter(Boolean).join('\n\n');
    if (!caption) {
      const input=feed.input ?? JSON.parse(fs.readFileSync(path.join(path.dirname(mediaPaths[0]),'input.json'),'utf8'));
      caption=[input.caption.text,input.caption.hashtags].filter(Boolean).join('\n\n');
    }
    if (typeof caption!=='string' || !caption.trim()) throw new Error('Feed caption required');
    if (/\b(apuestas?|bets?|betting)\b/i.test(caption)) throw new Error('Feed captions must not mention bets/apuestas');
    const media=mediaPaths.map(file=>{
      const mimeType={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'}[path.extname(file).toLowerCase()];
      const bytes=fs.readFileSync(file);
      if (!mimeType || !bytes.length || bytes.length>8*1024*1024) throw new Error('Require nonempty JPEG/PNG <=8MB');
      return {path:file,mimeType,size:bytes.length,sha256:hash(bytes)};
    });
    const provenance=(feed.provenance ?? plan.provenance ?? []).map(source=>{
      const file=typeof source==='string'?source:source.file;
      const resolved=file?path.resolve(root,file):null;
      const fileFacts=resolved&&fs.existsSync(resolved)?(()=>{
        const bytes=fs.readFileSync(resolved);
        let semanticFileSha256;
        try {semanticFileSha256=hash(canonicalJson(stableSourceFacts(JSON.parse(bytes.toString('utf8')))));}
        catch {semanticFileSha256=hash(bytes);}
        return {fileSha256:hash(bytes),semanticFileSha256};
      })():{fileSha256:null,semanticFileSha256:null};
      return {...(typeof source==='string'?{file:source}:source),...fileFacts};
    });
    return {id:feed.id,scheduledAt,caption,mediaPaths,media,provenance};
  });
}
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value==='object') return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function stableSourceFacts(value) {
  if (Array.isArray(value)) return value.map(stableSourceFacts);
  if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).filter(key=>!['fileSha256','semanticFileSha256','checked','checkedAt','lastChecked','verifiedAt','updatedAt','generatedAt'].includes(key)).sort().map(key=>[key,stableSourceFacts(value[key])]));
  return value;
}
function saveReceipt(file, receipt) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.${process.pid}.tmp`;
  const fd=fs.openSync(tmp,'w',0o600);
  try {fs.writeFileSync(fd,JSON.stringify(receipt,null,2)+'\n');fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
  fs.renameSync(tmp,file);
}
function verifyPost(post, receipt, {scheduled=false}={}) {
  if (post.id!==receipt.postId || post.accountId!==ACCOUNT || post.workspaceId!==WORKSPACE) throw new Error('Exact post/account/workspace readback mismatch');
  const media=(post.mediaUrls ?? post.media ?? []).map(m=>typeof m==='string'?m:m.url);
  if (JSON.stringify(media)!==JSON.stringify(receipt.uploads.map(m=>m.url))) throw new Error('Media order/list readback mismatch');
  if (post.text!==receipt.caption) throw new Error('Caption readback mismatch');
  if (scheduled && (post.status!=='scheduled' || Date.parse(post.scheduledFor)!==Date.parse(receipt.scheduledFor))) throw new Error('Schedule status/time readback mismatch');
  if (post.readiness?.publishBlocker) throw new Error('Publish blocker: '+post.readiness.publishBlocker);
}
export async function scheduleManifest(manifest, {root=ROOT,receiptDir=path.join(root,'instagram-pack/.automation/auto-schedule'),transport,now=Date.now,dryRun=false}={}) {
  const feeds=normalizeManifest(manifest,{root});
  if (!dryRun && !transport) throw new Error('Antwork transport required');
  if (!dryRun) fs.mkdirSync(receiptDir,{recursive:true});
  let lock;
  if (!dryRun) lock=fs.openSync(path.join(receiptDir,'.lock'),'wx',0o600);
  const results=[];
  try {
    for (const feed of feeds) {
      const receiptPath=path.join(receiptDir,hash(feed.id)+'.json');
      let r=fs.existsSync(receiptPath)?JSON.parse(fs.readFileSync(receiptPath,'utf8')):null;
      const fingerprint=hash(canonicalJson(stableSourceFacts({id:feed.id,accountId:ACCOUNT,workspaceId:WORKSPACE,caption:feed.caption,scheduledAt:feed.scheduledAt,media:feed.media.map(m=>m.sha256),provenance:feed.provenance})));
      const persist=()=>{if (!dryRun) saveReceipt(receiptPath,r);};
      try {
        if (r?.id && r.id!==feed.id) throw new Error('Receipt slot mismatch');
        if (r?.canceledAt || r?.state==='canceled') {results.push({...r,receiptPath});continue;}
        if (r?.fingerprint && r.fingerprint!==fingerprint) {
          const priorSemantic=hash(canonicalJson(stableSourceFacts({id:r.id,accountId:r.accountId,workspaceId:r.workspaceId,caption:r.caption,scheduledAt:r.sourceScheduledAt,media:(r.media??[]).map(m=>m.sha256),provenance:r.provenance??[]})));
          const sourceUnchanged=Boolean(r.postId && priorSemantic===fingerprint);
          if (sourceUnchanged) {
            r.fingerprint=fingerprint;r.provenance=feed.provenance;r.needsReview=false;delete r.reviewReason;delete r.observedFingerprint;persist();
          } else {
            r.needsReview=true;r.reviewReason='Source, caption, schedule or artwork changed; existing post was NOT replaced';r.observedFingerprint=fingerprint;persist();
            if (!r.postId) {results.push({...r,receiptPath});continue;}
          }
        }
        if (dryRun) {
          let window;
          try {window=reviewWindow(feed.scheduledAt,now());} catch(error) {results.push({id:feed.id,state:'skipped',reason:error.message,receiptPath});continue;}
          results.push({id:feed.id,state:'dry-run',...window,mediaPaths:feed.mediaPaths,fingerprint,existingPostId:r?.postId??null,receiptPath});continue;
        }
        const getPost=async()=>{
          const result=await transport('/posts/'+encodeURIComponent(r.postId));
          const post=result.post??result;
          if (post.id!==r.postId || post.accountId!==ACCOUNT || post.workspaceId!==WORKSPACE) throw new Error('Exact post/account/workspace readback mismatch');
          r.verifiedStatus=post.status;r.verifiedAt=new Date(now()).toISOString();
          r.remoteScheduledFor=post.scheduledFor??null;r.remoteMedia=post.mediaUrls??post.media??[];
          persist();return post;
        };
        if (r?.postId) {
          let post;
          try {post=await getPost();} catch(error) {
            if (error.status===404 && r.scheduleAttemptedAt) {r.state='canceled';r.canceledAt=new Date(now()).toISOString();r.cancelReason='Externally deleted';persist();results.push({...r,receiptPath});continue;}
            throw error;
          }
          if (r.scheduleAttemptedAt && post.status==='draft') {
            r.state='canceled';r.canceledAt=new Date(now()).toISOString();r.cancelReason='Externally unscheduled or ambiguous schedule not applied; explicit approval required';persist();results.push({...r,receiptPath});continue;
          }
          if (post.status==='scheduled' || post.status==='published') {
            verifyPost(post,r,{scheduled:post.status==='scheduled'});
            r.state=post.status;
            if (r.fingerprint===fingerprint) {r.needsReview=false;delete r.lastError;}
            persist();results.push({...r,receiptPath});continue;
          }
          if (post.status!=='draft') throw new Error('Unexpected existing post status: '+post.status);
          verifyPost(post,r);
          if (r.fingerprint!==fingerprint) {results.push({...r,receiptPath});continue;}
        }
        let window;
        try {window=reviewWindow(feed.scheduledAt,now());} catch(error) {results.push({id:feed.id,state:'skipped',reason:error.message,postId:r?.postId??null,receiptPath});continue;}
        if (!r) {
          r={version:1,id:feed.id,accountId:ACCOUNT,workspaceId:WORKSPACE,fingerprint,caption:feed.caption,sourceScheduledAt:feed.scheduledAt,...window,media:feed.media,provenance:feed.provenance,uploads:[],writes:{},state:'preparing',createdAt:new Date(now()).toISOString()};persist();
        }
        const write=async(operation,endpoint,options)=>{
          const prior=r.writes[operation];
          // Antwork remembers keys for only 24h. Do not replay uncertain writes later.
          if (prior?.attemptedAt && !prior.completedAt && now()-Date.parse(prior.attemptedAt)>=23*3600000) throw new Error('Ambiguous old write requires manual reconciliation: '+operation);
          const key=hash(`${feed.id}:${fingerprint}:${operation}`);
          r.writes[operation]={...prior,key,attemptedAt:prior?.attemptedAt??new Date(now()).toISOString()};persist();
          const result=await transport(endpoint,{...options,key});
          r.writes[operation].completedAt=new Date(now()).toISOString();
          return result;
        };
        for (let index=0;index<feed.media.length;index++) {
          if (r.uploads[index]?.url) continue;
          const m=feed.media[index];
          let upload=r.uploads[index];
          if (!upload?.ticket) {
            const ticket=await write('ticket:'+index,'/media',{method:'POST',body:{workspaceId:WORKSPACE,upload:{filename:path.basename(m.path),mimeType:m.mimeType,size:m.size}}});
            if (!ticket.uploadUrl) throw new Error('Missing media upload ticket');
            upload={ticket,sha256:m.sha256};r.uploads[index]=upload;persist();
          }
          if (upload.putAttemptedAt && !upload.url) throw new Error('Ambiguous one-time media PUT; inspect library before retry');
          upload.putAttemptedAt=new Date(now()).toISOString();persist();
          const result=await write('put:'+index,upload.ticket.uploadUrl,{method:'PUT',raw:fs.readFileSync(m.path),mimeType:m.mimeType});
          if (!result.url || result.success===false) throw new Error('Media upload missing URL');
          upload.url=result.url;upload.mediaId=result.mediaId??result.id;persist();
        }
        if (!r.postId) {
          const created=await write('create','/posts',{method:'POST',body:{accounts:[ACCOUNT],workspaceId:WORKSPACE,draft:true,text:feed.caption,media:r.uploads.map(m=>m.url),options:{instagram:{publishType:'post',postToGrid:true}}}});
          const post=created.posts?.[0];
          if (post?.id) {r.postId=post.id;r.editUrl=`https://antwork.io/workspace/${WORKSPACE}/compose?postId=${encodeURIComponent(post.id)}`;r.state='draft';persist();}
          if (!post?.id || ['failed','rejected'].includes(post.status)) throw new Error('Draft creation rejected/failed');
        }
        const draft=await getPost();verifyPost(draft,r);
        if (draft.status!=='draft') throw new Error('Expected draft before scheduling');
        const latestWindow=reviewWindow(feed.scheduledAt,now());
        r.reviewHoursAtSchedule=latestWindow.reviewHours;r.scheduleAttemptedAt=new Date(now()).toISOString();persist();
        await write('schedule','/posts/'+encodeURIComponent(r.postId)+'/schedule',{method:'POST',body:{scheduledFor:r.scheduledFor}});
        const post=await getPost();verifyPost(post,r,{scheduled:true});
        r.state='scheduled';r.needsReview=false;delete r.lastError;r.scheduledVerifiedAt=new Date(now()).toISOString();persist();
        results.push({...r,receiptPath});
      } catch(error) {
        if (r) {r.lastError=error.message;r.needsReview=true;persist();}
        results.push({...r,id:feed.id,state:r?.state??'error',error:error.message,receiptPath});
      }
    }
  } finally {if (lock!==undefined) {fs.closeSync(lock);fs.unlinkSync(path.join(receiptDir,'.lock'));}}
  return results;
}
export function createTransport({apiKey,fetchImpl=fetch}={}) {
  if (!apiKey) throw new Error('ANTWORK_API_KEY required');
  return async (endpoint,{method='GET',body,raw,mimeType,key}={})=>{
    const external=endpoint.startsWith('https:');
    const url=external?new URL(endpoint):new URL('https://antwork.io/api/v1'+endpoint);
    if (external && (url.origin!=='https://api.antwork.io' || !url.pathname.startsWith('/uploads/') || method!=='PUT')) throw new Error('Unexpected upload host/path/method');
    const headers=external?{}:{Authorization:'Bearer '+apiKey};
    if (method!=='GET') {
      if (!key) throw new Error('Idempotency key required for every write');
      headers['Idempotency-Key']=key;
    }
    if (raw) headers['Content-Type']=mimeType;
    else if (body!==undefined) headers['Content-Type']='application/json';
    const response=await fetchImpl(url.href,{method,headers,body:raw??(body===undefined?undefined:JSON.stringify(body)),redirect:'error',signal:AbortSignal.timeout(60000)});
    const text=await response.text();
    let result;
    try {result=JSON.parse(text);} catch {throw new Error('Antwork returned non-JSON response (HTTP '+response.status+')');}
    if (!response.ok) {const error=new Error('Antwork HTTP '+response.status+': '+(result.error?.code??result.code??'request failed'));error.status=response.status;throw error;}
    return result;
  };
}
export async function notifyScheduled(receipt,{telegram,chatId='5262019985',now=Date.now}={}) {
  const file=receipt.receiptPath;
  if (!file) throw new Error('Notification requires durable receiptPath');
  const r={...JSON.parse(fs.readFileSync(file,'utf8')),receiptPath:file};
  if (r.notification?.messageId) return r;
  if (r.notification?.attemptedAt) throw new Error('Ambiguous Telegram send: inspect chat before any manual recovery');
  if (r.state!=='scheduled' || r.verifiedStatus!=='scheduled' || r.canceledAt || r.needsReview) throw new Error('Only verified unchanged scheduled posts may be notified');
  const local=iso=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Chihuahua',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));
  const text=`Feed programado · @bet.mx.ufc\n${r.id}\nPublicación: ${local(r.scheduledFor)} Chihuahua (UTC-06:00).\nEstado verificado: scheduled · ${local(r.verifiedAt)}.\nRevisión mínima: 6 horas; al programar: ${r.reviewHoursAtSchedule.toFixed(2)} h.\nPara editar o desprogramar: abre Antwork y usa Desprogramar; el botón solo abre el editor, NO cancela por sí solo.\n${r.editUrl}\nHistorias: publicación manual con stickers nativos.`;
  const body={chat_id:chatId,text,disable_web_page_preview:true,reply_markup:{inline_keyboard:[[{text:'Abrir Antwork · editar / desprogramar',url:r.editUrl}]]}};
  r.notification={attemptedAt:new Date(now()).toISOString(),state:'ambiguous'};saveReceipt(file,r);
  const result=await telegram(body);
  if (!result.ok || !result.result?.message_id || String(result.result.chat?.id)!==String(chatId) || result.result.text!==text) throw new Error('Telegram confirmation response mismatch');
  r.notification={...r.notification,state:'sent',messageId:result.result.message_id,confirmedAt:new Date(now()).toISOString()};saveReceipt(file,r);
  return r;
}
function envFile(name) {
  const file=path.join(os.homedir(),'.hermes/scripts',name);
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).filter(line=>/^\s*(?:export\s+)?[A-Z_]+\s*=/.test(line)).map(line=>{
    const [,key,value]=line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*)$/);
    return [key,value.replace(/^(['"])(.*)\1$/,'$2')];
  }));
}
export async function main(args=process.argv.slice(2)) {
  const allowed=['--manifest=','--root=','--receipt-dir='];
  if (args.some(a=>!['--dry-run','--notify'].includes(a)&&!allowed.some(p=>a.startsWith(p)))) throw new Error('Unknown CLI option');
  const option=name=>args.find(a=>a.startsWith(name+'='))?.slice(name.length+1);
  const manifestPath=option('--manifest');
  if (!manifestPath) throw new Error('Usage: node scripts/instagram/auto-schedule.mjs --manifest=PATH [--dry-run] [--notify] [--root=PATH] [--receipt-dir=PATH]');
  const dryRun=args.includes('--dry-run');
  const root=path.resolve(option('--root')??ROOT);
  const receiptDir=path.resolve(option('--receipt-dir')??path.join(root,'instagram-pack/.automation/auto-schedule'));
  const manifest=JSON.parse(fs.readFileSync(path.resolve(manifestPath),'utf8'));
  const transport=dryRun?undefined:createTransport({apiKey:process.env.ANTWORK_API_KEY??envFile('.antwork.env').ANTWORK_API_KEY});
  const receipts=await scheduleManifest(manifest,{root,receiptDir,transport,dryRun});
  if (!dryRun && args.includes('--notify')) {
    const tg={...envFile('.ufc-telegram.env'),...Object.fromEntries(Object.entries(process.env).filter(([key])=>key.startsWith('TELEGRAM_')))};
    const telegram=async body=>{
      if (!tg.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN required');
      const response=await fetch(`https://api.telegram.org/bot${tg.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
      return response.json();
    };
    for (let i=0;i<receipts.length;i++) {
      const r=receipts[i];
      if (r.state!=='scheduled'||r.error||r.needsReview) continue;
      try {receipts[i]=await notifyScheduled(r,{telegram,chatId:tg.TELEGRAM_CHAT_ID??'5262019985'});} catch(error) {r.error=error.message;}
    }
  }
  const summary={ok:!receipts.some(r=>r.error||r.needsReview),dryRun,account:'@bet.mx.ufc',accountId:ACCOUNT,workspaceId:WORKSPACE,minimumReviewHours:6,receipts:receipts.map(r=>({id:r.id,state:r.state,postId:r.postId??null,scheduledFor:r.scheduledFor??null,sourceScheduledAt:r.sourceScheduledAt??null,verifiedStatus:r.verifiedStatus??null,verifiedAt:r.verifiedAt??null,reviewHoursAtSchedule:r.reviewHoursAtSchedule??r.reviewHours??null,editUrl:r.editUrl??null,receiptPath:r.receiptPath,fingerprint:r.fingerprint??null,mediaCount:r.uploads?.filter(m=>m?.url).length??r.mediaPaths?.length??0,canceledAt:r.canceledAt??null,needsReview:r.needsReview??false,reason:r.reason??r.reviewReason??r.cancelReason??null,error:r.error??null,telegramMessageId:r.notification?.messageId??null}))};
  console.log(JSON.stringify(summary,null,2));
  if (!summary.ok) process.exitCode=1;
  return summary;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.log(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;});

export function reviewWindow(at, now = Date.now()) {
  if (typeof at !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(at)) throw new Error('Explicit ISO UTC offset required');
  const time = Date.parse(at);
  if (!Number.isFinite(time)) throw new Error('Invalid schedule time');
  if (time - now < 6 * 3600000) throw new Error('At least 6 hours of future review required; no catch-up');
  if (time - now > 30 * 86400000) throw new Error('Schedule exceeds conservative 30-day horizon');
  return {scheduledFor:new Date(time).toISOString(), reviewHours:(time-now)/3600000};
}
