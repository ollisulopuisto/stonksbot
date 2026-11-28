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
 'is $NVDA over now?', "what's the mood on $NVDA?", 'what is the mood for $NVDA?',
 '$NVDA over or back?', '$NVDA is back again?', 'is $NVDA still over today?',
 'hey, is $NVDA back right now, please?', 'how is $NVDA doing?', "how's $NVDA looking?",
 'onko $NVDA vielä pelissä?', 'miltä $NVDA näyttää?', 'miltä $NVDA näyttää tänään?',
 'miten $NVDA menee nyt?', 'miten $NVDA voi?', 'mikä on $NVDA fiilis?',
 'mikä on $NVDA:n tilanne nyt?', 'hei, onko $NVDA jo takaisin, kiitos?',
 '$NVDA onko nyt nousussa?', '$NVDA takaisin taas?',

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
  assert.equal(sent.length,1);assert.equal(Object.hasOwn(sent[0],'thread_ts'),false);
  assert.match(sent[0].card.text,/Nvidia \(\$NVDA\): (106|94|101)\.00 USD/);
  if (["We're back","It's over"].includes(label)) assert.ok(sent[0].card.text.includes(label));
  else assert.doesNotMatch(sent[0].card.text,/Mood unavailable/);
  assert.equal(sent[0].card.blocks.length,1);
  assert.doesNotMatch(JSON.stringify(sent[0].card),/Finnhub/);
  await receive({message:{channel:'COTHER',ts:'123.5',text:'is $NVDA back?'}});
  await receive({message:{channel:'C123',ts:'123.6',text:'is $OTHER back?'}});
  assert.equal(sent.length,1);
 }
});
test('ordinary ticker cards stay unchanged, questions only affect matching symbol, demo is never a real mood',async()=>{
 const sent=[];
 await createHandler({provider:{lookup:async s=>({...base,symbol:s})},send:async p=>sent.push(p),now:()=>now})({channel:'C123',ts:'123.4',text:'is $NVDA back? $AAPL'});
 assert.match(sent[0].card.text,/Nvidia \(\$NVDA\): 106.00 USD.*We're back/);
 assert.match(sent[1].card.text,/\(\$AAPL\): 106.00 USD/);
 const demo=[];
 await createHandler({provider:{lookup:async()=>({...base,fixture:true})},send:async p=>demo.push(p),now:()=>now})({channel:'C123',ts:'123.5',text:'onko $NVDA takaisin?'});
 assert.doesNotMatch(demo[0].card.text,/Mood unavailable/);assert.match(demo[0].card.text,/DEMO/);
});

test('mood phrase must end the question, not introduce a price or other continuation',async()=>{
 for(const text of ['is $NVDA over 100?', 'is $AAPL back at 200 yet?', 'is $TSLA done reporting?', 'onko $NVDA ohi 100 dollarin?', 'is $NVDA back to normal?', 'is $NVDA over-valued?']) {
  assert.deepEqual(moodQuestionTickers(text),[],text);
  const sent=[];
  await createHandler({provider:{lookup:async symbol=>({...base,symbol})},send:async p=>sent.push(p),now:()=>now})({channel:'C123',ts:'123.4',text});
  assert.equal(sent.length,1);
  assert.match(sent[0].card.text,/\(\$[A-Z]+\): 106.00 USD\./);
 }
 for(const text of ['is $NVDA back to normal? is $AAPL over 100?','is $NVDA over-priced?','is $NVDA back/above 100?']) assert.deepEqual(moodQuestionTickers(text),[],text);
 assert.deepEqual(moodQuestionTickers('is $NVDA back?!  '),['NVDA']);
 assert.deepEqual(moodQuestionTickers('is $NVDA back. is $AAPL over?'),['NVDA','AAPL']);
});

test('broader grammar stays whole-question bounded and retains the ticker cap',()=>{
 for(const text of ["what's the mood on $NVDA at 100?",'miltä $NVDA näyttää 100 dollarin kohdalla?', 'onko $NVDA vielä pelissä 100 eurolla?', '$NVDA over 100?', '$NVDA takaisin 100 dollariin?', 'miten $NVDA menee yli 100?', 'I wonder if $NVDA is back', 'is $NVDA over-valued now?']) assert.deepEqual(moodQuestionTickers(text),[],text);
 assert.deepEqual(moodQuestionTickers('is $AAPL back? is $NVDA over? is $SPY back? is $MSFT back?'),['AAPL','NVDA','SPY']);
 assert.deepEqual(moodQuestionTickers('is $BRK.B over or back?'),['BRK.B']);
});
