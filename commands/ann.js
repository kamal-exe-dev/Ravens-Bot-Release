const { PermissionFlagsBits } = require('discord.js');
const { hasPermission, sendPermissionDenied } = require('../utils/permissions');
const { errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'ann',
  description: 'Post an announcement as plain text.',
  cooldown: 5,
  async execute(message, args) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild)) {
      return sendPermissionDenied(message);
    }

    const text = message.content.slice(message.content.indexOf(' ') + 1).trim();

    if (!text) {
      return message.reply({ embeds: [errorEmbed('❌ Please provide an announcement message.\n**Usage:** `!ann <message>`')] });
    }

    await message.delete().catch(() => {});

    return message.channel.send(text);
  },
};
