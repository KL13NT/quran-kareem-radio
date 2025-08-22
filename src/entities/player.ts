import { EventEmitter } from "events";
import { Guild } from "discord.js";
import {
	AudioPlayer,
	AudioPlayerStatus,
	createAudioPlayer,
	entersState,
	NoSubscriberBehavior,
	VoiceConnection,
	type AudioResource,
	type PlayerSubscription,
} from "@discordjs/voice";
import { createAudioPlayerResource } from "~/utils/createAudioPlayerResource";
import type { PlaybackRequest } from "~/types";
import console from "console";
import type { PlaybackService } from "~/services/PlaybackService";

export declare interface Player {
	// eslint-disable-next-line no-unused-vars
	on(event: "playing", listener: () => void): this;
}

const removePlayerListeners = (player: AudioPlayer, reason?: string) => {
	console.log("[PLAYER]", "Removing player listeners", reason);
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
	bufferingTimeout!: NodeJS.Timeout;

	constructor(
		private readonly playbackService: PlaybackService,
		request: PlaybackRequest
	) {
		super();

		const player = createAudioPlayer({
			debug: true,
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Play,
			},
		});

		this.state = {
			...request,
			surah: request.id === "default" ? 1 : request.surah ?? request.surahs[0],
		};
		this.player = player;
	}

	init = async () => {
		this.resource = await createAudioPlayerResource(this.state);

		this.player.play(this.resource);
		await entersState(this.player, AudioPlayerStatus.Playing, 10000);
		console.log("[PLAYER]", `Player for ${this.state.id} started playing`);
		this.attachPlayerListeners(this.player);

		if (this.state.id !== "default") {
			await this.playbackService.setPlaybackProgress(
				this.state.id,
				this.state.surah
			);
		}
	};

	refresh = async (reason?: string) => {
		removePlayerListeners(
			this.player,
			`Refreshing playback for ${this.state.id}. Reason: ${reason}`
		);
		this.player.stop();
		this.resource = await createAudioPlayerResource(this.state);
		this.attachPlayerListeners(this.player);
		this.player.play(this.resource);
		clearTimeout(this.bufferingTimeout);
	};

	// TODO: add max retries
	attachPlayerListeners = (player: AudioPlayer) => {
		if (player.listeners("error").length > 0) {
			console.log("[PLAYER]", "Listeners already attached", console.trace());
			return;
		}

		console.log("[PLAYER]", "Attaching player listeners");

		player.on(AudioPlayerStatus.Idle, () => {
			console.log(`[PLAYER] Player for ${this.state.id} became idle`);
			if (this.state.id === "default") this.refresh("Player became idle");
			else this.changeSurah();
		});

		player.on("error", (error) => {
			console.log("[PLAYER]", `Player error`, error.message);
			if (this.state.id === "default") this.refresh("Player error");
			else this.changeSurah();
		});
	};

	changeSurah = async () => {
		try {
			removePlayerListeners(this.player, `Changing surah for ${this.state.id}`);

			if (this.state.id === "default") {
				return;
			}

			const { surah, surahs } = this.state;

			const nextSurah = determinePlayableSurah(surahs, surah!);
			const updatedState: PlayerState = {
				...this.state,
				surah: nextSurah,
			};

			await this.playbackService.setPlaybackProgress(this.state.id, nextSurah);
			const resource = await createAudioPlayerResource(updatedState);
			this.state = updatedState;
			this.resource = resource;
			this.player.play(resource);
			this.attachPlayerListeners(this.player);
		} catch (error) {
			console.log("[PLAYER]", error);
		}
	};

	subscribe = async (connection: VoiceConnection, guild: Guild) => {
		try {
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

	stop = async () => {
		removePlayerListeners(
			this.player,
			`Stopping playback for ${this.state.id}`
		);
		this.player.stop();
	};

	getCurrentSurah = () => {
		return this.state.surah;
	};
}
