const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const logger = require('../utils/logger');
const serverContext = require('../services/serverContext');
const { definitions } = require('../services/discordTools');

test('audit records identify a failed action without retaining sensitive request content', () => {
  const record = logger.createAuditRecord({
    user: 'admin#0001',
    action: 'send_announcement',
    input: { channel_name: 'STAFF', message: 'private personnel update' },
    result: { success: false, error: 'Channel not found' },
  });

  assert.deepEqual(record, {
    user: 'admin#0001',
    action: 'send_announcement',
    target: 'Channel: STAFF',
    success: false,
    outcome: 'Failed',
  });
});

test('audit records distinguish confirmation requests from failed actions', () => {
  const record = logger.createAuditRecord({
    user: 'admin#0001',
    action: 'delete_channel',
    input: { channel_name: 'GENERAL' },
    result: { success: false, needs_confirmation: true },
  });

  assert.equal(record.outcome, 'Awaiting confirmation');
});

test('AI server context omits guild identifiers and uses the configured uppercase channel convention', () => {
  const prompt = serverContext.buildSystemPrompt({
    name: 'Example Guild',
    id: 'guild-secret-id',
    owner: 'owner-secret-id',
    memberCount: 4,
    roles: [],
    categories: [],
    uncategorized: [],
    botHighestRole: 'Bot',
    botPermissions: [],
  });

  assert.doesNotMatch(prompt, /guild-secret-id|owner-secret-id/i);
  assert.match(prompt, /UPPERCASE-WITH-HYPHENS/);
  assert.doesNotMatch(prompt, /lowercase with hyphens/i);
});

test('AI tools do not expose bulk member listings', () => {
  assert.equal(definitions.some(tool => tool.name === 'get_members'), false);
});

test('release archive excludes dependencies and macOS metadata', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'discord-bot-release-'));
  const source = path.join(fixtureRoot, 'source');
  const output = path.join(fixtureRoot, 'output');
  fs.mkdirSync(path.join(source, 'node_modules', 'dependency'), { recursive: true });
  fs.mkdirSync(path.join(source, '__MACOSX'), { recursive: true });
  fs.mkdirSync(path.join(source, 'commands'), { recursive: true });
  fs.writeFileSync(path.join(source, 'index.js'), 'console.log("bot");');
  fs.writeFileSync(path.join(source, '.DS_Store'), 'metadata');
  fs.writeFileSync(path.join(source, 'node_modules', 'dependency', 'index.js'), 'dependency');
  fs.writeFileSync(path.join(source, '__MACOSX', 'metadata'), 'metadata');
  fs.writeFileSync(path.join(source, 'commands', 'ping.js'), 'module.exports = {};');

  try {
    execFileSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
      path.join(__dirname, '..', 'scripts', 'create-release.ps1'),
      '-SourceDirectory', source,
      '-OutputDirectory', output,
      '-ArchiveName', 'fixture.zip',
    ], { stdio: 'pipe' });

    const archivePath = path.join(output, 'fixture.zip').replace(/'/g, "''");
    const entries = execFileSync('powershell', [
      '-NoProfile', '-Command',
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::OpenRead('${archivePath}').Entries.FullName`,
    ], { encoding: 'utf8' });

    assert.match(entries, /index\.js/);
    assert.match(entries, /commands\/ping\.js/);
    assert.doesNotMatch(entries, /node_modules|__MACOSX|\.DS_Store/i);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
