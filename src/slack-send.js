// Keep reply placement identical for cards and chart uploads. Channel mode
// omits thread_ts entirely, rather than relying on SDK handling of undefined.
export function slackSender(client) {
  return async ({ channel, thread_ts, symbol, card, png, chartTitle }) => {
    const placement = thread_ts ? { thread_ts } : {};
    await client.chat.postMessage({ channel, ...placement, ...card, unfurl_links: false, unfurl_media: false });
    if (png) await client.files.uploadV2({ channel_id: channel, ...placement, file: png, filename: `${symbol}-history.png`, title: chartTitle });
  };
}
