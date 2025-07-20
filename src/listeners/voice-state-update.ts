import { getVoiceConnection } from "@discordjs/voice";
import { VoiceState, type VoiceChannel } from "discord.js";
import { playerManager } from "~/controllers/player-manager";
import { subscriptionService } from "~/services/RecitationService";

const { CLIENT_ID } = process.env;

const onVoiceStateUpdate = async (
	oldState: VoiceState,
	newState: VoiceState
) => {
	try {
		const guild = newState.guild ?? oldState.guild;
		const voiceConnection = getVoiceConnection(guild.id);

		if (!voiceConnection) return;

		const connectedChannelId = (
			await subscriptionService.getGuildSubscription(guild.id)
		)?.channel_id;

		if (!connectedChannelId) return;

		const botChannel = connectedChannelId
			? ((await guild.channels.fetch(connectedChannelId)) as VoiceChannel)
			: null;

		const isBot = newState.member?.id === CLIENT_ID;
		const userLeft = oldState.channel && !newState.channel;
		const userJoined = !oldState.channel && newState.channel;
		const userMoved =
			oldState.channel &&
			newState.channel &&
			newState.channel.id !== oldState.channel.id;

		const sameUserBotOldChannel = connectedChannelId === oldState.channel?.id;
		const sameUserBotNewChannel = connectedChannelId === newState.channel?.id;

		// Using oldState first because users may have moved to a different channel,
		// which means there are actually two affected channels, the old (which the
		// bot is connected to) and the new one. We're only interested about the
		// channel the bot is connected to.
		const affectedChannelConnected =
			(userLeft && sameUserBotOldChannel) ||
			(userJoined && sameUserBotNewChannel) ||
			(userMoved && sameUserBotOldChannel) ||
			(userMoved && sameUserBotNewChannel);

		if (!isBot && botChannel && affectedChannelConnected) {
			if (botChannel.members.size <= 1 && userLeft) {
				console.log(`Unsubscribing ${guild.name} due to empty channel`);
				playerManager.unsubscribe(guild);
			} else if (botChannel.members.size === 2 && (userJoined || userMoved)) {
				console.log(`Subscribing ${guild.name} due to user joining channel`);
				await playerManager.refresh(guild, getVoiceConnection(guild.id)!);
			}

			return;
		}

		if (isBot && userLeft) {
			console.log(
				`Bot disconnected from ${oldState.guild.name} ${oldState.channel?.name}`
			);

			getVoiceConnection(oldState.guild.id)?.destroy();

			playerManager.unsubscribe(guild);
			await subscriptionService.unsubscribeGuild(guild.id);
		} else if (isBot && userMoved) {
			console.log(
				`Bot has been moved from ${oldState.guild.name} ${oldState.channel.name} to ${newState.channel.name}`
			);

			const targetChannel = (await guild.channels.fetch(
				newState.channel.id
			)) as VoiceChannel;

			await subscriptionService.updateGuildSubscription(guild.id, {
				channel_id: newState.channel.id,
			});

			if (targetChannel.members.size <= 1) {
				console.log(`Unsubscribing ${guild.name} due to empty channel`);
				playerManager.unsubscribe(guild);
			} else {
				console.log(
					`Subscribing ${guild.name}:${targetChannel.name} due to user joining channel`
				);
				await playerManager.refresh(guild, getVoiceConnection(guild.id)!);
			}
		}
	} catch (error) {
		console.log(error);
	}
};

export const onVoiceStateUpdateEvent = {
	name: "voiceStateUpdate",
	execute: onVoiceStateUpdate,
};
