const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { hasPermission, sendPermissionDenied } = require('../utils/permissions');

module.exports = {
  name: 'streamer',
  description: 'Post the Streamer role application embed with apply button.',
  cooldown: 10,
  async execute(message) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageRoles)) {
      return sendPermissionDenied(message);
    }

    await message.delete().catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0x9146FF)
      .setTitle('🎥 STREAMER ROLE')
      .setDescription(
        'Want to get the **Streamer** role?\n\n' +
        'Click the button below to apply! You will be asked:\n\n' +
        '• FiveM Name\n' +
        '• Streaming Platform\n' +
        '• Channel Link\n' +
        '• Followers/Subs & Average Viewers\n' +
        '• Streaming Schedule\n\n' +
        '📌 **Requirements:**\n' +
        '• Must actively stream FiveM/RP content.\n' +
        '• Must provide a valid streaming channel.\n' +
        '• Must follow community rules.\n' +
        '• Staff will review your application.\n\n' +
        'Once approved, the **Streamer** role will be assigned by staff.'
      )
      .setImage('https://i.imgur.com/AfFp7pu.png')
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('streamer-apply')
        .setLabel('Apply for Streamer')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎥'),
    );

    return message.channel.send({ embeds: [embed], components: [button] });
  },
};
