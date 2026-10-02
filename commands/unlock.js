const executeChannelLock = require('./channelLock');

module.exports = {
  name: 'unlock',
  description: 'Unlock the current chat or your voice channel.',
  async execute(message, args) {
    return executeChannelLock(message, args, false);
  },
};
