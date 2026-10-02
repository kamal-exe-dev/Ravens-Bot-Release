const { PermissionFlagsBits, ChannelType } = require('discord.js');
const permissionGuard = require('./permissionGuard');
const roleUtils = require('../utils/roleUtils');
const channelUtils = require('../utils/channelUtils');
const logger = require('../utils/logger');
const config = require('../config/botConfig');

// ─── Tool Definitions (Anthropic format) ────────────────────────────────

const definitions = [
  // ROLE TOOLS
  {
    name: 'find_role',
    description: 'Find a role by name and return its details.',
    input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Role name to search for' } }, required: ['name'] },
  },
  {
    name: 'create_role',
    description: 'Create a new role. Prevents duplicates automatically.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Role name' },
        color: { type: 'string', description: 'Hex color code e.g. #FF0000' },
        hoist: { type: 'boolean', description: 'Show separately in member list' },
        mentionable: { type: 'boolean', description: 'Allow anyone to mention this role' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_role',
    description: 'Delete a role by name. DESTRUCTIVE — requires confirmation.',
    input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Role name to delete' } }, required: ['name'] },
  },
  {
    name: 'rename_role',
    description: 'Rename an existing role.',
    input_schema: {
      type: 'object',
      properties: { current_name: { type: 'string' }, new_name: { type: 'string' } },
      required: ['current_name', 'new_name'],
    },
  },
  {
    name: 'set_role_color',
    description: 'Change a role color.',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' }, color: { type: 'string', description: 'Hex color e.g. #FF5733' } },
      required: ['name', 'color'],
    },
  },
  {
    name: 'assign_role',
    description: 'Assign a role to a member.',
    input_schema: {
      type: 'object',
      properties: { role_name: { type: 'string' }, user_id: { type: 'string', description: 'Discord user ID' } },
      required: ['role_name', 'user_id'],
    },
  },
  {
    name: 'remove_role',
    description: 'Remove a role from a member.',
    input_schema: {
      type: 'object',
      properties: { role_name: { type: 'string' }, user_id: { type: 'string', description: 'Discord user ID' } },
      required: ['role_name', 'user_id'],
    },
  },

  // CHANNEL TOOLS
  {
    name: 'find_channel',
    description: 'Find a channel by name.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'create_channel',
    description: 'Create a text, voice, announcement, or forum channel. Names are auto-formatted to UPPERCASE. Optionally add an emoji prefix like 「💬」・GENERAL.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Channel name (will be uppercased automatically)' },
        type: { type: 'string', enum: ['text', 'voice', 'announcement', 'forum'], description: 'Channel type' },
        category: { type: 'string', description: 'Category name to place the channel in' },
        topic: { type: 'string', description: 'Channel topic' },
        emoji: { type: 'string', description: 'Optional emoji prefix for the channel name format 「emoji」・NAME' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_channel',
    description: 'Delete a channel. DESTRUCTIVE — requires confirmation.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'rename_channel',
    description: 'Rename a channel. The new name is auto-formatted to UPPERCASE. Optionally add an emoji prefix.',
    input_schema: {
      type: 'object',
      properties: {
        current_name: { type: 'string', description: 'Current channel name' },
        new_name: { type: 'string', description: 'New channel name (will be uppercased automatically)' },
        emoji: { type: 'string', description: 'Optional emoji prefix for the channel name format 「emoji」・NAME' },
      },
      required: ['current_name', 'new_name'],
    },
  },
  {
    name: 'move_channel',
    description: 'Move a channel to a different category.',
    input_schema: {
      type: 'object',
      properties: { channel_name: { type: 'string' }, category_name: { type: 'string' } },
      required: ['channel_name', 'category_name'],
    },
  },
  {
    name: 'create_category',
    description: 'Create a channel category. Names are auto-formatted to UPPERCASE. Optionally add an emoji prefix.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Category name (will be uppercased automatically)' },
        emoji: { type: 'string', description: 'Optional emoji prefix for the category name format 「emoji」・NAME' },
      },
      required: ['name'],
    },
  },
  {
    name: 'set_channel_topic',
    description: 'Set a channel topic/description.',
    input_schema: {
      type: 'object',
      properties: { channel_name: { type: 'string' }, topic: { type: 'string' } },
      required: ['channel_name', 'topic'],
    },
  },
  {
    name: 'set_channel_slowmode',
    description: 'Set slowmode on a channel (0 to disable).',
    input_schema: {
      type: 'object',
      properties: { channel_name: { type: 'string' }, seconds: { type: 'number', description: '0-21600' } },
      required: ['channel_name', 'seconds'],
    },
  },
  {
    name: 'lock_channel',
    description: 'Lock a channel so @everyone cannot send messages.',
    input_schema: { type: 'object', properties: { channel_name: { type: 'string' } }, required: ['channel_name'] },
  },
  {
    name: 'unlock_channel',
    description: 'Unlock a channel so @everyone can send messages again.',
    input_schema: { type: 'object', properties: { channel_name: { type: 'string' } }, required: ['channel_name'] },
  },

  // PERMISSION TOOLS
  {
    name: 'get_channel_permissions',
    description: 'Get permission overwrites for a channel.',
    input_schema: { type: 'object', properties: { channel_name: { type: 'string' } }, required: ['channel_name'] },
  },
  {
    name: 'set_channel_permission',
    description: 'Set permission overwrite on a channel for a role or member.',
    input_schema: {
      type: 'object',
      properties: {
        channel_name: { type: 'string' },
        target_name: { type: 'string', description: 'Role name or user ID' },
        target_type: { type: 'string', enum: ['role', 'member'] },
        allow: { type: 'array', items: { type: 'string' }, description: 'Permission names to allow: ViewChannel, SendMessages, ManageMessages, etc.' },
        deny: { type: 'array', items: { type: 'string' }, description: 'Permission names to deny' },
      },
      required: ['channel_name', 'target_name', 'target_type'],
    },
  },
  {
    name: 'remove_channel_permission',
    description: 'Remove a permission overwrite from a channel.',
    input_schema: {
      type: 'object',
      properties: { channel_name: { type: 'string' }, target_name: { type: 'string', description: 'Role name or user ID' } },
      required: ['channel_name', 'target_name'],
    },
  },
  {
    name: 'sync_channel_permissions',
    description: 'Sync a channel permissions with its parent category.',
    input_schema: { type: 'object', properties: { channel_name: { type: 'string' } }, required: ['channel_name'] },
  },
  {
    name: 'reset_channel_permissions',
    description: 'Remove ALL permission overwrites from a channel. DESTRUCTIVE.',
    input_schema: { type: 'object', properties: { channel_name: { type: 'string' } }, required: ['channel_name'] },
  },

  // SERVER TOOLS
  {
    name: 'get_server_info',
    description: 'Get general server information.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_roles',
    description: 'List all server roles with member counts.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_channels',
    description: 'List all channels organized by category.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_categories',
    description: 'List all channel categories.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'audit_server',
    description: 'Audit server for issues: duplicate roles, dangerous permissions, empty roles, permission inconsistencies.',
    input_schema: { type: 'object', properties: {} },
  },

  // MODERATION TOOLS
  {
    name: 'purge_messages',
    description: 'Delete messages from a channel. DESTRUCTIVE.',
    input_schema: {
      type: 'object',
      properties: {
        channel_name: { type: 'string' },
        count: { type: 'number', description: 'Number of messages to delete (1-100)' },
      },
      required: ['channel_name', 'count'],
    },
  },
  {
    name: 'timeout_member',
    description: 'Timeout/mute a member for a duration.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        duration_minutes: { type: 'number', description: 'Timeout duration in minutes' },
        reason: { type: 'string' },
      },
      required: ['user_id', 'duration_minutes'],
    },
  },
  {
    name: 'kick_member',
    description: 'Kick a member from the server. DESTRUCTIVE.',
    input_schema: {
      type: 'object',
      properties: { user_id: { type: 'string' }, reason: { type: 'string' } },
      required: ['user_id'],
    },
  },
  {
    name: 'ban_member',
    description: 'Ban a member from the server. DESTRUCTIVE.',
    input_schema: {
      type: 'object',
      properties: { user_id: { type: 'string' }, reason: { type: 'string' } },
      required: ['user_id'],
    },
  },

  // COMMUNICATION TOOLS
  {
    name: 'send_announcement',
    description: 'Send a formatted announcement embed to a channel.',
    input_schema: {
      type: 'object',
      properties: {
        channel_name: { type: 'string' },
        title: { type: 'string' },
        message: { type: 'string' },
        color: { type: 'string', description: 'Hex color' },
      },
      required: ['channel_name', 'title', 'message'],
    },
  },
  {
    name: 'send_embed',
    description: 'Send a custom embed to a channel.',
    input_schema: {
      type: 'object',
      properties: {
        channel_name: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        color: { type: 'string' },
        fields: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' }, inline: { type: 'boolean' } }, required: ['name', 'value'] } },
      },
      required: ['channel_name', 'description'],
    },
  },
];

