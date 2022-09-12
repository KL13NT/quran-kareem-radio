const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const { Client } = require("discord.js");
const { createClient } = require("redis");

require("dotenv").config();

const { PlayerManager } = require("./player-manager");

const { TOKEN, CLIENT_ID } = process.env;

const redis = createClient();

// Create a new client instance
const client = new Client({
  intents: ["GUILD_VOICE_STATES", "GUILDS", "GUILD_MESSAGES"],
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

// When the client is ready, run this code (only once)
client.once("ready", async () => {
  console.log("Ready!");

  await redis.connect();

  const playerManager = new PlayerManager();
  playerManager.init();

  client.user.setActivity({
    type: "LISTENING",
    name: "slash commands! /connect & /leave",
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

  client.on("interactionCreate", async (interaction) => {
    const { commandName } = interaction;

    try {
      const { channel } = interaction.member.voice;
      const connection = getVoiceConnection(interaction.guild.id);
      const state = interaction.guild.voiceStates.resolve(CLIENT_ID);
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

        playerManager.subscribe(newConnection, interaction.guild);

        await redis.set(`CONNECTION:${channel.guild.id}:${state.channelId}`, 0);
      }

      if (!channel) {
        await interaction.reply(`You're not connected to a voice channel`);
        return;
      }

      if (commandName === "connect") {
        if (connected && state.channelId !== channel.id) {
          await interaction.reply(
            `I'm already connected to another channel. If you have permission you can try moving me manually.`
          );
          return;
        }

        if (connected && state.channelId === channel.id) {
          await interaction.reply(`I'm already connected to this channel.`);
          return;
        }

        const newConnection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          group: "default",
          debug: false,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });

        playerManager.subscribe(newConnection, interaction.guild);

        await redis.set(`CONNECTION:${channel.guild.id}:${channel.id}`, 0);
        await interaction.reply(`Joined voice channel ${channel.name}`);
      } else if (commandName === "leave") {
        if (!connected) {
          await interaction.reply(`I'm not connected to a voice channel`);
          return;
        }

        if (channel.id !== state.channelId && connected) {
          await interaction.reply(
            `You're not connected to the same voice channel as I am.`
          );
          return;
        }

        const oldConnection = getVoiceConnection(interaction.guild.id);
        oldConnection.disconnect();

        redis.del(`CONNECTION:${channel.guild.id}:${channel.id}`);
        await interaction.reply(
          `Disconnected from voice channel ${channel.name} from ${channel.guild.name}`
        );
      }
    } catch (error) {
      console.log(error.message);
      await interaction.reply("I couldn't process that");
    }
  });
});

// Login to Discord with your client's token
client.login(TOKEN);
