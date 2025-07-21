import {
	entersState,
	getVoiceConnection,
	joinVoiceChannel,
	VoiceConnectionStatus,
	type DiscordGatewayAdapterCreator,
	type VoiceConnection,
} from "@discordjs/voice";
import { type Guild } from "discord.js";
import type {
	DiscordIdentifier,
	Identifier,
	MappedRecitationEdition,
	PlaybackRequest,
	RecitationIdentifier,
} from "~/types";
import { EventEmitter } from "stream";
import { Player } from "./player";
import console, { log } from "node:console";
import { client } from "./client";
import { loadRecitations } from "~/utils/loadRecitations";
import { subscriptionService } from "~/services/RecitationService";
import { canConnect } from "~/utils/can-connect";

export declare interface PlayerManager {
	// eslint-disable-next-line no-unused-vars
	on(event: "playing", listener: () => void): this;
}

export class PlayerManager extends EventEmitter {
	private players = new Map<Identifier, Player>();

	constructor() {
		super();
	}

	async subscribe(
		request: MappedRecitationEdition,
		connection: VoiceConnection,
		guild: Guild,
		channelId: DiscordIdentifier
	) {
		const subscription = await subscriptionService.getGuildSubscription(
			guild.id
		);

		/**
		 * 1. Server already subscribed on a player
		 * 2. Server is not subscribed on a player
		 *
		 * 1.1. If server is already subscribed, check if it's the same recitation:
		 * do nothing
		 * 1.2. If server is subscribed to a different player:
		 * create a new player & terminate previous player if not listeners exist
		 */

		const sameRecitation = subscription
			? subscription.recitation_id === request.id
			: false;

		const player = await this.retrieveOrCreatePlayer(request);

		const existingPlayer = subscription
			? this.retrievePlayerByRecitationId(
					subscription.recitation_id as RecitationIdentifier
			  )
			: null;

		if (existingPlayer && subscription && !sameRecitation) {
			console.log(
				`[PLAYER-MANAGER] Unsubscribing ${guild.name} from ${existingPlayer.state.name}`
			);
			this.unsubscribe(guild, true);
		}

		console.log(
			`[PLAYER-MANAGER] Subscribing ${guild.name} to ${request.name}`
		);
		player.subscribe(connection, guild);

		if (!sameRecitation) {
			console.log(
				`[PLAYER-MANAGER] Switching ${guild.name} to ${request.name}`
			);
			await subscriptionService.subscribeGuild(guild.id, channelId, request.id);
		}

		if (player.state.id !== "default") {
			return player.state.surah;
		}
	}

	private retrievePlayerByRecitationId = (
		request: MappedRecitationEdition["id"]
	) => {
		return this.players.get(request);
	};

	private retrieveOrCreatePlayer = async (request: MappedRecitationEdition) => {
		const existingPlayer = this.players.get(request.id);

		if (existingPlayer) {
			return existingPlayer;
		}

		const player = new Player(request);
		await player.init();
		this.players.set(request.id, player);
		return player;
	};

	async refresh(guild: Guild, connection: VoiceConnection) {
		const recitations = await loadRecitations();
		const subscription = await subscriptionService.getGuildSubscription(
			guild.id
		);

		if (!subscription) {
			throw new Error(`Subscription not found for guild ${guild.id}`);
		}

		const recitation = recitations.find(
			(recitation) => recitation.id === subscription.recitation_id
		);

		if (!recitation) {
			throw new Error(
				`Couldn't find recitation by id ${subscription.recitation_id}`
			);
		}

		const request: PlaybackRequest = {
			...recitation,
			surah: 1,
		};

		const player = await this.retrieveOrCreatePlayer(request);
		if (!player) {
			throw new Error(
				`Player not found for server ${guild.id} and recitation ${request.id}`
			);
		}

		player?.subscribe(connection, guild);
	}

	async unsubscribe(guild: Guild, playerOnly = false) {
		// TODO: verify
		const data = await subscriptionService.getGuildSubscription(guild.id);

		if (!data) return;

		const player = this.players.get(data.recitation_id);

		if (!player) {
			console.log("Player not found");
			return;
		}

		player.unsubscribe(guild);

		if (player.subscriptions.size === 0) {
			console.log(
				`[PLAYER-MANAGER] Terminating player for ${data.recitation_id}`
			);
			player.stop();
			this.players.delete(data.recitation_id);
		}

		if (!playerOnly) {
			await subscriptionService.unsubscribeGuild(guild.id);
		}
	}

	reconnect = async () => {
		try {
			if (process.env.MODE === "DEVELOPMENT") return;

			console.log("Reconnecting players to guilds");

			const subscriptions = await subscriptionService.getAllRecitations();
			const recitations = await loadRecitations();
			const requests = subscriptions
				.map((subscription) => {
					const foundRecitation = recitations.find(
						(recitation) => recitation.id === subscription.recitation_id
					);

					if (!foundRecitation) return null;

					return {
						guildId: subscription.guild_id,
						channelId: subscription.channel_id,
						id: foundRecitation.id,
						server: foundRecitation.server,
						name: foundRecitation.name,
					};
				})
				.filter(Boolean);

			const expectedRecitations = new Set(
				subscriptions.map((subscription) => subscription.recitation_id)
			);

			for (const expectedRecitation of expectedRecitations) {
				await this.retrieveOrCreatePlayer(
					recitations.find(
						(recitation) => recitation.id === expectedRecitation
					)!
				);
			}

			await Promise.allSettled(
				requests.map(async ({ channelId, guildId, id }) => {
					const guild = await client.guilds.fetch(guildId);
					if (!guild) return;

					if (!canConnect(guild, channelId)) {
						console.log(
							`[PLAYER-MANAGER] Can't connect to guild ${guild.name} ${guild.id} due to missing permissions`
						);
						return;
					}

					const connection =
						getVoiceConnection(guildId) ??
						joinVoiceChannel({
							channelId: channelId,
							guildId: guildId,
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

					const targetRecitation = recitations.find(
						(recitation) => recitation.id === id
					);

					const defaultRecitation = recitations.find(
						(recitation) => recitation.id === "default"
					)!;

					const recitationRequest = {
						...(targetRecitation ?? defaultRecitation),
						surah: 1,
					};

					await this.subscribe(recitationRequest, connection, guild, channelId);
				})
			);
		} catch (error) {
			log("Couldn't load memory cache file", error);
		}
	};
}

export const playerManager = new PlayerManager();
