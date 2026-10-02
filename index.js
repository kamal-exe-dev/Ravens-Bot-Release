require('dotenv').config();

const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

const PREFIX = process.env.PREFIX || '!';

client.commands = new Collection();
client.cooldowns = new Collection();

// Load commands once at startup
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.name, command);
}

// Load interaction handlers once at startup
const interactionHandlers = {};
const handlersPath = path.join(__dirname, 'interactions');
if (fs.existsSync(handlersPath)) {
  const handlerFiles = fs.readdirSync(handlersPath).filter(f => f.endsWith('.js'));
  for (const file of handlerFiles) {
    const handler = require(path.join(handlersPath, file));
    if (handler.customIds && handler.execute) {
      for (const id of handler.customIds) {
        interactionHandlers[id] = handler;
      }
    }
  }
}

console.log(`Loaded ${client.commands.size} command(s): ${[...client.commands.keys()].join(', ')}`);

// Deduplication — prevent processing the same message/interaction twice
const processedMessages = new Set();
const processedInteractions = new Set();
const DEDUP_TTL = 10_000;

function markProcessed(set, id) {
  set.add(id);
  setTimeout(() => set.delete(id), DEDUP_TTL);
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} guild(s)`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;
  if (processedMessages.has(message.id)) return;
  markProcessed(processedMessages, message.id);

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  const cooldownKey = `${command.name}-${message.author.id}`;
  const cooldownAmount = (command.cooldown || 3) * 1000;
  const now = Date.now();

  if (client.cooldowns.has(cooldownKey)) {
    const expiresAt = client.cooldowns.get(cooldownKey);
    if (now < expiresAt) {
      const remaining = ((expiresAt - now) / 1000).toFixed(1);
      return message.reply(`Please wait **${remaining}s** before using \`${PREFIX}${command.name}\` again.`).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 3000);
      });
    }
  }

  client.cooldowns.set(cooldownKey, now + cooldownAmount);
  setTimeout(() => client.cooldowns.delete(cooldownKey), cooldownAmount);

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error(`Error executing ${command.name}:`, err);
    message.reply('❌ An unexpected error occurred while executing that command.').catch(() => {});
  }
});

client.on('interactionCreate', async (interaction) => {
  const customId = interaction.customId || '';
  if (!customId) return;

  const dedupKey = `${customId}-${interaction.user.id}-${interaction.message?.id || ''}`;
  if (processedInteractions.has(dedupKey)) return;
  markProcessed(processedInteractions, dedupKey);

  const handlerKey = Object.keys(interactionHandlers).find(key => customId === key || customId.startsWith(key));

  if (handlerKey) {
    try {
      await interactionHandlers[handlerKey].execute(interaction);
    } catch (err) {
      console.error(`Interaction error (${customId}):`, err);
      const reply = { content: '❌ Something went wrong.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  }
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

client.login(process.env.DISCORD_TOKEN);
