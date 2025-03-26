import { EventEmitter } from "events";
import { Guild } from "discord.js";
import {
	AudioPlayer,
	createAudioPlayer,
	NoSubscriberBehavior,
	VoiceConnection,
	type AudioResource,
	type PlayerSubscription,
} from "@discordjs/voice";
import { logger } from "~/utils/logger";
import { createAudioPlayerResource } from "~/utils/createAudioPlayerResource";
import type { PlaybackRequest } from "~/types";

const log = logger.create("player");

export declare interface Player {
	// eslint-disable-next-line no-unused-vars
	on(event: "playing", listener: () => void): this;
}

const removePlayerListeners = (player: AudioPlayer) => {
	log("Removing player listeners");
	player.removeAllListeners();
};

// const attachPlayerListeners = (player: AudioPlayer, url?: ResourceURL) => {
// 	log("Attaching player listeners");
// 	player.on("error", (error) => {
// 		log(`Player error`, error);
// 		removePlayerListeners(player);
// 		player.once("playing", () => {
// 			attachPlayerListeners(player, url);
// 		});
// 		player.play(createAudioPlayerResource(url));
// 	});

// 	player.on("debug", (info) => {
// 		log(info);

// 		if (
// 			info.includes('"status":"idle"') ||
// 			info.includes('"status":"autopaused"')
// 		) {
// 			removePlayerListeners(player);
// 			player.once("playing", () => {
// 				attachPlayerListeners(player), url;
// 			});
// 			player.play(createAudioPlayerResource(url));
// 		}
// 	});
// };

type PlayerState = (PlaybackRequest & { surah: number }) | "default";

export class Player extends EventEmitter {
	player: AudioPlayer;
	subscriptions = new Map<string, PlayerSubscription>();
	state: PlayerState;
	resource: AudioResource;

	constructor(request: PlaybackRequest) {
		super();

		const player = createAudioPlayer({
			debug: true,
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Play,
			},
		});

		const resource = createAudioPlayerResource(request);
		player.play(resource);

		this.resource = resource;
		this.player = player;
		this.state =
			request === "default"
				? "default"
				: {
						...request,
						surah: 1,
				  };

		this.player.once("playing", () => {
			this.emit("playing");
			// attachPlayerListeners(player, this.url);
		});

		if (request !== "default") {
			this.resource.playStream.on("end", () => {
				this.changeSurah();
			});
		}
	}

	changeSurah = () => {
		if (this.state === "default") return;

		const nextSurah = this.state.surah === 144 ? 1 : this.state.surah + 1;
		const resource = createAudioPlayerResource(this.state, nextSurah);
		this.player.play(resource);

		this.resource = resource;
		this.state = {
			...this.state,
			surah: nextSurah,
		};
	};

	init = () => {
		const interval = setInterval(() => {
			try {
				this.player.once("playing", () => {
					this.emit("playing");
					clearInterval(interval);
					// attachPlayerListeners(player, this.url);
				});

				this;
			} catch (error) {
				log(`error: while trying to init resource`, error);
			}
		}, 5000);
	};

	subscribe = (connection: VoiceConnection, guild: Guild) => {
		try {
			if (this.subscriptions.has(guild.id)) {
				log(
					`Dismissing subscription request for ${guild.name} since it already exists.`
				);
				return;
			}

			log(`Subscribing ${guild.name}`);
			const subscription = connection.subscribe(this.player);

			if (subscription) {
				this.subscriptions.set(guild.id, subscription);
			}
		} catch (error) {
			log("Subscription failed:", error);
		}
	};

	unsubscribe = (guild: Guild) => {
		log(`Unsubscribing ${guild.name}`);
		const subscription = this.subscriptions.get(guild.id);
		if (!subscription) return;

		subscription.unsubscribe();
		this.subscriptions.delete(guild.id);
	};
}
