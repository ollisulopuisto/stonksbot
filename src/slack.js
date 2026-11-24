import { App } from '@slack/bolt';
import { FixtureProvider } from './provider.js';
import { createHandler } from './bot.js';

// Installation/connection is a separate action. Startup is intentionally opt-in.
if (process.env.STONKSBOT_ALLOW_FIXTURE_POSTING !== 'yes') {
  throw new Error('Fixture-only prototype. Run npm run demo. To deliberately post DEMO fixtures to Slack, set STONKSBOT_ALLOW_FIXTURE_POSTING=yes.');
}
if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) throw new Error('Slack bot and Socket Mode app tokens are required.');
const channels = new Set((process.env.SLACK_CHANNEL_IDS ?? '').split(',').filter(Boolean));
if (!channels.size || [...channels].some(id => !/^[A-Z0-9]+$/.test(id))) throw new Error('Set an explicit SLACK_CHANNEL_IDS allowlist.');
const app = new App({ token: process.env.SLACK_BOT_TOKEN, appToken: process.env.SLACK_APP_TOKEN, socketMode: true });
const handler = createHandler({
  provider: new FixtureProvider(),
  onError: () => console.error('Quote handling failed; no raw provider payload logged.'),
  send: async ({ channel, thread_ts, symbol, card, png }) => {
    await app.client.chat.postMessage({ channel, thread_ts, ...card, unfurl_links: false, unfurl_media: false });
    await app.client.files.uploadV2({ channel_id: channel, thread_ts, file: png, filename: `${symbol}-demo-history.png`, title: `${symbol} DEMO fixture history` });
  },
});
app.message(async ({ message }) => { if (channels.has(message.channel)) await handler(message); });
await app.start();
console.log('Stonksbot fixture mode connected. All cards are labelled DEMO.');
