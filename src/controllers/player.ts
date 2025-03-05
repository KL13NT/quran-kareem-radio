import { EventEmitter } from "events";
import { Guild } from "discord.js";
import {
	AudioPlayer,
	AudioPlayerStatus,
	AudioResource,
	createAudioPlayer,
	createAudioResource,
	entersState,
	NoSubscriberBehavior,
	VoiceConnection,
	type PlayerSubscription,
} from "@discordjs/voice";

const { MODE, STREAM } = process.env;

export const createAudioPlayerSource = () => {
	const resource = createAudioResource(`${STREAM}?${Date.now()}`, {
		silencePaddingFrames: 0,
	});

	resource.playStream.on("end", () => {
		console.log("Stream ended");
	});

	resource.playStream.on("error", (e) => {
		console.log("Stream error", e);
	});

	resource.playStream.on("pause", () => {
		console.log("Stream paused");
	});

	return resource;
};

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

				const resource = createAudioPlayerSource();

				resource.playStream.on("close", async () => {
					console.log("Stream closed");
					resource.playStream.destroy();

					player.stop(true);

					await entersState(player, AudioPlayerStatus.Idle, 5_000);
					player.play(createAudioPlayerSource());
				});

				player.play(resource);

				player.on("error", (error) => {
					console.error(`Player error`, error);
					player.play(createAudioPlayerSource());
				});

				player.on("debug", (info) => {
					console.log(info);
				});

				player.on("stateChange", (change) => {
					console.log(`Player status changed to ${change.status}`);
				});

				player.on(AudioPlayerStatus.Playing, () => {
					console.log("Player status changed to playing, emitting event");
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
