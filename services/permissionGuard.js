const { PermissionFlagsBits } = require('discord.js');
const { isProtectedRole, isRoleManageable } = require('../utils/roleUtils');

const TOOL_PERMISSIONS = {
  find_role: [],
  get_roles: [],
  get_channels: [],
  get_categories: [],
  get_server_info: [],
  get_members: [],
  get_channel_permissions: [],
  audit_server: [],

  create_role: [PermissionFlagsBits.ManageRoles],
  delete_role: [PermissionFlagsBits.ManageRoles],
  rename_role: [PermissionFlagsBits.ManageRoles],
  set_role_color: [PermissionFlagsBits.ManageRoles],
  set_role_permissions: [PermissionFlagsBits.ManageRoles],
  assign_role: [PermissionFlagsBits.ManageRoles],
  remove_role: [PermissionFlagsBits.ManageRoles],

  find_channel: [],
  create_channel: [PermissionFlagsBits.ManageChannels],
  delete_channel: [PermissionFlagsBits.ManageChannels],
  rename_channel: [PermissionFlagsBits.ManageChannels],
  move_channel: [PermissionFlagsBits.ManageChannels],
  create_category: [PermissionFlagsBits.ManageChannels],
  set_channel_topic: [PermissionFlagsBits.ManageChannels],
  set_channel_slowmode: [PermissionFlagsBits.ManageChannels],
  lock_channel: [PermissionFlagsBits.ManageChannels],
  unlock_channel: [PermissionFlagsBits.ManageChannels],

  set_channel_permission: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],
  remove_channel_permission: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],
  reset_channel_permissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],
  sync_channel_permissions: [PermissionFlagsBits.ManageChannels],

  purge_messages: [PermissionFlagsBits.ManageMessages],
  timeout_member: [PermissionFlagsBits.ModerateMembers],
  kick_member: [PermissionFlagsBits.KickMembers],
  ban_member: [PermissionFlagsBits.BanMembers],

  send_announcement: [PermissionFlagsBits.ManageMessages],
  send_embed: [PermissionFlagsBits.ManageMessages],
};

function checkToolPermission(toolName, member, guild) {
  const required = TOOL_PERMISSIONS[toolName];
  if (!required) return { allowed: false, reason: `Unknown tool: ${toolName}` };

  if (required.length === 0) return { allowed: true };

  if (member.permissions.has(PermissionFlagsBits.Administrator)) return { allowed: true };

  const hasAll = required.every(perm => member.permissions.has(perm));
  if (!hasAll) {
    const missing = required
      .filter(p => !member.permissions.has(p))
      .map(p => permissionName(p))
      .join(', ');
    return { allowed: false, reason: `You need: ${missing}` };
  }

  return { allowed: true };
}

function checkBotPermissions(guild, permissions) {
  const bot = guild.members.me;
  const missing = permissions.filter(p => !bot.permissions.has(p));
  if (missing.length > 0) {
    return { allowed: false, reason: `Bot needs: ${missing.map(permissionName).join(', ')}` };
  }
  return { allowed: true };
}

function canManageRole(guild, member, role) {
  if (isProtectedRole(role)) {
    return { allowed: false, reason: `Cannot manage protected/integration role: ${role.name}` };
  }
  if (!isRoleManageable(guild, role)) {
    return { allowed: false, reason: `Role "${role.name}" is above or equal to my highest role` };
  }
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    if (role.position >= member.roles.highest.position) {
      return { allowed: false, reason: `Role "${role.name}" is above or equal to your highest role` };
    }
  }
  return { allowed: true };
}

function canModerate(guild, member, target) {
  if (target.id === guild.ownerId) {
    return { allowed: false, reason: 'Cannot moderate the server owner' };
  }
  if (target.id === guild.members.me.id) {
    return { allowed: false, reason: 'Cannot moderate myself' };
  }
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    if (target.roles.highest.position >= member.roles.highest.position) {
      return { allowed: false, reason: 'Target has equal or higher role than you' };
    }
  }
  const botHighest = guild.members.me.roles.highest;
  if (target.roles.highest.position >= botHighest.position) {
    return { allowed: false, reason: 'Target has equal or higher role than my bot role' };
  }
  return { allowed: true };
}

function permissionName(flag) {
  const names = {
    [PermissionFlagsBits.ManageRoles]: 'Manage Roles',
    [PermissionFlagsBits.ManageChannels]: 'Manage Channels',
    [PermissionFlagsBits.ManageMessages]: 'Manage Messages',
    [PermissionFlagsBits.ManageGuild]: 'Manage Server',
    [PermissionFlagsBits.ModerateMembers]: 'Moderate Members',
    [PermissionFlagsBits.KickMembers]: 'Kick Members',
    [PermissionFlagsBits.BanMembers]: 'Ban Members',
    [PermissionFlagsBits.Administrator]: 'Administrator',
  };
  return names[flag] || 'Unknown Permission';
}

module.exports = { checkToolPermission, checkBotPermissions, canManageRole, canModerate, TOOL_PERMISSIONS };
