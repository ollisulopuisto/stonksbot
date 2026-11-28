import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedChannels, channelHandler } from '../src/slack-events.js';
import { createHandler } from '../src/bot.js';
import { FixtureProvider } from '../src/provider.js';
test('allowlisted public and private channels and DMs reach actual ticker handler, others do not',async()=>{
 const sent=[];
 const handler=createHandler({provider:new FixtureProvider(),send:async p=>sent.push(p)});
 const receive=channelHandler(allowedChannels('CPUBLIC,GPRIVATE,DDIRECT'),handler);
 for(const [index,channel] of ['CPUBLIC','GPRIVATE','DDIRECT','COTHER'].entries()) {
  await receive({message:{channel,ts:`123.${index}`,text:'$AAPL'}});
 }
 assert.deepEqual(sent.map(p=>p.channel),['CPUBLIC','GPRIVATE','DDIRECT']);
 await receive({});
});
test('channel allowlist remains required and rejects invalid configuration',()=>{
 for(const value of [undefined,'',' , ','C-INVALID']) assert.throws(()=>allowedChannels(value));
 assert.deepEqual([...allowedChannels(' C123, G123 ')],['C123','G123']);
});
