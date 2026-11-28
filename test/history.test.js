import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { configuredProvider } from '../src/config.js';
import { QuoteWithDailyHistory } from '../src/history.js';
import { FinnhubProvider } from '../src/finnhub.js';
import { AlphaVantageProvider } from '../src/alpha-vantage.js';
import { createHandler } from '../src/bot.js';
const now=Date.parse('2026-11-28T08:00:00Z');
const alpha=JSON.parse(await readFile(new URL('./fixtures/alpha-daily.json',import.meta.url)));
test('mixed real handler keeps quote and history sources distinct and generates daily chart',async t=>{
 const root=await mkdtemp(join(tmpdir(),'mixed-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const options={stateDir:root,apiKey:'fake-key',currencies:{AAPL:'USD'},now:()=>now};
 const quote=new FinnhubProvider({...options,stateDir:join(root,'finnhub'),fetchImpl:async()=>({ok:true,json:async()=>({c:260,t:now/1000})})});
 const history=new AlphaVantageProvider({...options,stateDir:join(root,'alpha'),fetchImpl:async()=>({ok:true,json:async()=>alpha})});
 const provider=new QuoteWithDailyHistory(quote,history);const sent=[];
 await createHandler({provider,now:()=>now,send:async p=>sent.push(p)})({channel:'C123',ts:'123.4',text:'$AAPL'});
 assert.equal(sent.length,1);assert.match(sent[0].card.text,/260.00 USD.*REAL-TIME US/);
 assert.match(JSON.stringify(sent[0].card),/DAILY CLOSE HISTORY \(not live\/intraday\).*Alpha Vantage/);
 assert.equal(sent[0].chartTitle,'AAPL Alpha Vantage daily closes, not live');
 const result=await provider.lookup('AAPL');assert.equal(result.history.at(-1).close,250.12);assert.notEqual(result.history.at(-1).close,result.price);
 assert.ok(sent[0].png.length>1000);await writeFile('/downloads/stonksbot-mixed-chart.png',sent[0].png);
 // A state directory from the other provider must fail closed, not reuse cache.
 await assert.rejects(new FinnhubProvider({...options,stateDir:join(root,'alpha')}).lookup('AAPL'));
});
test('history failure, wrong symbol or currency produces quote only and honest notice',async()=>{
 const quote={symbol:'AAPL',name:'AAPL',price:260,currency:'USD',asOf:new Date(now).toISOString(),source:'Finnhub',fixture:false,priceKind:'us-quote',history:[]};
 for(const daily of [null,{...quote,priceKind:'daily-close',symbol:'SPY'},{...quote,priceKind:'daily-close',currency:'EUR'}]){
  const provider=new QuoteWithDailyHistory({lookup:async()=>quote},{lookup:async()=>daily});
  const sent=[];await createHandler({provider,now:()=>now,send:async p=>sent.push(p)})({channel:'C123',ts:'123.4',text:'$AAPL'});
  assert.equal(sent.length,1);assert.equal(sent[0].png,null);assert.match(JSON.stringify(sent[0].card),/Daily history unavailable/);
 }
});
test('configuration enforces provider-specific child directories and US currency identity',()=>{
 const p=configuredProvider({STONKSBOT_PROVIDER:'finnhub',FINNHUB_PERSONAL_USE_CONFIRMED:'yes',FINNHUB_API_KEY:'fake',FINNHUB_US_SYMBOL_CURRENCIES:'{"AAPL":"USD"}',STONKSBOT_STATE_DIR:'/tmp/combined',STONKSBOT_HISTORY_PROVIDER:'alpha-vantage',ALPHAVANTAGE_API_KEY:'fake'});
 assert.notEqual(p.quoteProvider.stateDir,p.historyProvider.stateDir);
 assert.equal(p.historyProvider.currencies.AAPL,'USD');
});
