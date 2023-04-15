import { joinVoiceChannel } from "@discordjs/voice";
import { Locator } from "~/controllers/locator";

export const reconnect = async () => {
	const client = Locator.resolve("client");
	const redis = Locator.resolve("redis");
	const player = Locator.resolve("player");

	const results = await redis.keys("CONNECTION*");

	results.forEach((result) => {
		try {
			const match = result.match(/CONNECTION:(\d+):(\d+)/);
			if (!match) return;

			const [, guildId, channelId] = match;
			const guild = client.guilds.resolve(guildId);

			if (!guild) return;

			const connection = joinVoiceChannel({
				channelId,
				guildId,
				adapterCreator: guild.voiceAdapterCreator,
			});

			player.subscribe(connection, guild);
		} catch (error) {
			console.log(
				`error while reconnecting on launch ${(error as Error).message}`
			);
		}
	});
};
