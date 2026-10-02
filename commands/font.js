const { PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ComponentType } = require('discord.js');
const { hasPermission, sendPermissionDenied } = require('../utils/permissions');
const { stripFormatting } = require('../utils/channelUtils');
const { applyFont, getFontList } = require('../utils/fonts');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  name: 'font',
  description: 'Change channel name fonts. Pick scope and style.',
  cooldown: 30,
  async execute(message) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator)) {
      return sendPermissionDenied(message);
    }

    const guild = message.guild;
    const currentChannel = message.channel;
    const category = currentChannel.parent;

    const scopeOptions = [
      { label: 'This Channel', description: `Only #${currentChannel.name}`, value: 'channel' },
    ];
    if (category) {
      const count = guild.channels.cache.filter(c => c.parentId === category.id).size;
      scopeOptions.push({ label: 'All Channels of this Category', description: `${category.name} (${count} channels)`, value: 'category' });
    }
    const totalChannels = guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory).size;
    scopeOptions.push({ label: 'All Channels of this Server', description: `Entire server (${totalChannels} channels)`, value: 'server' });

    const scopeEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Channel Font')
      .setDescription('Select the scope — what do you want to change?');

    const scopeRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('font_scope')
        .setPlaceholder('Select scope...')
        .addOptions(scopeOptions),
    );

    const msg = await message.reply({ embeds: [scopeEmbed], components: [scopeRow] });

    let scopeInteraction;
    try {
      scopeInteraction = await msg.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === message.author.id,
        time: 30_000,
      });
    } catch {
      return msg.edit({ embeds: [errorEmbed('Timed out.')], components: [] });
    }

    const scope = scopeInteraction.values[0];

    const sampleName = stripFormatting(currentChannel.name).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '') || 'general';
    const fonts = getFontList();

    const fontOptions = [
      { label: 'UPPERCASE', description: sampleName.toUpperCase(), value: 'style_upper' },
      { label: 'lowercase', description: sampleName.toLowerCase(), value: 'style_lower' },
      ...fonts.map(f => ({
        label: f.label,
        description: applyFont(sampleName, f.key).slice(0, 100),
        value: `font_${f.key}`,
      })),
      { label: '「emoji」・name', description: `「💬」・${sampleName}`, value: 'style_emoji' },
      { label: '• name', description: `• ${sampleName}`, value: 'style_bullet' },
      { label: '┃name', description: `┃${sampleName}`, value: 'style_bar' },
    ];

    const scopeLabel = scope === 'channel' ? `#${currentChannel.name}`
      : scope === 'category' ? category.name
      : 'Entire Server';

    const fontEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Choose Font Style')
      .setDescription(`**Scope:** ${scopeLabel}\n\nPick a font from the dropdown below. Preview uses: \`${sampleName}\``);

    const fontRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('font_style')
        .setPlaceholder('Select font...')
        .addOptions(fontOptions.slice(0, 25)),
    );

    await scopeInteraction.update({ embeds: [fontEmbed], components: [fontRow] });

    let fontInteraction;
    try {
      fontInteraction = await msg.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === message.author.id,
        time: 30_000,
      });
    } catch {
      return msg.edit({ embeds: [errorEmbed('Timed out.')], components: [] });
    }

    const choice = fontInteraction.values[0];

    let emoji = null;
    if (choice === 'style_emoji') {
      await fontInteraction.reply({ content: 'Type the emoji you want as prefix (e.g. 💬, 🎮, 📢):', ephemeral: true });
      try {
        const emojiMsg = await message.channel.awaitMessages({
          filter: m => m.author.id === message.author.id,
          max: 1, time: 20_000, errors: ['time'],
        });
        emoji = emojiMsg.first().content.trim();
        emojiMsg.first().delete().catch(() => {});
      } catch {
        return msg.edit({ embeds: [errorEmbed('No emoji provided. Run `!font` again.')], components: [] });
      }
    } else {
      await fontInteraction.deferUpdate();
    }

    function formatName(rawName) {
      // Extract existing emoji if present (matches 「emoji」・ pattern)
      const emojiMatch = rawName.match(/^[「\[]([^\]」]+)[」\]][\s・•]*/);
      const existingEmoji = emojiMatch ? emojiMatch[1] : null;

      const clean = stripFormatting(rawName).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');

      let formatted;
      if (choice.startsWith('font_')) {
        formatted = applyFont(clean, choice.replace('font_', ''));
      } else {
        switch (choice) {
          case 'style_upper': formatted = clean.toUpperCase(); break;
          case 'style_lower': formatted = clean.toLowerCase(); break;
          case 'style_emoji': return `「${emoji}」・${clean}`;
          case 'style_bullet': formatted = `• ${clean}`; break;
          case 'style_bar': formatted = `┃${clean}`; break;
          default: formatted = clean;
        }
      }

      // Preserve existing emoji if the new style isn't emoji/bullet/bar
      if (existingEmoji && !['style_emoji', 'style_bullet', 'style_bar'].includes(choice)) {
        return `「${existingEmoji}」・${formatted}`;
      }

      return formatted;
    }

    const styleName = fontOptions.find(o => o.value === choice)?.label || choice;

    const channels = getChannelsForScope(guild, scope, currentChannel, category);

    await msg.edit({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('Formatting...').setDescription(`Applying **${styleName}** to ${channels.length} channel(s)...`)],
      components: [],
    });

    let renamed = 0;
    let skipped = 0;
    let failed = 0;
    const log = [];

    for (const ch of channels) {
      if (!ch.manageable) { failed++; continue; }
      const formatted = formatName(ch.name);
      if (ch.name === formatted) { skipped++; continue; }
      try {
        const old = ch.name;
        await ch.setName(formatted, 'Font command');
        renamed++;
        const icon = ch.type === ChannelType.GuildCategory ? '📁' : ch.type === ChannelType.GuildVoice ? '🔊' : '#';
        log.push(`${icon} **${old}** → **${formatted}**`);
        await sleep(1200);

        if (log.length % 5 === 0) {
          await msg.edit({
            embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('Formatting...').setDescription(`**Progress:** ${renamed} renamed, ${skipped} skipped\n**Working on:** ${formatted}`)],
          }).catch(() => {});
        }
      } catch {
        failed++;
      }
    }

    const summary = [];
    summary.push(`**Style:** ${styleName}`);
    summary.push(`**Renamed:** ${renamed} | **Already formatted:** ${skipped}${failed > 0 ? ` | **Failed:** ${failed}` : ''}`);
    if (log.length > 0) summary.push('', ...log.slice(0, 35));
    if (log.length > 35) summary.push(`...and ${log.length - 35} more`);

    await msg.edit({ embeds: [successEmbed('Done', summary.join('\n'))] });
  },
};

function getChannelsForScope(guild, scope, currentChannel, category) {
  const channels = [];
  if (scope === 'channel') {
    channels.push(currentChannel);
  } else if (scope === 'category') {
    channels.push(category);
    guild.channels.cache
      .filter(c => c.parentId === category.id)
      .sort((a, b) => a.position - b.position)
      .forEach(c => channels.push(c));
  } else {
    guild.channels.cache
      .filter(c => c.type === ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position)
      .forEach(cat => {
        channels.push(cat);
        guild.channels.cache
          .filter(c => c.parentId === cat.id)
          .sort((a, b) => a.position - b.position)
          .forEach(c => channels.push(c));
      });
    guild.channels.cache
      .filter(c => !c.parentId && c.type !== ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position)
      .forEach(c => channels.push(c));
  }
  return channels;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
