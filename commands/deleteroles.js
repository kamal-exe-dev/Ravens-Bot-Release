const { PermissionFlagsBits } = require('discord.js');
const { hasPermission, sendPermissionDenied, botCanManageRoles } = require('../utils/permissions');
const { warningEmbed, errorEmbed } = require('../utils/embeds');

const pendingDeletions = new Map();

function getPendingDeletions() {
  return pendingDeletions;
}

module.exports = {
  name: 'deleteroles',
  description: 'Delete all removable roles managed by the bot.',
  cooldown: 10,
  async execute(message) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator)) {
      return sendPermissionDenied(message);
    }

    if (!botCanManageRoles(message.guild)) {
      return message.reply({ embeds: [errorEmbed('❌ I need the **Manage Roles** permission to delete roles.')] });
    }

    if (pendingDeletions.has(message.guild.id)) {
      return message.reply({ embeds: [errorEmbed('❌ A deletion confirmation is already pending. Please wait for it to expire or confirm it.')] });
    }

    const botHighestRole = message.guild.members.me.roles.highest;
    const deletableRoles = message.guild.roles.cache.filter(role =>
      role.id !== message.guild.id &&
      !role.managed &&
      role.position < botHighestRole.position &&
      role.id !== message.guild.members.me.roles.botRole?.id
    );

    if (deletableRoles.size === 0) {
      return message.reply({ embeds: [errorEmbed('❌ There are no roles I can delete.')] });
    }

    pendingDeletions.set(message.guild.id, {
      userId: message.author.id,
      channelId: message.channel.id,
      timestamp: Date.now(),
    });

    setTimeout(() => {
      if (pendingDeletions.has(message.guild.id)) {
        pendingDeletions.delete(message.guild.id);
        message.channel.send({ embeds: [errorEmbed('⏰ Role deletion confirmation has expired.')] }).catch(() => {});
      }
    }, 30_000);

    const roleList = deletableRoles.map(r => `• ${r.name}`).join('\n');
    const description = [
      'This action will delete **all removable roles** managed by this bot.',
      '',
      `**Roles to be deleted (${deletableRoles.size}):**`,
      roleList.length > 1900 ? roleList.slice(0, 1900) + '\n• ...' : roleList,
      '',
      '⚠️ **This action cannot be undone.**',
      '',
      'Type `!confirmdelete` within **30 seconds** to continue.',
    ].join('\n');

    return message.reply({ embeds: [warningEmbed('⚠️ Role Deletion Confirmation', description)] });
  },
  getPendingDeletions,
};
