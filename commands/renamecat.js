const { PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ComponentType } = require('discord.js');
const { hasPermission, sendPermissionDenied } = require('../utils/permissions');
const { stripFormatting } = require('../utils/channelUtils');
const { applyFont, getFontList } = require('../utils/fonts');
const { errorEmbed, successEmbed } = require('../utils/embeds');

const PREFIX_STYLES = {
  emoji: { label: '「emoji」・name', format: (name, emoji) => `「${emoji}」・${name}` },
  bullet: { label: '• name', format: (name) => `• ${name}` },
  bar: { label: '┃name', format: (name) => `┃${name}` },
};

module.exports = {
  name: 'renamecat',
  description: 'Pick a font style and format all channels in the current category.',
  cooldown: 30,
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

    const sampleRaw = stripFormatting(children.first()?.name || 'general-chat')
      .replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '') || 'general-chat';

    const fonts = getFontList();
    const previewLines = [
      '**── Fonts ──**',
      ...fonts.map(f => `${f.label}: \`${applyFont(sampleRaw, f.key)}\``),
      '',
      '**── Prefix Styles ──**',
      `UPPERCASE: \`${sampleRaw.toUpperCase()}\``,
      `lowercase: \`${sampleRaw.toLowerCase()}\``,
      `「emoji」・name: \`「💬」・${sampleRaw}\``,
      `• name: \`• ${sampleRaw}\``,
      `┃name: \`┃${sampleRaw}\``,
    ];

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Choose Channel Style')
      .setDescription(`**Category:** ${category.name} (${children.size} channels)\n\n${previewLines.join('\n')}`)
      .setFooter({ text: 'Pick a style from the menu below. Expires in 30s.' });

    const options = [
      ...fonts.map(f => ({
        label: f.label,
        description: applyFont(sampleRaw, f.key).slice(0, 100),
        value: `font_${f.key}`,
      })),
      { label: 'UPPERCASE', description: sampleRaw.toUpperCase(), value: 'prefix_upper' },
      { label: 'lowercase', description: sampleRaw.toLowerCase(), value: 'prefix_lower' },
      { label: '「emoji」・name', description: `「💬」・${sampleRaw}`, value: 'prefix_emoji' },
      { label: '• name', description: `• ${sampleRaw}`, value: 'prefix_bullet' },
      { label: '┃name', description: `┃${sampleRaw}`, value: 'prefix_bar' },
    ];

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('font_select')
        .setPlaceholder('Select a style...')
        .addOptions(options),
    );

    const picker = await message.reply({ embeds: [embed], components: [row] });

    let interaction;
    try {
      interaction = await picker.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === message.author.id,
        time: 30_000,
      });
    } catch {
      return picker.edit({ embeds: [errorEmbed('Timed out. Run `!renamecat` again.')], components: [] });
    }

    const choice = interaction.values[0];
    const isFont = choice.startsWith('font_');
    const key = choice.replace(/^(font_|prefix_)/, '');

    let emoji = null;
    if (key === 'emoji') {
      await interaction.reply({ content: 'Type the emoji you want as prefix (e.g. 💬, 🎮, 📢):', ephemeral: true });
      try {
        const emojiMsg = await message.channel.awaitMessages({
          filter: m => m.author.id === message.author.id,
          max: 1, time: 20_000, errors: ['time'],
        });
        emoji = emojiMsg.first().content.trim();
        emojiMsg.first().delete().catch(() => {});
      } catch {
        return picker.edit({ embeds: [errorEmbed('No emoji provided. Run `!renamecat` again.')], components: [] });
      }
    } else {
      await interaction.deferUpdate();
    }

    const styleName = isFont
      ? getFontList().find(f => f.key === key)?.label || key
      : options.find(o => o.value === choice)?.label || key;

    await picker.edit({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('Formatting...').setDescription(`Applying **${styleName}** to **${category.name}**...`)],
      components: [],
    });

    function formatName(rawName) {
      const clean = stripFormatting(rawName).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');
      if (isFont) return applyFont(clean, key);
      switch (key) {
        case 'upper': return clean.toUpperCase();
        case 'lower': return clean.toLowerCase();
        case 'emoji': return PREFIX_STYLES.emoji.format(clean, emoji);
        case 'bullet': return PREFIX_STYLES.bullet.format(clean);
        case 'bar': return PREFIX_STYLES.bar.format(clean);
        default: return clean;
      }
    }

    let renamed = 0;
    let skipped = 0;
    let failed = 0;
    const log = [];

    const catFormatted = formatName(category.name);
    if (category.name !== catFormatted && category.manageable) {
      try {
        const old = category.name;
        await category.setName(catFormatted, 'Channel formatting');
        renamed++;
        log.push(`📁 **${old}** → **${catFormatted}**`);
        await sleep(1200);
      } catch {
        failed++;
      }
    } else {
      skipped++;
    }

    for (const [, ch] of children) {
      if (!ch.manageable) { failed++; continue; }
      const formatted = formatName(ch.name);
      if (ch.name === formatted) { skipped++; continue; }
      try {
        const old = ch.name;
        await ch.setName(formatted, 'Channel formatting');
        renamed++;
        log.push(`  ├ **${old}** → **${formatted}**`);
        await sleep(1200);
      } catch {
        failed++;
      }
    }

    const summary = [];
    summary.push(`**Style:** ${styleName}`);
    summary.push(`**Category:** ${catFormatted}`);
    summary.push(`**Renamed:** ${renamed} | **Already formatted:** ${skipped}${failed > 0 ? ` | **Failed:** ${failed}` : ''}`);
    if (log.length > 0) summary.push('', ...log.slice(0, 30));
    if (log.length > 30) summary.push(`...and ${log.length - 30} more`);

    await picker.edit({ embeds: [successEmbed('Done', summary.join('\n'))] });
  },
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
