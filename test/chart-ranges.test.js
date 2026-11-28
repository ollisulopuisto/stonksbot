import test from 'node:test';
import assert from 'node:assert/strict';
import { requestedRange,rangeStart,chartForRange } from '../src/chart-ranges.js';
import { createHandler } from '../src/bot.js';
const now=Date.parse('2026-11-27T18:00:00Z');
const history=Array.from({length:100},(_,i)=>({date:new Date(now-(100-i)*86400000).toISOString().slice(0,10),close:100+i}));
const q={symbol:'AAPL',name:'Apple',price:200,currency:'USD',asOf:new Date(now).toISOString(),source:'synthetic',fixture:false,priceKind:'us-quote',history,historyKind:'daily-close',historySource:'synthetic',historyAsOf:history.at(-1).date+'T00:00:00Z'};
test('default30calendar days and explicit7d/3m/1y, no1d trigger',()=>{
 assert.equal(requestedRange('$AAPL'),'30d');assert.equal(requestedRange('$AAPL 7d'),'7d');assert.equal(requestedRange('$AAPL 3m'),'3m');assert.equal(requestedRange('$AAPL 1y'),'1y');assert.equal(requestedRange('$AAPL 1d'),'30d');
 assert.equal(rangeStart('3m',now),'2026-08-27');assert.equal(chartForRange(q,'30d',now).points.length,30);assert.equal(chartForRange(q,'7d',now).points.length,7);assert.equal(chartForRange(q,'3m',now).points.length,92);
 assert.match(chartForRange(q,'1y',now).notice,/unavailable.*100 trading/);
});
test('handler passes range, trims only chart not mood history, refusesUS1y with plain note',async()=>{
 const seen=[],sent=[];const handler=createHandler({provider:{lookup:async(s,o)=>{seen.push(o.range);return q;}},now:()=>now,send:async p=>sent.push(p)});
 await handler({channel:'C1',ts:'1.1',text:'$AAPL 7d'});assert.equal(seen[0],'7d');assert.ok(sent[0].png);assert.match(sent[0].chartTitle,/7d/);assert.equal(q.history.length,100);
 await handler({channel:'C1',ts:'1.2',text:'$AAPL 1y'});assert.equal(sent[1].png,null);assert.match(sent[1].card.text,/1y chart unavailable/);
});
test('insufficientrange evidence never pretendsshort cache is1y',()=>{
 const he={...q,symbol:'REMEDY.HE',currency:'EUR',exchange:'XHEL',priceKind:'delayed-quote',historyFrom:'2026-10-01'};
 assert.match(chartForRange(he,'1y',now).notice,/coverage|range/i);
});
test('short new-listing history has partial label and actual date coverage',async()=>{
 const short={...q,history:history.slice(-3)};for(const range of ['7d','30d']){const c=chartForRange(short,range,now);assert.match(c.notice,/partial|shorter/i);assert.match(c.label,/partial/);const sent=[];await createHandler({provider:{lookup:async()=>short},now:()=>now,send:async p=>sent.push(p)})({channel:'C1',ts:'11.'+range.length,text:'$AAPL '+range});assert.match(sent[0].chartTitle,/partial/);assert.match(sent[0].card.text,/shorter|partial/);}
});
