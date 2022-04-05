// Require the necessary discord.js classes
const {
  AudioPlayer,
  joinVoiceChannel,
  createAudioResource,
  getVoiceConnection,
} = require("@discordjs/voice");
const { Client } = require("discord.js");

require("dotenv").config();

const { TOKEN, CLIENT_ID } = process.env;

// Create a new client instance
const client = new Client({
  intents: ["GUILD_VOICE_STATES", "GUILDS", "GUILD_MESSAGES"],
});

// fetch(`https://www.youtube.com/channel/UCzv6uVYjfvE8X-_F3cicWog`)
//   .then((res) => res.text())
//   .then((text) => {
//     try {
//     } catch (error) {
//       console.log(error);
//       throw new Error("Error while filtering response");
//     }
//   });

// When the client is ready, run this code (only once)
client.once("ready", async () => {
  console.log("Ready!");

  const player = new AudioPlayer({
    behaviors: {
      noSubscriber: "play",
    },
  });

  const resource = createAudioResource(
    `https://livestreaming5.onlinehorizons.net/hls-live/Qurankareem/_definst_/liveevent/livestream.m3u8`
  );
  player.play(resource);

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const { channel } = message.member.voice;
    const connection = getVoiceConnection(message.guild.id);
    const state = message.guild.voiceStates.resolve(CLIENT_ID);
    const connected = Boolean(state && state.channelId);
    const streaming = Boolean(connection);

    if (connected && !streaming) {
      const newConnection = joinVoiceChannel({
        channelId: state.channelId,
        guildId: channel.guild.id,
        group: "default",
        debug: false,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });

      newConnection.subscribe(player);
    }

    if (!channel) {
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

      await message.reply(`Joined voice channel ${message.channel.name}`);
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
      await message.reply(
        `Disconnected from voice channel ${message.channel.name}`
      );
    }
  });
});

// Login to Discord with your client's token
client.login(TOKEN);
