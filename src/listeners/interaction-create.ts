import {
	entersState,
	getVoiceConnection,
	joinVoiceChannel,
	VoiceConnectionStatus,
	type DiscordGatewayAdapterCreator,
} from "@discordjs/voice";
import {
	Guild,
	GuildMember,
	Interaction,
	PermissionFlagsBits,
	VoiceState,
	type CommandInteraction,
} from "discord.js";
import { Locator } from "src/controllers/locator";

const { CLIENT_ID } = process.env;

const connect = async (interaction: CommandInteraction) => {
	const player = Locator.resolve("player");
	const connections = Locator.resolve("connections");
	const client = Locator.resolve("client");

	const member = interaction.member as GuildMember;
	const guild = interaction.guild as Guild;

	const { channel: requestChannel } = member.voice;
	const existingConnection = getVoiceConnection(guild.id);
	const state = guild.voiceStates.resolve(CLIENT_ID as unknown as VoiceState);
	const connected = Boolean(existingConnection && state && state.channelId);

	if (!requestChannel) {
		await interaction.reply(`You're not connected to a voice channel`);
		return;
	}

	if (
		connected &&
		state.channelId === requestChannel.id &&
		existingConnection?.joinConfig?.channelId === requestChannel.id
	) {
		player.subscribe(existingConnection, interaction.guild);
		await interaction.reply(
			`I'm already connected to this channel. Refreshing playback just in case...`
		);
		return;
	}

	if (
		!requestChannel
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

	if (existingConnection) {
		existingConnection.disconnect();
		existingConnection.destroy();
	}

	const newConnection = joinVoiceChannel({
		channelId: requestChannel.id,
		guildId: requestChannel.guild.id,
		adapterCreator: requestChannel.guild
			.voiceAdapterCreator as DiscordGatewayAdapterCreator,
	});

	await entersState(newConnection, VoiceConnectionStatus.Ready, 5_000);

	player.subscribe(newConnection, interaction.guild);
	connections.add(requestChannel.guild.id, requestChannel.id);

	await interaction.reply(`Joined ${requestChannel.name}`);
};

const leave = async (interaction: CommandInteraction) => {
	const connections = Locator.resolve("connections");
	const guild = interaction.guild as Guild;
	const existingConnection = getVoiceConnection(guild.id);
	const state = guild.voiceStates.resolve(CLIENT_ID as unknown as VoiceState);
	const connected = Boolean(existingConnection && state && state.channelId);

	if (!connected) {
		await interaction.reply(`I'm not connected to a voice channel`);
		return;
	}

	if (existingConnection) {
		existingConnection.disconnect();
	}

	connections.del(guild.id);
	await interaction.reply(`Disconnected from voice channel`);
};

const onInteractionCreate = async (interaction: Interaction) => {
	if (!interaction.isCommand() || !interaction.member || !interaction.guild) {
		return;
	}

	const { commandName } = interaction;

	try {
		if (commandName === "connect") {
			await connect(interaction);
		} else if (commandName === "leave") {
			await leave(interaction);
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
