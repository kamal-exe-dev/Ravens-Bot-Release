const { PermissionFlagsBits } = require('discord.js');
const { hasPermission, sendPermissionDenied } = require('../utils/permissions');
const { successEmbed, errorEmbed } = require('../utils/embeds');

const MAX_PURGE = 100;
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
const INDIVIDUAL_DELETE_DELAY = 1200;

module.exports = {
  name: 'purge',
  description: 'Delete messages from the current channel.',
  cooldown: 5,
  async execute(message, args) {
    if (!hasPermission(message.member, PermissionFlagsBits.ManageMessages)) {
      return sendPermissionDenied(message);
    }

    const botMember = message.guild.members.me;
    if (!botMember.permissionsIn(message.channel).has(PermissionFlagsBits.ManageMessages)) {
      return message.reply({ embeds: [errorEmbed('❌ I need the **Manage Messages** permission in this channel.')] });
    }

    if (args[0] === 'all') {
      return this.purgeAll(message);
    }

    const amount = parseInt(args[0], 10);

    if (!args[0] || isNaN(amount)) {
      return message.reply({ embeds: [errorEmbed('❌ Please provide a valid number.\n**Usage:** `!purge <1-100>` or `!purge all`')] });
    }

    if (amount < 1 || amount > MAX_PURGE) {
      return message.reply({ embeds: [errorEmbed(`❌ Amount must be between **1** and **${MAX_PURGE}**.`)] });
    }

    try {
      await message.delete().catch(() => {});

      const fetched = await message.channel.messages.fetch({ limit: amount });
      const now = Date.now();

      const deletable = fetched.filter(msg => (now - msg.createdTimestamp) < FOURTEEN_DAYS);
      const tooOld = fetched.size - deletable.size;

      const deleted = await message.channel.bulkDelete(deletable, true);

      let description = `🧹 Successfully deleted **${deleted.size}** message${deleted.size !== 1 ? 's' : ''}.`;
      if (tooOld > 0) {
        description += `\n⚠️ Skipped **${tooOld}** message${tooOld !== 1 ? 's' : ''} older than 14 days.`;
      }

      const confirmation = await message.channel.send({ embeds: [successEmbed('Purge Complete', description)] });
      setTimeout(() => confirmation.delete().catch(() => {}), 5000);
    } catch (err) {
      console.error('Purge error:', err.message);
      if (err.code === 50034) {
        return message.channel.send({ embeds: [errorEmbed('❌ Cannot delete messages older than **14 days**.')] });
      }
      return message.channel.send({ embeds: [errorEmbed('❌ An error occurred while deleting messages.')] });
    }
  },

  async purgeAll(message) {
    const channel = message.channel;

    await message.delete().catch(() => {});

    const status = await channel.send({
      embeds: [successEmbed('Purge All', '🧹 Deleting all messages… This may take a while.')],
    });

    const botMessageIds = new Set([status.id]);
    let totalDeleted = 0;
    let totalSkipped = 0;

    try {
      const pinnedMessages = await channel.messages.fetchPinned();
      const pinnedIds = new Set(pinnedMessages.map(m => m.id));

      let lastId;

      while (true) {
        const fetchOptions = { limit: 100 };
        if (lastId) fetchOptions.before = lastId;

        const fetched = await channel.messages.fetch(fetchOptions);
        if (fetched.size === 0) break;

        lastId = fetched.last().id;

        const targets = fetched.filter(m => !pinnedIds.has(m.id) && !botMessageIds.has(m.id));

        if (targets.size === 0) {
          if (fetched.size < 100) break;
          totalSkipped += fetched.size;
          continue;
        }

        const now = Date.now();
        const recent = targets.filter(m => (now - m.createdTimestamp) < FOURTEEN_DAYS);
        const old = targets.filter(m => (now - m.createdTimestamp) >= FOURTEEN_DAYS);

        if (recent.size >= 2) {
          const deleted = await channel.bulkDelete(recent, true);
          totalDeleted += deleted.size;
          totalSkipped += recent.size - deleted.size;
        } else if (recent.size === 1) {
          try {
            await recent.first().delete();
            totalDeleted++;
          } catch {
            totalSkipped++;
          }
        }

        for (const [, msg] of old) {
          try {
            await msg.delete();
            totalDeleted++;
          } catch {
            totalSkipped++;
          }
          await new Promise(r => setTimeout(r, INDIVIDUAL_DELETE_DELAY));
        }

        if (totalDeleted % 200 < 100) {
          await status.edit({
            embeds: [successEmbed('Purge All', `🧹 Deleting… **${totalDeleted.toLocaleString()}** messages removed so far.`)],
          }).catch(() => {});
        }

        if (fetched.size < 100) break;
      }

      const skippedNote = totalSkipped > 0
        ? `\n**Messages Skipped:** ${totalSkipped.toLocaleString()}\n**Reason:** Older than Discord deletion limits / protected messages`
        : '';

      await status.edit({
        embeds: [successEmbed(
          '🧹 Channel Purge Complete',
          `**Messages Deleted:** ${totalDeleted.toLocaleString()}${skippedNote}`,
        )],
      });
      setTimeout(() => status.delete().catch(() => {}), 10000);
    } catch (err) {
      console.error('Purge all error:', err.message);
      await status.edit({ embeds: [errorEmbed('❌ An error occurred during the purge. Some messages may have been deleted.')] }).catch(() => {});
      setTimeout(() => status.delete().catch(() => {}), 10000);
    }
  },
};
