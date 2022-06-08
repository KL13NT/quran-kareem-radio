const {
  joinVoiceChannel,
  getVoiceConnection,
  getVoiceConnections,
} = require("@discordjs/voice");
const { Client } = require("discord.js");
const { createClient } = require("redis");

require("dotenv").config();

const { PlayerManager } = require("./player-manager");
const { RedisController } = require("./redis-controller");

const { TOKEN, CLIENT_ID } = process.env;

const redisClient = createClient();

// Create a new client instance
const client = new Client({
  intents: ["GUILD_VOICE_STATES", "GUILDS", "GUILD_MESSAGES"],
});

const redis = new RedisController(redisClient);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

// When the client is ready, run this code (only once)
client.once("ready", async () => {
  console.log("Ready!");

  await redisClient.connect();

  const playerManager = new PlayerManager();
  playerManager.init();

  client.user.setActivity({
    type: "LISTENING",
    name: "-connect and -leave",
  });

  setInterval(() => {
    try {
      /** @type {import('discord.js').VoiceChannel[]} */
      const allChannels = Array.from(client.channels.cache.values());

      const voiceChannels = allChannels.filter(
        (channel) =>
          channel.type === "GUILD_VOICE" &&
          channel.members.has(process.env.CLIENT_ID)
      );

      const membersCount = voiceChannels.reduce(
        (acc, cur) => acc + cur.members.size - 1,
        0
      );

      console.log(
        `stats: bot is currently connected to ${voiceChannels.length} channels with with ${membersCount} members listening in ${client.guilds.cache.size} servers`
      );
    } catch (error) {
      console.log(`error: ${error.message}`);
    }
  }, 5 * 60 * 1000);

  console.log("getting keys");
  /** @type {string[]} */
  const results = await redis.keys("CONNECTION*");
  console.log("results", results);

  results.forEach(async (result) => {
    try {
      const [, guildId, channelId] = result.match(/CONNECTION:(\d+):(\d+)/);

      const guild = await client.guilds.resolve(guildId);

      const connection = await joinVoiceChannel({
        channelId,
        guildId,
        group: "default",
        debug: false,
        adapterCreator: guild.voiceAdapterCreator,
      });

      playerManager.subscribe(connection, guild);
    } catch (error) {
      console.log(`error while rejoining ${error.message}`);
    }
  });

  client.on("voiceStateUpdate", async (oldState, newState) => {
    if (newState.member.id === CLIENT_ID && !newState.channel) {
      console.log(
        `bot disconnected from ${oldState.guild.name} ${oldState.channel.name}`
      );

      await redis.del(`CONNECTION:${oldState.guild.id}:${oldState.channel.id}`);
    } else if (
      newState.member.id === CLIENT_ID &&
      newState.channel &&
      oldState.channel
    ) {
      console.log(
        `bot has been moved from ${oldState.guild.name} ${oldState.channel.name} to ${newState.channel.name}`
      );

      await Promise.all([
        redis.del(`CONNECTION:${oldState.guild.id}:${oldState.channel.id}`),
        redis.set(`CONNECTION:${newState.guild.id}:${newState.channel.id}`, 0),
      ]);
    }
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

        playerManager.subscribe(newConnection, message.guild);

        await redis.set(`CONNECTION:${channel.guild.id}:${state.channelId}`, 0);
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

        playerManager.subscribe(newConnection, message.guild);

        await redis.set(`CONNECTION:${channel.guild.id}:${channel.id}`, 0);

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

        redis.del(`CONNECTION:${channel.guild.id}:${channel.id}`);
        await message.reply(
          `Disconnected from voice channel ${channel.name} from ${channel.guild.name}`
        );
      }
    } catch (error) {
      console.log(error.message);
    }
  });
});

// Login to Discord with your client's token
client.login(TOKEN);
