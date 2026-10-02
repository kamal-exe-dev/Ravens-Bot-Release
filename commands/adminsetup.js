const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { hasPermission, sendPermissionDenied } = require('../utils/permissions');
const { formatChannelName } = require('../utils/channelUtils');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'adminsetup',
  description: 'Create private ADMIN section with channels.',
  cooldown: 30,
  async execute(message) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator)) {
      return sendPermissionDenied(message);
    }

    const guild = message.guild;
    await guild.roles.fetch();

    const founderRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'founder');
    const cmRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'community manager');

    if (!founderRole || !cmRole) {
      const missing = [];
      if (!founderRole) missing.push('Founder');
      if (!cmRole) missing.push('Community Manager');
      return message.reply({ embeds: [errorEmbed(`Missing roles: ${missing.join(', ')}`)] });
    }

    const status = await message.reply('Setting up ADMIN section...');

    const permissionOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: founderRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ManageMessages] },
      { id: cmRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ManageMessages] },
      { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect] },
    ];

    const categoryName = formatChannelName('ADMIN');
    const existing = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().replace(/[^a-z]/g, '') === 'admin'
    );

    const category = existing || await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites,
      reason: 'Admin section setup',
    });

    if (existing) {
      await category.permissionOverwrites.set(permissionOverwrites, 'Admin section setup');
    }

    const channels = [
      { name: 'admin-chat', type: ChannelType.GuildText },
      { name: 'admin-announcements', type: ChannelType.GuildText },
      { name: 'admin-logs', type: ChannelType.GuildText },
      { name: 'admin-notes', type: ChannelType.GuildText },
      { name: 'admin-vc', type: ChannelType.GuildVoice },
      { name: 'admin-meeting', type: ChannelType.GuildVoice },
    ];

    const created = [];
    const skipped = [];

    for (const ch of channels) {
      const formatted = formatChannelName(ch.name);
      const exists = guild.channels.cache.find(
        c => c.parentId === category.id && c.name.toLowerCase().replace(/[^a-z]/g, '') === ch.name.replace(/-/g, '')
      );

      if (exists) {
        await exists.lockPermissions().catch(() => {});
        skipped.push(ch.name);
        continue;
      }

      await guild.channels.create({
        name: formatted,
        type: ch.type,
        parent: category.id,
        reason: 'Admin section setup',
      });
      created.push(ch.name);
    }

    const lines = [];
    lines.push(`**Category:** ${category.name}`);
    lines.push(`**Visible to:** ${founderRole} & ${cmRole}`);
    if (created.length) lines.push(`**Created:** ${created.join(', ')}`);
    if (skipped.length) lines.push(`**Already existed:** ${skipped.join(', ')}`);
    lines.push('\nAll channel permissions synced with the category.');

    await status.edit({ content: null, embeds: [successEmbed(lines.join('\n'))] });
  },
};
