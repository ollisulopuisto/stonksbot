import test from 'node:test';
import assert from 'node:assert/strict';
import { StaticHelsinkiRouter, loadHelsinkiSymbols } from '../src/helsinki-symbols.js';
import { createHandler } from '../src/bot.js';
const quote=symbol=>({symbol,name:'Synthetic',price:106,previousClose:100,currency:symbol.endsWith('.HE')?'EUR':'USD',asOf:'2026-11-27T18:00:00Z',source:'synthetic',fixture:false,priceKind:'us-quote',history:[]});
test('bare HE-only, US-only, unknown and overlapping symbols never guess a venue',async()=>{
 const calls=[];
 const us={resolveSymbol:async s=>['AAPL','NOKIA'].includes(s),lookup:async s=>{calls.push('US:'+s);return quote(s);}};
 const he={resolveSymbol:async s=>['MEKKO.HE','NOKIA.HE'].includes(s),lookup:async s=>{calls.push('HE:'+s);return quote(s);}};
 const router=new StaticHelsinkiRouter(us,he,new Map([['MEKKO',{name:'Marimekko Oyj',route:'MEKKO.HE'}],['NOKIA',{name:'Nokia Oyj',route:'NOKIA.HE'}],['SBI',{name:'Synthetic overlap',route:'SBI.HE',ambiguous:true}]]));
 assert.equal((await router.lookup('MEKKO')).symbol,'MEKKO.HE');assert.equal((await router.lookup('AAPL')).symbol,'AAPL');
 const ambiguous=await router.lookup('SBI');assert.match(ambiguous.resolutionNotice,/ambiguous/i);
 assert.equal((await router.lookup('NOKIA')).symbol,'NOKIA.HE');assert.equal((await router.lookup('NOKIA.HE')).symbol,'NOKIA.HE');assert.equal((await router.lookup('NOKIA.US')).symbol,'NOKIA');
 assert.deepEqual(calls,['HE:MEKKO.HE','US:AAPL','HE:NOKIA.HE','HE:NOKIA.HE','US:NOKIA']);
});
test('handler ambiguity is a short text card, no chart or mood reaction',async()=>{
 const sent=[],reactions=[];
 await createHandler({provider:{lookup:async()=>({resolutionNotice:'SBI is ambiguous. Use $SBI.HE for Helsinki or $SBI.US for US.'})},send:async p=>sent.push(p),react:async p=>reactions.push(p)})({channel:'C1',ts:'123.4',text:'$SBI'});
 assert.equal(sent.length,1);assert.match(sent[0].card.text,/ambiguous/);assert.equal(sent[0].png,null);assert.equal(reactions.length,0);
});
test('bundled snapshot is174entries, names/routes intact, only verified SBI collision',async()=>{
 const entries=await loadHelsinkiSymbols();assert.equal(entries.size,174);assert.equal(entries.get('MEKKO').name,'Marimekko Oyj');assert.equal(entries.get('MEKKO').route,'MEKKO.HE');
 assert.equal(entries.get('NOKIA').ambiguous,false);assert.deepEqual([...entries].filter(([,x])=>x.ambiguous).map(([key])=>key),['SBI']);
});
test('local overrides add/replace/remove entries and explicitly pick a venue, invalid config fails',async t=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const root=await mkdtemp(join(tmpdir(),'he-overrides-'));t.after(()=>rm(root,{recursive:true,force:true}));const file=join(root,'overrides.json');
 await writeFile(file,JSON.stringify({SBI:{name:'Chosen US SBI',route:'SBI.US'},CUSTOM:{name:'Custom fund',route:'KNEBV.HE'},NOKIA:null}));
 const entries=await loadHelsinkiSymbols(file);assert.equal(entries.get('SBI').ambiguous,false);assert.equal(entries.get('CUSTOM').route,'KNEBV.HE');assert.equal(entries.has('NOKIA'),false);
 const calls=[];const router=new StaticHelsinkiRouter({lookup:async s=>{calls.push('US:'+s);return quote(s);}},{lookup:async s=>{calls.push('HE:'+s);return quote(s);}},entries);
 assert.equal((await router.lookup('SBI')).name,'Chosen US SBI');assert.equal((await router.lookup('CUSTOM')).symbol,'KNEBV.HE');assert.deepEqual(calls,['US:SBI','HE:KNEBV.HE']);
 for(const value of [[],{SBI:{name:'x',route:'SBI'}},{SBI:{route:'SBI.US'}}]){await writeFile(file,JSON.stringify(value));await assert.rejects(loadHelsinkiSymbols(file));}
});
test('repeated bare routing and table misses consume no resolution API requests',async()=>{
 const entries=await loadHelsinkiSymbols();let lookups=0;
 const us={resolveSymbol:()=>{throw Error('no resolution');},lookup:async s=>{lookups++;return s==='AAPL'?quote(s):null;}};
 const he={resolveSymbol:()=>{throw Error('no catalog');},lookup:async s=>{lookups++;return quote(s);}};
 const router=new StaticHelsinkiRouter(us,he,entries);
 for(let i=0;i<3;i++){assert.equal((await router.lookup('MEKKO')).symbol,'MEKKO.HE');assert.equal(await router.lookup('UNKNOWN'),null);}
 assert.equal(lookups,6);
});
test('unknown US-path misses persist across restart and never repeatedly probe provider',async t=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const root=await mkdtemp(join(tmpdir(),'bare-miss-'));t.after(()=>rm(root,{recursive:true,force:true}));let calls=0;
 const us={lookup:async()=>{calls++;throw Error('invalid or unavailable');}},path=join(root,'misses.json');
 for(let i=0;i<3;i++)assert.equal(await new StaticHelsinkiRouter(us,{},new Map(),path).lookup('UNKNOWN'),null);
 assert.equal(calls,1);
});
test('real startup config loads table in mixed and Helsinki-only modes without network',async t=>{
 const {startupProvider}=await import('../src/config.js');const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const root=await mkdtemp(join(tmpdir(),'he-startup-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const env={STONKSBOT_PROVIDER:'eodhd',EODHD_API_KEY:'synthetic',EODHD_PERSONAL_USE_CONFIRMED:'yes',STONKSBOT_STATE_DIR:root};
 const p=await startupProvider(env);assert.equal(p.entries.size,174);p.helsinkiProvider.lookup=async s=>quote(s);assert.equal((await p.lookup('MEKKO')).symbol,'MEKKO.HE');assert.equal(await p.lookup('AAPL'),null);
 const mixed=await startupProvider({...env,STONKSBOT_PROVIDER:'finnhub',EODHD_ENABLED:'yes',FINNHUB_API_KEY:'synthetic',FINNHUB_PERSONAL_USE_CONFIRMED:'yes',STONKSBOT_HISTORY_PROVIDER:'alpha-vantage',ALPHAVANTAGE_API_KEY:'synthetic'});assert.equal(mixed.usProvider.constructor.name,'QuoteWithDailyHistory');assert.equal(mixed.entries.size,174);
});
