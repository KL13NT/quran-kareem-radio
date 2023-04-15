import { getVoiceConnections } from "@discordjs/voice";
import { Client, VoiceChannel } from "discord.js";

const ANALYTICS_INTERVAL =
	process.env.MODE === "PRODUCTION"
		? 5 * 60 * 1000 /* 5 minutes */
		: 10 * 1000; /* 10 seconds */

export const initAnalytics = (client: Client) => {
	return setInterval(() => {
		try {
			const connections = Array.from(getVoiceConnections().values());

			const members = connections.reduce((members, connection) => {
				const channel = client.channels.resolve(
					connection.joinConfig.channelId
				) as VoiceChannel;

				return channel.members.size + members;
			}, 0);

			console.log(
				`stats: bot is currently connected to ${connections.length} channels with with ${members} members listening in ${client.guilds.cache.size} servers`
			);
		} catch (error) {
			console.log(error);
		}
	}, ANALYTICS_INTERVAL);
};
