import test from 'node:test';
import assert from 'node:assert/strict';
import { loadNameIndex, resolveName } from '../src/name-lookup.js';
import { createHandler } from '../src/bot.js';
const index=await loadNameIndex();
const quote=symbol=>({symbol,name:symbol,price:106,previousClose:100,currency:'USD',asOf:'2026-11-27T18:00:00Z',source:'synthetic',fixture:false,priceKind:'us-quote',history:[]});
test('offline exact tickers win, company names and conservative typo resolution',()=>{
 assert.equal(resolveName(index,'AAPL').symbol,'AAPL');assert.equal(resolveName(index,'MEKKO').symbol,'MEKKO.HE');
 assert.equal(resolveName(index,'apple').symbol,'AAPL');assert.equal(resolveName(index,'marimekko').symbol,'MEKKO.HE');
 assert.ok(resolveName(index,'appl').notice);assert.equal(resolveName(index,'qzxunfindable').symbol,undefined);
 assert.ok(resolveName(index,'bank').notice);
});
test('cashtag name and verified app mention resolve quote, ordinary prose does not',async()=>{
 const calls=[],sent=[];const handler=createHandler({nameIndex:index,provider:{lookup:async s=>{calls.push(s);return quote(s.replace('.US',''));}},send:async p=>sent.push(p),now:()=>Date.parse('2026-11-27T18:00:00Z')});
 await handler({channel:'C1',ts:'1.1',text:'how is $apple doing'});await handler({channel:'C1',ts:'1.2',text:'<@B123> apple',type:'app_mention'});
 assert.deepEqual(calls,['AAPL.US','AAPL.US']);assert.equal(sent.length,2);assert.match(sent[0].card.text,/Apple.*\(\$AAPL\)/);
 await handler({channel:'C1',ts:'1.3',text:'apple'});await handler({channel:'C1',ts:'1.4',text:'@stonksbot apple'});await handler({channel:'C1',ts:'1.5',type:'app_mention',text:'<@B123> apple',bot_id:'B123'});assert.equal(calls.length,2);
});
test('ambiguous/low-confidence name asks instead of querying, duplicate mention events dedup',async()=>{
 const calls=[],sent=[];const handler=createHandler({nameIndex:index,provider:{lookup:async s=>{calls.push(s);return quote(s);}},send:async p=>sent.push(p)});
 const event={channel:'C1',ts:'1.1',type:'app_mention',text:'<@B123> bank'};await handler(event);await handler(event);
 assert.equal(calls.length,0);assert.equal(sent.length,0);
});
test('near ties and generic names never guess, explicit ticker routes bypass fuzzy',()=>{
 for(const q of ['bank','trust','energy','appl','apple hospitality'])assert.ok(resolveName(index,q).notice||resolveName(index,q).name);
 const tiny=[{symbol:'ONE',canonical:'ONE',route:'ONE.US',name:'Alpha Corp',normalized:'alpha'},{symbol:'TWO',canonical:'TWO',route:'TWO.US',name:'Alphi Corp',normalized:'alphi'}];assert.ok(resolveName(tiny,'alph').notice);
 assert.equal(resolveName(index,'NOK').route,'NOK');
});
test('multiple instruments or suggestion plus instrument never reacts ambiguously',async()=>{
 const reactions=[],posts=[];const handler=createHandler({nameIndex:index,provider:{lookup:async s=>quote(s.replace('.US',''))},send:async p=>posts.push(p),react:async p=>reactions.push(p),now:()=>Date.parse('2026-11-27T18:00:00Z')});
 await handler({channel:'C1',ts:'2.1',text:'$apple $bank'});assert.equal(reactions.length,0);assert.equal(posts.length,2);
});
test('unindexed cashtags pass through, BRK-B normalizes, strict names still resolve',async()=>{
 const calls=[];const handler=createHandler({nameIndex:index,provider:{lookup:async s=>{calls.push(s);return null;}},send:async()=>{}});
 for(const [i,s]of ['BRK-B','NSRGY','NEWLISTING','google','hello','ping','apple'].entries())await handler({channel:'C1',ts:`9.${i}`,text:'$'+s});
 assert.deepEqual(calls,['BRK.B','NSRGY','NEWLISTING','GOOGLE','HELLO','PING','AAPL.US']);
});
test('ordinary app mentions stay silent, strict names work, resolved mood question retains flag',async()=>{
 const sent=[],calls=[];const handler=createHandler({nameIndex:index,provider:{lookup:async s=>{calls.push(s);return {...quote('AAPL'),price:101,name:'Apple'};}},send:async p=>sent.push(p),now:()=>Date.parse('2026-11-27T18:00:00Z')});
 for(const [i,s]of ['help','test','thanks','status','google','hello','ping'].entries())await handler({channel:'C1',ts:`8.${i}`,type:'app_mention',text:'<@B123> '+s});
 assert.equal(sent.length,0);assert.equal(calls.length,0);
 await handler({channel:'C1',ts:'8.8',text:'is $apple over?'});assert.match(sent[0].card.text,/no trigger/);
});
