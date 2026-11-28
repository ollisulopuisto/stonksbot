import test from 'node:test';
import assert from 'node:assert/strict';
import { moodQuestionTickers, createHandler } from '../src/bot.js';
import { channelHandler, allowedChannels } from '../src/slack-events.js';
const phrases=[
 'is $NVDA over or back?', 'is $NVDA back or over?', 'is $NVDA back?', 'is $NVDA over?',
 'is $NVDA back yet?', 'is $NVDA done?',
 'onko $NVDA over vai back?', 'onko $NVDA back vai over?', 'onko $NVDA over?',
 'onko $NVDA back?', 'onko $NVDA takaisin?', 'onko $NVDA palannut?',
 'onko $NVDA pohjalla?', 'onko $NVDA ohi?', 'joko $NVDA on takaisin?',
 'onko $NVDA nousussa?', 'onko $NVDA laskussa?',
];
const now=Date.parse('2026-11-27T18:00:00Z');
const base={symbol:'NVDA',name:'Nvidia',price:106,previousClose:100,currency:'USD',asOf:new Date(now).toISOString(),source:'Finnhub',fixture:false,priceKind:'us-quote',history:[]};
for(const phrase of phrases) test(`question variant: ${phrase}`,()=>{
 assert.deepEqual(moodQuestionTickers(phrase),['NVDA']);
 assert.deepEqual(moodQuestionTickers(phrase.toUpperCase()),['NVDA']);
});
test('recognition ignores code, URLs, longer words and unrelated text, but preserves multi-ticker boundaries',()=>{
 for(const text of ['`is $NVDA back`','```is $NVDA back```','<https://site/is-$NVDA-back>','https://site/is/$NVDA/back','is $NVDA background','onko $NVDA takaisinmaksu','I think $NVDA is back','$NVDA','is NVDA back']) assert.deepEqual(moodQuestionTickers(text),[]);
 assert.deepEqual(moodQuestionTickers('Is $BRK.B back? Is $AAPL over? $SPY'),['BRK.B','AAPL']);
});
test('actual handler answers all four outcomes, not the outcome suggested by the question; source and thread preserved',async()=>{
 for(const [change,label] of [[{price:106},"We're back"],[{price:94},"It's over"],[{price:101},'No mood trigger'],[{previousClose:undefined},'Mood unavailable']]) {
  const sent=[];
  const receive=channelHandler(allowedChannels('C123'),createHandler({provider:{lookup:async s=>s==='NVDA'?{...base,...change}:null},send:async p=>sent.push(p),now:()=>now}));
  await receive({message:{channel:'C123',ts:'123.4',thread_ts:'122.3',text:'is $NVDA over or back?'}});
  assert.equal(sent.length,1);assert.equal(sent[0].thread_ts,'122.3');
  assert.ok(sent[0].card.text.startsWith(`NVDA: ${label}`));
  assert.equal(sent[0].card.blocks[1].text.text,`NVDA: ${label}.`);
  assert.match(JSON.stringify(sent[0].card),/Finnhub/);
  await receive({message:{channel:'COTHER',ts:'123.5',text:'is $NVDA back?'}});
  await receive({message:{channel:'C123',ts:'123.6',text:'is $OTHER back?'}});
  assert.equal(sent.length,1);
 }
});
test('ordinary ticker cards stay unchanged, questions only affect matching symbol, demo is never a real mood',async()=>{
 const sent=[];
 await createHandler({provider:{lookup:async s=>({...base,symbol:s})},send:async p=>sent.push(p),now:()=>now})({channel:'C123',ts:'123.4',text:'is $NVDA back? $AAPL'});
 assert.ok(sent[0].card.text.startsWith("NVDA: We're back."));
 assert.ok(sent[1].card.text.startsWith('AAPL: 106.00 USD.'));
 const demo=[];
 await createHandler({provider:{lookup:async()=>({...base,fixture:true})},send:async p=>demo.push(p),now:()=>now})({channel:'C123',ts:'123.5',text:'onko $NVDA takaisin?'});
 assert.match(demo[0].card.text,/^NVDA: Mood unavailable/);assert.match(demo[0].card.text,/DEMO/);
});
