import {
	entersState,
	getVoiceConnection,
	joinVoiceChannel,
	VoiceConnectionStatus,
	type DiscordGatewayAdapterCreator,
} from "@discordjs/voice";
import { Locator } from "~/controllers/locator";
import { logger } from "./logger";
import type { VoiceChannel } from "discord.js";

const log = logger.create("reconnect");

export const reconnect = async () => {
	const client = Locator.resolve("client");
	const connections = Locator.resolve("connections");
	const player = Locator.resolve("player");
	const results = connections.list();

	log(`Found ${results.size} existing connections`);

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

			connection.configureNetworking();

			connection.on(VoiceConnectionStatus.Disconnected, async () => {
				try {
					await Promise.race([
						entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
						entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
					]);
				} catch {
					connection.destroy();
					connection.removeAllListeners();
					player.unsubscribe(guild);
				}
			});

			await entersState(connection, VoiceConnectionStatus.Ready, 5_000);

			const channel = (await guild.channels.fetch(channelId)) as VoiceChannel;
			if (channel.members.size === 1) {
				log(
					`No members in channel ${channel.name} in guild ${guild.name} - skipping...`
				);
				continue;
			}

			player.subscribe(connection, guild);
		} catch (error) {
			log(`error while reconnecting on launch`, error);
		}
	}
};
