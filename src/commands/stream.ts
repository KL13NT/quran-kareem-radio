import {
	getVoiceConnection,
	joinVoiceChannel,
	type DiscordGatewayAdapterCreator,
	entersState,
	VoiceConnectionStatus,
} from "@discordjs/voice";
import {
	type CommandInteraction,
	ApplicationCommandType,
	PermissionFlagsBits,
	type Guild,
	type GuildMember,
	type VoiceState,
} from "discord.js";
import type { AutocompleteInteraction } from "discord.js";
import { client } from "~/controllers/client";
import { connections } from "~/controllers/connections";
import { playerManager } from "~/controllers/player-manager";
import type { CommandType, RecitationEdition } from "~/types";

const { CLIENT_ID } = process.env;

const stream = async (interaction: CommandInteraction) => {
	await interaction.deferReply();

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
		playerManager.subscribe(existingConnection, interaction.guild!);
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

export default {
	name: "stream",
	description:
		"24/7 Quran stream of select recitations instead of the Egyptian Quran Radio",
	type: ApplicationCommandType.ChatInput,
	run: stream,
} as CommandType;
