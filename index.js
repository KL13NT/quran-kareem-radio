const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const { Client } = require("discord.js");

require("dotenv").config();

const { PlayerManager } = require("./player-manager");

const { TOKEN, CLIENT_ID } = process.env;

// Create a new client instance
const client = new Client({
  intents: ["GUILD_VOICE_STATES", "GUILDS", "GUILD_MESSAGES"],
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

// When the client is ready, run this code (only once)
client.once("ready", async () => {
  console.log("Ready!");

  const playerManager = new PlayerManager();
  playerManager.init();

  client.user.setActivity({
    type: "LISTENING",
    name: "-connect and -leave",
  });

  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot) return;

      const { channel } = message.member.voice;
      const connection = getVoiceConnection(message.guild.id);
      const state = message.guild.voiceStates.resolve(CLIENT_ID);
      const connected = Boolean(state && state.channelId);
      const streaming = Boolean(connection);

      if (connected && !streaming && channel) {
        const newConnection = joinVoiceChannel({
          channelId: state.channelId,
          guildId: channel.guild.id,
          group: "default",
          debug: false,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });

        playerManager.subscribe(newConnection, message.member);
      }

      if (!channel && ["-connect", "-leave"].includes(message.content)) {
        await message.reply(`You're not connected to a voice channel`);
        return;
      }

      if (message.content === "-connect") {
        if (connected && state.channelId !== channel.id) {
          await message.reply(
            `I'm already connected to another channel. If you have permission you can try moving me manually.`
          );
          return;
        }

        if (connected && state.channelId === channel.id) {
          await message.reply(`I'm already connected to this channel.`);
          return;
        }

        const newConnection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          group: "default",
          debug: false,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });

        playerManager.subscribe(newConnection, message.member);

        await message.reply(`Joined voice channel ${channel.name}`);
      } else if (message.content === "-leave") {
        if (!connected) {
          await message.reply(`I'm not connected to a voice channel`);
          return;
        }

        if (channel.id !== state.channelId && connected) {
          await message.reply(
            `You're not connected to the same voice channel as I am.`
          );
          return;
        }

        const oldConnection = getVoiceConnection(message.guild.id);
        oldConnection.disconnect();
        await message.reply(`Disconnected from voice channel ${channel.name}`);
      }
    } catch (error) {
      console.log(error.message);
    }
  });
});

// Login to Discord with your client's token
client.login(TOKEN);
