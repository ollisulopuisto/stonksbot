import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EodhdProvider, HelsinkiRouter } from '../src/eodhd.js';
import { configuredProvider } from '../src/config.js';
import { buildCard, createHandler } from '../src/bot.js';
import { evaluateMood } from '../src/mood.js';
const NOW = Date.parse('2026-11-27T12:00:00Z');
const series = Array.from({length: 10}, (_,i) => ({date:`2026-11-${String(16+i).padStart(2,'0')}`,close:100+i,adjusted_close:100+i}));
async function setup(t, options={}) {
 const dir=await mkdtemp(join(tmpdir(),'eodhd-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 let clock=NOW;const calls=[];
 const fetchImpl=async url=>{calls.push(new URL(url));let body;
  if(url.pathname.endsWith('/exchanges-list/'))body=[{Code:'HE',OperatingMIC:'XHEL',Currency:'EUR'}];
  else if(url.pathname.endsWith('/exchange-symbol-list/HE'))body=[{Code:'NOKIA',Exchange:'HE',Currency:'EUR',Name:'Synthetic Nokia'},{Code:'KNEBV',Exchange:'HE',Currency:'EUR',Name:'Synthetic Kone'}];
  else if(url.pathname.includes('/real-time/'))body={code:url.pathname.split('/').at(-1),timestamp:(clock-20*60000)/1000,close:120,previousClose:109};
  else body=series;
  return {ok:true,status:200,json:async()=>options.change?options.change(body,url):body};
 };
 const args={apiKey:'synthetic-secret',stateDir:dir,fetchImpl,now:()=>clock,...options.args};
 return {dir,calls,args,provider:new EodhdProvider(args),advance:ms=>{clock+=ms;},clock:()=>clock};
}
test('Helsinki full handler validates EUR/XHEL before requesting quote and same-feed history',async t=>{
 const s=await setup(t);const posts=[];
 await createHandler({provider:s.provider,now:s.clock,send:async p=>posts.push(p),onError:e=>{throw e;}})({channel:'C1',ts:'123.456',text:'is $NOKIA.HE over?'});
 assert.equal(posts.length,1);const q=await s.provider.lookup('NOKIA.HE');
 assert.equal(q.currency,'EUR');assert.equal(q.priceKind,'delayed-quote');assert.equal(q.exchange,'XHEL');
 assert.equal(s.calls.length,4);assert.equal(q.historySource,q.source);assert.equal(q.history.at(-1).close,109);
 assert.equal(evaluateMood(q,NOW).targetDate,'2026-11-27');
 assert.match(posts[0].card.text,/delayed/);assert.doesNotMatch(posts[0].card.text,/REAL-TIME|STALE/);
 assert.match(posts[0].chartTitle,/EODHD/);
 const restart=new EodhdProvider({...s.args,fetchImpl:()=>{throw Error('cache miss');}});
 assert.equal((await restart.lookup('NOKIA.HE')).price,120);
 assert.equal(await s.provider.lookup('MSFT'),null);assert.equal(await s.provider.lookup('../X.HE'),null);
 assert.equal(await s.provider.lookup('NOTREAL.HE'),null);assert.equal(s.calls.length,4);
});
test('metadata exchange identity and currency fail closed, no quote request',async t=>{
 for(const change of [b=>Array.isArray(b)&&b[0]?.OperatingMIC?[{Code:'HE',OperatingMIC:'XSTO',Currency:'EUR'}]:b,
  (b,u)=>u.pathname.includes('exchange-symbol-list')?b.map(x=>({...x,Currency:'USD'})):b]){
  const s=await setup(t,{change});try { assert.equal(await s.provider.lookup('NOKIA.HE'),null); } catch(e) { assert.match(e.message,/EODHD/); }
  assert.equal(s.calls.some(u=>u.pathname.includes('real-time')),false);
 }
});
test('bad quotes never become cards, query errors do not leak token or raw body',async t=>{
 for(const patch of [{code:'NOK.US'},{close:NaN},{timestamp:NOW/1000+61},{previousClose:0}]){
  const s=await setup(t,{change:(b,u)=>u.pathname.includes('real-time')?{...b,...patch}:b});
  await assert.rejects(s.provider.lookup('NOKIA.HE'),/EODHD/);
 }
 const s=await setup(t,{args:{fetchImpl:async()=>{throw Error('synthetic-secret raw upstream');}}});
 await assert.rejects(s.provider.lookup('NOKIA.HE'),e=>!e.message.includes('synthetic-secret')&&!e.message.includes('raw upstream'));
});
test('persistent rolling20/day limit includes metadata, cache refresh, failures and restart',async t=>{
 const symbols=Array.from({length:10},(_,i)=>'ETF'+i);
 const s=await setup(t,{change:(b,u)=>u.pathname.includes('/exchange-symbol-list/')?symbols.map(Code=>({Code,Exchange:'HE',Currency:'EUR',Name:'Synthetic ETF'})):b});
 for(const symbol of symbols.slice(0,9))await s.provider.lookup(symbol+'.HE'); //2metadata +9*(quote+history)=20
 assert.equal(s.calls.length,20);
 await assert.rejects(new EodhdProvider(s.args).lookup('ETF9.HE'),/quota/);assert.equal(s.calls.length,20);
 s.advance(72*3600000);await new EodhdProvider(s.args).lookup('ETF9.HE');assert.equal(s.calls.length,24);
 const failed=await setup(t,{args:{dailyLimit:2,fetchImpl:async()=>{throw Error('fail');}}});
 for(let i=0;i<2;i++)await assert.rejects(failed.provider.lookup('NOKIA.HE'));
 await assert.rejects(new EodhdProvider(failed.args).lookup('NOKIA.HE'),/quota/);
 const minute=await setup(t,{args:{minuteLimit:1}});await assert.rejects(minute.provider.lookup('NOKIA.HE'),/quota/);assert.equal(minute.calls.length,1);
});
test('configuration requires personal-use acknowledgement and dispatch leaves US provider unchanged',async t=>{
 const s=await setup(t);const env={STONKSBOT_PROVIDER:'finnhub',FINNHUB_PERSONAL_USE_CONFIRMED:'yes',FINNHUB_API_KEY:'fake',STONKSBOT_STATE_DIR:s.dir,EODHD_ENABLED:'yes',EODHD_API_KEY:'fake',EODHD_PERSONAL_USE_CONFIRMED:'yes'};
 const p=configuredProvider(env);assert.equal(p.usProvider.constructor.name,'FinnhubProvider');assert.equal(p.helsinkiProvider.constructor.name,'EodhdProvider');
 assert.throws(()=>configuredProvider({...env,EODHD_PERSONAL_USE_CONFIRMED:'no'}));
 assert.equal(configuredProvider({...env,STONKSBOT_PROVIDER:'eodhd'}).constructor.name,'EodhdProvider');
});
test('Helsinki delayed mood stale/session guard and splits cannot trigger mood',async t=>{
 const s=await setup(t);const q=await s.provider.lookup('NOKIA.HE');
 assert.notEqual(evaluateMood(q,NOW).basis,'unavailable');
 assert.equal(evaluateMood(q,NOW+46*60000).basis,'unavailable');
 assert.equal(evaluateMood(q,NOW+24*3600000).basis,'unavailable');
 assert.match(buildCard(q,NOW+46*60000).text,/STALE/);
 const split=await setup(t,{change:(b,u)=>u.pathname.includes('/eod/')?b.map((x,i)=>({...x,adjusted_close:x.close*(i<5?0.5:1)})):b});
 assert.equal(evaluateMood(await split.provider.lookup('NOKIA.HE'),NOW).basis,'unavailable');
});

test('429 pause survives restart; no retry, no unsupported or duplicate requests',async t=>{
 const s=await setup(t,{args:{fetchImpl:async()=>({ok:false,status:429})}});
 await assert.rejects(s.provider.lookup('NOKIA.HE'),/EODHD/);
 const state=JSON.parse(await readFile(join(s.dir,'state.json'),'utf8'));assert.equal(state.calls.length,1);
 assert.equal(state.blockedUntil,NOW+86400000);
 await assert.rejects(new EodhdProvider(s.args).lookup('NOKIA.HE'),/quota/);
 const concurrent=await setup(t);await Promise.all([concurrent.provider.lookup('NOKIA.HE'),concurrent.provider.lookup('NOKIA.HE')]);assert.equal(concurrent.calls.length,4);
});
test('history failure preserves delayed quote but disables chart/mood; future cache clock rejected',async t=>{
 const s=await setup(t,{change:(b,u)=>u.pathname.includes('/eod/')?{error:'synthetic'}:b});
 const q=await s.provider.lookup('NOKIA.HE');assert.equal(q.price,120);assert.deepEqual(q.history,[]);assert.equal(evaluateMood(q,NOW).basis,'unavailable');
 const state=JSON.parse(await readFile(join(s.dir,'state.json'),'utf8'));state.lastSeen=NOW+1;
 await writeFile(join(s.dir,'state.json'),JSON.stringify(state));await assert.rejects(new EodhdProvider(s.args).lookup('NOKIA.HE'));
});
test('Helsinki DST session boundaries differ from US; no date rollover mood',async t=>{
 const s=await setup(t);const q=await s.provider.lookup('NOKIA.HE');
 const midnight={...q,asOf:'2026-11-27T21:50:00Z'};
 assert.equal(evaluateMood(midnight,Date.parse('2026-11-27T22:05:00Z')).basis,'unavailable');
 assert.equal(evaluateMood({...q,historySource:'Alpha Vantage'},NOW).basis,'unavailable');
});

test('router sends only Helsinki suffix to EODHD; US response is unchanged',async()=>{
 const calls=[];const usQuote={synthetic:'us untouched'};const heQuote={synthetic:'Helsinki untouched'};
 const router=new HelsinkiRouter({lookup:async s=>{calls.push('us:'+s);return usQuote;}},{lookup:async s=>{calls.push('he:'+s);return heQuote;}});
 assert.equal(await router.lookup('MSFT'),usQuote);assert.equal(await router.lookup('NOKIA.HE'),heQuote);
 assert.deepEqual(calls,['us:MSFT','he:NOKIA.HE']);
});
test('refreshes on-demand stale cache during Helsinki regular session, never burns closed-market quota',async t=>{
 const s=await setup(t);const first=await s.provider.lookup('NOKIA.HE');assert.equal(s.calls.length,4);
 s.advance(46*60000);const refreshed=await s.provider.lookup('NOKIA.HE');assert.equal(s.calls.length,5);assert.notEqual(refreshed.asOf,first.asOf);
 s.advance(30*3600000);const before=s.calls.length;await s.provider.lookup('NOKIA.HE');assert.equal(s.calls.length,before); // Saturday, use cached catalogs/history/quote
 assert.doesNotMatch(buildCard(first,NOW+30*3600000).text,/STALE/);
 assert.equal(evaluateMood(first,NOW+30*3600000).basis,'unavailable');
});

test('nineteen-day-old closed cache stays quota-free but visibly OLD DATA',async t=>{
 const s=await setup(t);const q=await s.provider.lookup('NOKIA.HE');s.advance(22*86400000);
 const cached=await s.provider.lookup('NOKIA.HE');assert.equal(s.calls.length,4);assert.equal(cached.asOf,q.asOf);
 assert.match(buildCard(cached,s.clock()).text,/OLD DATA/);
});

test('EODHD range caches isolated and every wider-range history call counts',async t=>{
 const s=await setup(t);await s.provider.lookup('NOKIA.HE',{range:'30d'});assert.equal(s.calls.length,4);
 await s.provider.lookup('NOKIA.HE',{range:'1y'});assert.equal(s.calls.length,5);assert.equal(s.calls.at(-1).searchParams.get('from'),'2025-11-27');
 await new EodhdProvider(s.args).lookup('NOKIA.HE',{range:'30d'});assert.equal(s.calls.length,5);
 await new EodhdProvider(s.args).lookup('NOKIA.HE',{range:'1y'});assert.equal(s.calls.length,5);
});
