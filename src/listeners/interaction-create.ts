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
	PermissionFlagsBits,
	VoiceState,
	type CommandInteraction,
} from "discord.js";
import { readFile } from "fs/promises";
import { resolve } from "path";
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

let helpText: string;
const help = async (interaction: CommandInteraction) => {
	if (!helpText) {
		log("Loading help text for the first time");
		helpText = await readFile(resolve(__dirname, "../../help.txt"), "utf-8");
	}

	await interaction.editReply(helpText);
};

const commands = {
	connect,
	leave,
	help,
};

type CommandType = keyof typeof commands;

const onInteractionCreate = async (interaction: CommandInteraction) => {
	if (!interaction.isCommand() || !interaction.member || !interaction.guild) {
		return;
	}

	await interaction.deferReply();
	try {
		const { commandName } = interaction;
		const command = commands[commandName as CommandType];

		if (!command) {
			await help(interaction);
		} else {
			await command(interaction);
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
