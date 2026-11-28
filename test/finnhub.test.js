import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FinnhubProvider } from '../src/finnhub.js';
import { configuredProvider } from '../src/config.js';
import { buildCard, createHandler } from '../src/bot.js';
const now = Date.parse('2026-11-28T08:00:00Z');
async function setup(t, overrides={}) {
 const stateDir=await mkdtemp(join(tmpdir(),'finnhub-test-')); t.after(()=>rm(stateDir,{recursive:true,force:true}));
 const calls=[];const options={apiKey:'fake-test-key',currencies:{AAPL:'USD'},stateDir,now:()=>now,
 fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({c:250.12,t:now/1000-3})};},...overrides};
 return {provider:new FinnhubProvider(options),options,calls,stateDir};
}
test('US quote uses header auth, restart cache and honest no-chart card',async t=>{
 const {provider,options,calls,stateDir}=await setup(t);const quote=await provider.lookup('AAPL');
 assert.equal(quote.price,250.12);assert.deepEqual(quote.history,[]);assert.equal(quote.currency,'USD');
 assert.equal(calls[0].url.href,'https://finnhub.io/api/v1/quote?symbol=AAPL');assert.equal(calls[0].options.headers['X-Finnhub-Token'],'fake-test-key');
 assert.equal(calls[0].options.redirect,'error');
 assert.deepEqual(await new FinnhubProvider(options).lookup('AAPL'),quote);assert.equal(calls.length,1);
 assert.doesNotMatch(await readFile(join(stateDir,'state.json'),'utf8'),/fake-test-key/);
 assert.match(buildCard(quote,now).text,/AAPL: 250.12 USD.*updated just now/);
 const sent=[];await createHandler({provider,now:()=>now,send:async p=>sent.push(p)})({channel:'C123',ts:'123.4',text:'$AAPL'});
 assert.equal(sent.length,1);assert.equal(sent[0].png,null);assert.doesNotMatch(JSON.stringify(sent[0].card),/No history chart/);
 assert.match(buildCard(quote,now+3600000).text,/STALE/);
});
test('only explicitly configured US USD symbols; no international currency guessing',async t=>{
 const {provider,calls}=await setup(t);assert.equal(await provider.lookup('NOKIA.HE'),null);assert.equal(calls.length,0);
 assert.throws(()=>new FinnhubProvider({apiKey:'x',stateDir:'/tmp/x',currencies:{NOKIA:'EUR'}}));
 assert.throws(()=>configuredProvider({STONKSBOT_PROVIDER:'finnhub'}),/personal-only/);
});
test('failed requests count durably in rolling-minute budget and refill after minute',async t=>{
 let count=0;const {provider,options}=await setup(t,{minuteLimit:1,fetchImpl:async()=>{count++;throw Error('secret');}});
 await assert.rejects(provider.lookup('AAPL'),e=>!e.message.includes('secret'));
 await assert.rejects(new FinnhubProvider({...options,now:()=>now+30000}).lookup('AAPL'),/quota/);assert.equal(count,1);
 await assert.rejects(new FinnhubProvider({...options,now:()=>now+61000}).lookup('AAPL'));assert.equal(count,2);
});
test('429 blocks across restart, invalid or zero quote never sent',async t=>{
 let count=0;const {provider,options}=await setup(t,{fetchImpl:async()=>{count++;return {ok:false,status:429};}});
 await assert.rejects(provider.lookup('AAPL'));await assert.rejects(new FinnhubProvider(options).lookup('AAPL'),/quota/);assert.equal(count,1);
 for(const body of [{},{c:0,t:now/1000},{c:-1,t:now/1000},{c:1,t:0},{c:1,t:now/1000+1000},{c:'1',t:now/1000}]){
  const {provider:p}=await setup(t,{fetchImpl:async()=>({ok:true,json:async()=>body})});await assert.rejects(p.lookup('AAPL'));
 }
});


test('15-second cache expires and global 30-per-second cap blocks bursts',async t=>{
 const {provider,options,calls}=await setup(t);
 await provider.lookup('AAPL');
 await new FinnhubProvider({...options,now:()=>now+16000}).lookup('AAPL');
 assert.equal(calls.length,2);
 const currencies=Object.fromEntries(Array.from({length:31},(_,i)=>['S'+i,'USD']));
 const burst=await setup(t,{currencies});
 for(let i=0;i<30;i++)await burst.provider.lookup('S'+i);
 await assert.rejects(burst.provider.lookup('S30'),/quota/);
 assert.equal(burst.calls.length,30);
});

test('previous close is optional same-feed data, invalid values never become mood inputs',async t=>{
 for(const pc of [100,undefined,0,-1,'100']) {
  const {provider}=await setup(t,{fetchImpl:async()=>({ok:true,json:async()=>({c:106,pc,t:now/1000})})});
  const quote=await provider.lookup('AAPL');
  assert.equal(quote.previousClose,pc===100?100:undefined);
  const text=buildCard(quote,now).text;
  assert.match(text,pc===100?/We're back/:/updated just now/);
 }
});
test('symbol-search names count quota, persist across restart and fail to ticker safely',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'names-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const urls=[];const options={apiKey:'fake',stateDir:dir,now:()=>now,resolveNames:true,fetchImpl:async url=>{urls.push(url.pathname);return {ok:true,json:async()=>url.pathname.endsWith('/search')?{result:[{symbol:'AAPL',description:'Apple Inc'}]}:{c:106,pc:100,t:now/1000}};}};
 const q=await new FinnhubProvider(options).lookup('AAPL');assert.equal(q.name,'Apple Inc');assert.equal(urls.length,2);
 const state=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));assert.equal(state.calls.length,2);
 assert.equal((await new FinnhubProvider({...options,now:()=>now+16000}).lookup('AAPL')).name,'Apple Inc');assert.equal(urls.length,3);
});
