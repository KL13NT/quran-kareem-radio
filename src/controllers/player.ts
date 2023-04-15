import { EventEmitter } from "events";
import { Guild } from "discord.js";
import {
	AudioPlayer,
	AudioResource,
	createAudioResource,
	NoSubscriberBehavior,
	VoiceConnection,
} from "@discordjs/voice";

const { MODE, STREAM } = process.env;

export const createAudioPlayerSource = () =>
	createAudioResource(STREAM, {
		silencePaddingFrames: 0,
	});

class Player extends EventEmitter {
	resource!: AudioResource;

	player!: AudioPlayer;

	init = () => {
		while (true) {
			try {
				this.resource = createAudioPlayerSource();
				break;
			} catch (error) {
				console.log(
					`error: while trying to init resource ${(error as Error).message}`
				);
			}
		}

		this.attachListeners();
		this.player = new AudioPlayer({
			debug: MODE === "DEVELOPMENT",
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Play,
			},
		});

		this.player.on("error", (error) => {
			console.error(`error: ${error.message}`);
		});

		this.player.on("stateChange", (change) => {
			console.log(`Player status changed to ${change.status}`);
		});

		this.player.play(this.resource);
	};

	handleStreamErrors = (message: string) => (reason: string | Error | void) => {
		console.log(message, reason);

		if (this.resource) {
			this.resource.playStream.removeAllListeners();
			this.resource.playStream.destroy();
		}

		console.log("Creating another audio source");

		const interval = setInterval(() => {
			try {
				this.resource = createAudioPlayerSource();

				if (this.resource.started && this.resource.readable && this.player) {
					console.log("New source stream is readable");

					this.player.play(this.resource);
					this.attachListeners();
					clearInterval(interval);
				} else {
					console.log("New source stream is NOT readable");
				}
			} catch (error) {
				console.log(
					`error: stream error when retrying ${(error as Error).message} `
				);
			}
		}, 5000);
	};

	attachListeners = () => {
		this.resource.playStream.on(
			"error",
			this.handleStreamErrors("Stream error")
		);

		this.resource.playStream.on(
			"close",
			this.handleStreamErrors("Stream closed")
		);

		this.resource.playStream.on("end", this.handleStreamErrors("Stream ended"));

		this.resource.playStream.on(
			"pause",
			this.handleStreamErrors("Stream paused")
		);
	};

	subscribe = (connection: VoiceConnection, guild: Guild) => {
		console.log(`subscribing ${guild.name}`);
		connection.subscribe(this.player);
	};
}

export const player = new Player();
