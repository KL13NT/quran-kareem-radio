const {
  AudioPlayer,
  joinVoiceChannel,
  createAudioResource,
  getVoiceConnection,
} = require("@discordjs/voice");
const { Client } = require("discord.js");

require("dotenv").config();

const { TOKEN, CLIENT_ID, MODE } = process.env;
const STREAM = `https://stream.radiojar.com/8s5u5tpdtwzuv`;

// Create a new client instance
const client = new Client({
  intents: ["GUILD_VOICE_STATES", "GUILDS", "GUILD_MESSAGES"],
});

const createAudioPlayerSource = () =>
  createAudioResource(STREAM, {
    silencePaddingFrames: 0,
  });

const handleStreamErrors =
  (resource, player, message) => (reason /* string | Error | void */) => {
    console.log(message, reason);

    resource.playStream.removeAllListeners();
    resource.playStream.destroy();

    console.log("Creating another audio source");

    let newSource = createAudioPlayerSource();
    const interval = setInterval(() => {
      if (newSource.started && newSource.readable) {
        player.play(newSource);
        clearInterval(interval);
      } else {
        newSource = createAudioPlayerSource();
      }
    }, 5000);
  };

/**
 * @param {import('@discordjs/voice').AudioPlayer} player
 */
const playResource = (player) => {
  const resource = createAudioPlayerSource();
  player.play(resource);

  resource.playStream.on(
    "error",
    handleStreamErrors(resource, player, "Stream error")
  );

  resource.playStream.on(
    "close",
    handleStreamErrors(resource, player, "Stream closed")
  );

  resource.playStream.on(
    "end",
    handleStreamErrors(resource, player, "Stream ended")
  );

  resource.playStream.on(
    "pause",
    handleStreamErrors(resource, player, "Stream paused")
  );
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

// When the client is ready, run this code (only once)
client.once("ready", async () => {
  console.log("Ready!");

  const player = new AudioPlayer({
    debug: true,
    behaviors: {
      noSubscriber: "play",
    },
  });

  player.on("error", (error) => {
    console.log(error);
  });

  player.on("stateChange", (change) => {
    console.log(change);
  });

  if (MODE === "DEVELOPMENT")
    player.on("debug", (log) => {
      console.log(log);
    });

  playResource(player);

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

        newConnection.subscribe(player);
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

        newConnection.subscribe(player);

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
