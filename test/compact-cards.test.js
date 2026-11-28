import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCard } from '../src/bot.js';
const now=Date.parse('2026-11-27T18:00:00Z');
const quote={symbol:'AAPL',name:'Apple',price:106,currency:'USD',asOf:new Date(now-3*3600000).toISOString(),source:'Finnhub',fixture:false,priceKind:'us-quote',history:[]};
test('compact card uses relative age, short stale flag, no raw timestamp/source/unavailable',()=>{
 const card=buildCard(quote,now,{},true);assert.match(card.text,/Apple \(\$AAPL\): 106.00 USD/);assert.match(card.text,/updated 3 h ago/);assert.match(card.text,/STALE/);
 const text=JSON.stringify(card);assert.doesNotMatch(text,/2026-|Finnhub|Source:|Mood unavailable|No history|not a current|investment advice/);
 assert.equal(card.blocks.length,1);
});
test('relative age never invents freshness; daily and demo stay identified',()=>{
 assert.match(buildCard({...quote,asOf:new Date(now-30000).toISOString()},now).text,/updated just now/);
 assert.match(buildCard({...quote,asOf:new Date(now+120000).toISOString()},now).text,/INVALID TIME/);
 assert.match(buildCard({...quote,fixture:true,priceKind:undefined,history:[{date:'2026-11-25',close:100},{date:'2026-11-26',close:106}]},now).text,/DEMO/);
 assert.match(buildCard({...quote,priceKind:'daily-close',history:[{date:'2026-11-25',close:100},{date:'2026-11-26',close:106}]},now).text,/daily close age/);
});
test('full name uses requested cashtag format and ticker fallback, hostile names plain text',()=>{
 assert.match(buildCard(quote,now).text,/Apple \(\$AAPL\)/);
 assert.match(buildCard({...quote,name:'AAPL'},now).text,/^AAPL:/);
 const card=buildCard({...quote,name:'<!here>'},now);assert.doesNotMatch(card.text,/<!here>/);assert.equal(card.blocks[0].text.type,'plain_text');
});

test('provider names strip control/bidi, collapse whitespace, enforce length',()=>{
 const card=buildCard({...quote,name:'  Ap\u202eple\n\t Inc\u0000  '},now);
 assert.match(card.text,/Ap ple Inc \(\$AAPL\)/);assert.doesNotMatch(card.blocks[0].text.text,/[\p{Cc}\p{Cf}]/u);
});
