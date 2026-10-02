const executeChannelLock = require('./channelLock');

module.exports = {
  name: 'lock',
  description: 'Lock the current chat or your voice channel.',
  async execute(message, args) {
    return executeChannelLock(message, args, true);
  },
};
