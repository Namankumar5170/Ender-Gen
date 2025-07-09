// ✅ FINAL DISCORDGENBOT for CYCLIC
const express = require('express');
const app = express();
app.get('/', (_, res) => res.send('✅ Bot is alive!'));
app.listen(3000, () => console.log('✅ Express web server running on port 3000'));

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const FREE_CHANNEL = '1389236703411306597';
const PREMIUM_CHANNEL = '1389231737342787634';
const FREE_ROLE = 'supporter';
const PREMIUM_ROLE = 'premium user';
const COOLDOWN_TIME = 5 * 60 * 1000; // 5 minutes
const cooldowns = new Map();

client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

function readStock(tier, service) {
  const path = `./${tier}/${service}.txt`;
  if (!fs.existsSync(path)) return null;
  const lines = fs.readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  return lines;
}

function writeStock(tier, service, accounts) {
  const path = `./${tier}/${service}.txt`;
  fs.writeFileSync(path, accounts.join('\n'), 'utf-8');
}

client.on('messageCreate', async message => {
  if (!message.content.startsWith('!') || message.author.bot) return;

  const [cmd, ...args] = message.content.slice(1).split(' ');
  const userID = message.author.id;

  const isPremium = message.channel.id === PREMIUM_CHANNEL;
  const isFree = message.channel.id === FREE_CHANNEL;
  const tier = isPremium ? 'premium' : isFree ? 'free' : null;

  const neededRole = isPremium ? PREMIUM_ROLE : isFree ? FREE_ROLE : null;
  const memberRoles = message.member.roles.cache.map(r => r.name.toLowerCase());

  // Channel restriction
  if (!tier) return message.reply('❌ Use this command in a generator channel.');

  // Role restriction
  if (!memberRoles.includes(neededRole.toLowerCase()))
    return message.reply(`❌ You need the "${neededRole}" role to use this command.`);

  // Cooldown check
  if (userID !== process.env.OWNER_ID && cooldowns.has(userID)) {
    const left = cooldowns.get(userID) - Date.now();
    if (left > 0) {
      return message.reply(`⏳ Wait ${Math.ceil(left / 1000)}s before using again.`);
    }
  }

  if (cmd === 'fgen' || cmd === 'pgen') {
    const service = args[0];
    if (!service) return message.reply('❌ Provide a service name.');

    const stock = readStock(tier, service);
    if (!stock || stock.length === 0) return message.reply('❌ Out of stock!');

    const account = stock.shift();
    writeStock(tier, service, stock);
    if (userID !== process.env.OWNER_ID) cooldowns.set(userID, Date.now() + COOLDOWN_TIME);

    try {
      await message.author.send(`🎁 Your ${service} account:\n\`\`\`${account}\`\`\``);
      message.reply('✅ Check your DMs!');
    } catch {
      message.reply('❌ I can\'t DM you. Open your DMs!');
    }
  }

  if (cmd === 'addstock') {
    if (userID !== process.env.OWNER_ID) return;

    const [targetTier, service, ...accLines] = args;
    if (!['free', 'premium'].includes(targetTier)) return message.reply('❌ Use free or premium.');
    if (!service || accLines.length === 0) return message.reply('❌ Provide a service and accounts.');

    const accounts = accLines.join(' ').split('\\n').map(a => a.trim()).filter(Boolean);
    const current = readStock(targetTier, service) || [];
    writeStock(targetTier, service, [...current, ...accounts]);
    message.reply(`✅ Added ${accounts.length} accounts to ${targetTier}/${service}.`);
  }

  if (cmd === 'stock') {
    let msg = '📦 **Current Stock:**\n\n';
    ['free', 'premium'].forEach(tier => {
      msg += `**${tier.toUpperCase()}**\n`;
      const dir = `./${tier}/`;
      if (fs.existsSync(dir)) {
        const services = fs.readdirSync(dir).filter(f => f.endsWith('.txt'));
        if (services.length === 0) {
          msg += '> No services.\n';
        } else {
          for (const file of services) {
            const name = file.replace('.txt', '');
            const count = readStock(tier, name)?.length || 0;
            msg += `> ${name}: ${count} accounts\n`;
          }
        }
      } else {
        msg += '> No folder found.\n';
      }
      msg += '\n';
    });
    message.reply(msg);
  }

  if (cmd === 'help') {
    message.reply(`📖 **Help Menu**
\`\`\`
!fgen [service]    - Generate Free account
!pgen [service]    - Generate Premium account
!stock             - View stock
!addstock [tier] [service] [acc1\\nacc2]  (owner only)
\`\`\``);
  }
});

client.login(process.env.TOKEN);
