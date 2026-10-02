const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { getManageableRoles, getRoleChanges } = require('../utils/selfRoles');

const setupSessions = new Map();
const configPath = path.join(__dirname, '..', 'config', 'selfRoles.json');

function loadConfigurations() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfiguration(configuration) {
  const configurations = loadConfigurations();
  configurations[`${configuration.guildId}:${configuration.messageId}`] = configuration;
  fs.writeFileSync(configPath, JSON.stringify(configurations, null, 2));
}

function getConfiguration(guildId, messageId) {
  return loadConfigurations()[`${guildId}:${messageId}`];
}

function createSetup(messageId, guildId, ownerId) {
  setupSessions.set(messageId, { guildId, ownerId, channelId: null, roleIds: [] });
}

function canConfigure(interaction, session) {
  return interaction.member.permissions.has(PermissionFlagsBits.Administrator) && interaction.user.id === session.ownerId;
}

function setupComponents(session, canPost = false) {
  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId('selfroles-setup-channel')
    .setPlaceholder(session.channelId ? 'Channel selected' : 'Choose where to post the role menu')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1)
    .setMaxValues(1);
  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId('selfroles-setup-roles')
    .setPlaceholder(session.roleIds.length ? `${session.roleIds.length} role(s) selected` : 'Choose up to 25 self-assignable roles')
    .setMinValues(1)
    .setMaxValues(25);
  const postButton = new ButtonBuilder()
    .setCustomId('selfroles-setup-post')
    .setLabel('Post Role Menu')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!canPost);
  return [
    new ActionRowBuilder().addComponents(channelMenu),
    new ActionRowBuilder().addComponents(roleMenu),
    new ActionRowBuilder().addComponents(postButton),
  ];
}

function roleMenuEmbed(roleNames) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Choose Your Roles')
    .setDescription('Select the roles you want, then submit your choice. You can update your selection later.')
    .addFields({ name: 'Available roles', value: roleNames.map(name => `• ${name}`).join('\n') })
    .setTimestamp();
}

module.exports = {
  customIds: ['selfroles-'],
  createSetup,

  async execute(interaction) {
    if (interaction.customId.startsWith('selfroles-setup-')) {
      return this.handleSetup(interaction);
    }
    if (interaction.customId === 'selfroles-menu') {
      return this.handleRoleSelection(interaction);
    }
  },

  async handleSetup(interaction) {
    const session = setupSessions.get(interaction.message.id);
    if (!session) {
      return interaction.reply({ content: '❌ This setup panel expired. Run `!selfroles` again.', ephemeral: true });
    }
    if (!canConfigure(interaction, session)) {
      return interaction.reply({ content: '❌ Only the administrator who opened this setup can use it.', ephemeral: true });
    }

    if (interaction.customId === 'selfroles-setup-channel') {
      session.channelId = interaction.values[0];
      return interaction.update({ components: setupComponents(session, session.roleIds.length > 0) });
    }

    if (interaction.customId === 'selfroles-setup-roles') {
      const roles = interaction.values.map(id => interaction.guild.roles.cache.get(id)).filter(Boolean);
      const manageable = getManageableRoles(roles, interaction.guild.members.me.roles.highest.position)
        .filter(role => role.id !== interaction.guild.id);
      if (manageable.length !== roles.length) {
        return interaction.reply({ content: '❌ One or more selected roles are managed or above my highest role.', ephemeral: true });
      }
      session.roleIds = manageable.map(role => role.id);
      return interaction.update({ components: setupComponents(session, Boolean(session.channelId)) });
    }

    if (!session.channelId || !session.roleIds.length) {
      return interaction.reply({ content: '❌ Choose a channel and at least one role first.', ephemeral: true });
    }

    const targetChannel = interaction.guild.channels.cache.get(session.channelId);
    const roles = session.roleIds.map(id => interaction.guild.roles.cache.get(id)).filter(Boolean);
    const manageable = getManageableRoles(roles, interaction.guild.members.me.roles.highest.position)
      .filter(role => role.id !== interaction.guild.id);
    if (!targetChannel?.isTextBased() || manageable.length !== session.roleIds.length) {
      return interaction.reply({ content: '❌ The selected channel or roles are no longer available.', ephemeral: true });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('selfroles-menu')
      .setPlaceholder('Choose your roles')
      .setMinValues(0)
      .setMaxValues(manageable.length)
      .addOptions(manageable.map(role => ({ label: role.name.slice(0, 100), value: role.id })));
    const roleMessage = await targetChannel.send({
      embeds: [roleMenuEmbed(manageable.map(role => role.name))],
      components: [new ActionRowBuilder().addComponents(selectMenu)],
    });

    saveConfiguration({
      guildId: interaction.guild.id,
      channelId: targetChannel.id,
      messageId: roleMessage.id,
      roleIds: manageable.map(role => role.id),
    });
    setupSessions.delete(interaction.message.id);
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Self-Role Menu Posted').setDescription(`✅ Posted in ${targetChannel}.`)],
      components: [],
    });
  },

  async handleRoleSelection(interaction) {
    const configuration = getConfiguration(interaction.guild.id, interaction.message.id);
    if (!configuration) {
      return interaction.reply({ content: '❌ This role menu is no longer configured. Ask an administrator to create a new one.', ephemeral: true });
    }
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: '❌ I need the **Manage Roles** permission to update your roles.', ephemeral: true });
    }

    const roles = configuration.roleIds.map(id => interaction.guild.roles.cache.get(id)).filter(Boolean);
    const manageableIds = getManageableRoles(roles, interaction.guild.members.me.roles.highest.position)
      .map(role => role.id);
    const selectedIds = new Set(interaction.values.filter(id => manageableIds.includes(id)));
    const changes = getRoleChanges(manageableIds, interaction.member.roles.cache.keys(), selectedIds);

    try {
      if (changes.add.length) await interaction.member.roles.add(changes.add, 'Self-role menu selection');
      if (changes.remove.length) await interaction.member.roles.remove(changes.remove, 'Self-role menu selection');
    } catch {
      return interaction.reply({ content: '❌ I could not update your roles. Check my role position and permissions.', ephemeral: true });
    }

    const selectedNames = roles.filter(role => selectedIds.has(role.id)).map(role => role.name);
    return interaction.reply({
      content: selectedNames.length ? `✅ Your roles are now: **${selectedNames.join(', ')}**.` : '✅ Your self-roles have been removed.',
      ephemeral: true,
    });
  },
};
