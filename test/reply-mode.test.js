import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, replyOptions } from '../src/bot.js';
import { FixtureProvider } from '../src/provider.js';
import { slackSender } from '../src/slack-send.js';
test('default channel replies omit thread_ts even for inbound thread messages',async()=>{
 for(const thread_ts of [undefined,'122.3']){
  const sent=[];await createHandler({provider:new FixtureProvider(),send:async p=>sent.push(p)})({channel:'C123',ts:'123.4',thread_ts,text:'$AAPL'});
  assert.equal(sent.length,1);assert.equal(Object.hasOwn(sent[0],'thread_ts'),false);
 }
});
test('opt-in thread mode uses root or existing parent, rejects bad configuration',async()=>{
 for(const thread_ts of [undefined,'122.3','bad']){
  const sent=[];await createHandler({provider:new FixtureProvider(),replyMode:'thread',send:async p=>sent.push(p)})({channel:'C123',ts:'123.4',thread_ts,text:'$AAPL'});
  assert.equal(sent[0].thread_ts,thread_ts==='122.3'?'122.3':'123.4');
 }
 assert.deepEqual(replyOptions({}),{replyMode:'channel'});assert.deepEqual(replyOptions({STONKSBOT_REPLY_MODE:'thread'}),{replyMode:'thread'});
 for(const mode of ['','channels','THREAD','no']){
  assert.throws(()=>replyOptions({STONKSBOT_REPLY_MODE:mode}));assert.throws(()=>createHandler({replyMode:mode}));
 }
});
test('actual Slack sender omits thread_ts for card and chart in channel mode; keeps it for thread mode',async()=>{
 for(const thread_ts of [undefined,'122.3']){
  const calls=[];const client={chat:{postMessage:async p=>calls.push(p)},files:{uploadV2:async p=>calls.push(p)}};
  await slackSender(client)({channel:'C123',...(thread_ts?{thread_ts}:{}),symbol:'AAPL',card:{text:'synthetic'},png:Buffer.from('synthetic'),chartTitle:'synthetic'});
  assert.equal(calls.length,2);for(const p of calls){assert.equal(Object.hasOwn(p,'thread_ts'),!!thread_ts);if(thread_ts)assert.equal(p.thread_ts,thread_ts);}
 }
});
