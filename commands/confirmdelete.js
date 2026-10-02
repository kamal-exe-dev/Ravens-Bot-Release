const { PermissionFlagsBits } = require('discord.js');
const { hasPermission, sendPermissionDenied, botCanManageRoles } = require('../utils/permissions');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { getPendingDeletions } = require('./deleteroles');

module.exports = {
  name: 'confirmdelete',
  description: 'Confirm the deletion of roles initiated by !deleteroles.',
  cooldown: 0,
  async execute(message) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator)) {
      return sendPermissionDenied(message);
    }

    const pendingDeletions = getPendingDeletions();
    const pending = pendingDeletions.get(message.guild.id);

    if (!pending) {
      return message.reply({ embeds: [errorEmbed('❌ There is no pending role deletion to confirm. Use `!deleteroles` first.')] });
    }

    if (pending.userId !== message.author.id) {
      return message.reply({ embeds: [errorEmbed('❌ Only the user who initiated the deletion can confirm it.')] });
    }

    pendingDeletions.delete(message.guild.id);

    if (!botCanManageRoles(message.guild)) {
      return message.reply({ embeds: [errorEmbed('❌ I need the **Manage Roles** permission to delete roles.')] });
    }

    const botMember = message.guild.members.me;
    const botHighestRole = botMember.roles.highest;
    const botRoleId = botMember.roles.botRole?.id;

    const deleted = [];
    const skipped = [];
    const failed = [];

    const roles = message.guild.roles.cache
      .filter(r => r.id !== message.guild.id)
      .sort((a, b) => a.position - b.position);

    for (const [, role] of roles) {
      if (role.id === message.guild.id) {
        skipped.push('@everyone');
        continue;
      }

      if (role.managed) {
        skipped.push(`${role.name} (integration)`);
        continue;
      }

      if (role.position >= botHighestRole.position) {
        skipped.push(`${role.name} (higher/equal)`);
        continue;
      }

      if (role.id === botRoleId) {
        skipped.push(`${role.name} (bot role)`);
        continue;
      }

      try {
        await role.delete(`Bulk deletion by ${message.author.tag} via !deleteroles`);
        deleted.push(role.name);
      } catch (err) {
        console.error(`Failed to delete role "${role.name}":`, err.message);
        failed.push(role.name);
      }
    }

    skipped.push('@everyone');

    const deletedList = deleted.length > 0 ? deleted.map(r => `• ${r}`).join('\n') : '• None';
    const skippedList = skipped.length > 0 ? skipped.map(r => `• ${r}`).join('\n') : '• None';
    const failedList = failed.length > 0 ? failed.map(r => `• ${r}`).join('\n') : '• None';

    const description = [
      '**Deleted:**',
      deletedList.length > 800 ? deletedList.slice(0, 800) + '\n• ...' : deletedList,
      '',
      '**Skipped:**',
      skippedList.length > 800 ? skippedList.slice(0, 800) + '\n• ...' : skippedList,
      '',
      '**Failed:**',
      failedList,
      '',
      `**Total Deleted:** ${deleted.length}`,
      `**Total Skipped:** ${skipped.length}`,
    ].join('\n');

    const embed = successEmbed('Role Deletion Complete', description);
    if (failed.length > 0) embed.setColor(0xFEE75C);

    return message.reply({ embeds: [embed] });
  },
};
