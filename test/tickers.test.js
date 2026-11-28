import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FinnhubProvider } from '../src/finnhub.js';
import { AlphaVantageProvider } from '../src/alpha-vantage.js';
import { configuredProvider } from '../src/config.js';
const now=Date.parse('2026-11-27T18:00:00Z');
test('unset ticker maps allow US symbols in both providers, while explicit maps restrict',async t=>{
 for(const Provider of [FinnhubProvider,AlphaVantageProvider]) {
  for(const currencies of [undefined,{AAPL:'USD'}]) {
   const stateDir=await mkdtemp(join(tmpdir(),'ticker-test-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));
   const calls=[];
   const provider=new Provider({apiKey:'fake',stateDir,currencies,now:()=>now,fetchImpl:async url=>{
    const symbol=url.searchParams.get('symbol');calls.push(symbol);
    return {ok:true,json:async()=>Provider===FinnhubProvider?{c:106,pc:100,t:now/1000}:{'Meta Data':{'2. Symbol':symbol},'Time Series (Daily)':{'2026-11-25':{'4. close':'100'},'2026-11-27':{'4. close':'106'}}}};
   }});
   for(const symbol of ['MSFT','BRK.B']) {
    const result=await provider.lookup(symbol);
    assert.equal(result?.currency,currencies?undefined:'USD');
    assert.equal((await new Provider({apiKey:'fake',stateDir,currencies,now:()=>now,fetchImpl:async()=>{throw Error('cache missed');}}).lookup(symbol))?.currency,currencies?undefined:'USD'); // restart cache path
   }
   assert.equal(await provider.lookup('NOKIA.HE'),null);
   assert.equal(await provider.lookup('../oops'),null);
   assert.deepEqual(calls,currencies?[]:['MSFT','BRK.B']);
  }
 }
});
test('configuration accepts omitted ticker maps, rejects malformed or explicitly empty maps',()=>{
 const env={STONKSBOT_PROVIDER:'finnhub',FINNHUB_PERSONAL_USE_CONFIRMED:'yes',FINNHUB_API_KEY:'fake',STONKSBOT_STATE_DIR:'/tmp/default-tickers',STONKSBOT_HISTORY_PROVIDER:'alpha-vantage',ALPHAVANTAGE_API_KEY:'fake'};
 assert.doesNotThrow(()=>configuredProvider(env));
 assert.doesNotThrow(()=>configuredProvider({...env,STONKSBOT_PROVIDER:'alpha-vantage'}));
 for(const value of ['', '{}','null','[]','bad']) assert.throws(()=>configuredProvider({...env,FINNHUB_US_SYMBOL_CURRENCIES:value}));
});
