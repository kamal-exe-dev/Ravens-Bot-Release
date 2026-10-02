const { EmbedBuilder } = require('discord.js');
const { hasPermission, sendPermissionDenied } = require('../utils/permissions');
const { PermissionFlagsBits } = require('discord.js');
const claudeService = require('../services/claudeService');
const confirmationManager = require('../services/confirmationManager');
const config = require('../config/botConfig');

const activeRequests = new Set();

module.exports = {
  name: 'ai',
  description: 'AI-powered server management assistant.',
  cooldown: config.ai.cooldown,
  async execute(message, args) {
    if (!hasPermission(message.member, PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels)) {
      return sendPermissionDenied(message);
    }

    if (!process.env.GEMINI_API_KEY) {
      return message.reply({
        embeds: [errorEmbed('❌ AI is not configured. Set `GEMINI_API_KEY` in your .env file.')],
      });
    }

    const prompt = args.join(' ').trim();
    if (!prompt) {
      return message.reply({
        embeds: [helpEmbed()],
      });
    }

    if (activeRequests.has(message.author.id)) {
      return message.reply({
        embeds: [errorEmbed('⏳ You already have an AI request in progress. Please wait.')],
      });
    }

    activeRequests.add(message.author.id);

    const thinking = await message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x5865F2)
        .setDescription('🤖 Processing your request...')],
    });

    try {
      const result = await claudeService.processRequest(prompt, message.guild, message.member);

      if (result.needsConfirmation) {
        await thinking.edit({
          embeds: [new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('📋 Proposed Plan')
            .setDescription(truncate(result.text, 4000))
            .setFooter({ text: 'Review the plan above' })
            .setTimestamp()],
        });

        const confirmed = await confirmationManager.request(
          message.channel,
          message.author.id,
          'Proceed with the actions described above?',
        );

        if (confirmed) {
          const progress = await message.channel.send({
            embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription('🤖 Executing approved plan...')],
          });

          try {
            const finalResult = await claudeService.continueAfterConfirmation(
              result.messages, message.guild, message.member,
            );

            await progress.edit({
              embeds: [formatResponse(finalResult.text, finalResult.actionLog)],
            });
          } catch (err) {
            console.error('AI execution error:', err);
            await progress.edit({ embeds: [errorEmbed('❌ An error occurred while executing the plan.')] });
          }
        } else {
          await message.channel.send({
            embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Plan cancelled.')],
          });
        }
      } else {
        await thinking.edit({
          embeds: [formatResponse(result.text, result.actionLog)],
        });
      }
    } catch (err) {
      console.error('AI request error:', err);
      const status = err.status || err.httpStatusCode;
      const errMsg = status === 401
        ? '❌ Invalid API key. Check your `GEMINI_API_KEY`.'
        : status === 429
          ? '❌ Rate limited. Please try again in a moment.'
          : status === 503
            ? '❌ AI service is temporarily overloaded. Please try again in a few seconds.'
            : `❌ Something went wrong. ${err.message?.slice(0, 100) || ''}`;
      await thinking.edit({ embeds: [errorEmbed(errMsg)] });
    } finally {
      activeRequests.delete(message.author.id);
    }
  },
};

function formatResponse(text, actionLog) {
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setDescription(truncate(text, 4000))
    .setFooter({ text: `Kamal.exe AI • ${actionLog.length} action(s) performed` })
    .setTimestamp();

  if (actionLog.length > 0) {
    const summary = actionLog
      .filter(a => a.result.success)
      .map(a => `✅ ${a.tool}`)
      .join('\n');
    if (summary) {
      embed.addFields({ name: 'Actions', value: truncate(summary, 1024) });
    }
  }

  return embed;
}

function errorEmbed(description) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(description);
}

function helpEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🤖 Kamal.exe AI Assistant')
    .setDescription('Natural language server management.\n\n**Usage:** `!ai <request>`')
    .addFields(
      { name: 'Roles', value: '`!ai create a Streamer role`\n`!ai give @user the VIP role`', inline: true },
      { name: 'Channels', value: '`!ai create a staff category with channels`\n`!ai lock announcements`', inline: true },
      { name: 'Permissions', value: '`!ai make staff-chat private`\n`!ai only Founder can see admin-chat`', inline: true },
      { name: 'Server', value: '`!ai setup my server`\n`!ai audit server`\n`!ai fix permissions`', inline: true },
      { name: 'Moderation', value: '`!ai timeout @user 10 minutes`\n`!ai purge 50 messages`', inline: true },
      { name: 'Announcements', value: '`!ai announce server maintenance tonight`', inline: true },
    )
    .setFooter({ text: 'Powered by Claude AI' });
}

function truncate(str, max) {
  if (!str) return 'Done.';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}
