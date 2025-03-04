import { getVoiceConnection } from "@discordjs/voice";
import { VoiceState } from "discord.js";
import { Locator } from "src/controllers/locator";

const { CLIENT_ID } = process.env;

const onVoiceStateUpdate = async (
	oldState: VoiceState,
	newState: VoiceState
) => {
	const connections = Locator.resolve("connections");

	if (newState.member.id !== CLIENT_ID) return;

	if (!newState.channel) {
		console.log(
			`bot disconnected from ${oldState.guild.name} ${oldState.channel?.name}`
		);

		getVoiceConnection(oldState.guild.id)?.destroy();

		connections.del(`${oldState.guild.id}:${oldState.channel?.id}`);
	} else if (
		newState.member?.id === CLIENT_ID &&
		newState.channel &&
		oldState.channel &&
		newState.channel.id !== oldState.channel.id
	) {
		console.log(
			`bot has been moved from ${oldState.guild.name} ${oldState.channel.name} to ${newState.channel.name}`
		);

		connections.del(oldState.guild.id);
		connections.add(newState.guild.id, newState.channel.id);
	}
};

export const onVoiceStateUpdateEvent = {
	name: "voiceStateUpdate",
	execute: onVoiceStateUpdate,
};
