const { PermissionFlagsBits } = require('discord.js');
const { hasPermission, sendPermissionDenied, botCanManageRoles, getBotHighestRole } = require('../utils/permissions');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'giverole',
  description: 'Give a role to all members in the server.',
  cooldown: 10,
  async execute(message, args) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageRoles)) {
      return sendPermissionDenied(message);
    }

    if (!botCanManageRoles(message.guild)) {
      return message.reply({ embeds: [errorEmbed('❌ I need the **Manage Roles** permission.')] });
    }

    const roleName = args.join(' ').trim();
    if (!roleName) {
      return message.reply({ embeds: [errorEmbed('❌ Please provide a role name or mention.\n**Usage:** `!giverole <role>`')] });
    }

    const role = message.mentions.roles.first()
      || message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase())
      || message.guild.roles.cache.get(roleName);

    if (!role) {
      return message.reply({ embeds: [errorEmbed(`❌ Role **${roleName}** not found.`)] });
    }

    const botHighest = getBotHighestRole(message.guild);
    if (role.position >= botHighest.position) {
      return message.reply({ embeds: [errorEmbed('❌ That role is higher than or equal to my highest role. I cannot assign it.')] });
    }

    if (role.managed) {
      return message.reply({ embeds: [errorEmbed('❌ That role is managed by an integration and cannot be assigned manually.')] });
    }

    const status = await message.reply({
      embeds: [successEmbed('Give Role', `⏳ Assigning **${role.name}** to all members… This may take a while.`)],
    });

    await message.guild.members.fetch();

    const members = message.guild.members.cache.filter(m => !m.user.bot && !m.roles.cache.has(role.id));
    const total = members.size;

    if (total === 0) {
      return status.edit({ embeds: [successEmbed('Give Role', `✅ All members already have **${role.name}**.`)] });
    }

    let assigned = 0;
    let failed = 0;

    for (const [, member] of members) {
      try {
        await member.roles.add(role, `Bulk assign by ${message.author.tag} via !giverole`);
        assigned++;
      } catch {
        failed++;
      }

      if (assigned % 50 === 0 && assigned > 0) {
        await status.edit({
          embeds: [successEmbed('Give Role', `⏳ Assigning **${role.name}**… **${assigned}**/${total} done.`)],
        }).catch(() => {});
      }
    }

    let description = `✅ Assigned **${role.name}** to **${assigned.toLocaleString()}** member${assigned !== 1 ? 's' : ''}.`;
    if (failed > 0) {
      description += `\n⚠️ Failed for **${failed}** member${failed !== 1 ? 's' : ''}.`;
    }

    await status.edit({ embeds: [successEmbed('Give Role Complete', description)] });
  },
};