// ─── Permission Flag Mapping ────────────────────────────────────────────

const PERM_FLAGS = {
  ViewChannel: PermissionFlagsBits.ViewChannel,
  SendMessages: PermissionFlagsBits.SendMessages,
  ManageMessages: PermissionFlagsBits.ManageMessages,
  ManageChannels: PermissionFlagsBits.ManageChannels,
  ManageRoles: PermissionFlagsBits.ManageRoles,
  EmbedLinks: PermissionFlagsBits.EmbedLinks,
  AttachFiles: PermissionFlagsBits.AttachFiles,
  ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
  AddReactions: PermissionFlagsBits.AddReactions,
  Connect: PermissionFlagsBits.Connect,
  Speak: PermissionFlagsBits.Speak,
  MuteMembers: PermissionFlagsBits.MuteMembers,
  DeafenMembers: PermissionFlagsBits.DeafenMembers,
  MoveMembers: PermissionFlagsBits.MoveMembers,
  MentionEveryone: PermissionFlagsBits.MentionEveryone,
  CreatePublicThreads: PermissionFlagsBits.CreatePublicThreads,
  CreatePrivateThreads: PermissionFlagsBits.CreatePrivateThreads,
  UseExternalEmojis: PermissionFlagsBits.UseExternalEmojis,
  SendMessagesInThreads: PermissionFlagsBits.SendMessagesInThreads,
  Administrator: PermissionFlagsBits.Administrator,
};

