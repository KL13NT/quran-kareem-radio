import {
	entersState,
	getVoiceConnection,
	VoiceConnectionStatus,
} from "@discordjs/voice";
import { VoiceState, type VoiceChannel } from "discord.js";
import type { ListenerType } from "~/types";

const { CLIENT_ID } = process.env;

const onVoiceStateUpdate: ListenerType<"voiceStateUpdate">["execute"] =
	({ playerManager }) =>
	async (oldState: VoiceState, newState: VoiceState) => {
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
					`[VOICE] Voice connection not ready with status ${voiceConnection.state.status} for guild ${guild.id}, awaiting ready`
				);
				voiceConnection.configureNetworking();
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

			const sameUserBotOldChannel = connectedChannelId === oldChannel?.id;
			const sameUserBotNewChannel = connectedChannelId === newChannel?.id;
			const botChannelAffected = sameUserBotOldChannel || sameUserBotNewChannel;

			const botMovedToEmptyChannel =
				isBot && moved && newChannel.members.size === 1;
			const botMovedToNonEmptyChannel =
				isBot && moved && newChannel.members.size > 1;
			const botJoinedChannel = isBot && joined;
			const botLeftChannel = isBot && left;
			const channelEmptyAfterUserMovement =
				!isBot && movedOrLeft && botChannel.members.size === 1;
			const channelOccupiedAfterUserMovement =
				!isBot && joined && botChannel.members.size === 2;

			/**
			 * If bot is not affected by channel change, there's nothing to do
			 */
			if (!botChannelAffected) return;

			if (botJoinedChannel) {
				return;
			} else if (botMovedToEmptyChannel) {
				console.log(`Unsubscribing ${guild.name} due to empty channel`);
				await playerManager.unsubscribe(guild, true);
				console.log(
					`Bot has been moved from ${oldState.guild.name} ${oldChannel.name} to ${newChannel.name}`
				);
			} else if (botMovedToNonEmptyChannel) {
				console.log(
					`Bot has been moved from ${oldState.guild.name} ${oldChannel.name} to ${newChannel.name}`
				);
				return;
			} else if (botLeftChannel) {
				console.log(
					`Bot disconnected from ${oldState.guild.name} ${oldChannel?.name}`
				);
				await playerManager.unsubscribe(guild);
			} else if (channelEmptyAfterUserMovement) {
				console.log(`Unsubscribing ${guild.name} due to empty channel`);
				await playerManager.unsubscribe(guild, true);
			} else if (channelOccupiedAfterUserMovement) {
				console.log(`Resubscribing ${guild.name} due to user joining channel`);
				await playerManager.refresh(guild, getVoiceConnection(guild.id)!);
			}
		} catch (error) {
			console.log(`[VOICE-STATE-UPDATE]`, (error as Error).message);
		}
	};

export const onVoiceStateUpdateEvent: ListenerType<"voiceStateUpdate"> = {
	name: "voiceStateUpdate",
	execute: onVoiceStateUpdate,
};
