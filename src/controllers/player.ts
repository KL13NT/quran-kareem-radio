import { EventEmitter } from "events";
import { Guild } from "discord.js";
import {
	AudioPlayer,
	AudioResource,
	createAudioPlayer,
	createAudioResource,
	NoSubscriberBehavior,
	VoiceConnection,
	type PlayerSubscription,
} from "@discordjs/voice";
import { logger } from "~/utils/logger";

const { STREAM } = process.env;

const log = logger.create("player");

export const createAudioPlayerSource = () => {
	const url = `${STREAM}?${Date.now()}`;
	log(`Creating ${url} stream`);

	const resource = createAudioResource(url);

	return resource;
};

declare interface Player {
	// eslint-disable-next-line no-unused-vars
	on(event: "playing", listener: () => void): this;
}

const attachPlayerListeners = (player: AudioPlayer) => {
	player.on("error", (error) => {
		log(`Player error`, error);
		player.play(createAudioPlayerSource());
	});

	player.on("debug", (info) => {
		log(info);

		if (
			info.includes('"status":"idle"') ||
			info.includes('"status":"autopaused"')
		) {
			player.play(createAudioPlayerSource());
		}
	});
};

class Player extends EventEmitter {
	resource!: AudioResource;
	player!: AudioPlayer;
	subscriptions = new Map<string, PlayerSubscription>();

	init = () => {
		const interval = setInterval(() => {
			try {
				const player = createAudioPlayer({
					debug: true,
					behaviors: {
						noSubscriber: NoSubscriberBehavior.Play,
					},
				});

				this.player = player;
				player.play(createAudioPlayerSource());
				player.once("playing", () => {
					this.emit("playing");
					clearInterval(interval);
					attachPlayerListeners(player);
				});
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

export const player = new Player();
