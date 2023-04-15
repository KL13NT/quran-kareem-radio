import { getVoiceConnection } from "@discordjs/voice";
import { VoiceState } from "discord.js";
import { Locator } from "src/controllers/locator";

const { CLIENT_ID } = process.env;

const onVoiceStateUpdate = async (
	oldState: VoiceState,
	newState: VoiceState
) => {
	const redis = Locator.resolve("redis");

	if (newState.member?.id === CLIENT_ID && !newState.channel) {
		console.log(
			`bot disconnected from ${oldState.guild.name} ${oldState.channel?.name}`
		);

		getVoiceConnection(oldState.guild.id)?.destroy();

		await redis.del(`CONNECTION:${oldState.guild.id}:${oldState.channel?.id}`);
	} else if (
		newState.member?.id === CLIENT_ID &&
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
};

export const onVoiceStateUpdateEvent = {
	name: "voiceStateUpdate",
	execute: onVoiceStateUpdate,
};
