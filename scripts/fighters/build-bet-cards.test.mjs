import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildCardData} from './build-bet-cards.mjs';

test('creates one ordered matchup per reciprocal bout and only the selected event', () => {
  const root=mkdtempSync(join(tmpdir(),'bet-card-test-'));
  const event='Test Fight Night';
  writeFileSync(join(root,'_weekly-gather.json'),JSON.stringify({event,eventDate:'2030-01-20T20:00Z',partial:false,queryDate:'2030-01-20',fighters:[{name:'Alice'},{name:'Bob'}]}));
  for(const [slug,name,opponent] of [['alice','Alice','Bob'],['bob','Bob','Alice']]) {
    mkdirSync(join(root,slug));
    writeFileSync(join(root,slug,'profile.json'),JSON.stringify({slug,name,record:{wins:12,losses:3},_event:{name:event,date:'2030-01-20',bouts:[{order:0,opponent,date:'2030-01-20T21:00Z'}]}}));
  }
  const card=buildCardData(root);
  assert.equal(card.matchups.length,1);
  assert.deepEqual([card.matchups[0].a,card.matchups[0].b],['Alice','Bob']);
  assert.equal(card.matchups[0].image,'');
  assert.equal(card.matchups[0].date,'2030-01-20T21:00Z');
});

test('refuses partial research instead of producing a publishable card',()=>{
  const root=mkdtempSync(join(tmpdir(),'bet-card-partial-'));
  writeFileSync(join(root,'_weekly-gather.json'),JSON.stringify({event:'Test',partial:true}));
  assert.throws(()=>buildCardData(root),/partial/i);
});
