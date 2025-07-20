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
import { createAudioPlayerResource } from "~/utils/createAudioPlayerResource";
import type { MappedRecitationEdition, PlaybackRequest } from "~/types";
import console from "console";

export declare interface Player {
	// eslint-disable-next-line no-unused-vars
	on(event: "playing", listener: () => void): this;
}

const removePlayerListeners = (player: AudioPlayer) => {
	console.log("[PLAYER]", "Removing player listeners");
	player.removeAllListeners();
};

type PlayerState = PlaybackRequest;

const determinePlayableSurah = (surahs: number[], currentSurah: number) => {
	if (surahs.length === 0) {
		throw new Error("Moshaf has no available surahs");
	}

	const nextAvailableSurah = currentSurah
		? surahs[surahs.indexOf(currentSurah) + 1]
		: surahs[0];

	if (!nextAvailableSurah) {
		return 1;
	}

	return nextAvailableSurah;
};

export class Player extends EventEmitter {
	player: AudioPlayer;
	subscriptions = new Map<string, PlayerSubscription>();
	state!: PlaybackRequest;
	resource!: AudioResource;

	constructor(request: MappedRecitationEdition) {
		super();

		const player = createAudioPlayer({
			debug: true,
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Play,
			},
		});

		console.log({ request });

		this.state = {
			...request,
			surah: request.id === "default" ? 1 : request.surahs[0],
		};
		this.player = player;
	}

	setState = (request: Partial<PlaybackRequest>) => {
		return {
			...this.state,
			request,
			started: new Date(),
		};
	};

	init = async () => {
		this.resource = await createAudioPlayerResource(this.state);

		this.player.once("playing", () => {
			this.emit("playing");
			this.attachPlayerListeners(this.player);
		});

		this.player.play(this.resource);

		if (this.state.id !== "default") {
			this.resource?.playStream.on("error", (error) => {
				console.log("[PLAYER]", "Stream errored", error);
				removePlayerListeners(this.player);
				this.changeSurah();
			});
		}
	};

	refresh = async () => {
		this.player.stop();
		this.resource = await createAudioPlayerResource(this.state);
		this.player.play(this.resource);
	};

	attachPlayerListeners = (player: AudioPlayer) => {
		console.log("[PLAYER]", "Attaching player listeners");
		player.on("error", async (error) => {
			console.log("[PLAYER]", `Player error`, error);
			removePlayerListeners(player);
			this.changeSurah();
		});

		player.on("debug", (info) => {
			console.log("[PLAYER]", info);

			const toRegex = /to.+"status":"(?<status>\w+)"/gm;
			const matched = toRegex.exec(info);

			if (!matched) {
				return;
			}

			const { status } = matched.groups!;
			const isStopped = status === "idle" || status === "autopaused";

			const isSurah = this.state.id !== "default";

			console.log("[PLAYER]", status, isStopped, isSurah);

			if (isStopped && isSurah) {
				// TODO: Should seek here instead or go to the next one
				removePlayerListeners(player);
				player.once("playing", () => {
					this.attachPlayerListeners(player);
				});
				this.changeSurah();
			} else if (isStopped && !isSurah) {
				removePlayerListeners(player);
				this.refresh();
				player.once("playing", () => {
					this.attachPlayerListeners(player);
				});
			}
		});
	};

	changeSurah = async () => {
		try {
			if (this.state.id === "default") {
				return;
			}

			const { surah, surahs } = this.state;

			const nextSurah = determinePlayableSurah(surahs, surah!);
			const updatedState: PlayerState = {
				...this.state,
				surah: nextSurah,
			};

			const resource = await createAudioPlayerResource(updatedState);
			this.state = updatedState;
			this.resource = resource;
			this.player.play(resource);
			this.attachPlayerListeners(this.player);
		} catch (error) {
			console.log("[PLAYER]", error);
		}
	};

	subscribe = (connection: VoiceConnection, guild: Guild) => {
		try {
			if (this.subscriptions.has(guild.id)) {
				console.log(
					"[PLAYER]",
					`Dismissing subscription request for ${guild.name} since it already exists.`
				);
				return;
			}

			console.log("[PLAYER]", `Subscribing ${guild.name}`);
			const subscription = connection.subscribe(this.player);

			if (subscription) {
				this.subscriptions.set(guild.id, subscription);
			}
		} catch (error) {
			console.log("[PLAYER]", "Subscription failed:", error);
		}
	};

	unsubscribe = (guild: Guild) => {
		const subscription = this.subscriptions.get(guild.id);
		if (!subscription) return;

		subscription.unsubscribe();
		this.subscriptions.delete(guild.id);
	};

	stop = () => {
		this.player.stop();
		removePlayerListeners(this.player);
	};

	getCurrentSurah = () => {
		return this.state.surah;
	};
}
