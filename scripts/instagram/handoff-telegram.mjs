#!/usr/bin/env node
// Send one event handoff ZIP to Daniel; durable intent and exact-file readback.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function credentials(){
 const file=path.join(os.homedir(),'.hermes/scripts/.ufc-telegram.env'),saved={};
 if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split('\n')){
  const m=line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m)saved[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
 }
 const token=process.env.TELEGRAM_BOT_TOKEN??saved.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID??saved.TELEGRAM_CHAT_ID;
 if(!token||!chat)throw new Error('Telegram credentials missing');return {token,chat};
}
function save(file,value){const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,file);}
export async function sendHandoff({zip,event,credentials:provided,fetchImpl=fetch}={}){
 zip=path.resolve(zip);const bytes=fs.readFileSync(zip),digest=hash(bytes),receiptPath=`${zip}.telegram-receipt.json`;
 const prior=fs.existsSync(receiptPath)?JSON.parse(fs.readFileSync(receiptPath,'utf8')):null;
 if(prior?.status==='verified'&&prior.sha256===digest)return {...prior,status:'unchanged'};
 if(prior?.status==='sending'||prior?.status==='ambiguous'||prior?.status==='accepted')throw new Error(`Telegram delivery ambiguous; inspect chat and reconcile ${receiptPath} before retrying`);
 const {token,chat}=provided??credentials(),base=`https://api.telegram.org/bot${token}`;
 const receipt={event,zip:path.basename(zip),sha256:digest,status:'sending',startedAt:new Date().toISOString()};save(receiptPath,receipt);
 const body=new FormData();body.set('chat_id',String(chat));body.set('document',new Blob([bytes],{type:'application/zip'}),path.basename(zip));
 body.set('caption',`${event}\nPack de historias por evento: abre el ZIP, luego index.html. Las historias JPG están junto a la página; feeds en Antwork. Revisa antes de publicar.`.slice(0,1024));
 try{
  const response=await fetchImpl(`${base}/sendDocument`,{method:'POST',body,signal:AbortSignal.timeout(60000)}),data=await response.json();
  if(!response.ok||data?.ok!==true||!data.result?.message_id)throw new Error(`Telegram rejected or returned invalid response: ${data?.description??response.status}`);
  const message=data.result,document=message.document;
  receipt.messageId=message.message_id;receipt.chatId=String(message.chat?.id);receipt.fileId=document?.file_id;receipt.status='accepted';save(receiptPath,receipt);
  if(receipt.chatId!==String(chat)||!receipt.fileId||document.file_size!==bytes.length||document.file_name!==path.basename(zip))throw new Error('Telegram returned unexpected document or chat');
  const fileResponse=await fetchImpl(`${base}/getFile?file_id=${encodeURIComponent(receipt.fileId)}`,{signal:AbortSignal.timeout(30000)}),file=await fileResponse.json();
  if(!fileResponse.ok||!file.ok||file.result?.file_id!==receipt.fileId||!file.result.file_path)throw new Error('Telegram getFile verification failed');
  const download=await fetchImpl(`https://api.telegram.org/file/bot${token}/${file.result.file_path}`,{signal:AbortSignal.timeout(60000)});
  if(!download.ok||hash(Buffer.from(await download.arrayBuffer()))!==digest)throw new Error('Telegram downloaded document differs from local ZIP');
  receipt.status='verified';receipt.verifiedAt=new Date().toISOString();save(receiptPath,receipt);return receipt;
 }catch(error){receipt.status=receipt.status==='accepted'?'accepted':'ambiguous';receipt.error=error.message;save(receiptPath,receipt);throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const [zip,event]=process.argv.slice(2);if(!zip||!event)throw new Error('Usage: node scripts/instagram/handoff-telegram.mjs ZIP "EXACT EVENT"');
 sendHandoff({zip,event}).then(r=>console.log(JSON.stringify({status:r.status,messageId:r.messageId,chatId:r.chatId,sha256:r.sha256,receipt:`${path.resolve(zip)}.telegram-receipt.json`},null,2))).catch(e=>{console.error(e.message);process.exitCode=1});
}
