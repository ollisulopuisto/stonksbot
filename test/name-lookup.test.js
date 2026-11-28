import test from 'node:test';
import assert from 'node:assert/strict';
import { loadNameIndex, resolveName } from '../src/name-lookup.js';
import { createHandler } from '../src/bot.js';
const index=await loadNameIndex();
const quote=symbol=>({symbol,name:symbol,price:106,previousClose:100,currency:'USD',asOf:'2026-11-27T18:00:00Z',source:'synthetic',fixture:false,priceKind:'us-quote',history:[]});
test('offline exact tickers win, company names and conservative typo resolution',()=>{
 assert.equal(resolveName(index,'AAPL').symbol,'AAPL');assert.equal(resolveName(index,'MEKKO').symbol,'MEKKO.HE');
 assert.equal(resolveName(index,'apple').symbol,'AAPL');assert.equal(resolveName(index,'marimekko').symbol,'MEKKO.HE');
 assert.equal(resolveName(index,'appl').symbol,undefined);assert.equal(resolveName(index,'qzxunfindable').symbol,undefined);
 assert.equal(resolveName(index,'bank').symbol,undefined);
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
 for(const q of ['bank','trust','energy'])assert.equal(resolveName(index,q).symbol,undefined);
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
 assert.deepEqual(calls,['BRK.B','NSRGY','NEWLISTING','GOOGL.US','HELLO','PING','AAPL.US']);
});
test('ordinary app mentions stay silent, strict names work, resolved mood question retains flag',async()=>{
 const sent=[],calls=[];const handler=createHandler({nameIndex:index,provider:{lookup:async s=>{calls.push(s);return {...quote('AAPL'),price:101,name:'Apple'};}},send:async p=>sent.push(p),now:()=>Date.parse('2026-11-27T18:00:00Z')});
 for(const [i,s]of ['help','test','thanks','status','hello','ping'].entries())await handler({channel:'C1',ts:`8.${i}`,type:'app_mention',text:'<@B123> '+s});
 assert.equal(sent.length,0);assert.equal(calls.length,0);
 await handler({channel:'C1',ts:'8.8',text:'is $apple over?'});assert.match(sent[0].card.text,/no trigger/);
});
test('fuzzy names honor reviewed brands and never known prefix false positives',()=>{
 for(const [query,symbol]of [['google','GOOGL'],['facebook','META'],['marimeko','MEKKO.HE']])assert.equal(resolveName(index,query,{strict:false}).symbol,symbol);
 for(const query of ['hello','ping','help','test','thanks','status'])assert.equal(resolveName(index,query,{strict:false,namesOnly:true}).symbol,undefined);
});
test('ordinary-word mention regression never autoquotes plausible company fragments',()=>{
 for(const q of ['price','stock','over','chart','coffee','where','with','train','nice','hello','ping','help','thanks','status'])assert.equal(resolveName(index,q,{mode:'mention',namesOnly:true}).symbol,undefined,q);
});

test('reviewer ordinary-word regression33words, dictionary guard blocks both modes',()=>{
 const words='price stock where should with over chart train coffee orange bread butter storm long wide narrow deep sharp value index option hedge broker customer cousin neighbor baker credit humble nice loan dull square'.split(' ');
 for(const q of words)for(const mode of ['mention','cashtag'])assert.equal(resolveName(index,q,{mode,namesOnly:true}).symbol,undefined,mode+':'+q);
});
test('short cashtag typos and long mention typos keep requested working cases',()=>{
 for(const [q,s]of [['tesl','TSLA'],['microsft','MSFT'],['nvida','NVDA'],['gamestp','GME'],['blackrok','BLK']])assert.equal(resolveName(index,q,{mode:'cashtag'}).symbol,s,q);
 assert.equal(resolveName(index,'aple',{mode:'mention',namesOnly:true}).symbol,undefined);
 assert.equal(resolveName(index,'microsft',{mode:'mention',namesOnly:true}).symbol,'MSFT');
});

test('reviewer297-word probe cannot autoquote names except explicit exact names/aliases',async()=>{
 const {readFile}=await import('node:fs/promises');const words=(await readFile(new URL('./common-word-probe.txt',import.meta.url),'utf8')).trim().split(/\s+/);
 const allowed=new Set('google alphabet apple tesla microsoft amazon nvidia meta facebook coinbase gamestop blackrock ford visa target nokia kone nordea fortum sampo neste'.split(' '));
 for(const q of Object.keys(index.aliases))allowed.add(q);
 for(const q of words)if(!allowed.has(q))for(const mode of ['mention','cashtag'])assert.equal(resolveName(index,q,{mode,namesOnly:true}).symbol,undefined,mode+':'+q);
});

test('reviewed short brands all retain exact alias/core resolution for mentions',()=>{
 for(const q of 'google alphabet apple tesla microsoft amazon nvidia meta facebook coinbase gamestop blackrock ford visa target nokia kone nordea fortum sampo neste'.split(' '))assert.ok(resolveName(index,q,{mode:'mention',namesOnly:true}).symbol,q);
 assert.equal(resolveName(index,'APLE').symbol,'APLE');assert.equal(resolveName(index,'HELP').symbol,'HELP');
});

test("reviewed additional brand aliases resolve exact routes in mentions",()=>{
 const expected={"intel": "INTC.US", "oracle": "ORCL.US", "adobe": "ADBE.US", "nike": "NKE.US", "mastercard": "MA.US", "toyota": "TM.US", "ferrari": "RACE.US", "disney": "DIS.US", "cisco": "CSCO.US", "exxon": "XOM.US", "pepsi": "PEP.US", "spotify": "SPOT.US", "costco": "COST.US", "boeing": "BA.US", "invesco": "IVZ.US", "berkshire hathaway": "BRK.B.US"};
 for(const [q,route]of Object.entries(expected))assert.equal(resolveName(index,q,{mode:"mention",namesOnly:true}).route,route,q);
});
