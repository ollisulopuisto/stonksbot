import { loadNameIndex } from './name-lookup.js';
import { reactionOptions, slackReactor } from './reactions.js';
import { slackSender } from './slack-send.js';
import { App } from '@slack/bolt';
import { startupProvider } from './config.js';
import { createHandler, replyOptions } from './bot.js';
import { moodOptions } from './mood.js';
import { allowedChannels, channelHandler, joinAllowedPublicChannels } from './slack-events.js';

const provider = await startupProvider();
if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) throw new Error('Slack bot and Socket Mode app tokens are required.');
const channels = allowedChannels(process.env.SLACK_CHANNEL_IDS);
const app = new App({ token: process.env.SLACK_BOT_TOKEN, appToken: process.env.SLACK_APP_TOKEN, socketMode: true });
const handler = createHandler({
  provider,
  nameIndex: await loadNameIndex(process.env.STONKSBOT_HELSINKI_SYMBOLS_FILE),
  mood: moodOptions(),
  ...reactionOptions(),
  react: slackReactor(app.client),
  ...replyOptions(),
  onError: () => console.error('Quote handling failed; no raw provider payload logged.'),
  send: slackSender(app.client),
});
app.message(channelHandler(channels, handler));
app.event('app_mention',async ({event})=>{if(channels.has(event?.channel))await handler(event);});
const failedJoins = await joinAllowedPublicChannels(app.client, channels);
if (failedJoins.length) console.error(`Could not auto-join configured channel(s): ${failedJoins.join(', ')}. Check channels:join scope, reinstall app, or invite bot manually. Private channels require invitation. No automatic retry.`);
await app.start();
console.log('Stonksbot connected with explicitly configured provider and channel allowlist.');
