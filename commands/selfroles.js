const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
} = require('discord.js');
const { hasPermission, sendPermissionDenied, botCanManageRoles } = require('../utils/permissions');
const { infoEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'selfroles',
  description: 'Open the self-role menu setup wizard.',
  cooldown: 5,
  async execute(message) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator)) {
      return sendPermissionDenied(message);
    }

    if (!botCanManageRoles(message.guild)) {
      return message.reply({ embeds: [errorEmbed('❌ I need the **Manage Roles** permission to create self-role menus.')] });
    }

    const channelMenu = new ChannelSelectMenuBuilder()
      .setCustomId('selfroles-setup-channel')
      .setPlaceholder('Choose where to post the role menu')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1);

    const roleMenu = new RoleSelectMenuBuilder()
      .setCustomId('selfroles-setup-roles')
      .setPlaceholder('Choose up to 25 self-assignable roles')
      .setMinValues(1)
      .setMaxValues(25);

    const postButton = new ButtonBuilder()
      .setCustomId('selfroles-setup-post')
      .setLabel('Post Role Menu')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true);

    const setupMessage = await message.reply({
      embeds: [infoEmbed('Self-Role Setup', '1. Choose a channel.\n2. Choose one or more roles.\n3. Press **Post Role Menu**.')],
      components: [
        new ActionRowBuilder().addComponents(channelMenu),
        new ActionRowBuilder().addComponents(roleMenu),
        new ActionRowBuilder().addComponents(postButton),
      ],
    });

    const handler = require('../interactions/selfroles');
    handler.createSetup(setupMessage.id, message.guild.id, message.author.id);
  },
};
