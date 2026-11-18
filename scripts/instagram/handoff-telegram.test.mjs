import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sendHandoff} from './handoff-telegram.mjs';
const scratch=()=>fs.mkdtempSync(path.join(process.env.TMPDIR??os.tmpdir(),'handoff-send-'));
test('sends one event ZIP and verifies Telegram returned exact bytes; unchanged bundle skips',async()=>{
 const root=scratch();try{
  const zip=path.join(root,'event.zip');fs.writeFileSync(zip,'archive-for-this-event');let calls=[];
  const fetchImpl=async(url,options={})=>{calls.push(url);if(url.endsWith('/sendDocument')){assert.equal(options.body.get('chat_id'),'123');assert.equal(options.body.get('document').name,'event.zip');return {ok:true,json:async()=>({ok:true,result:{message_id:44,chat:{id:123},document:{file_id:'DOC-ID',file_size:fs.statSync(zip).size,file_name:'event.zip'}}})};}if(url.includes('/getFile?'))return {ok:true,json:async()=>({ok:true,result:{file_id:'DOC-ID',file_path:'documents/event.zip'}})};return {ok:true,arrayBuffer:async()=>fs.readFileSync(zip)};};
  const opts={zip,event:'Test event',credentials:{token:'MOCK',chat:'123'},fetchImpl};
  const first=await sendHandoff(opts);assert.equal(first.status,'verified');assert.equal(first.messageId,44);assert.equal(first.sha256,createHash('sha256').update(fs.readFileSync(zip)).digest('hex'));assert.equal(calls.length,3);
  assert.equal(fs.existsSync(`${zip}.telegram-receipt.json`),true);
  const second=await sendHandoff(opts);assert.equal(second.status,'unchanged');assert.equal(calls.length,3);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('lost Telegram response blocks retry until reconciled',async()=>{
 const root=scratch();try{const zip=path.join(root,'event.zip');fs.writeFileSync(zip,'new-content');let calls=0;
 const options={zip,event:'Test event',credentials:{token:'MOCK',chat:'123'},fetchImpl:async()=>{calls++;throw new Error('timeout')}};
 await assert.rejects(sendHandoff(options),/timeout|ambiguous/i);await assert.rejects(sendHandoff(options),/reconcil|inspect/i);assert.equal(calls,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
