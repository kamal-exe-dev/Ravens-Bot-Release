const assert = require('node:assert/strict');
const test = require('node:test');

const { getManageableRoles, getRoleChanges } = require('../utils/selfRoles');

test('getManageableRoles excludes managed and unmanageable roles from a self-role menu', () => {
  const roles = [
    { id: 'pubg', name: 'PUBG', managed: false, position: 2 },
    { id: 'bot', name: 'Bot', managed: false, position: 10 },
    { id: 'linked', name: 'Linked', managed: true, position: 1 },
  ];

  assert.deepEqual(getManageableRoles(roles, 10).map(role => role.id), ['pubg']);
});

test('getRoleChanges synchronizes only roles configured in the self-role menu', () => {
  const changes = getRoleChanges(['pubg', 'valorant'], new Set(['pubg']), new Set(['valorant']));

  assert.deepEqual(changes, { add: ['valorant'], remove: ['pubg'] });
});

test('getRoleChanges accepts role identifiers from a Discord collection iterator', () => {
  const roleCache = new Map([['pubg', { id: 'pubg' }]]);
  const changes = getRoleChanges(['pubg', 'valorant'], roleCache.keys(), new Set(['valorant']));

  assert.deepEqual(changes, { add: ['valorant'], remove: ['pubg'] });
});
