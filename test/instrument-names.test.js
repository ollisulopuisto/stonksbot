import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FinnhubProvider } from '../src/finnhub.js';
import { AlphaVantageProvider } from '../src/alpha-vantage.js';
const now=Date.parse('2026-11-27T18:00:00Z');
async function setup(t,Provider,extra={}){
 const stateDir=await mkdtemp(join(tmpdir(),'instrument-names-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));const calls=[];
 const options={apiKey:'synthetic',stateDir,now:()=>now,resolveNames:true,fetchImpl:async url=>{
  calls.push(url);let data;
  if(url.pathname==='/api/v1/search') data={result:[{symbol:'QQQ',displaySymbol:'QQQ',description:'Invesco QQQ Trust',type:'ETP'},{symbol:'QQQ.L',description:'Wrong listing'}]};
  else if(url.searchParams.get('function')==='SYMBOL_SEARCH')data={bestMatches:[{'1. symbol':'QQQ','2. name':'Invesco QQQ Trust','8. currency':'USD'},{'1. symbol':'QQQ.LON','2. name':'Wrong listing','8. currency':'GBP'}]};
  else if(Provider===FinnhubProvider)data={c:106,pc:100,t:now/1000};
  else data={'Meta Data':{'2. Symbol':'QQQ'},'Time Series (Daily)':{'2026-11-25':{'4. close':'100'},'2026-11-26':{'4. close':'106'}}};
  if(extra.change)data=extra.change(data,url);return {ok:true,json:async()=>data};
 },...extra.args};return {options,calls,stateDir};
}
test('US ETF names resolve on both paths with one counted cached search, never fuzzy listing',async t=>{
 for(const Provider of [FinnhubProvider,AlphaVantageProvider]){
  const s=await setup(t,Provider);const quote=await new Provider(s.options).lookup('QQQ');assert.equal(quote.name,'Invesco QQQ Trust');assert.equal(s.calls.length,2);
  assert.equal((await new Provider(s.options).lookup('QQQ')).name,'Invesco QQQ Trust');assert.equal(s.calls.length,2);
  const state=JSON.parse(await readFile(join(s.stateDir,'state.json'),'utf8'));assert.equal(state.calls.length,2);
 }
});
test('missing or ambiguous exact match is cached ticker fallback, wrong-currency alpha rejected',async t=>{
 for(const Provider of [FinnhubProvider,AlphaVantageProvider]){
  for(const bad of ['missing','ambiguous']){
   const s=await setup(t,Provider,{change:(b,u)=>u.pathname.endsWith('/search')?{result:bad==='missing'?[{symbol:'QQQ.L',description:'wrong'}]:[{symbol:'QQQ',description:'One'},{symbol:'QQQ',description:'Two'}]}:u.searchParams.get('function')==='SYMBOL_SEARCH'?{bestMatches:[{'1. symbol':'QQQ','2. name':'Wrong currency','8. currency':'EUR'}]}:b});
   assert.equal((await new Provider(s.options).lookup('QQQ')).name,'QQQ');await new Provider(s.options).lookup('QQQ');assert.equal(s.calls.length,2);
  }
 }
});
test('last quota slot goes to quote, no name bypass or loss of quote',async t=>{
 for(const Provider of [FinnhubProvider,AlphaVantageProvider]){
  const s=await setup(t,Provider,{args:Provider===FinnhubProvider?{minuteLimit:1}:{dailyLimit:1}});
  assert.equal((await new Provider(s.options).lookup('QQQ')).name,'QQQ');assert.equal(s.calls.length,1);
 }
});
