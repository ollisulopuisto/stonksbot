export function allowedChannels(value) {
  const channels = new Set((value ?? '').split(',').map(id => id.trim()).filter(Boolean));
  if (!channels.size || [...channels].some(id => !/^[A-Z0-9]+$/.test(id))) throw Error('Set an explicit SLACK_CHANNEL_IDS allowlist.');
  return channels;
}
export function channelHandler(channels, handler) {
  // Slack public channels, private channels and DMs share this channel ID gate.
  // Public visibility does not bypass the explicitly configured channel list.
  return async ({ message }) => { if (channels.has(message?.channel)) await handler(message); };
}
