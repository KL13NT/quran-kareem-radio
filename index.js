const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const { Client } = require("discord.js");

require("dotenv").config();

const { PlayerController } = require("./controllers/player-controller");
const { connect } = require("./controllers/mongo-controller");
const { getConfig, updateConfig } = require("./controllers/config-controller");

const { TOKEN, CLIENT_ID } = process.env;

// Create a new client instance
const client = new Client({
  intents: ["GUILD_VOICE_STATES", "GUILDS", "GUILD_MESSAGES"],
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

// When the client is ready, run this code (only once)
client.once("ready", async () => {
  console.log("Ready!");

  await connect();

  const playerController = new PlayerController();
  playerController.init();

  client.user.setActivity({
    type: "LISTENING",
    name: "-connect and -leave",
  });

  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot) return;

      const config = await getConfig(message.guild.id);
      const prefix = config?.prefix || "-";

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

        playerController.subscribe(newConnection);
      }

      if (
        !channel &&
        [`${prefix}connect`, `${prefix}leave`].includes(message.content)
      ) {
        await message.reply(`You're not connected to a voice channel`);
        return;
      }

      if (message.content === `${prefix}connect`) {
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

        playerController.subscribe(newConnection);

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
      } else if (message.content.startsWith(`${prefix}prefix`)) {
        if (message.content.split(" ").length !== 2) {
          await message.reply(`this command takes one parameter.`);
          return;
        }

        const [_, newPrefix] = message.content.split(" ");
        await updateConfig(message.guild.id, { prefix: newPrefix });
      }
    } catch (error) {
      console.log(error.message);
    }
  });
});

// Login to Discord with your client's token
client.login(TOKEN);
