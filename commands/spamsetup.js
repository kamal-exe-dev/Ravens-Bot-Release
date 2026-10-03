const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const {
  hasPermission,
  sendPermissionDenied
} = require('../utils/permissions');

const {
  errorEmbed
} = require('../utils/embeds');

const CONFIG_DIR = path.join(__dirname, '../config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'spamTrap.json');

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return { channels: {} };
    }

    const data = JSON.parse(
      fs.readFileSync(CONFIG_FILE, 'utf8')
    );

    if (!data || typeof data !== 'object') {
      return { channels: {} };
    }

    if (!data.channels || typeof data.channels !== 'object') {
      data.channels = {};
    }

    return data;
  } catch (error) {
    console.error(
      '[SPAM TRAP] Failed to read config:',
      error.message
    );

    return { channels: {} };
  }
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(config, null, 2),
    'utf8'
  );
}

module.exports = {
  name: 'spamsetup',

  description: 'Configure the current channel as a Spam Trap.',

  cooldown: 30,

  async execute(message) {

    // Administrator only
    if (
      !hasPermission(
        message.member,
        PermissionFlagsBits.Administrator
      )
    ) {
      return sendPermissionDenied(message);
    }

    if (!message.guild) {
      return message.reply({
        embeds: [
          errorEmbed(
            '❌ This command can only be used inside a server.'
          )
        ]
      });
    }

    const channel = message.channel;

    // Spam Trap must be a text channel
    if (!channel.isTextBased()) {
      return message.reply({
        embeds: [
          errorEmbed(
            '❌ Please run `!spamsetup` inside a text channel.'
          )
        ]
      });
    }

    const botMember = message.guild.members.me;

    // Check bot permission
    if (
      !botMember?.permissionsIn(channel).has(
        PermissionFlagsBits.SendMessages
      )
    ) {
      return message.reply({
        embeds: [
          errorEmbed(
            '❌ I need **Send Messages** permission in this channel.'
          )
        ]
      });
    }

    try {

      const config = loadConfig();

      // Save Spam Trap configuration
      config.channels[channel.id] = {
        enabled: true,
        guildId: message.guild.id,
        channelId: channel.id,
        configuredBy: message.author.id,
        configuredAt: new Date().toISOString()
      };

      saveConfig(config);

      // Delete !spamsetup command
      await message.delete().catch(() => {});

      // Spam Trap warning embed
      const embed = new EmbedBuilder()
        .setColor(0xED4245)

        .setTitle('🛡️ SPAM TRAP NOTICE')

        .setDescription(
          '⚠️ **Do Not Spam This Channel!**\n\n' +

          'If you accidentally get caught by the **Spam Trap**, ' +
          'please contact the **Server Admins or Management Team** ' +
          'for assistance.\n\n' +

          '📨 Please do not spam or repeatedly send messages in the channel.\n\n' +

          '🙏 Thank you for your cooperation.'
        )

        .addFields({
          name: '⚠️ Spam Trap Rules',

          value:
            '• Normal members who send a message will be **kicked**.\n' +
            '• Images and attachments are also detected.\n' +
            '• Admins/Moderators receive a **2-hour timeout** instead.\n' +
            '• Server owner and bots are protected from punishment.'
        })

        .setFooter({
          text: 'Ravens Bot • Spam Protection'
        })

        .setTimestamp();

      await channel.send({
        content: '@everyone',

        embeds: [embed],

        allowedMentions: {
          parse: ['everyone']
        }
      });

      console.log(
        `[SPAM TRAP] Enabled #${channel.name} (${channel.id}) ` +
        `in ${message.guild.name}`
      );

    } catch (error) {

      console.error(
        '[SPAM TRAP] Setup error:',
        error
      );

      await channel.send({
        embeds: [
          errorEmbed(
            '❌ Failed to configure the Spam Trap. ' +
            'Check the bot permissions and try again.'
          )
        ]
      }).catch(() => {});
    }
  }
};