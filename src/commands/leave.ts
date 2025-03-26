import { getVoiceConnection } from "@discordjs/voice";
import {
	type CommandInteraction,
	type Guild,
	type VoiceState,
	ApplicationCommandType,
} from "discord.js";
import { connections } from "~/controllers/connections";
import type { CommandType } from "~/types";

const { CLIENT_ID } = process.env;

const leave = async (interaction: CommandInteraction) => {
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

export default {
	name: "leave",
	description: "Disconnects the bot from a voice channel when connected",
	type: ApplicationCommandType.ChatInput,
	run: leave,
} as CommandType;
