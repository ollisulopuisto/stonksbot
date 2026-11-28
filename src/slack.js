import { App } from '@slack/bolt';
import { configuredProvider } from './config.js';
import { createHandler } from './bot.js';

const provider = configuredProvider();
if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) throw new Error('Slack bot and Socket Mode app tokens are required.');
const channels = new Set((process.env.SLACK_CHANNEL_IDS ?? '').split(',').filter(Boolean));
if (!channels.size || [...channels].some(id => !/^[A-Z0-9]+$/.test(id))) throw new Error('Set an explicit SLACK_CHANNEL_IDS allowlist.');
const app = new App({ token: process.env.SLACK_BOT_TOKEN, appToken: process.env.SLACK_APP_TOKEN, socketMode: true });
const handler = createHandler({
  provider,
  onError: () => console.error('Quote handling failed; no raw provider payload logged.'),
  send: async ({ channel, thread_ts, symbol, card, png }) => {
    await app.client.chat.postMessage({ channel, thread_ts, ...card, unfurl_links: false, unfurl_media: false });
    await app.client.files.uploadV2({ channel_id: channel, thread_ts, file: png, filename: `${symbol}-history.png`, title: `${symbol} ${process.env.STONKSBOT_PROVIDER === 'alpha-vantage' ? 'daily close' : 'DEMO fixture'} history` });
  },
});
app.message(async ({ message }) => { if (channels.has(message.channel)) await handler(message); });
await app.start();
console.log('Stonksbot connected with explicitly configured provider and channel allowlist.');
