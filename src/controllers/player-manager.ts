import { type VoiceConnection } from "@discordjs/voice";
import type { Guild } from "discord.js";
import type { DiscordIdentifier, Identifier, PlaybackRequest } from "~/types";
import { EventEmitter } from "stream";
import { Player } from "./player";

// TODO: Continue implementation
// TODO: Add error handling depending on stream type
// TODO: Add refresh logic and other supplementary features
// TODO: Add ongoing stream subscription
export declare interface PlayerManager {
	// eslint-disable-next-line no-unused-vars
	on(event: "playing", listener: () => void): this;
}

export class PlayerManager extends EventEmitter {
	private players = new Map<Identifier, Player>();
	private subscriptionsByResource = new Map<Identifier, DiscordIdentifier[]>();
	private subscriptionsByGuild = new Map<DiscordIdentifier, Identifier[]>();

	// getPlayer(resourceURL: string): Player {
	// 	if (!this.players.has(resourceURL)) {
	// 		const player = new Player();
	// 		player.init(resourceURL);
	// 		this.players.set(resourceURL, player);
	// 	}
	// 	return this.players.get(resourceURL)!;
	// }

	subscribe(
		request: PlaybackRequest,
		connection: VoiceConnection,
		guild: Guild
	) {
		const player = new Player(request);
		player.subscribe(connection, guild);
		this.players.set(
			request === "default" ? "default" : String(request.moshafId),
			player
		);
	}

	// TODO: implement
	refresh() {}

	unsubscribePlayer(resourceURL: string, guild: Guild) {
		const player = this.players.get(resourceURL);
		if (player) {
			player.unsubscribe(guild);
			if (player.subscriptions.size === 0) {
				this.players.delete(resourceURL);
			}
		}
	}
}

export const playerManager = new PlayerManager();
