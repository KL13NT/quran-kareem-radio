import type {
	AutocompleteInteraction,
	CommandInteraction,
	Interaction,
} from "discord.js";

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
	run: (interaction: CommandInteraction) => Promise<void>;
	subcommands?: SubcommandType[];
	type: "command";
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

// export type URLCreationRequest =
// 	| (PlaybackRequest & { surah: number })
// 	| "default";

export interface Response {
	reciters: RecitationEdition[];
}

export interface RecitationEdition {
	id: number;
	name: string;
	letter: string;
	date: Date;
	moshaf: Moshaf[];
}

export interface Moshaf {
	id: number;
	name: string;
	server: string;
	surah_total: number;
	moshaf_type: number;
	surah_list: string;
}

export type SurahPlaybackRequest = {
	moshafId: number;
	reciter: RecitationEdition;
	surah: number;
};

export type PlaybackRequest = SurahPlaybackRequest | "default";

export type URLCreationRequest =
	| (PlaybackRequest & { surah: number })
	| "default";
