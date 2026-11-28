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

export async function joinAllowedPublicChannels(client, channels) {
  const failed = [];
  // Private channels require an invitation. Never discover or join other IDs.
  // C IDs may also be private in newer workspaces; Slack will refuse the join.
  for (const channel of channels) {
    if (!channel.startsWith('C')) continue;
    try {
      const response = await client.conversations.join({ channel });
      if (!response?.ok) failed.push(channel);
    } catch {
      failed.push(channel); // Do not log tokens, raw Slack errors or payloads.
    }
  }
  return failed;
}
