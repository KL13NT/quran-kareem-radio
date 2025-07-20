import { getVoiceConnections } from "@discordjs/voice";
import { Client, TextChannel, VoiceChannel } from "discord.js";

const ANALYTICS_INTERVAL = 5 * 60 * 1000; /* 5 minutes */
const ANALYTICS_CHANNEL_ID = process.env.ANALYTICS_CHANNEL_ID;
const DEV_SERVER_ID = process.env.DEV_SERVER_ID;

export const initAnalytics = (client: Client) => {
	if (process.env.MODE !== "PRODUCTION") return;

	if (!ANALYTICS_CHANNEL_ID || !DEV_SERVER_ID) {
		console.log(
			"Environment lacking ANALYTICS_CHANNEL_ID or DEV_SERVER_ID. Analytics disabled."
		);

		return;
	}

	return setInterval(async () => {
		try {
			const connections = Array.from(getVoiceConnections().values());

			const members = connections.reduce((members, connection) => {
				const channel = client.channels.resolve(
					connection.joinConfig.channelId!
				) as VoiceChannel;

				return channel.members.size - 1 + members;
			}, 0);

			const message = `[stats]: bot is currently connected to ${connections.length} channels with with ${members} members listening in ${client.guilds.cache.size} servers`;

			const channel = await client.channels.fetch(ANALYTICS_CHANNEL_ID);
			if (!channel) return;

			(channel as TextChannel).send(message);
		} catch (error) {
			console.error(error);
		}
	}, ANALYTICS_INTERVAL);
};
