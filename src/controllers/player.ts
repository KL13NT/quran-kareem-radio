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
import type { Moshaf, PlaybackRequest, SurahPlaybackRequest } from "~/types";

export declare interface Player {
	// eslint-disable-next-line no-unused-vars
	on(event: "playing", listener: () => void): this;
}

const removePlayerListeners = (player: AudioPlayer) => {
	console.log("Removing player listeners");
	player.removeAllListeners();
};

type PlayerState = {
	request: PlaybackRequest;
	started: Date;
};

const determinePlayableSurah = (moshaf: Moshaf, currentSurah?: number) => {
	const { surah_list } = moshaf;

	const availableSurahs = JSON.parse(`[${surah_list}]`) as number[];

	if (availableSurahs.length === 0) {
		throw new Error("Moshaf has no available surahs");
	}

	const nextAvailableSurah = currentSurah
		? availableSurahs[availableSurahs.indexOf(currentSurah) + 1]
		: availableSurahs[0];

	if (!nextAvailableSurah) {
		return -1;
	}

	return Number(nextAvailableSurah);
};

export class Player extends EventEmitter {
	player: AudioPlayer;
	subscriptions = new Map<string, PlayerSubscription>();
	state!: PlayerState;
	resource!: AudioResource;

	constructor(request: PlaybackRequest) {
		super();

		const player = createAudioPlayer({
			debug: true,
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Play,
			},
		});

		if (request === "default") {
			this.state = {
				request: "default",
				started: new Date(),
			};
		} else {
			const moshaf = request.reciter.moshaf.find(
				(moshaf) => moshaf.id === Number(request.moshafId)
			);

			this.state = {
				request: {
					...request,
					surah: determinePlayableSurah(moshaf!),
				},
				started: new Date(),
			};
		}

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
		this.resource = await createAudioPlayerResource(this.state.request);

		this.player.once("playing", () => {
			this.emit("playing");
			this.attachPlayerListeners(this.player);
		});

		this.player.play(this.resource);

		if (this.state.request !== "default") {
			this.resource?.playStream.on("error", (error) => {
				console.log("Stream errored", error);
				removePlayerListeners(this.player);
				this.changeSurah();
			});
		}
	};

	refresh = async () => {
		this.player.stop();
		this.resource = await createAudioPlayerResource(this.state.request);
		this.player.play(this.resource);
	};

	attachPlayerListeners = (player: AudioPlayer) => {
		console.log("Attaching player listeners");
		player.on("error", async (error) => {
			console.log(`Player error`, error);
			removePlayerListeners(player);
			this.changeSurah();
		});

		player.on("debug", (info) => {
			console.log(info);

			const toRegex = /to.+"status":"(?<status>\w+)"/gm;
			const matched = toRegex.exec(info);

			if (!matched) {
				return;
			}

			const { status } = matched.groups!;
			const isStopped = status === "idle" || status === "autopaused";

			const isSurah = this.state.request !== "default";

			console.log(status, isStopped, isSurah);

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
			if (this.state.request === "default") {
				return;
			}

			const { reciter, moshafId, surah } = this.state.request;
			const moshaf = reciter.moshaf.find((moshaf) => moshaf.id === moshafId);

			const nextSurah = determinePlayableSurah(moshaf!, surah);

			if (nextSurah === -1) {
				this.player.play(await createAudioPlayerResource("default"));
				return;
			}

			const updatedState: PlayerState = {
				request: {
					...this.state.request,
					surah: nextSurah,
				},
				started: new Date(),
			};

			const resource = await createAudioPlayerResource(updatedState.request);
			this.state = updatedState;
			this.resource = resource;
			this.player.play(resource);
			this.attachPlayerListeners(this.player);
		} catch (error) {
			console.log(error);
		}
	};

	subscribe = (connection: VoiceConnection, guild: Guild) => {
		try {
			if (this.subscriptions.has(guild.id)) {
				console.log(
					`Dismissing subscription request for ${guild.name} since it already exists.`
				);
				return;
			}

			console.log(`Subscribing ${guild.name}`);
			const subscription = connection.subscribe(this.player);

			if (subscription) {
				this.subscriptions.set(guild.id, subscription);
			}
		} catch (error) {
			console.log("Subscription failed:", error);
		}
	};

	unsubscribe = (guild: Guild) => {
		console.log(`Unsubscribing ${guild.name}`);
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
		return (this.state.request as SurahPlaybackRequest)?.surah;
	};
}
