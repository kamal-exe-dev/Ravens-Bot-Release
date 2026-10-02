const { EmbedBuilder } = require('discord.js');
const config = require('../config/botConfig');

async function findLogChannel(guild) {
  return guild.channels.cache.find(c => c.name === config.logChannelName)
    || guild.channels.cache.find(c => c.name.includes('bot-log'));
}

function createAuditRecord({ user, action, input = {}, result = {} }) {
  const awaitingConfirmation = result.needs_confirmation === true;
  return {
    user: user || 'Unknown',
    action: action || 'Unknown',
    target: summarizeTarget(input),
    success: result.success === true,
    outcome: result.success === true ? 'Success' : awaitingConfirmation ? 'Awaiting confirmation' : 'Failed',
  };
}

function summarizeTarget(input) {
  if (input.channel_name) return `Channel: ${input.channel_name}`;
  if (input.current_name) return `Channel: ${input.current_name}`;
  if (input.role_name) return `Role: ${input.role_name}`;
  if (input.name) return `Name: ${input.name}`;
  if (input.user_id) return `Member ID: ${input.user_id}`;
  return undefined;
}

async function logAction(guild, { user, action, target, success, outcome }) {
  const channel = await findLogChannel(guild);
  if (!channel) return;

  const color = success ? 0x57F287 : outcome === 'Awaiting confirmation' ? 0xFEE75C : 0xED4245;
  const status = success ? '✅ Success' : outcome === 'Awaiting confirmation' ? '⏳ Awaiting confirmation' : '❌ Failed';

  const fields = [
    { name: 'User', value: user || 'Unknown', inline: true },
    { name: 'Action', value: action || 'Unknown', inline: true },
    { name: 'Status', value: status, inline: true },
  ];

  if (target) fields.push({ name: 'Target', value: truncate(target, 256), inline: true });
  if (outcome) fields.push({ name: 'Outcome', value: outcome, inline: true });

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('📜 AI Action Log')
    .addFields(fields)
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

module.exports = { createAuditRecord, logAction, findLogChannel };
