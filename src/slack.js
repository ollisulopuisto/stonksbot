import { App } from '@slack/bolt';
import { configuredProvider } from './config.js';
import { createHandler } from './bot.js';
import { moodOptions } from './mood.js';
import { allowedChannels, channelHandler } from './slack-events.js';

const provider = configuredProvider();
if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) throw new Error('Slack bot and Socket Mode app tokens are required.');
const channels = allowedChannels(process.env.SLACK_CHANNEL_IDS);
const app = new App({ token: process.env.SLACK_BOT_TOKEN, appToken: process.env.SLACK_APP_TOKEN, socketMode: true });
const handler = createHandler({
  provider,
  mood: moodOptions(),
  onError: () => console.error('Quote handling failed; no raw provider payload logged.'),
  send: async ({ channel, thread_ts, symbol, card, png, chartTitle }) => {
    await app.client.chat.postMessage({ channel, thread_ts, ...card, unfurl_links: false, unfurl_media: false });
    if (png) await app.client.files.uploadV2({ channel_id: channel, thread_ts, file: png, filename: `${symbol}-history.png`, title: chartTitle });
  },
});
app.message(channelHandler(channels, handler));
await app.start();
console.log('Stonksbot connected with explicitly configured provider and channel allowlist.');
