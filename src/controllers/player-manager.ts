import {
	entersState,
	getVoiceConnection,
	joinVoiceChannel,
	VoiceConnectionStatus,
	type DiscordGatewayAdapterCreator,
	type VoiceConnection,
} from "@discordjs/voice";
import type { Guild, VoiceChannel } from "discord.js";
import type { DiscordIdentifier, Identifier, PlaybackRequest } from "~/types";
import { EventEmitter } from "stream";
import { Player } from "./player";
import { resolve } from "path";
import { readFile, writeFile } from "node:fs/promises";
import { ensureFile } from "~/utils/ensure-file";
import console, { log } from "node:console";
import { client } from "./client";
import { loadRecitations } from "~/utils/loadRecitations";

const { MODE } = process.env;

const directory =
	MODE === "PRODUCTION"
		? resolve(__dirname, "/data")
		: resolve(__dirname, "../../data");

const filePath = resolve(directory, `subscriptions.json`);

type Subscription = {
	channelId: DiscordIdentifier;
	playback:
		| {
				moshafId: number;
				recitationId: number;
		  }
		| "default";
};

export declare interface PlayerManager {
	// eslint-disable-next-line no-unused-vars
	on(event: "playing", listener: () => void): this;
}
const getRecitationKeyFromSubscription = (subscription: Subscription) => {
	if (subscription.playback === "default") {
		return "default";
	}

	return `${subscription.playback.recitationId}-${subscription.playback.moshafId}`;
};

const getRecitationKeyFromRequest = (request: PlaybackRequest) => {
	if (request === "default") {
		return "default";
	}

	return `${request.reciter.id}-${request.moshafId}`;
};

export class PlayerManager extends EventEmitter {
	/**
	 * Maps recitationId-moshafId to Player
	 */
	private players = new Map<Identifier, Player>();
	private subscriptions = new Map<DiscordIdentifier, Subscription>();

	constructor() {
		super();
	}

	async subscribe(
		request: PlaybackRequest,
		connection: VoiceConnection,
		guild: Guild
	) {
		const key = getRecitationKeyFromRequest(request);
		const existingSubscription = this.subscriptions.get(guild.id);
		const sameRecitation = existingSubscription
			? getRecitationKeyFromSubscription(existingSubscription) === key
			: false;
		const player = await this.retrieveOrCreatePlayer(key, request);

		if (sameRecitation) {
			player.subscribe(connection, guild);
			return;
		} else if (existingSubscription) {
			this.unsubscribe(guild);
			this.subscriptions.delete(guild.id);
		}

		player.subscribe(connection, guild);

		if (request === "default") {
			this.subscriptions.set(guild.id, {
				playback: "default",
				channelId: connection.joinConfig.channelId!,
			});
			return null;
		} else {
			this.subscriptions.set(guild.id, {
				playback: {
					moshafId: request.moshafId,
					recitationId: request.reciter.id,
				},
				channelId: connection.joinConfig.channelId!,
			});
		}

		if (player.state.request !== "default") {
			return player.state.request.surah;
		}
	}

	private retrieveOrCreatePlayer = async (
		key: Identifier,
		request: PlaybackRequest
	) => {
		const existingPlayer = this.players.get(key);

		if (existingPlayer) {
			return existingPlayer;
		}

		const player = new Player(request);
		await player.init();
		this.players.set(key, player);
		return player;
	};

	refreshOrChangePlayback(guild: Guild, connection: VoiceConnection) {
		const subscription = this.subscriptions.get(guild.id);
		if (!subscription) return;

		const key = getRecitationKeyFromSubscription(subscription);
		const player = this.players.get(key);

		player?.subscribe(connection, guild);
	}

	unsubscribe(guild: Guild) {
		const subscription = this.subscriptions.get(guild.id);
		if (!subscription) return;

		const key = getRecitationKeyFromSubscription(subscription);
		const player = this.players.get(key);

		if (!player) {
			console.log("Player not found");
			return;
		}

		player.unsubscribe(guild);

		if (player.subscriptions.size === 0) {
			player.stop();
			this.players.delete(key);
			this.subscriptions.delete(guild.id);
		}
	}

	reconnect = async () => {
		try {
			console.log("Reconnecting players to guilds");
			await ensureFile(filePath);
			const recitations = await loadRecitations();

			const contents = await readFile(filePath, "utf-8");
			const parsed = JSON.parse(contents) as Map<
				DiscordIdentifier,
				Subscription
			>;

			const entries = Object.entries(parsed) as [
				DiscordIdentifier,
				Subscription
			][];

			await Promise.allSettled(
				entries.map(async ([guildId, { channelId, playback }]) => {
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
								entersState(
									connection,
									VoiceConnectionStatus.Signalling,
									5_000
								),
								entersState(
									connection,
									VoiceConnectionStatus.Connecting,
									5_000
								),
							]);
						} catch {
							connection.destroy();
							connection.removeAllListeners();
							this.unsubscribe(guild);
							console.log(`Failed to reconnect to guild ${guild.name}`);
						}
					});

					if (connection.state.status !== VoiceConnectionStatus.Ready) {
						await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
					}

					const channel = (await guild.channels.fetch(
						channelId
					)) as VoiceChannel;

					if (channel.members.size === 1) {
						log(
							`No members in channel ${channel.name} in guild ${guild.name} - skipping...`
						);
						return;
					}

					if (playback === "default") {
						await this.subscribe("default", connection, guild);
					} else {
						const reciter = recitations.find(
							(recitation) => recitation.id === playback.recitationId
						);

						if (!reciter) {
							await this.subscribe("default", connection, guild);
						}

						const moshaf = reciter!.moshaf.find(
							(moshaf) => moshaf.id === playback.moshafId
						);

						if (!moshaf) {
							await this.subscribe("default", connection, guild);
						}

						const request: PlaybackRequest = {
							moshafId: moshaf!.id,
							reciter: reciter!,
							surah: 1,
						};

						await this.subscribe(request, connection, guild);
					}
				})
			);
		} catch (error) {
			log("Couldn't load memory cache file", error);
		}

		// TODO: store which surah each player is currently playing so the bot can
		// continue playing the same surah after recovery
		setInterval(async () => {
			try {
				console.log(`Writing ${this.subscriptions.size} subscriptions`);
				await writeFile(
					filePath,
					JSON.stringify(Object.fromEntries(this.subscriptions.entries()))
				);
			} catch (error) {
				console.log("Couldn't write memory cache file", error);
			}
		}, 1000 * 5);
	};
}

export const playerManager = new PlayerManager();
