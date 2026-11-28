import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/bot.js';
import { reactionOptions, slackReactor } from '../src/reactions.js';
const now=Date.parse('2026-11-27T18:00:00Z');
const base={symbol:'AAPL',name:'Apple',price:106,previousClose:100,currency:'USD',asOf:new Date(now).toISOString(),source:'synthetic',fixture:false,priceKind:'us-quote',history:[]};
test('cashtag reacts to original message independently of reply; all verdicts and demos',async()=>{
 for(const [patch,name] of [[{},'back'],[{price:94},'over'],[{price:101},null],[{previousClose:undefined},null],[{fixture:true},null]]){
  const reactions=[],posts=[];let lookups=0;
  const handler=createHandler({provider:{lookup:async()=>{lookups++;return {...base,...patch};}},now:()=>now,react:async p=>reactions.push(p),send:async p=>posts.push(p)});
  await handler({channel:'C1',ts:'123.4',thread_ts:'120.1',text:'$AAPL'});
  assert.equal(posts.length,1);assert.equal(lookups,1);assert.deepEqual(reactions,name?[{channel:'C1',timestamp:'123.4',name}]:[]);
 }
});
test('reaction error never blocks reply; post error never undoes/duplicates reaction',async()=>{
 const event={channel:'C1',ts:'123.4',text:'$AAPL'};let posts=0,reactions=0;
 const handler=createHandler({provider:{lookup:async()=>base},now:()=>now,react:async()=>{reactions++;},send:async()=>{if(++posts===1)throw Error('posting failed');}});
 await handler(event);await handler(event);assert.equal(reactions,1);assert.equal(posts,2);
 let posted=false;await createHandler({provider:{lookup:async()=>base},now:()=>now,react:async()=>{throw Error('emoji missing');},send:async()=>{posted=true;}})(event);assert.equal(posted,true);
});
test('Slack reaction exact args, already_reacted harmless; missing emoji stays an error',async()=>{
 const calls=[];await slackReactor({reactions:{add:async p=>{calls.push(p);return {ok:true};}}})({channel:'C1',timestamp:'123.4',name:'back'});assert.deepEqual(calls,[{channel:'C1',timestamp:'123.4',name:'back'}]);
 await slackReactor({reactions:{add:async()=>{throw {data:{error:'already_reacted'}};}}})({});
 await assert.rejects(slackReactor({reactions:{add:async()=>{throw Error('invalid_name');}}})({}));
 assert.deepEqual(reactionOptions({}),{reactionNames:{over:'over',back:'back'}});
 assert.throws(()=>reactionOptions({STONKSBOT_REACTION_OVER:'bad name'}));
});
