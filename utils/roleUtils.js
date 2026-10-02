function normalizeRoleName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

function findRole(guild, name) {
  const normalized = normalizeRoleName(name).toLowerCase();
  return guild.roles.cache.find(r => r.name.toLowerCase() === normalized);
}

function isProtectedRole(role) {
  return role.managed || role.id === role.guild.id;
}

function isRoleManageable(guild, role) {
  const botHighest = guild.members.me.roles.highest;
  return role.position < botHighest.position && !isProtectedRole(role);
}

async function createRole(guild, name, options = {}) {
  const normalized = normalizeRoleName(name);
  await guild.roles.fetch();
  const existing = findRole(guild, normalized);
  if (existing) return { created: false, role: existing, reason: 'already_exists' };

  const role = await guild.roles.create({
    name: normalized,
    color: options.color || undefined,
    hoist: options.hoist ?? false,
    mentionable: options.mentionable ?? false,
    permissions: options.permissions || [],
    reason: options.reason || 'Created via bot',
  });

  return { created: true, role };
}

module.exports = { normalizeRoleName, findRole, isProtectedRole, isRoleManageable, createRole };
