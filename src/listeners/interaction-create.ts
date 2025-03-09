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
import { logger } from "~/utils/logger";

const { CLIENT_ID } = process.env;

const log = logger.create("interaction-create");

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
		await interaction.editReply(`You're not connected to a voice channel`);
		return;
	}

	if (
		connected &&
		state.channelId === requestChannel.id &&
		existingConnection?.joinConfig?.channelId === requestChannel.id
	) {
		player.subscribe(existingConnection, interaction.guild!);
		await interaction.editReply(
			`I'm already connected to this channel. Refreshing playback just in case...`
		);
		return;
	}

	if (
		!requestChannel
			.permissionsFor(client.user!)!
			.has([
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.Connect,
				PermissionFlagsBits.Speak,
			])
	) {
		await interaction.editReply(
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

	newConnection.configureNetworking();

	await entersState(newConnection, VoiceConnectionStatus.Ready, 5_000);

	player.subscribe(newConnection, interaction.guild!);
	connections.add(requestChannel.guild.id, requestChannel.id);

	await interaction.editReply(`Joined ${requestChannel.name}`);
};

const leave = async (interaction: CommandInteraction) => {
	const connections = Locator.resolve("connections");
	const guild = interaction.guild as Guild;
	const existingConnection = getVoiceConnection(guild.id);
	const state = guild.voiceStates.resolve(CLIENT_ID as unknown as VoiceState);
	const connected = Boolean(existingConnection && state && state.channelId);

	if (!connected) {
		await interaction.editReply(`I'm not connected to a voice channel`);
		return;
	}

	if (existingConnection) {
		existingConnection.disconnect();
	}

	connections.del(guild.id);
	await interaction.editReply(`Disconnected from voice channel`);
};

const onInteractionCreate = async (interaction: Interaction) => {
	if (!interaction.isCommand() || !interaction.member || !interaction.guild) {
		return;
	}

	await interaction.deferReply();
	const { commandName } = interaction;

	try {
		if (commandName === "connect") {
			await connect(interaction);
		} else if (commandName === "leave") {
			await leave(interaction);
		}
	} catch (error) {
		log(error);
		await interaction.editReply("I couldn't process that");
	}
};

export const onInteractionCreateEvent = {
	name: "interactionCreate",
	execute: onInteractionCreate,
};
