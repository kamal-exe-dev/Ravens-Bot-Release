const { ChannelType } = require('discord.js');

function stripFormatting(name) {
  return name
    .replace(/^[「\[(<].*?[」\])>][\s・•\-]*/g, '')
    .replace(/^[•\-]\s*/g, '')
    .trim();
}

function normalizeForComparison(name) {
  return stripFormatting(name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

function formatChannelName(rawName, options = {}) {
  const clean = rawName.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');
  const upper = clean.toUpperCase();

  if (options.emoji) {
    return `「${options.emoji}」・${upper}`;
  }

  return upper;
}

function findChannel(guild, name) {
  const normalized = normalizeForComparison(name);
  return guild.channels.cache.find(c => {
    const cNorm = normalizeForComparison(c.name);
    return cNorm === normalized || cNorm.includes(normalized);
  });
}

function findCategory(guild, name) {
  const normalized = normalizeForComparison(name);
  return guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && normalizeForComparison(c.name) === normalized
  );
}

const CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  category: ChannelType.GuildCategory,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
};

async function createChannel(guild, name, options = {}) {
  const type = CHANNEL_TYPES[options.type] || ChannelType.GuildText;
  const formatted = formatChannelName(name, { emoji: options.emoji });

  const channelOptions = {
    name: formatted,
    type,
    topic: options.topic || undefined,
    reason: options.reason || 'Created via bot',
  };

  if (options.parent) {
    const category = typeof options.parent === 'string'
      ? findCategory(guild, options.parent)
      : options.parent;
    if (category) channelOptions.parent = category.id;
  }

  if (options.permissionOverwrites) {
    channelOptions.permissionOverwrites = options.permissionOverwrites;
  }

  return guild.channels.create(channelOptions);
}

module.exports = {
  normalizeForComparison,
  stripFormatting,
  formatChannelName,
  findChannel,
  findCategory,
  createChannel,
  CHANNEL_TYPES,
};
