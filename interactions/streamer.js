const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

const CATEGORY_NAME = 'Streamer Applications';
const ROLE_NAME = 'Streamer';

module.exports = {
  customIds: ['streamer-apply', 'streamer-modal', 'streamer-approve-', 'streamer-deny-'],

  async execute(interaction) {
    const customId = interaction.customId;

    if (customId === 'streamer-apply') {
      return this.showModal(interaction);
    }

    if (customId === 'streamer-modal') {
      return this.handleSubmission(interaction);
    }

    if (customId.startsWith('streamer-approve-')) {
      return this.handleApprove(interaction);
    }

    if (customId.startsWith('streamer-deny-')) {
      return this.handleDeny(interaction);
    }
  },

  async showModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('streamer-modal')
      .setTitle('🎥 Streamer Role Application');

    const fields = [
      new TextInputBuilder()
        .setCustomId('fivem_name')
        .setLabel('FiveM Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100),
      new TextInputBuilder()
        .setCustomId('platform')
        .setLabel('Streaming Platform')
        .setPlaceholder('Twitch, YouTube, Kick, etc.')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100),
      new TextInputBuilder()
        .setCustomId('channel_link')
        .setLabel('Channel Link')
        .setPlaceholder('https://twitch.tv/yourchannel')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(200),
      new TextInputBuilder()
        .setCustomId('stats')
        .setLabel('Followers/Subs & Average Viewers')
        .setPlaceholder('e.g. 500 followers, 20 avg viewers')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(200),
      new TextInputBuilder()
        .setCustomId('schedule')
        .setLabel('Streaming Schedule')
        .setPlaceholder('e.g. Mon/Wed/Fri 8PM - 11PM EST')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(300),
    ];

    for (const field of fields) {
      modal.addComponents(new ActionRowBuilder().addComponents(field));
    }

    await interaction.showModal(modal);
  },

  async handleSubmission(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const user = interaction.user;
    const member = interaction.member;

    const fivemName = interaction.fields.getTextInputValue('fivem_name');
    const platform = interaction.fields.getTextInputValue('platform');
    const channelLink = interaction.fields.getTextInputValue('channel_link');
    const stats = interaction.fields.getTextInputValue('stats');
    const schedule = interaction.fields.getTextInputValue('schedule');

    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME
    );

    if (!category) {
      category = await guild.channels.create({
        name: CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: guild.members.me.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages],
          },
        ],
      });
    }

    const channelName = `app-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${user.discriminator || user.id.slice(-4)}`;

    const appChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: guild.members.me.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
        },
        {
          id: user.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.SendMessages],
        },
      ],
    });

    const appEmbed = new EmbedBuilder()
      .setColor(0x9146FF)
      .setTitle('🎥 Streamer Role Application')
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Applicant', value: `${user.tag} (<@${user.id}>)`, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: '​', value: '​' },
        { name: 'FiveM Name', value: fivemName, inline: true },
        { name: 'Streaming Platform', value: platform, inline: true },
        { name: 'Channel Link', value: channelLink },
        { name: 'Followers/Subs & Avg Viewers', value: stats },
        { name: 'Streaming Schedule', value: schedule },
      )
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`streamer-approve-${user.id}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`streamer-deny-${user.id}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌'),
    );

    await appChannel.send({ embeds: [appEmbed], components: [buttons] });

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription('✅ Your **Streamer** application has been submitted! Staff will review it soon.')],
    });
  },

  async handleApprove(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: '❌ You need **Manage Roles** permission.', ephemeral: true });
    }

    const userId = interaction.customId.replace('streamer-approve-', '');
    const guild = interaction.guild;

    const role = guild.roles.cache.find(r => r.name.toLowerCase() === ROLE_NAME.toLowerCase());
    if (!role) {
      return interaction.reply({
        content: `❌ **${ROLE_NAME}** role not found. Create it with \`!createrole ${ROLE_NAME}\`.`,
        ephemeral: true,
      });
    }

    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      return interaction.reply({ content: '❌ User is no longer in the server.', ephemeral: true });
    }

    try {
      await member.roles.add(role, `Streamer approved by ${interaction.user.tag}`);
    } catch {
      return interaction.reply({ content: '❌ Failed to assign role. Check bot permissions and role hierarchy.', ephemeral: true });
    }

    const approvedEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Application Approved')
      .setDescription(
        `**${member.user.tag}** has been approved and given the **${ROLE_NAME}** role.\n` +
        `Approved by: ${interaction.user.tag}`
      )
      .setTimestamp();

    await interaction.update({ embeds: [interaction.message.embeds[0], approvedEmbed], components: [] });

    await member.user.send({
      embeds: [new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🎥 Streamer Application Approved!')
        .setDescription(`Your **Streamer** role application in **${guild.name}** has been approved! Welcome aboard!`)],
    }).catch(() => {});

    setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
  },

  async handleDeny(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: '❌ You need **Manage Roles** permission.', ephemeral: true });
    }

    const userId = interaction.customId.replace('streamer-deny-', '');
    const guild = interaction.guild;

    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      return interaction.reply({ content: '❌ User is no longer in the server.', ephemeral: true });
    }

    const deniedEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('❌ Application Denied')
      .setDescription(
        `**${member.user.tag}**'s application has been denied.\n` +
        `Denied by: ${interaction.user.tag}`
      )
      .setTimestamp();

    await interaction.update({ embeds: [interaction.message.embeds[0], deniedEmbed], components: [] });

    await member.user.send({
      embeds: [new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🎥 Streamer Application Denied')
        .setDescription(`Your **Streamer** role application in **${guild.name}** has been denied.\nYou may reapply in the future.`)],
    }).catch(() => {});

    setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
  },
};
