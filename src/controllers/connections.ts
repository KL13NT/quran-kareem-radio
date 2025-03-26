import { resolve } from "path";
import { readFile, writeFile } from "node:fs/promises";
import { ensureFile } from "~/utils/ensure-file";
import { logger } from "~/utils/logger";
import {
	joinVoiceChannel,
	entersState,
	VoiceConnectionStatus,
	getVoiceConnection,
	type DiscordGatewayAdapterCreator,
} from "@discordjs/voice";
import {
	PermissionFlagsBits,
	type Guild,
	type GuildMember,
	type VoiceState,
} from "discord.js";
import { client } from "./client";
import { playerManager } from "./player-manager";
import type { PlaybackDetails } from "~/types";

const { MODE, CLIENT_ID } = process.env;

const directory =
	MODE === "PRODUCTION"
		? resolve(__dirname, "/data")
		: resolve(__dirname, "../../data");

const filePath =
	MODE === "PRODUCTION"
		? resolve(directory, `connections.json`)
		: resolve(directory, `connections.json`);

const log = logger.create("connections");

class ConnectionsCache {
	/**
	 * Guild ID -> Channel ID
	 */
	data: Map<string, string>;

	constructor() {
		this.data = new Map();
	}

	async init() {
		try {
			await ensureFile(filePath);

			const contents = await readFile(filePath, "utf-8");
			const parsed = JSON.parse(contents);
			this.data = new Map(Object.entries(parsed));
		} catch (error) {
			log("Couldn't load memory cache file", error);
		}

		setInterval(async () => {
			try {
				await writeFile(
					filePath,
					JSON.stringify(Object.fromEntries(this.data.entries()))
				);
			} catch (error) {
				log("Couldn't write memory cache file", error);
			}
		}, 1000 * 5);
	}

	async connect(
		guild: Guild,
		member: GuildMember,
		data: PlaybackDetails | "default"
	) {
		try {
			const { channel: requestChannel } = member.voice;
			const existingConnection = getVoiceConnection(guild.id);
			const state = guild.voiceStates.resolve(
				CLIENT_ID as unknown as VoiceState
			);
			const connected = Boolean(existingConnection && state && state.channelId);

			if (!requestChannel) {
				return {
					message: `You're not connected to a voice channel`,
				};
				return `You're not connected to a voice channel`;
			}

			if (
				connected &&
				state.channelId === requestChannel.id &&
				existingConnection?.joinConfig?.channelId === requestChannel.id
			) {
				playerManager.refresh(existingConnection, interaction.guild!);
				return `I'm already connected to this channel. Refreshing playback just in case...`;
			}

			if (
				!requestChannel
					.permissionsFor(client.user!)!
					.has([
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.Connect,
						PermissionFlagsBits.Speak,
					])
			) {
				return `I don't have the permissions to connect to this channel.`;
			}

			if (existingConnection) {
				existingConnection.disconnect();
				existingConnection.destroy();
			}

			const newConnection = joinVoiceChannel({
				channelId: requestChannel.id,
				guildId: requestChannel.guild.id,
				adapterCreator: requestChannel.guild
					.voiceAdapterCreator as DiscordGatewayAdapterCreator,
			});

			newConnection.configureNetworking();

			await entersState(newConnection, VoiceConnectionStatus.Ready, 5_000);

			playerManager.subscribe(newConnection, interaction.guild!);
			connections.add(requestChannel.guild.id, requestChannel.id);

			return {
				message: `Joined ${requestChannel.name}`,
				connection: newConnection,
			};
			return `Joined ${requestChannel.name}`;
		} catch (error) {
			console.error(error);
			return "Something went wrong";
		}
	}

	add(guildId: string, channelId: string) {
		this.data.set(guildId, channelId);
	}

	del(guildId: string) {
		this.data.delete(guildId);
	}

	list() {
		return this.data;
	}

	get(guildId: string) {
		return this.data.get(guildId);
	}
}

export const connections = new ConnectionsCache();