function resolvePermFlags(names) {
  if (!names || !Array.isArray(names)) return 0n;
  let bits = 0n;
  for (const name of names) {
    if (PERM_FLAGS[name]) bits |= PERM_FLAGS[name];
  }
  return bits;
}

// ─── Tool Executors ─────────────────────────────────────────────────────

const executors = {
  // ── Role Tools ──

  async find_role(input, guild) {
    await guild.roles.fetch();
    const role = roleUtils.findRole(guild, input.name);
    if (!role) return { success: false, error: `Role "${input.name}" not found` };
    return {
      success: true, role: {
        name: role.name, id: role.id, color: role.hexColor,
        position: role.position, members: role.members.size,
        managed: role.managed, mentionable: role.mentionable, hoist: role.hoist,
      },
    };
  },

  async create_role(input, guild, member) {
    const result = await roleUtils.createRole(guild, input.name, {
      color: input.color, hoist: input.hoist, mentionable: input.mentionable,
      reason: `AI request by ${member.user.tag}`,
    });
    if (!result.created) {
      return { success: false, error: `Role "${result.role.name}" already exists`, role_id: result.role.id };
    }
    return { success: true, action: 'create_role', role_name: result.role.name, role_id: result.role.id };
  },

  async delete_role(input, guild, member) {
    await guild.roles.fetch();
    const role = roleUtils.findRole(guild, input.name);
    if (!role) return { success: false, error: `Role "${input.name}" not found` };
    const check = permissionGuard.canManageRole(guild, member, role);
    if (!check.allowed) return { success: false, error: check.reason };
    await role.delete(`AI request by ${member.user.tag}`);
    return { success: true, action: 'delete_role', role_name: input.name };
  },

  async rename_role(input, guild, member) {
    await guild.roles.fetch();
    const role = roleUtils.findRole(guild, input.current_name);
    if (!role) return { success: false, error: `Role "${input.current_name}" not found` };
    const check = permissionGuard.canManageRole(guild, member, role);
    if (!check.allowed) return { success: false, error: check.reason };
    const dup = roleUtils.findRole(guild, input.new_name);
    if (dup && dup.id !== role.id) return { success: false, error: `Role "${input.new_name}" already exists` };
    const prev = role.name;
    await role.setName(roleUtils.normalizeRoleName(input.new_name), `AI request by ${member.user.tag}`);
    return { success: true, action: 'rename_role', previous: prev, new_name: role.name };
  },

  async set_role_color(input, guild, member) {
    await guild.roles.fetch();
    const role = roleUtils.findRole(guild, input.name);
    if (!role) return { success: false, error: `Role "${input.name}" not found` };
    const check = permissionGuard.canManageRole(guild, member, role);
    if (!check.allowed) return { success: false, error: check.reason };
    await role.setColor(input.color, `AI request by ${member.user.tag}`);
    return { success: true, action: 'set_role_color', role_name: role.name, color: input.color };
  },

  async assign_role(input, guild, member) {
    await guild.roles.fetch();
    const role = roleUtils.findRole(guild, input.role_name);
    if (!role) return { success: false, error: `Role "${input.role_name}" not found` };
    const check = permissionGuard.canManageRole(guild, member, role);
    if (!check.allowed) return { success: false, error: check.reason };
    let target;
    try { target = await guild.members.fetch(input.user_id); } catch {
      return { success: false, error: `Member ${input.user_id} not found` };
    }
    if (target.roles.cache.has(role.id)) return { success: true, note: `${target.user.tag} already has ${role.name}` };
    await target.roles.add(role, `AI request by ${member.user.tag}`);
    return { success: true, action: 'assign_role', role_name: role.name, user: target.user.tag };
  },

  async remove_role(input, guild, member) {
    await guild.roles.fetch();
    const role = roleUtils.findRole(guild, input.role_name);
    if (!role) return { success: false, error: `Role "${input.role_name}" not found` };
    const check = permissionGuard.canManageRole(guild, member, role);
    if (!check.allowed) return { success: false, error: check.reason };
    let target;
    try { target = await guild.members.fetch(input.user_id); } catch {
      return { success: false, error: `Member ${input.user_id} not found` };
    }
    if (!target.roles.cache.has(role.id)) return { success: true, note: `${target.user.tag} doesn't have ${role.name}` };
    await target.roles.remove(role, `AI request by ${member.user.tag}`);
    return { success: true, action: 'remove_role', role_name: role.name, user: target.user.tag };
  },

  // ── Channel Tools ──

  async find_channel(input, guild) {
    const ch = channelUtils.findChannel(guild, input.name);
    if (!ch) return { success: false, error: `Channel "${input.name}" not found` };
    return {
      success: true, channel: {
        name: ch.name, id: ch.id, type: ch.type, topic: ch.topic,
        parent: ch.parent?.name || null, position: ch.position, nsfw: ch.nsfw,
      },
    };
  },

  async create_channel(input, guild, member) {
    const existing = channelUtils.findChannel(guild, input.name);
    if (existing && existing.type !== ChannelType.GuildCategory) {
      return { success: false, error: `Channel "${input.name}" already exists` };
    }
    const ch = await channelUtils.createChannel(guild, input.name, {
      type: input.type || 'text',
      parent: input.category,
      topic: input.topic,
      emoji: input.emoji,
      reason: `AI request by ${member.user.tag}`,
    });
    return { success: true, action: 'create_channel', channel_name: ch.name, channel_id: ch.id, type: input.type || 'text' };
  },

  async delete_channel(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.name);
    if (!ch) return { success: false, error: `Channel "${input.name}" not found` };
    if (!ch.deletable) return { success: false, error: `Channel "${ch.name}" cannot be deleted` };
    const name = ch.name;
    await ch.delete(`AI request by ${member.user.tag}`);
    return { success: true, action: 'delete_channel', channel_name: name };
  },

  async rename_channel(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.current_name);
    if (!ch) return { success: false, error: `Channel "${input.current_name}" not found` };
    const prev = ch.name;
    const formatted = channelUtils.formatChannelName(input.new_name, { emoji: input.emoji });
    await ch.setName(formatted, `AI request by ${member.user.tag}`);
    return { success: true, action: 'rename_channel', previous: prev, new_name: ch.name };
  },

  async move_channel(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    const cat = channelUtils.findCategory(guild, input.category_name);
    if (!cat) return { success: false, error: `Category "${input.category_name}" not found` };
    await ch.setParent(cat.id, { reason: `AI request by ${member.user.tag}` });
    return { success: true, action: 'move_channel', channel_name: ch.name, category: cat.name };
  },

  async create_category(input, guild, member) {
    const existing = channelUtils.findCategory(guild, input.name);
    if (existing) return { success: false, error: `Category "${input.name}" already exists`, category_id: existing.id };
    const formatted = channelUtils.formatChannelName(input.name, { emoji: input.emoji });
    const cat = await guild.channels.create({
      name: formatted,
      type: ChannelType.GuildCategory,
      reason: `AI request by ${member.user.tag}`,
    });
    return { success: true, action: 'create_category', category_name: cat.name, category_id: cat.id };
  },

  async set_channel_topic(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    await ch.setTopic(input.topic, `AI request by ${member.user.tag}`);
    return { success: true, action: 'set_channel_topic', channel_name: ch.name, topic: input.topic };
  },

  async set_channel_slowmode(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    const secs = Math.min(Math.max(0, input.seconds), 21600);
    await ch.setRateLimitPerUser(secs, `AI request by ${member.user.tag}`);
    return { success: true, action: 'set_channel_slowmode', channel_name: ch.name, seconds: secs };
  },

  async lock_channel(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    await ch.permissionOverwrites.edit(guild.id, { SendMessages: false }, { reason: `AI lock by ${member.user.tag}` });
    return { success: true, action: 'lock_channel', channel_name: ch.name };
  },

  async unlock_channel(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    await ch.permissionOverwrites.edit(guild.id, { SendMessages: null }, { reason: `AI unlock by ${member.user.tag}` });
    return { success: true, action: 'unlock_channel', channel_name: ch.name };
  },

  // ── Permission Tools ──

  async get_channel_permissions(input, guild) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    const overwrites = ch.permissionOverwrites.cache.map(ow => {
      const target = ow.type === 0
        ? guild.roles.cache.get(ow.id)?.name || ow.id
        : guild.members.cache.get(ow.id)?.user.tag || ow.id;
      return {
        target, type: ow.type === 0 ? 'role' : 'member',
        allow: ow.allow.toArray(), deny: ow.deny.toArray(),
      };
    });
    return { success: true, channel: ch.name, permissions: overwrites };
  },

  async set_channel_permission(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };

    let targetId;
    if (input.target_type === 'role') {
      if (input.target_name.toLowerCase() === '@everyone' || input.target_name.toLowerCase() === 'everyone') {
        targetId = guild.id;
      } else {
        const role = roleUtils.findRole(guild, input.target_name);
        if (!role) return { success: false, error: `Role "${input.target_name}" not found` };
        targetId = role.id;
      }
    } else {
      try { const m = await guild.members.fetch(input.target_name); targetId = m.id; } catch {
        return { success: false, error: `Member "${input.target_name}" not found` };
      }
    }

    const overwrites = {};
    if (input.allow) for (const p of input.allow) { if (PERM_FLAGS[p]) overwrites[p] = true; }
    if (input.deny) for (const p of input.deny) { if (PERM_FLAGS[p]) overwrites[p] = false; }

    await ch.permissionOverwrites.edit(targetId, overwrites, { reason: `AI request by ${member.user.tag}` });
    return { success: true, action: 'set_channel_permission', channel: ch.name, target: input.target_name, allow: input.allow || [], deny: input.deny || [] };
  },

  async remove_channel_permission(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    let targetId;
    const role = roleUtils.findRole(guild, input.target_name);
    if (role) targetId = role.id;
    else targetId = input.target_name;
    const ow = ch.permissionOverwrites.cache.get(targetId);
    if (!ow) return { success: false, error: 'No permission overwrite found for that target' };
    await ow.delete(`AI request by ${member.user.tag}`);
    return { success: true, action: 'remove_channel_permission', channel: ch.name, target: input.target_name };
  },

  async sync_channel_permissions(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    if (!ch.parent) return { success: false, error: 'Channel is not in a category' };
    await ch.lockPermissions();
    return { success: true, action: 'sync_channel_permissions', channel: ch.name, category: ch.parent.name };
  },

  async reset_channel_permissions(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    for (const [, ow] of ch.permissionOverwrites.cache) {
      await ow.delete(`AI reset by ${member.user.tag}`);
    }
    return { success: true, action: 'reset_channel_permissions', channel: ch.name };
  },

  // ── Server Tools ──

  async get_server_info(input, guild) {
    return {
      success: true,
      server: {
        name: guild.name, id: guild.id, memberCount: guild.memberCount,
        owner: guild.ownerId, boostLevel: guild.premiumTier,
        roleCount: guild.roles.cache.size, channelCount: guild.channels.cache.size,
        createdAt: guild.createdAt.toISOString(),
      },
    };
  },

  async get_roles(input, guild) {
    await guild.roles.fetch();
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => ({ name: r.name, id: r.id, color: r.hexColor, members: r.members.size, managed: r.managed, position: r.position }));
    return { success: true, roles, total: roles.length };
  },

  async get_channels(input, guild) {
    const categories = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position)
      .map(c => ({
        name: c.name, id: c.id,
        channels: guild.channels.cache
          .filter(ch => ch.parentId === c.id)
          .sort((a, b) => a.position - b.position)
          .map(ch => ({ name: ch.name, id: ch.id, type: ch.type })),
      }));
    const uncategorized = guild.channels.cache
      .filter(c => !c.parentId && c.type !== ChannelType.GuildCategory)
      .map(c => ({ name: c.name, id: c.id, type: c.type }));
    return { success: true, categories, uncategorized };
  },

  async get_categories(input, guild) {
    const cats = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position)
      .map(c => ({ name: c.name, id: c.id, childCount: guild.channels.cache.filter(ch => ch.parentId === c.id).size }));
    return { success: true, categories: cats };
  },

  async audit_server(input, guild) {
    await guild.roles.fetch();
    const issues = [];
    const good = [];

    // Check duplicate roles
    const roleNames = {};
    guild.roles.cache.forEach(r => {
      const key = r.name.toLowerCase();
      if (!roleNames[key]) roleNames[key] = [];
      roleNames[key].push(r.name);
    });
    const dupes = Object.entries(roleNames).filter(([, v]) => v.length > 1);
    if (dupes.length > 0) issues.push({ type: 'warning', area: 'Roles', detail: `Duplicate roles: ${dupes.map(([k]) => k).join(', ')}` });
    else good.push({ area: 'Roles', detail: 'No duplicate roles' });

    // Check empty roles
    const emptyRoles = guild.roles.cache.filter(r => r.id !== guild.id && !r.managed && r.members.size === 0);
    if (emptyRoles.size > 0) issues.push({ type: 'warning', area: 'Roles', detail: `${emptyRoles.size} empty role(s): ${emptyRoles.map(r => r.name).join(', ')}` });

    // Check dangerous permissions
    guild.roles.cache.forEach(r => {
      if (r.id === guild.id || r.managed) return;
      if (r.permissions.has(PermissionFlagsBits.Administrator)) {
        issues.push({ type: 'warning', area: 'Roles', detail: `"${r.name}" has Administrator permission` });
      }
    });

    // Check bot permissions
    const bot = guild.members.me;
    const botPerms = ['ManageRoles', 'ManageChannels', 'ManageMessages'];
    for (const p of botPerms) {
      if (bot.permissions.has(PermissionFlagsBits[p])) good.push({ area: 'Bot', detail: p });
      else issues.push({ type: 'error', area: 'Bot', detail: `Missing ${p}` });
    }

    return { success: true, issues, good, summary: { totalRoles: guild.roles.cache.size, totalChannels: guild.channels.cache.size, totalMembers: guild.memberCount } };
  },

  // ── Moderation Tools ──

  async purge_messages(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    const count = Math.min(Math.max(1, input.count), 100);
    const deleted = await ch.bulkDelete(count, true);
    return { success: true, action: 'purge_messages', channel: ch.name, deleted: deleted.size };
  },

  async timeout_member(input, guild, member) {
    let target;
    try { target = await guild.members.fetch(input.user_id); } catch {
      return { success: false, error: `Member ${input.user_id} not found` };
    }
    const check = permissionGuard.canModerate(guild, member, target);
    if (!check.allowed) return { success: false, error: check.reason };
    const ms = input.duration_minutes * 60 * 1000;
    await target.timeout(ms, input.reason || `AI request by ${member.user.tag}`);
    return { success: true, action: 'timeout_member', user: target.user.tag, duration_minutes: input.duration_minutes };
  },

  async kick_member(input, guild, member) {
    let target;
    try { target = await guild.members.fetch(input.user_id); } catch {
      return { success: false, error: `Member ${input.user_id} not found` };
    }
    const check = permissionGuard.canModerate(guild, member, target);
    if (!check.allowed) return { success: false, error: check.reason };
    await target.kick(input.reason || `AI request by ${member.user.tag}`);
    return { success: true, action: 'kick_member', user: target.user.tag };
  },

  async ban_member(input, guild, member) {
    let target;
    try { target = await guild.members.fetch(input.user_id); } catch {
      return { success: false, error: `Member ${input.user_id} not found` };
    }
    const check = permissionGuard.canModerate(guild, member, target);
    if (!check.allowed) return { success: false, error: check.reason };
    await guild.members.ban(target, { reason: input.reason || `AI request by ${member.user.tag}` });
    return { success: true, action: 'ban_member', user: target.user.tag };
  },

  // ── Communication Tools ──

  async send_announcement(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor(input.color ? parseInt(input.color.replace('#', ''), 16) : 0x5865F2)
      .setTitle(`📢 ${input.title}`)
      .setDescription(input.message)
      .setFooter({ text: `Kamal.exe • Requested by ${member.user.tag}` })
      .setTimestamp();
    await ch.send({ embeds: [embed] });
    return { success: true, action: 'send_announcement', channel: ch.name, title: input.title };
  },

  async send_embed(input, guild, member) {
    const ch = channelUtils.findChannel(guild, input.channel_name);
    if (!ch) return { success: false, error: `Channel "${input.channel_name}" not found` };
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor(input.color ? parseInt(input.color.replace('#', ''), 16) : 0x5865F2)
      .setDescription(input.description)
      .setTimestamp();
    if (input.title) embed.setTitle(input.title);
    if (input.fields) embed.addFields(input.fields);
    await ch.send({ embeds: [embed] });
    return { success: true, action: 'send_embed', channel: ch.name };
  },
};

