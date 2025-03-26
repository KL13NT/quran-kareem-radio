import {
	getVoiceConnection,
	joinVoiceChannel,
	type DiscordGatewayAdapterCreator,
	entersState,
	VoiceConnectionStatus,
} from "@discordjs/voice";
import {
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	type Guild,
	type GuildMember,
	type VoiceState,
	PermissionFlagsBits,
} from "discord.js";
import { client } from "~/controllers/client";
import { connections } from "~/controllers/connections";
import { playerManager } from "~/controllers/player-manager";
import type { CommandType, RecitationEdition } from "~/types";
import memoize from "lodash.memoize";

/**
 * Memoizes the loading of recitations. Cleared every 24 hours.
 */
const loadRecitations = memoize(async () => {
	// "https://raw.githubusercontent.com/islamic-network/cdn/master/info/cdn_surah_audio.json"
	const editions: RecitationEdition[] = await fetch(
		"https://www.mp3quran.net/api/v3/reciters?language=ar"
	)
		.then((res) => res.json())
		.then((data) => data.reciters);

	return editions;
});

setInterval(() => {
	if (loadRecitations.cache.clear) {
		loadRecitations.cache.clear();
	}
}, 1000 * 60 * 60 * 24 /* 24 hours */);

const { CLIENT_ID } = process.env;

const connect = async (interaction: ChatInputCommandInteraction) => {
	await interaction.deferReply();

	const member = interaction.member as GuildMember;
	const guild = interaction.guild as Guild;

	const { channel: requestChannel } = member.voice;
	const existingConnection = getVoiceConnection(guild.id);
	const state = guild.voiceStates.resolve(CLIENT_ID as unknown as VoiceState);
	const connected = Boolean(existingConnection && state && state.channelId);

	if (!requestChannel) {
		await interaction.editReply(`You're not connected to a voice channel`);
		return;
	}

	// TODO: continue, uncomment
	// if (
	// 	connected &&
	// 	state.channelId === requestChannel.id &&
	// 	existingConnection?.joinConfig?.channelId === requestChannel.id
	// ) {
	// 	playerManager.subscribe(existingConnection, interaction.guild!);
	// 	await interaction.editReply(
	// 		`I'm already connected to this channel. Refreshing playback just in case...`
	// 	);
	// 	return;
	// }

	const subcommand = interaction.options.getSubcommand();
	const reciterValue = interaction.options.getString("reciter");
	const moshafValue = interaction.options.getString("moshaf");

	// TODO: handle loose user-input
	if (subcommand === "recitation" && (!reciterValue || !moshafValue)) {
		await interaction.editReply(`Invalid command options`);
		return;
	}

	if (
		!requestChannel
			.permissionsFor(client.user!)!
			.has([
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.Connect,
				PermissionFlagsBits.Speak,
			])
	) {
		await interaction.editReply(
			`I don't have the permissions to connect to this channel.`
		);
		return;
	}

	if (existingConnection) {
		existingConnection.disconnect();
		existingConnection.destroy();
	}

	const newConnection = joinVoiceChannel({
		channelId: requestChannel.id,
		guildId: requestChannel.guild.id,
		adapterCreator: requestChannel.guild
			.voiceAdapterCreator as DiscordGatewayAdapterCreator,
	});

	newConnection.configureNetworking();

	await entersState(newConnection, VoiceConnectionStatus.Ready, 5_000);

	if (subcommand === "radio") {
		playerManager.subscribe("default", newConnection, guild);
		connections.add(requestChannel.guild.id, requestChannel.id);
		await interaction.editReply(
			`Playing إذاعة القرآن الكريم من القاهرة in ${requestChannel.name}`
		);
		return;
	}

	const recitations = await loadRecitations();

	const recitation = recitations.find(
		(edition) => edition.id === Number(reciterValue)
	);

	if (!recitation) {
		await interaction.editReply(`Invalid recitation selected`);
		return;
	}

	const moshaf = recitation.moshaf.find(
		(moshaf) => moshaf.id === Number(moshafValue)
	);

	if (!moshaf) {
		await interaction.editReply(`Invalid moshaf selected`);
		return;
	}

	playerManager.subscribe(
		{
			moshafId: String(moshaf.id),
			reciter: recitation,
		},
		newConnection,
		guild
	);
	await interaction.editReply(
		`Playing ${recitation.name}-${moshaf.name} in ${requestChannel.name}`
	);
};

const selectReciter = async (interaction: AutocompleteInteraction) => {
	const recitations = await loadRecitations();

	console.log(recitations);
	const defaultOption = {
		name: "إذاعة القرآن الكريم من القاهرة",
		id: "default",
		language: "ar",
	};
	const focusedOption = interaction.options.getFocused(true);

	const editionsAsOptions = [defaultOption, ...recitations]
		.filter((edition) =>
			edition.name.toLowerCase().includes(focusedOption.value.toLowerCase())
		)
		.slice(0, 24)
		.map((edition) => ({
			name: edition.name,
			value: String(edition.id),
		}));

	// console.log(editionsAsOptions);

	await interaction.respond(editionsAsOptions);
};

const selectMoshaf = async (interaction: AutocompleteInteraction) => {
	const recitations = await loadRecitations();
	const selectedRecitation = interaction.options.get("reciter");

	console.log(selectedRecitation);
	if (!selectedRecitation) {
		await interaction.respond([]);
		return;
	}

	const focusedOption = interaction.options.getFocused(true);

	const selectedRecitationObject = recitations.find(
		(recitation) => String(recitation.id) === String(selectedRecitation.value)
	);

	if (!selectedRecitationObject) {
		await interaction.respond([]);
		return;
	}

	const moshafOptions = selectedRecitationObject.moshaf.map((moshaf) => ({
		name: moshaf.name,
		value: String(moshaf.id),
	}));

	console.log(moshafOptions);

	await interaction.respond(moshafOptions);
};

export default {
	name: "connect",
	description:
		"Connects the bot to a voice channel indefinitely or until disconnected",
	run: connect,
	subcommands: [
		{
			name: "radio",
			description: "Play the Egyptian Quran Radio",
		},
		{
			name: "recitation",
			description: "Play a specific recitation instead of Quran Radio",
			options: [
				{
					name: "reciter",
					description: "Select a reciter or stream the Egyptian Quran Radio",
					autocomplete: true,
					required: true,
					method: selectReciter,
				},
				{
					name: "moshaf",
					description: "Select a moshaf edition",
					autocomplete: true,
					required: true,
					method: selectMoshaf,
				},
			],
		},
	],
} as CommandType;
