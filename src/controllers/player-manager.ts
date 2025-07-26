import {
	entersState,
	getVoiceConnection,
	joinVoiceChannel,
	VoiceConnectionStatus,
	type DiscordGatewayAdapterCreator,
	type VoiceConnection,
} from "@discordjs/voice";
import { VoiceChannel, type Guild } from "discord.js";
import type {
	DiscordIdentifier,
	Identifier,
	MappedRecitationEdition,
	PlaybackRequest,
	RecitationIdentifier,
} from "~/types";
import { EventEmitter } from "stream";
import { Player } from "../entities/player";
import console, { log } from "node:console";
import { client } from "./client";
import { loadRecitations } from "~/utils/loadRecitations";
import { canConnect } from "~/utils/can-connect";
import type { SubscriptionService } from "~/services/SubscriptionService";
import type { PlaybackService } from "~/services/PlaybackService";

export declare interface PlayerManager {
	// eslint-disable-next-line no-unused-vars
	on(event: "playing", listener: () => void): this;
}

export class PlayerManager extends EventEmitter {
	/**
	 * Maps
	 */
	private players = new Map<Identifier, Player>();

	constructor(
		private readonly playbackService: PlaybackService,
		private readonly subscriptionService: SubscriptionService
	) {
		super();
	}

	async subscribe(
		request: MappedRecitationEdition,
		connection: VoiceConnection,
		guild: Guild,
		channelId: DiscordIdentifier
	) {
		const subscription = await this.subscriptionService.getGuildSubscription(
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
			await this.unsubscribe(guild, true);
		}

		console.log(
			`[PLAYER-MANAGER] Subscribing ${guild.name} to ${request.name}`
		);
		await player.subscribe(connection, guild);

		if (!sameRecitation) {
			console.log(
				`[PLAYER-MANAGER] Switching ${guild.name} to ${request.name}`
			);
			await this.subscriptionService.subscribeGuild(
				guild.id,
				channelId,
				request.id
			);
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

	private retrieveOrCreatePlayer = async (
		request: MappedRecitationEdition & { surah?: number }
	) => {
		const existingPlayer = this.players.get(request.id);

		if (existingPlayer) {
			return existingPlayer;
		}

		const player = new Player(this.playbackService, {
			...request,
			surah: request.surah || 1,
		});
		this.players.set(request.id, player);

		await player.init();
		return player;
	};

	async isGuildSubscribed(guildId: DiscordIdentifier) {
		const recitation = await this.subscriptionService.getGuildSubscription(
			guildId
		);

		if (!recitation) {
			return false;
		}

		const player = this.players.get(recitation.recitation_id);

		if (!player) {
			return false;
		}

		return player.isGuildSubscribed(guildId);
	}

	async refresh(guild: Guild, connection: VoiceConnection) {
		const recitations = await loadRecitations();
		const subscription = await this.subscriptionService.getGuildSubscription(
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

		await player?.subscribe(connection, guild);
	}

	async unsubscribe(guild: Guild, playerOnly = false) {
		const data = await this.subscriptionService.getGuildSubscription(guild.id);

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
			await player.stop();
			this.players.delete(data.recitation_id);
		}

		if (!playerOnly) {
			await this.subscriptionService.unsubscribeGuild(guild.id);
		}
	}

	reconnect = async () => {
		try {
			console.log("Reconnecting players to guilds");

			const subscriptions = await this.subscriptionService.getAllRecitations();
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

			const expectedRecitations = Array.from(
				new Set(subscriptions.map((subscription) => subscription.recitation_id))
			);

			const playbacks = await this.playbackService.bulkGetPlaybackProgress(
				expectedRecitations
			);

			if (!playbacks) return;

			playbacks.forEach(async ({ surah }, index) => {
				const expectedRecitation = expectedRecitations[index];

				console.log(
					`Found expected recitation ${expectedRecitation} at surah ${surah}`
				);

				const expectedRecitationObject = recitations.find(
					(recitation) => recitation.id === expectedRecitation
				)!;

				try {
					await this.retrieveOrCreatePlayer({
						...expectedRecitationObject,
						surah: surah ?? 1,
					});
				} catch (error) {
					console.log(
						`[PLAYER-MANAGER] FATAL on reconnect ${surah}`,
						(error as Error).message
					);
				}
			});

			for (const { channelId, guildId, id } of requests) {
				try {
					const guild = await client.guilds.fetch(guildId);
					if (!guild) return;

					if (!canConnect(guild, channelId)) {
						console.log(
							`[PLAYER-MANAGER] Can't connect to guild ${guild.name} ${guild.id} due to missing permissions`
						);
						return;
					}

					const channel = (await guild.channels.fetch(
						channelId
					)!) as VoiceChannel;

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

					if (channel.members.size === 0) {
						console.log(
							`[PLAYER-MANAGER] Guild ${guild.name} ${guild.id} has no members. Ignoring reconnect until someone joins.`
						);
						return;
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
				} catch (error) {
					console.log(
						`[PLAYER-MANAGER] Couldn't reconnect to guild ${guildId}`,
						(error as Error).message
					);
				}
			}
		} catch (error) {
			log("Couldn't reconnect", error);
		}
	};
}
