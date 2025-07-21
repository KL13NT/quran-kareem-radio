import {
	entersState,
	getVoiceConnection,
	VoiceConnectionStatus,
} from "@discordjs/voice";
import { VoiceState, type VoiceChannel } from "discord.js";
import { playerManager } from "~/controllers/player-manager";

const { CLIENT_ID } = process.env;

const onVoiceStateUpdate = async (
	oldState: VoiceState,
	newState: VoiceState
) => {
	try {
		const guild = newState.guild ?? oldState.guild;
		const voiceConnection = getVoiceConnection(guild.id);

		/**
		 * If bot is not connected to a voice channel, there's nothing to do
		 * If bot is moved between channels, check if voice connection automatically
		 * picks up the change
		 *
		 */

		if (!voiceConnection) return;

		if (voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
			console.log(
				`[VOICE] Voice connection not ready for guild ${guild.id}, awaiting ready`
			);
			await entersState(voiceConnection, VoiceConnectionStatus.Ready, 5_000);
		}

		const oldChannel = oldState.channel;
		const newChannel = newState.channel;
		const connectedChannelId = voiceConnection.joinConfig.channelId;

		if (!connectedChannelId) {
			console.log(
				`[VOICE] Voice connection not configured for guild ${guild.id}`
			);
			return;
		}

		const botChannel = (await guild.channels.fetch(
			connectedChannelId
		)) as VoiceChannel;

		const isBot = newState.member?.id === CLIENT_ID;
		const left = oldChannel && !newChannel;
		const joined = !oldChannel && newChannel;
		const moved = oldChannel && newChannel && newChannel.id !== oldChannel.id;
		const movedOrLeft = moved || left;
		const movedOrJoined = moved || joined;

		const sameUserBotOldChannel = connectedChannelId === oldChannel?.id;
		const sameUserBotNewChannel = connectedChannelId === newChannel?.id;
		const botChannelAffected = sameUserBotOldChannel || sameUserBotNewChannel;

		/**
		 * If bot is not affected by channel change, there's nothing to do
		 */
		if (!botChannelAffected) return;

		if (isBot && joined) {
			return;
		} else if (isBot && moved && newChannel.members.size === 1) {
			console.log(`Unsubscribing ${guild.name} due to empty channel`);
			await playerManager.unsubscribe(guild, true);
			// TODO: verify this gets updated automatically
			// TODO: verify bot can connect
			console.log(
				`Bot has been moved from ${oldState.guild.name} ${oldChannel.name} to ${newChannel.name}`
			);
		} else if (isBot && left) {
			console.log(
				`Bot disconnected from ${oldState.guild.name} ${oldChannel?.name}`
			);
			await playerManager.unsubscribe(guild);
		} else if (!isBot && movedOrLeft && botChannel.members.size === 1) {
			console.log(`Unsubscribing ${guild.name} due to empty channel`);
			await playerManager.unsubscribe(guild, true);
		} else if (!isBot && movedOrJoined && botChannel.members.size === 2) {
			console.log(`Resubscribing ${guild.name} due to user joining channel`);
			await playerManager.refresh(guild, getVoiceConnection(guild.id)!);
		}

		// if (isBot && moved && canConnect(newState.guild, newChannel.id)) {
		// 	console.log(
		// 		`Bot has been moved from ${oldState.guild.name} ${oldChannel.name} to ${newChannel.name}`
		// 	);

		// 	const targetChannel = (await guild.channels.fetch(
		// 		newChannel.id
		// 	)) as VoiceChannel;

		// 	await subscriptionService.updateGuildSubscription(guild.id, {
		// 		channel_id: newChannel.id,
		// 	});

		// 	if (targetChannel.members.size <= 1) {
		// 		console.log(`Unsubscribing ${guild.name} due to empty channel`);
		// 		playerManager.unsubscribe(guild);
		// 	} else {
		// 		console.log(
		// 			`Subscribing ${guild.name}:${targetChannel.name} due to user joining channel`
		// 		);
		// 		await playerManager.refresh(guild, getVoiceConnection(guild.id)!);
		// 	}
		// }
	} catch (error) {
		console.log(`[VOICE-STATE-UPDATE]`, (error as Error).message);
	}
};

export const onVoiceStateUpdateEvent = {
	name: "voiceStateUpdate",
	execute: onVoiceStateUpdate,
};
