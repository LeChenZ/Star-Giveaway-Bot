const { Client, Intents, MessageEmbed } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');
const mongoose = require('mongoose');

const config = require('./config.json');
const Giveaway = require('./models/Giveaway');

const client = new Client({ 
    intents: [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
      Intents.FLAGS.GUILD_MESSAGES,
    ]
});

mongoose.connect(config.mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

function selectWinners(participants, numWinners) {
  const winners = [];
  for(let i = 0; i < numWinners; i++){
    winners.push(participants[Math.floor(Math.random() * participants.length)]);
  }
  return winners;
}

function formatTime(date) {
    const now = new Date();
    const endsAt = new Date(date);
    const duration = endsAt - now;
    const seconds = Math.floor(duration / 1000) % 60;
    const minutes = Math.floor(duration / 1000 / 60) % 60;
    const hours = Math.floor(duration / 1000 / 60 / 60) % 24;
    const days = Math.floor(duration / 1000 / 60 / 60 / 24);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

const commands = [
  new SlashCommandBuilder()
    .setName('gcreate')
    .setDescription('Crée un nouveau Giveaway.')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Le salon ou ce déroulera le giveaway.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Le nom que vous voulez.')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('La durée en minutes.')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('winners')
        .setDescription('Le nombre de gagants.')
        .setRequired(true)
    )
];

const rest = new REST({ version: '9' }).setToken(config.token);

(async () => {
  try {
    console.log('Démarrage du rafraîchissement des commandes de l\'application (/).');

    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands.map(command => command.toJSON()) },
    );

    console.log('Les commandes de l\'application (/) ont été rechargées avec succès.');
  } catch (error) {
    console.error(error);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'gcreate') {
    const channel = interaction.options.getChannel('channel');
    const item = interaction.options.getString('item');
    const duration = interaction.options.getInteger('duration');
    const winners = interaction.options.getInteger('winners');

    const giveaway = new Giveaway({
      _id: interaction.id,
      channel: channel.id,
      message: null,  
      item,
      endsAt: new Date(Date.now() + duration * 60 * 1000),
      winners,
      participants: [],
    });

    const embed = new MessageEmbed()
  .setTitle(item)
  .setDescription(`Réagissez avec 🎉 pour participer !\nTemps restant : <t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>\nWinner(s) : ${winners}`)
  .setTimestamp(giveaway.endsAt)
  .setColor('BLUE');
const message = await channel.send({ embeds: [embed] });
giveaway.message = message.id;
await message.react('🎉');
await giveaway.save();

    try {
      await interaction.user.send('Le **Giveaway** a été créer avec succès !');
    } catch (error) {
      console.error(`Je n'ai pas réussi à envoyer un dm à ${interaction.user.tag}:`, error);
    }

    const interval = setInterval(async () => {
      const now = new Date();
      if (now >= giveaway.endsAt) {
        clearInterval(interval);
        const reaction = message.reactions.cache.get('🎉');
        const users = await reaction.users.fetch();
        const participants = users.filter(user => !user.bot).map(user => user.id);
    
        if (participants.length === 0) {
          await channel.send('Malheureusement, il n\'y a eu aucun participants !');
        } else {
          const winners = selectWinners(participants, giveaway.winners);
          await channel.send(`Le gagnant du giveaway est <@${winners.join(', ')}>. Félicitations !`);
        }
    
        await Giveaway.deleteOne({ _id: giveaway._id });
      } else {
      }
    }, 5000);
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.emoji.name !== '🎉') return;
  if (user.bot) return;

  const giveaway = await Giveaway.findById(reaction.message.id);
  if (!giveaway) return;
  
  giveaway.participants.push(user.id);
  await giveaway.save();
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (reaction.emoji.name !== '🎉') return;
  if (user.bot) return;

  const giveaway = await Giveaway.findById(reaction.message.id);
  if (!giveaway) return;

  giveaway.participants = giveaway.participants.filter(participant => participant !== user.id);
  await giveaway.save();
});

client.once('ready', () => {
  console.log(`Connecter en tant que ${client.user.tag}`);
  console.log(`
    _____ _                                    ______       _   
    |  __ (_)                                   | ___ \\     | |  
    | |  \\/___   _____  __ ___      ____ _ _   _| |_/ / ___ | |_ 
    | | __| \\ \\ / / _ \\/ _\` \\ \\ /\\ / / _\` | | | | ___ \\/ _ \\| __|
    | |_\\ \\ |\\ V /  __/ (_| |\\ V  V / (_| | |_| | |_/ / (_) | |_ 
    \\____/_| \\_/ \\___|\\__,_| \\_/\\_/ \\__,_|\\__, \\____/ \\___/ \\__|
                                            __/ |                
                                           |___/                 
  `);
  console.log(`
  _                _            _       _                 _       
 | |              | |          | |     | |               (_)      
___| |_ __ _ _ __ __| | _____   _| |_ ___| |__   _____  __  _  ___  
/ __| __/ _\` | '__/ _\` |/ _ \\ \\ / | __/ _\` | '_ \\ / _ \\ \\/ / | |/ _ \\ 
\\__ | || (_| | | | (_| |  __/\\ V _| ||  __| |_) |  __/>  < _| | (_) |
|___/\\__\\__,_|_|  \\__,_|\\___| \\_(_)\\__\\___|_.__/ \\___/_/\\_(_|_|\\___/ 
`);
  client.user.setActivity("StarGiveawayBot", { type: "STREAMING", url: "https://twitch.tv/lechenzmp4" });
});

client.login(config.token);
