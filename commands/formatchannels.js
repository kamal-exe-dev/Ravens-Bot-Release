const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { hasPermission, sendPermissionDenied } = require('../utils/permissions');
const { formatChannelName, stripFormatting } = require('../utils/channelUtils');
const { successEmbed, errorEmbed, infoEmbed } = require('../utils/embeds');

module.exports = {
  name: 'formatchannels',
  description: 'Bulk rename all channels to UPPERCASE format, category by category.',
  cooldown: 60,
  async execute(message, args) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator)) {
      return sendPermissionDenied(message);
    }

    const guild = message.guild;
    const channels = guild.channels.cache;

    const categories = channels
      .filter(c => c.type === ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position);

    const uncategorized = channels
      .filter(c => !c.parentId && c.type !== ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position);

    const total = channels.filter(c => c.manageable).size;
    let renamed = 0;
    let skipped = 0;
    let failed = 0;
    const log = [];

    const status = await message.reply({
      embeds: [infoEmbed('Formatting', `Formatting **${total}** channels across **${categories.size}** categories...\nThis may take a while due to Discord rate limits.`)],
    });

    for (const [, category] of categories) {
      const catClean = stripFormatting(category.name);
      const catFormatted = formatChannelName(catClean);

      if (category.name !== catFormatted && category.manageable) {
        try {
          await category.setName(catFormatted, 'Channel formatting');
          renamed++;
          log.push(`📁 **${category.name}** → **${catFormatted}**`);
          await sleep(1200);
        } catch {
          failed++;
        }
      } else {
        skipped++;
      }

      const children = channels
        .filter(c => c.parentId === category.id)
        .sort((a, b) => a.position - b.position);

      for (const [, ch] of children) {
        const result = await renameChannel(ch);
        if (result === 'renamed') renamed++;
        else if (result === 'skipped') skipped++;
        else failed++;
        if (result === 'renamed') log.push(`  ├ ${ch.name}`);
      }

      await status.edit({
        embeds: [infoEmbed('Formatting', `**Progress:** ${renamed} renamed, ${skipped} already formatted, ${failed} failed\n**Current:** ${catFormatted}`)],
      }).catch(() => {});
    }

    if (uncategorized.size > 0) {
      for (const [, ch] of uncategorized) {
        const result = await renameChannel(ch);
        if (result === 'renamed') renamed++;
        else if (result === 'skipped') skipped++;
        else failed++;
        if (result === 'renamed') log.push(`├ ${ch.name}`);
      }
    }

    const summary = [];
    summary.push(`**Renamed:** ${renamed}`);
    summary.push(`**Already formatted:** ${skipped}`);
    if (failed > 0) summary.push(`**Failed:** ${failed}`);
    if (log.length > 0) summary.push('', '**Changes:**', ...log.slice(0, 30));
    if (log.length > 30) summary.push(`...and ${log.length - 30} more`);

    await status.edit({ embeds: [successEmbed('Done', summary.join('\n'))] });
  },
};

async function renameChannel(ch) {
  if (!ch.manageable) return 'failed';
  const clean = stripFormatting(ch.name);
  const formatted = formatChannelName(clean);
  if (ch.name === formatted) return 'skipped';
  try {
    await ch.setName(formatted, 'Channel formatting');
    await sleep(1200);
    return 'renamed';
  } catch {
    return 'failed';
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
