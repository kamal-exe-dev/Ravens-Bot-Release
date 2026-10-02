const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const config = require('../config/botConfig');

async function request(channel, userId, description, timeout) {
  const timeoutMs = timeout || config.confirmationTimeout;

  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('⚠️ Confirmation Required')
    .setDescription(description + '\n\nThis action may not be easily undone.')
    .setFooter({ text: `Expires in ${Math.round(timeoutMs / 1000)}s • Only the requesting user can confirm` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ai-confirm-${userId}-${Date.now()}`)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`ai-cancel-${userId}-${Date.now()}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌'),
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  try {
    const interaction = await msg.awaitMessageComponent({
      filter: (i) => i.user.id === userId && i.customId.startsWith('ai-'),
      time: timeoutMs,
    });

    await interaction.deferUpdate();
    const confirmed = interaction.customId.includes('confirm');

    const resultEmbed = new EmbedBuilder()
      .setColor(confirmed ? 0x57F287 : 0xED4245)
      .setDescription(confirmed ? '✅ Confirmed. Executing...' : '❌ Cancelled.');

    await msg.edit({ embeds: [embed, resultEmbed], components: [] });

    return confirmed;
  } catch {
    const timeoutEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setDescription('⏱️ Confirmation timed out. Action cancelled.');

    await msg.edit({ embeds: [embed, timeoutEmbed], components: [] }).catch(() => {});
    return false;
  }
}

module.exports = { request };
