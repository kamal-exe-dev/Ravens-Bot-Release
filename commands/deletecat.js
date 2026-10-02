const { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require('discord.js');
const { hasPermission, sendPermissionDenied } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  name: 'deletecat',
  description: 'Delete the current category and all its channels.',
  cooldown: 10,
  async execute(message) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator)) {
      return sendPermissionDenied(message);
    }

    const guild = message.guild;
    const category = message.channel.parent;

    if (!category || category.type !== ChannelType.GuildCategory) {
      return message.reply({ embeds: [errorEmbed('This channel is not inside a category.')] });
    }

    const children = guild.channels.cache
      .filter(c => c.parentId === category.id)
      .sort((a, b) => a.position - b.position);

    const channelList = children.map(c => {
      const icon = c.type === ChannelType.GuildVoice ? '🔊' : '#';
      return `${icon} ${c.name}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('⚠️ Delete Category')
      .setDescription(`**Category:** ${category.name}\n**Channels (${children.size}):**\n${channelList}\n\nThis will delete the category and **ALL** channels inside it. This cannot be undone.`)
      .setFooter({ text: 'Expires in 15s.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('deletecat_confirm').setLabel('Delete All').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('deletecat_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );

    const msg = await message.reply({ embeds: [embed], components: [row] });

    let interaction;
    try {
      interaction = await msg.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: i => i.user.id === message.author.id,
        time: 15_000,
      });
    } catch {
      return msg.edit({ embeds: [errorEmbed('Timed out. Category was not deleted.')], components: [] });
    }

    if (interaction.customId === 'deletecat_cancel') {
      return interaction.update({ embeds: [errorEmbed('Cancelled.')], components: [] });
    }

    await interaction.update({
      embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('Deleting...').setDescription(`Removing ${children.size} channels...`)],
      components: [],
    });

    let deleted = 0;
    let failed = 0;

    for (const [, ch] of children) {
      if (ch.id === message.channel.id) continue;
      try {
        await ch.delete(`Category deletion by ${message.author.tag}`);
        deleted++;
        await sleep(500);
      } catch {
        failed++;
      }
    }

    try {
      await message.channel.send({ embeds: [successEmbed('Done', `Deleted **${deleted}** channels${failed > 0 ? `, ${failed} failed` : ''}. Deleting category now...`)] });
    } catch {}

    try {
      if (message.channel.parentId === category.id) {
        await message.channel.delete(`Category deletion by ${message.author.tag}`);
      }
      await category.delete(`Category deletion by ${message.author.tag}`);
    } catch {}
  },
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
