import {
	entersState,
	getVoiceConnection,
	joinVoiceChannel,
	VoiceConnectionStatus,
	type DiscordGatewayAdapterCreator,
} from "@discordjs/voice";
import { Locator } from "~/controllers/locator";

export const reconnect = async () => {
	const client = Locator.resolve("client");
	const connections = Locator.resolve("connections");
	const player = Locator.resolve("player");
	const results = connections.list();

	console.log("Existing bot connections", results.size);

	for await (const [guildId, channelId] of results) {
		try {
			const guild = await client.guilds.fetch(guildId);
			if (!guild) return;

			const connection =
				getVoiceConnection(guildId) ??
				joinVoiceChannel({
					channelId,
					guildId,
					adapterCreator:
						guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
				});

			connection.on(VoiceConnectionStatus.Disconnected, async () => {
				try {
					await Promise.race([
						entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
						entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
					]);
				} catch {
					connection.destroy();
					player.unsubscribe(guild);
				}
			});

			await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
			console.log("ready status");
			player.subscribe(connection, guild);
		} catch (error) {
			console.log(`error while reconnecting on launch`, error);
		}
	}
};
