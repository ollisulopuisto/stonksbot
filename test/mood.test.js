import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMood, moodOptions } from '../src/mood.js';
const now = Date.parse('2026-11-27T18:00:00Z');
const dates = ['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-23','2026-11-24','2026-11-25'];
const history = dates.map((date,i)=>({date,close:100 * 1.01 ** i}));
const quote = {fixture:false,priceKind:'us-quote',price:103,previousClose:100,asOf:new Date(now).toISOString(),history,historyKind:'daily-close',historySource:'Alpha Vantage',historyAsOf:'2026-11-25T00:00:00Z'};
test('7 preceding session returns, absolute mean and inclusive 3x boundary in both directions',()=>{
 for(const price of [103,97]) {
  const mood=evaluateMood({...quote,price},now);
  assert.equal(mood.label,price>100?"We're back":"It's over");
  assert.equal(mood.basis,'rolling');assert.ok(Math.abs(mood.typicalPercent-1)<1e-10);
 }
 assert.equal(evaluateMood({...quote,price:102.99},now).label,null);
 assert.equal(evaluateMood({...quote,price:102},now,{multiplier:2}).label,"We're back");
});
test('today point is excluded and cross-provider close is never the session denominator',()=>{
 const q={...quote,historyAsOf:'2026-11-27T00:00:00Z',history:[...history,{date:'2026-11-27',close:900}]};
 assert.equal(evaluateMood(q,now).label,"We're back");
 assert.equal(evaluateMood({...q,previousClose:undefined},now).basis,'unavailable');
 assert.equal(evaluateMood({...q,previousClose:0},now).label,null);
});
test('short or zero baseline uses explicit 5% fallback, not division by zero',()=>{
 for(const points of [[],history.slice(-4),history.map(p=>({...p,close:100}))]) {
  assert.equal(evaluateMood({...quote,price:104.99,history:points},now).label,null);
  const m=evaluateMood({...quote,price:105,history:points},now);
  assert.equal(m.basis,'fixed');assert.equal(m.label,"We're back");
 }
});
test('absolute changes cannot cancel; rolling window uses only latest configured sessions',()=>{
 const alternating=history.map((p,i)=>({...p,close:i%2?101:100}));
 assert.ok(evaluateMood({...quote,history:alternating},now).typicalPercent>.99);
 const older={date:'2026-11-13',close:1};
 assert.ok(Math.abs(evaluateMood({...quote,history:[older,...history]},now).typicalPercent-1)<1e-10);
});
test('daily-only mood judges final close against same-feed previous close, excludes target return',()=>{
 const points=[...history,{date:'2026-11-27',close:history.at(-1).close*1.04}];
 const q={...quote,priceKind:'daily-close',price:points.at(-1).close,asOf:'2026-11-27T00:00:00Z',history:points};
 assert.equal(evaluateMood(q,now).label,"We're back");
 assert.equal(evaluateMood({...q,price:900},now).basis,'unavailable');
});
test('stale/future quotes, old/malformed history and invalid settings fail closed',()=>{
 for(const q of [{...quote,asOf:'2026-11-26T18:00:00Z'},{...quote,asOf:'2026-11-28T18:00:00Z'},
  {...quote,history:[...history].reverse()},{...quote,historyAsOf:'2026-11-01T00:00:00Z'},
  {...quote,history:history.map(p=>({...p,close:0}))}]) assert.equal(evaluateMood(q,now).basis,'unavailable');
 for(const opts of [{window:4},{window:8},{multiplier:1.9},{multiplier:3.1},{fallbackPercent:0}]) assert.throws(()=>evaluateMood(quote,now,opts));
 assert.deepEqual(moodOptions({}),{window:7,multiplier:3,fallbackPercent:5});
 assert.deepEqual(moodOptions({STONKSBOT_MOOD_WINDOW:'5',STONKSBOT_MOOD_MULTIPLIER:'2',STONKSBOT_MOOD_FALLBACK_PERCENT:'6'}),{window:5,multiplier:2,fallbackPercent:6});
});

test('New York session date excludes current-session close near UTC midnight',()=>{
 const time=Date.parse('2026-11-28T00:10:00Z');
 const q={...quote,asOf:new Date(time).toISOString(),historyAsOf:'2026-11-27T00:00:00Z',history:[...history,{date:'2026-11-27',close:900}]};
 assert.equal(evaluateMood(q,time).targetDate,'2026-11-27');
 assert.equal(evaluateMood(q,time).label,"We're back");
});
