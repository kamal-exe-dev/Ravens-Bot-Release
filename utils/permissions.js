const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function hasPermission(member, ...permissions) {
  return permissions.some(perm => member.permissions.has(perm));
}

function sendPermissionDenied(message) {
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setDescription("❌ You don't have permission to use this command.");
  return message.reply({ embeds: [embed] });
}

function botCanManageRoles(guild) {
  return guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles);
}

function getBotHighestRole(guild) {
  return guild.members.me.roles.highest;
}

module.exports = {
  hasPermission,
  sendPermissionDenied,
  botCanManageRoles,
  getBotHighestRole,
};
