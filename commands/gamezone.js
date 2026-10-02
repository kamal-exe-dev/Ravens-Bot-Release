const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { hasPermission, sendPermissionDenied } = require('../utils/permissions');
const { formatChannelName } = require('../utils/channelUtils');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'gamezone',
  description: 'Create GAME ZONE category with game channels.',
  cooldown: 30,
  async execute(message) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator)) {
      return sendPermissionDenied(message);
    }

    const guild = message.guild;
    await guild.roles.fetch();

    const allyRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'ally');
    const recruitRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'recruit');

    if (!allyRole || !recruitRole) {
      const missing = [];
      if (!allyRole) missing.push('Ally');
      if (!recruitRole) missing.push('Recruit');
      return message.reply({ embeds: [errorEmbed(`❌ Missing roles: ${missing.join(', ')}\nPlease create these roles first using \`!createrole Ally, Recruit\``)] });
    }

    const status = await message.reply('🎮 Setting up GAME ZONE...');

    const permissionOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: allyRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
      { id: recruitRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
      { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect] },
    ];

    const categoryName = '-----------「🎮」・GAME ZONE-----------';
    const existing = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('game zone')
    );

    const category = existing || await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites,
      reason: 'Game Zone setup',
    });

    if (existing) {
      await category.permissionOverwrites.set(permissionOverwrites, 'Game Zone setup');
    }

    const channels = [
      // PUBG
      { name: '「🔫」・PUBG-CHAT', type: ChannelType.GuildText },
      { name: '「🔊」・PUBG-VC-1', type: ChannelType.GuildVoice },
      { name: '「🔊」・PUBG-VC-2', type: ChannelType.GuildVoice },

      // VALORANT
      { name: '「⚔️」・VALORANT-CHAT', type: ChannelType.GuildText },
      { name: '「🔊」・VALORANT-VC-1', type: ChannelType.GuildVoice },
      { name: '「🔊」・VALORANT-VC-2', type: ChannelType.GuildVoice },

      // MINECRAFT
      { name: '「⛏️」・MINECRAFT-CHAT', type: ChannelType.GuildText },
      { name: '「🔊」・MINECRAFT-VC-1', type: ChannelType.GuildVoice },
      { name: '「🔊」・MINECRAFT-VC-2', type: ChannelType.GuildVoice },

      // CHILL
      { name: '「💬」・CHILL-CHAT', type: ChannelType.GuildText },
      { name: '「🔊」・CHILL-LOUNGE', type: ChannelType.GuildVoice },
    ];

    const created = [];
    const skipped = [];

    for (const ch of channels) {
      const exists = guild.channels.cache.find(
        c => c.parentId === category.id && c.name === ch.name
      );

      if (exists) {
        await exists.lockPermissions().catch(() => {});
        skipped.push(ch.name);
        continue;
      }

      await guild.channels.create({
        name: ch.name,
        type: ch.type,
        parent: category.id,
        reason: 'Game Zone setup',
      });
      created.push(ch.name);
    }

    const lines = [];
    lines.push(`**Category:** ${category.name}`);
    lines.push(`**Visible to:** ${allyRole} & ${recruitRole}`);
    lines.push(`**Total Channels:** ${channels.length}`);
    if (created.length) lines.push(`\n✅ **Created:** ${created.length} channels`);
    if (skipped.length) lines.push(`⏭️ **Already existed:** ${skipped.length} channels`);
    lines.push('\n🔒 All channel permissions synced with the category.');

    await status.edit({ content: null, embeds: [successEmbed('🎮 Game Zone Setup Complete', lines.join('\n'))] });
  },
};
