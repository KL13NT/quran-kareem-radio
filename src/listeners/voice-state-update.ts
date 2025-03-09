import { getVoiceConnection } from "@discordjs/voice";
import { VoiceState, type VoiceChannel } from "discord.js";
import { Locator } from "src/controllers/locator";
import { logger } from "~/utils/logger";

const { CLIENT_ID } = process.env;

const log = logger.create("voice-state-update");

const onVoiceStateUpdate = async (
	oldState: VoiceState,
	newState: VoiceState
) => {
	const player = Locator.resolve("player");
	const connections = Locator.resolve("connections");
	const guild = newState.guild ?? oldState.guild;
	const connectedChannelId = connections.get(guild.id);
	const connectedChannel = connectedChannelId
		? ((await guild.channels.fetch(connectedChannelId)) as VoiceChannel)
		: null;

	const isBot = newState.member?.id === CLIENT_ID;
	const userLeft = oldState.channel && !newState.channel;
	const userJoined = !oldState.channel && newState.channel;
	const userMoved =
		oldState.channel &&
		newState.channel &&
		newState.channel.id !== oldState.channel.id;

	// Using oldState first because users may have moved to a different channel,
	// which means there are actually two affected channels, the old (which the
	// bot is connected to) and the new one. We're only interested about the
	// channel the bot is connected to.
	const affectedChannelConnected =
		(userLeft && oldState.channel?.id === connectedChannelId) ||
		(userJoined && newState.channel?.id === connectedChannelId) ||
		(userMoved && connectedChannelId === oldState.channel?.id) ||
		(userMoved && connectedChannelId === newState.channel?.id);

	if (!isBot && connectedChannel && affectedChannelConnected) {
		if (connectedChannel.members.size <= 1) {
			log(`Unsubscribing ${guild.name} due to empty channel`);
			player.unsubscribe(guild);
		} else {
			log(`Subscribing ${guild.name} due to user joining channel`);
			player.subscribe(getVoiceConnection(guild.id)!, guild);
		}

		return;
	}

	if (isBot && userLeft) {
		log(
			`Bot disconnected from ${oldState.guild.name} ${oldState.channel?.name}`
		);

		getVoiceConnection(oldState.guild.id)?.destroy();

		player.unsubscribe(guild);
		connections.del(guild.id);
	} else if (isBot && userMoved) {
		log(
			`Bot has been moved from ${oldState.guild.name} ${oldState.channel.name} to ${newState.channel.name}`
		);

		const targetChannel = (await guild.channels.fetch(
			newState.channel.id
		)) as VoiceChannel;

		connections.del(guild.id);
		connections.add(newState.guild.id, newState.channel.id);

		if (targetChannel.members.size <= 1) {
			log(`Unsubscribing ${guild.name} due to empty channel`);
			player.unsubscribe(guild);
		} else {
			log(
				`Subscribing ${guild.name}:${targetChannel.name} due to user joining channel`
			);
			player.subscribe(getVoiceConnection(guild.id)!, guild);
		}
	}
};

export const onVoiceStateUpdateEvent = {
	name: "voiceStateUpdate",
	execute: onVoiceStateUpdate,
};
