import test from 'node:test';
import assert from 'node:assert/strict';
import { joinAllowedPublicChannels, allowedChannels, channelHandler } from '../src/slack-events.js';
import { createHandler } from '../src/bot.js';
import { FixtureProvider } from '../src/provider.js';
test('startup joins only configured public-channel candidates then responds through normal channel gate',async()=>{
 const calls=[],sent=[];const channels=allowedChannels('CPUBLIC,CALREADY,GPRIVATE,DDIRECT');
 const client={conversations:{join:async args=>{calls.push(args);return {ok:true,channel:{id:args.channel},warning:args.channel==='CALREADY'?'already_in_channel':undefined};}}};
 assert.deepEqual(await joinAllowedPublicChannels(client,channels),[]);
 assert.deepEqual(calls,[{channel:'CPUBLIC'},{channel:'CALREADY'}]);
 const receive=channelHandler(channels,createHandler({provider:new FixtureProvider(),send:async p=>sent.push(p)}));
 await receive({message:{channel:'CPUBLIC',ts:'123.4',text:'$AAPL'}});
 await receive({message:{channel:'COTHER',ts:'123.5',text:'$AAPL'}});
 assert.equal(sent.length,1);assert.equal(sent[0].channel,'CPUBLIC');
});
test('join failures are reported without raw Slack data, do not stop other joins or private-channel events',async()=>{
 const channels=allowedChannels('CFAIL,CBAD,COK,GPRIVATE');const calls=[];
 const failures=await joinAllowedPublicChannels({conversations:{join:async({channel})=>{
  calls.push(channel);if(channel==='CFAIL')throw Error('token secret raw payload');
  return {ok:channel!=='CBAD',channel:{id:channel}};
 }}},channels);
 assert.deepEqual(calls,['CFAIL','CBAD','COK']);
 assert.deepEqual(failures,['CFAIL','CBAD']);assert.doesNotMatch(JSON.stringify(failures),/secret/);
 const sent=[];
 await channelHandler(channels,createHandler({provider:new FixtureProvider(),send:async p=>sent.push(p)}))({message:{channel:'GPRIVATE',ts:'123.4',text:'$AAPL'}});
 assert.equal(sent.length,1);
});
