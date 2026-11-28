import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{StaticHelsinkiRouter}from'../src/helsinki-symbols.js';
const q=s=>({symbol:s,name:'Example',currency:s.includes('.')?'EUR':'USD'});
test('confirmed US absence resolves exact European listing despite old misses',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fallback-')),path=join(dir,'miss.json');await writeFile(path,JSON.stringify({BMW:{at:Date.now(),ttl:900000}}));let us=0;
 const eu={resolveBare:async s=>s==='BMW'?['BMW.XETRA']:[],lookup:async s=>q(s)};const r=new StaticHelsinkiRouter({lookup:async()=>{us++;return null;}},eu,new Map(),path);
 assert.equal((await r.lookup('BMW')).symbol,'BMW.XETRA');assert.equal((await r.lookup('BMW')).symbol,'BMW.XETRA');assert.equal(us,1);
});
test('US wins collisions, outages never redirect, exact European collisions ask',async()=>{
 let calls=0;const eu={resolveBare:async()=>{calls++;return ['ABC.XETRA','ABC.HE'];},lookup:async s=>q(s)};
 assert.equal((await new StaticHelsinkiRouter({lookup:async()=>q('ABC')},eu,new Map()).lookup('ABC')).symbol,'ABC');assert.equal(calls,0);
 assert.equal(await new StaticHelsinkiRouter({lookup:async()=>{throw Error('outage');}},eu,new Map()).lookup('ABC'),null);assert.equal(calls,0);
 assert.match((await new StaticHelsinkiRouter({lookup:async()=>null},eu,new Map()).lookup('ABC')).resolutionNotice,/ABC.DE.*ABC.HE/);
});
test('known US catalog identity never silently becomes EU after a null quote',async()=>{
 const r=new StaticHelsinkiRouter({lookup:async()=>null},{resolveBare:async()=>['ABC.XETRA']},new Map(),null,Date.now,new Set(['ABC']));assert.match((await r.lookup('ABC')).resolutionNotice,/ABC.US.*ABC.DE/);
});
test('Finnhub zero quote needs separate confirmed empty search before fallback',async()=>{
 const{FinnhubProvider}=await import('../src/finnhub.js');for(const [response,absent]of [[{count:0,result:[]},true],[{count:1,result:[{symbol:'BMW'}]},false],[{error:'auth'},false]]){
  const dir=await mkdtemp(join(tmpdir(),'finn-absence-'));let calls=0;const p=new FinnhubProvider({apiKey:'fake',stateDir:dir,fetchImpl:async u=>{calls++;return{ok:true,json:async()=>u.pathname.endsWith('/quote')?{c:0,h:0,l:0,o:0,pc:0,t:0,d:null,dp:null}:response};}});
  if(absent)assert.equal(await p.lookup('BMW'),null);else await assert.rejects(p.lookup('BMW'));assert.equal(calls,2);
 }
});
test('catalogs persist seven days across restarts, share exchange list, refresh only on demand',async()=>{
 const{EodhdProvider}=await import('../src/eodhd.js');const dir=await mkdtemp(join(tmpdir(),'catalog-'));let now=Date.parse('2026-11-27T12:00Z'),calls=0;
 const args={apiKey:'fake',stateDir:dir,now:()=>now,fetchImpl:async u=>{calls++;const suffix=u.pathname.split('/').at(-1);return{ok:true,json:async()=>u.pathname.includes('exchanges-list')?[{Code:'HE',OperatingMIC:'XHEL',Currency:'EUR'},{Code:'XETRA',OperatingMIC:'XETR',Currency:'EUR'}]:[{Code:'BMW',Exchange:suffix,Currency:'EUR',Name:'Catalog name',Type:'Common Stock'}]};}};
 assert.deepEqual(await new EodhdProvider(args).resolveBare('BMW'),['BMW.XETRA','BMW.HE']);assert.equal(calls,3);now+=6*86400000;assert.equal(await new EodhdProvider(args).hasCachedSymbol('BMW'),true);await new EodhdProvider(args).resolveBare('BMW');assert.equal(calls,3);now+=86400001;await new EodhdProvider(args).resolveBare('BMW');assert.equal(calls,6);
});
test('handler exact catalog identity beats fuzzy names, titles/cards use resolved exchange and dedup before catalog calls',async()=>{
 const{createHandler}=await import('../src/bot.js');const now=Date.parse('2026-11-27T12:00Z'),posts=[];let catalogs=0;
 const quote={symbol:'BMW.XETRA',name:'Bayerische Motoren Werke AG',currency:'EUR',exchange:'XETR',price:100,previousClose:99,asOf:new Date(now-1200000).toISOString(),source:'EODHD Xetra delayed quote and raw daily closes',fixture:false,priceKind:'delayed-quote',historyFrom:'2026-10-01',historyKind:'daily-close',historySource:'EODHD',historyAsOf:'2026-11-26T00:00:00Z',history:[{date:'2026-11-25',close:98},{date:'2026-11-26',close:99}]};
 const eu={resolveBare:async()=>{catalogs++;return['BMW.XETRA'];},lookup:async()=>quote};const router=new StaticHelsinkiRouter({lookup:async()=>null},eu,new Map());
 const index=[{symbol:'OTHER',route:'OTHER.US',canonical:'OTHER',name:'BMW',normalized:'bmw',commonStock:true}];const errors=[];const h=createHandler({provider:router,nameIndex:index,now:()=>now,send:async p=>posts.push(p),onError:e=>errors.push(e)});const event={channel:'C1',ts:'1.0',text:'$BMW'};await h(event);const n=catalogs;await h(event);assert.equal(catalogs,n);assert.equal(errors.length,0);assert.equal(posts.length,1);assert.match(posts[0].card.text,/BMW.XETRA.*Xetra \(XETR\)/);assert.match(posts[0].chartTitle,/BMW.XETRA/);assert.ok(posts[0].png);
});
test('catalog failure backoff survives restart without serving stale row as absence',async()=>{
 const{EodhdProvider}=await import('../src/eodhd.js');const dir=await mkdtemp(join(tmpdir(),'catalog-fail-'));let calls=0;const args={apiKey:'fake',stateDir:dir,fetchImpl:async()=>{calls++;throw Error('down');}};await assert.rejects(new EodhdProvider(args).resolveBare('BMW'));await assert.rejects(new EodhdProvider(args).resolveBare('BMW'));assert.equal(calls,1);
});
