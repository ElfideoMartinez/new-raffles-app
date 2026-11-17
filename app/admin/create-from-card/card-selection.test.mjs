import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSelection, betPayload} from './card-selection.mjs';
const card={event:'Test Night',eventDate:'2030-01-20',matchups:[{id:'test-2030-01-20-0',a:'Alice',b:'Bob',date:'2030-01-20T21:00Z',image:'/bet-cards/images/test.jpg'}]};
test('selected matchup becomes one reviewable bet with explicit fields',()=>{
  const selection={id:'test-2030-01-20-0',price:'50',pool:'0',approved:true};
  const payload=betPayload(card,selection);
  assert.equal(payload.title,'Alice vs. Bob');
  assert.equal(payload.sourceKey,selection.id);
  assert.equal(payload.image,card.matchups[0].image);
  assert.equal(payload.pricePerTicket,50);
  assert.equal(payload.initialPool,0);
  assert.equal(payload.date,'2030-01-20T21:00Z');
});
test('rejects missing approval, invalid price and unknown matchup',()=>{
  assert.throws(()=>validateSelection(card,{id:'test-2030-01-20-0',price:'50',pool:'0',approved:false}),/approval/i);
  assert.throws(()=>validateSelection(card,{id:'test-2030-01-20-0',price:'0',pool:'0',approved:true}),/price/i);
  assert.throws(()=>validateSelection(card,{id:'other',price:'50',pool:'0',approved:true}),/unknown/i);
});
