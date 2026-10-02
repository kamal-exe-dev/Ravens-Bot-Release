const { PermissionFlagsBits } = require('discord.js');
const { hasPermission, sendPermissionDenied, botCanManageRoles } = require('../utils/permissions');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'createrolecolor',
  description: 'Create roles with custom colors. Format: !createrolecolor RoleName #HexColor, RoleName2 #HexColor2',
  cooldown: 5,
  async execute(message, args) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageRoles)) {
      return sendPermissionDenied(message);
    }

    if (!botCanManageRoles(message.guild)) {
      return message.reply({ embeds: [errorEmbed('❌ I need the **Manage Roles** permission to create roles.')] });
    }

    const input = message.content.slice(message.content.indexOf('createrolecolor') + 'createrolecolor'.length).trim();
    if (!input) {
      return message.reply({
        embeds: [errorEmbed(
          '❌ Please provide role names with colors.\n' +
          '**Usage:** `!createrolecolor RoleName #HexColor, RoleName2 #HexColor2`\n' +
          '**Example:** `!createrolecolor PUBG #E74C3C, VALORANT #FF4654, MINECRAFT #57F287`'
        )]
      });
    }

    await message.guild.roles.fetch();
    const existingRoleNames = new Set(
      message.guild.roles.cache.map(r => r.name.toLowerCase())
    );

    const roleEntries = input.split(',').map(entry => entry.trim()).filter(e => e);
    const created = [];
    const alreadyExists = [];
    const failed = [];

    for (const entry of roleEntries) {
      // Parse "RoleName #HexColor" or just "RoleName"
      const match = entry.match(/^(.+?)\s+(#[0-9A-Fa-f]{6})$/);

      let roleName, color;
      if (match) {
        roleName = match[1].trim();
        color = parseInt(match[2].slice(1), 16);
      } else {
        roleName = entry.trim();
        color = 0x99AAB5; // Default Discord gray
      }

      const key = roleName.toLowerCase();

      if (existingRoleNames.has(key)) {
        alreadyExists.push(roleName);
        continue;
      }

      try {
        await message.guild.roles.create({
          name: roleName,
          color: color,
          mentionable: true,
          permissions: [],
          reason: `Created by ${message.author.tag} via !createrolecolor`,
        });
        created.push({ name: roleName, color: color });
        existingRoleNames.add(key);
      } catch (err) {
        console.error(`Failed to create role "${roleName}":`, err.message);
        failed.push(roleName);
      }
    }

    const lines = [];

    if (created.length > 0) {
      lines.push('**✅ Created:**');
      created.forEach(r => {
        const hexColor = `#${r.color.toString(16).padStart(6, '0').toUpperCase()}`;
        lines.push(`• ${r.name} - ${hexColor}`);
      });
    } else {
      lines.push('**Created:** None');
    }

    if (alreadyExists.length > 0) {
      lines.push('', '**⏭️ Already Exists:**');
      alreadyExists.forEach(r => lines.push(`• ${r}`));
    }

    if (failed.length > 0) {
      lines.push('', '**❌ Failed:**');
      failed.forEach(r => lines.push(`• ${r}`));
    }

    lines.push('', `**Total Created:** ${created.length} | **Existing:** ${alreadyExists.length}`);

    const embed = created.length > 0 ? successEmbed('Role Creation Complete', lines.join('\n')) : errorEmbed(lines.join('\n'));
    if (failed.length > 0) embed.setColor(0xFEE75C);

    return message.reply({ embeds: [embed] });
  },
};