// ─── Main Executor ──────────────────────────────────────────────────────

async function executeTool(name, input, guild, member, options = {}) {
  const executor = executors[name];
  if (!executor) return logAndReturn(guild, member, name, input, { success: false, error: `Unknown tool: ${name}` });

  const permCheck = permissionGuard.checkToolPermission(name, member, guild);
  if (!permCheck.allowed) return logAndReturn(guild, member, name, input, { success: false, error: permCheck.reason });

  if (config.destructiveTools.has(name) && !options.confirmed) {
    return logAndReturn(guild, member, name, input, { success: false, needs_confirmation: true, action: name, description: `${name}: ${JSON.stringify(input)}` });
  }

  const botPerms = permissionGuard.TOOL_PERMISSIONS[name];
  if (botPerms && botPerms.length > 0) {
    const botCheck = permissionGuard.checkBotPermissions(guild, botPerms);
    if (!botCheck.allowed) return logAndReturn(guild, member, name, input, { success: false, error: botCheck.reason });
  }

  try {
    const result = await executor(input, guild, member);
    return logAndReturn(guild, member, name, input, result);
  } catch (err) {
    console.error(`Tool ${name} error:`, err.message);
    return logAndReturn(guild, member, name, input, { success: false, error: `Failed to execute ${name}: ${err.message}` });
  }
}

async function logAndReturn(guild, member, action, input, result) {
  const record = logger.createAuditRecord({
    user: member?.user?.tag,
    action,
    input,
    result,
  });
  await logger.logAction(guild, record).catch(() => {});
  return result;
}

module.exports = { definitions, executeTool };
