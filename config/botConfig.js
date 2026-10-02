module.exports = {
  ai: {
    model: 'models/gemini-flash-latest',
    fallbackModel: 'models/gemini-pro-latest',
    maxTokens: 4096,
    maxToolCalls: 25,
    requestTimeout: 60_000,
    cooldown: 10,
  },

  channelNameFormat: '「{emoji}」・{name}',

  destructiveTools: new Set([
    'delete_role',
    'delete_channel',
    'purge_messages',
    'kick_member',
    'ban_member',
    'reset_channel_permissions',
  ]),

  confirmationTimeout: 60_000,
  logChannelName: '「📜」・bot-logs',
};
