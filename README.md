# Discord Role Management Bot

A FiveM community Discord bot for role management, announcements, and moderation — built with Discord.js v14.

## Setup

### 1. Install dependencies

```bash
cd discord-bot
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and add your bot token:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_TOKEN=your_actual_bot_token_here
PREFIX=!
```

### 3. Create the bot on Discord

1. Go to https://discord.com/developers/applications
2. Click **New Application** and give it a name.
3. Go to the **Bot** tab and click **Reset Token** to get your bot token.
4. Under **Privileged Gateway Intents**, enable:
   - **Server Members Intent**
   - **Message Content Intent**
5. Go to the **OAuth2 → URL Generator** tab.
6. Select scopes: **bot**
7. Select bot permissions:
   - Manage Roles
   - Manage Messages
   - Send Messages
   - Embed Links
   - Read Message History
   - View Channels
8. Copy the generated URL and open it in your browser to invite the bot.

> **Important:** After inviting the bot, drag the bot's role **above** any roles you want it to manage in Server Settings → Roles.

### 4. Start the bot

```bash
npm start
```

## Commands

| Command | Permission | Description |
|---------|-----------|-------------|
| `!createrole <roles>` | Administrator or Manage Roles | Create roles from a comma-separated list |
| `!deleteroles` | Administrator | Delete all removable roles (with confirmation) |
| `!confirmdelete` | The user who ran `!deleteroles` | Confirm the role deletion |
| `!purge <amount>` | Manage Messages | Delete 1–100 messages from the channel |
| `!ann <message>` | Administrator or Manage Server | Post a formatted announcement embed |
| `!selfroles` | Administrator | Open a menu to publish a multi-role self-role picker |

## Required Bot Permissions

- Manage Roles
- Manage Messages
- Send Messages
- Embed Links
- Read Message History
- View Channels

## Required Gateway Intents

- Guilds
- GuildMessages
- MessageContent (privileged)
- GuildMembers (privileged)

## Project Structure

```
discord-bot/
├── commands/
│   ├── ann.js
│   ├── confirmdelete.js
│   ├── createrole.js
│   ├── deleteroles.js
│   └── purge.js
├── utils/
│   ├── embeds.js
│   └── permissions.js
├── index.js
├── package.json
├── .env
├── .env.example
└── .gitignore
```
