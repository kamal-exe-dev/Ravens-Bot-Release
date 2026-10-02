const { PermissionFlagsBits } = require('discord.js');
const { hasPermission, sendPermissionDenied } = require('../utils/permissions');
const { successEmbed, errorEmbed } = require('../utils/embeds');

async function executeChannelLock(message, args, locked) {
  if (!hasPermission(message.member, PermissionFlagsBits.ManageChannels)) {
    return sendPermissionDenied(message);
  }

  const targetType = (args[0] || 'chat').toLowerCase();
  if (targetType !== 'chat' && targetType !== 'vc') {
    return message.reply({ embeds: [errorEmbed('❌ Usage: `!lock [chat|vc]` or `!unlock [chat|vc]`.')] });
  }

  const channel = targetType === 'vc' ? message.member.voice.channel : message.channel;
  if (!channel) {
    return message.reply({ embeds: [errorEmbed('❌ Join a voice channel first, then use `!lock vc` or `!unlock vc`.')] });
  }

  const isVoice = channel.isVoiceBased();
  const permissions = isVoice
    ? { Connect: locked ? false : null }
    : { SendMessages: locked ? false : null };
  const botPermissions = message.guild.members.me.permissionsIn(channel);
  if (!botPermissions.has(PermissionFlagsBits.ManageChannels)) {
    return message.reply({ embeds: [errorEmbed('❌ I need **Manage Channels** permission in the target channel.')] });
  }

  try {
    await channel.permissionOverwrites.edit(message.guild.id, permissions, {
      reason: `${locked ? 'Lock' : 'Unlock'} requested by ${message.author.tag}`,
    });
    const label = isVoice ? 'voice channel' : 'chat';
    return message.reply({ embeds: [successEmbed(
      `Channel ${locked ? 'Locked' : 'Unlocked'}`,
      `${locked ? '🔒' : '🔓'} ${locked ? 'Locked' : 'Unlocked'} **${channel.name}** ${label}.`,
    )] });
  } catch (error) {
    return message.reply({ embeds: [errorEmbed(`❌ Could not ${locked ? 'lock' : 'unlock'} this channel. Check the bot's channel permissions.`)] });
  }
}

module.exports = executeChannelLock;
