import { getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import {
	Guild,
	GuildMember,
	Interaction,
	PermissionFlagsBits,
	VoiceState,
} from "discord.js";
import { Locator } from "src/controllers/locator";

const { CLIENT_ID } = process.env;

const onInteractionCreate = async (interaction: Interaction) => {
	const player = Locator.resolve("player");
	const memory = Locator.resolve("memory");
	const client = Locator.resolve("client");

	if (!interaction.isCommand()) return;

	const { commandName } = interaction;

	try {
		if (!interaction.member || !interaction.guild) return;

		const member = interaction.member as GuildMember;
		const guild = interaction.guild as Guild;

		const { channel } = member.voice;
		const connection = getVoiceConnection(guild.id);
		const state = guild.voiceStates.resolve(CLIENT_ID as unknown as VoiceState);
		const connected = Boolean(state && state);
		const streaming = Boolean(connection);

		if (connected && !streaming && channel && state.channelId) {
			const newConnection = joinVoiceChannel({
				channelId: state.channelId,
				guildId: channel.guild.id,
				adapterCreator: channel.guild.voiceAdapterCreator,
			});

			player.subscribe(newConnection, interaction.guild);

			await memory.set(`CONNECTION:${channel.guild.id}:${state.channelId}`, 0);
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

			if (
				!channel
					.permissionsFor(client.user)
					.has([
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.Connect,
						PermissionFlagsBits.Speak,
					])
			) {
				await interaction.reply(
					`I don't have the permissions to connect to this channel.`
				);
				return;
			}

			const newConnection = joinVoiceChannel({
				channelId: channel.id,
				guildId: channel.guild.id,
				adapterCreator: channel.guild.voiceAdapterCreator,
			});

			player.subscribe(newConnection, interaction.guild);

			await memory.set(`CONNECTION:${channel.guild.id}:${channel.id}`, 0);
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

			if (oldConnection) {
				oldConnection.disconnect();
			}

			memory.del(`CONNECTION:${channel.guild.id}:${channel.id}`);
			await interaction.reply(
				`Disconnected from voice channel ${channel.name} from ${channel.guild.name}`
			);
		}
	} catch (error) {
		console.log(error);
		await interaction.reply("I couldn't process that");
	}
};

export const onInteractionCreateEvent = {
	name: "interactionCreate",
	execute: onInteractionCreate,
};
