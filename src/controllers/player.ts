import { EventEmitter } from "events";
import { Guild } from "discord.js";
import {
	AudioPlayer,
	AudioPlayerStatus,
	AudioResource,
	createAudioPlayer,
	createAudioResource,
	NoSubscriberBehavior,
	VoiceConnection,
	type PlayerSubscription,
} from "@discordjs/voice";

const { MODE, STREAM } = process.env;

export const createAudioPlayerSource = () =>
	createAudioResource(`${STREAM}?${Date.now()}`, {
		silencePaddingFrames: 0,
	});

declare interface Player {
	on(event: "playing", listener: () => void): this;
}

class Player extends EventEmitter {
	resource!: AudioResource;
	player!: AudioPlayer;
	subscriptions = new Map<string, PlayerSubscription>();

	init = () => {
		const interval = setInterval(() => {
			try {
				const player = createAudioPlayer({
					debug: MODE === "DEVELOPMENT",
					behaviors: {
						noSubscriber: NoSubscriberBehavior.Play,
					},
				});

				player.play(createAudioPlayerSource());

				player.on("error", (error) => {
					console.error(`Player error`, error);
					player.play(createAudioPlayerSource());
				});

				player.on("stateChange", (change) => {
					console.log(`Player status changed to ${change.status}`);
				});

				player.on(AudioPlayerStatus.Playing, () => {
					this.emit("playing");
				});

				this.player = player;
				clearInterval(interval);
			} catch (error) {
				console.log(`error: while trying to init resource`, error);
			}
		}, 5000);
	};

	subscribe = (connection: VoiceConnection, guild: Guild) => {
		console.log(`Subscribing ${guild.name}`);
		try {
			const subscription = connection.subscribe(this.player);
			this.subscriptions.set(guild.id, subscription);
		} catch (error) {
			console.error("Subscription failed:", error);
		}
	};

	unsubscribe = (guild: Guild) => {
		console.log(`Unsubscribing ${guild.name}`);
		const subscription = this.subscriptions.get(guild.id);
		if (!subscription) return;

		subscription.unsubscribe();
		this.subscriptions.delete(guild.id);
	};
}

export const player = new Player();
