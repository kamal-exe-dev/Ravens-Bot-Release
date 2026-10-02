const { PermissionFlagsBits } = require('discord.js');
const { hasPermission, sendPermissionDenied, botCanManageRoles, getBotHighestRole } = require('../utils/permissions');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'createrole',
  description: 'Create multiple Discord roles from a comma-separated list.',
  cooldown: 5,
  async execute(message, args) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageRoles)) {
      return sendPermissionDenied(message);
    }

    if (!botCanManageRoles(message.guild)) {
      return message.reply({ embeds: [errorEmbed('❌ I need the **Manage Roles** permission to create roles.')] });
    }

    const input = message.content.slice(message.content.indexOf('createrole') + 'createrole'.length);
    if (!input.trim()) {
      return message.reply({ embeds: [errorEmbed('❌ Please provide role names separated by commas or newlines.\n**Usage:** `!createrole Role1, Role2, Role3`')] });
    }

    const normalize = (name) => name.trim().replace(/\s+/g, ' ');

    const roleNames = input
      .split(/[,\n]/)
      .map(normalize)
      .filter(name => name.length > 0);

    if (roleNames.length === 0) {
      return message.reply({ embeds: [errorEmbed('❌ No valid role names provided.')] });
    }

    await message.guild.roles.fetch();

    const existingRoleNames = new Set(
      message.guild.roles.cache.map(r => r.name.toLowerCase())
    );

    const seen = new Set();
    const created = [];
    const alreadyExists = [];
    const duplicateInCmd = [];
    const failed = [];

    for (const roleName of roleNames) {
      const key = roleName.toLowerCase();

      if (seen.has(key)) {
        duplicateInCmd.push(roleName);
        continue;
      }
      seen.add(key);

      if (existingRoleNames.has(key)) {
        alreadyExists.push(roleName);
        continue;
      }

      try {
        await message.guild.roles.create({
          name: roleName,
          mentionable: false,
          permissions: [],
          reason: `Created by ${message.author.tag} via !createrole`,
        });
        created.push(roleName);
        existingRoleNames.add(key);
      } catch (err) {
        console.error(`Failed to create role "${roleName}":`, err.message);
        failed.push(roleName);
      }
    }

    const allExisting = [...alreadyExists, ...duplicateInCmd];
    const createdList = created.length > 0 ? created.map(r => `• ${r}`).join('\n') : '• None';
    const existsList = allExisting.length > 0 ? allExisting.map(r => `• ${r}`).join('\n') : '• None';
    const failedList = failed.length > 0 ? failed.map(r => `• ${r}`).join('\n') : '• None';

    const sections = [
      '**Created:**',
      createdList,
      '',
      '**Already Exists:**',
      existsList,
    ];

    if (failed.length > 0) {
      sections.push('', '**Failed:**', failedList);
    }

    sections.push(
      '',
      `**Total Created:** ${created.length}`,
      `**Total Existing:** ${allExisting.length}`,
    );

    const description = sections.join('\n');

    const embed = successEmbed('Role Creation Complete', description);
    if (failed.length > 0) embed.setColor(0xFEE75C);

    return message.reply({ embeds: [embed] });
  },
};
