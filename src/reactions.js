export function reactionOptions(env=process.env) {
 const reactionNames={over:env.STONKSBOT_REACTION_OVER??'over',back:env.STONKSBOT_REACTION_BACK??'back'};
 if(Object.values(reactionNames).some(name=>!/^[-+a-z0-9_]{1,64}$/.test(name)))throw Error('Reaction names must be Slack emoji names without colons.');
 return {reactionNames};
}
export function slackReactor(client) {
 return async ({channel,timestamp,name})=>{
  try {
   const result=await client.reactions.add({channel,timestamp,name});
   if(result?.ok===false&&result.error!=='already_reacted')throw Error('Slack reaction unavailable.');
  }catch(error){if(error?.data?.error!=='already_reacted')throw Error('Slack reaction unavailable; check reactions:write and custom emoji names.');}
 };
}
