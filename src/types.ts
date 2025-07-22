import type {
	AutocompleteInteraction,
	ClientEvents,
	CommandInteraction,
	Interaction,
} from "discord.js";
import type { PlayerManager } from "./controllers/player-manager";
import type { SubscriptionService } from "./services/SubscriptionService";
import type { PlaybackService } from "./services/PlaybackService";

export type DeployCommandsResponse = {
	length: number;
};

// export interface RecitationEdition {
// 	identifier: string;
// 	language: "ar";
// 	name: string;
// 	englishName: string;
// 	format: "audio";
// 	type: "surahbysurah";
// 	bitrate: string;
// }

export interface PlaybackDetails {
	surah: number;
	edition: RecitationEdition;
}

// export type PlaybackRequest =
// 	| Pick<RecitationEdition, "id" | "name">
// 	| "default";

export type CommandOptionBase = {
	name: string;
	description: string;
	required: boolean;
	requiredIf?: (interaction: Interaction) => boolean;
};

export type AutocompleteCommandOption = CommandOptionBase & {
	autocomplete: true;
	method: (interaction: AutocompleteInteraction) => Promise<void>;
};

export type NonAutocompleteCommandOption = CommandOptionBase & {
	autocomplete: false;
};

export type CommandOption =
	| AutocompleteCommandOption
	| NonAutocompleteCommandOption;

export interface BaseCommandType {
	name: string;
	description: string;
	options?: CommandOption[];
}

export interface SubcommandType extends BaseCommandType {
	type: "subcommand";
}

export interface CommandType extends BaseCommandType {
	run: (deps: {
		playerManager: PlayerManager;
		subscriptionService: SubscriptionService;
		playbackService: PlaybackService;
	}) => (interaction: CommandInteraction) => Promise<void>;
	subcommands?: SubcommandType[];
	type: "command";
}

export interface ListenerType<T extends keyof ClientEvents> {
	execute: (deps: {
		playerManager: PlayerManager;
		subscriptionService: SubscriptionService;
		playbackService: PlaybackService;
	}) => (...args: ClientEvents[T]) => Promise<void>;
	name: string;
}

/**
 * Playback audio resource URL
 */
export type ResourceURL = string;
/**
 * Unique API recitation identifier
 */
export type Identifier = string;
/**
 * A DiscordJS identifier
 */
export type DiscordIdentifier = string;

export type RecitationIdentifier = "default" | `${number}-${number}`;

export interface Moshaf {
	id: number;
	name: string;
	server: string;
	surah_total: number;
	moshaf_type: number;
	surah_list: string;
}

export interface MappedMoshaf {
	id: number;
	name: string;
	server: string;
	surah_total: number;
	moshaf_type: number;
	surah_list: number[];
}

export interface RecitationEdition {
	id: number;
	name: string;
	letter: string;
	date: Date;
	moshaf: Moshaf[];
}

export type MappedRecitationEdition =
	| {
			id: Extract<RecitationIdentifier, "default">;
			name: string;
			server: string;
	  }
	// eslint-disable-next-line @typescript-eslint/ban-types
	| {
			id: RecitationIdentifier;
			name: string;
			surahs: number[];
			server: string;
	  };

export interface Response {
	reciters: RecitationEdition[];
}

export type PlaybackRequest = MappedRecitationEdition & { surah: number };
