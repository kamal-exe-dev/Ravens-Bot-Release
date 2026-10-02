function build(guild) {
  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map(r => ({
      name: r.name,
      id: r.id,
      color: r.hexColor,
      position: r.position,
      members: r.members.size,
      managed: r.managed,
    }));

  const categories = guild.channels.cache
    .filter(c => c.type === 4)
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      name: c.name,
      id: c.id,
      children: guild.channels.cache
        .filter(ch => ch.parentId === c.id)
        .sort((a, b) => a.position - b.position)
        .map(ch => ({ name: ch.name, id: ch.id, type: channelTypeName(ch.type) })),
    }));

  const uncategorized = guild.channels.cache
    .filter(c => !c.parentId && c.type !== 4)
    .map(c => ({ name: c.name, id: c.id, type: channelTypeName(c.type) }));

  return {
    name: guild.name,
    memberCount: guild.memberCount,
    boostLevel: guild.premiumTier,
    roles,
    categories,
    uncategorized,
    botHighestRole: guild.members.me.roles.highest.name,
    botPermissions: guild.members.me.permissions.toArray(),
  };
}

function buildSystemPrompt(context) {
  return `You are Kamal.exe, an AI-powered Discord server management assistant for a FiveM RP community.

SERVER CONTEXT:
- Server: ${context.name}
- Members: ${context.memberCount}
- Bot highest role: ${context.botHighestRole}

EXISTING ROLES (${context.roles.length}):
${context.roles.map(r => `- ${r.name} (${r.members} members${r.managed ? ', managed' : ''})`).join('\n')}

SERVER STRUCTURE:
${context.categories.map(c => `${c.name}/\n${c.children.map(ch => `  └ ${ch.name} (${ch.type})`).join('\n')}`).join('\n')}
${context.uncategorized.length > 0 ? `Uncategorized:\n${context.uncategorized.map(c => `  - ${c.name} (${c.type})`).join('\n')}` : ''}

RULES — FOLLOW STRICTLY:
1. NEVER bypass Discord permissions or role hierarchy.
2. For DESTRUCTIVE or LARGE-SCALE actions (deleting roles/channels, mass changes, server setup), FIRST present a detailed plan and ask the user to confirm. Do NOT execute destructive tools until confirmed.
3. Prevent duplicate roles: normalize names (trim, collapse whitespace, case-insensitive compare).
4. Never modify @everyone, managed/integration roles, or roles above the bot.
5. Always use the tools provided. Never claim to do something without calling the tool.
6. Use read-only tools (get_roles, get_channels, get_server_info, audit_server) freely to inspect before acting.
7. For channel and category names, use UPPERCASE-WITH-HYPHENS.
8. Respond concisely and professionally. Suitable for a FiveM RP community.
9. Do not expose technical errors. Give clear, human-friendly explanations.
10. When creating multiple items, create them one by one using individual tool calls.
11. When the user says "setup my server", inspect what exists, propose a structure, and WAIT for confirmation.
12. Maximum ${context.roles.length > 0 ? 'check existing roles/channels before creating to avoid duplicates' : 'you may create freely as the server is empty'}.`;
}

function channelTypeName(type) {
  const names = { 0: 'text', 2: 'voice', 4: 'category', 5: 'announcement', 13: 'stage', 15: 'forum' };
  return names[type] || 'text';
}

module.exports = { build, buildSystemPrompt };
