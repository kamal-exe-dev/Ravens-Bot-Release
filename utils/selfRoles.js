function getManageableRoles(roles, botHighestPosition) {
  return roles.filter(role => !role.managed && role.position < botHighestPosition);
}

function getRoleChanges(configuredRoleIds, currentRoleIds, selectedRoleIds) {
  const currentIds = new Set(currentRoleIds);
  const selectedIds = new Set(selectedRoleIds);
  return {
    add: configuredRoleIds.filter(roleId => selectedIds.has(roleId) && !currentIds.has(roleId)),
    remove: configuredRoleIds.filter(roleId => !selectedIds.has(roleId) && currentIds.has(roleId)),
  };
}

module.exports = { getManageableRoles, getRoleChanges };
