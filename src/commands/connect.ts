import {
	entersState,
	getVoiceConnection,
	joinVoiceChannel,
	VoiceConnectionStatus,
	type DiscordGatewayAdapterCreator,
} from "@discordjs/voice";
import {
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	type Guild,
	type GuildMember,
	PermissionFlagsBits,
} from "discord.js";
import { client } from "~/controllers/client";
import { playerManager } from "~/controllers/player-manager";
import type { CommandType } from "~/types";
import { loadRecitations, translateSurahNumber } from "~/utils/loadRecitations";

const createVoiceConnection = async (
	channelId: string,
	guildId: string,
	adapterCreator: DiscordGatewayAdapterCreator
) => {
	const existingConnection = getVoiceConnection(guildId);

	if (
		existingConnection &&
		existingConnection.state.status === VoiceConnectionStatus.Ready
	) {
		console.log(
			`[VOICE] Voice connection already exists for guild ${guildId}, reusing it`
		);
		return existingConnection;
	}

	const newConnection = joinVoiceChannel({
		channelId,
		guildId,
		adapterCreator,
	});

	newConnection.configureNetworking();

	console.log(
		`[VOICE] Joining voice channel ${channelId} for guild ${guildId}`
	);
	await entersState(newConnection, VoiceConnectionStatus.Ready, 5_000);
	console.log(`[VOICE] Joined voice channel ${channelId} for guild ${guildId}`);

	return newConnection;
};

const connect = async (interaction: ChatInputCommandInteraction) => {
	await interaction.deferReply();

	const member = interaction.member as GuildMember;
	const guild = interaction.guild as Guild;

	const { channel: requestChannel } = member.voice;

	if (!requestChannel) {
		await interaction.editReply(`You're not connected to a voice channel`);
		return;
	}

	const subcommand = interaction.options.getSubcommand();
	const reciterValue = interaction.options.getString("reciter");
	const voiceConnection = await createVoiceConnection(
		requestChannel.id,
		guild.id,
		guild!.voiceAdapterCreator
	);

	if (subcommand === "recitation" && !reciterValue) {
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

	const recitations = await loadRecitations();

	if (subcommand === "radio") {
		await playerManager.subscribe(
			recitations.find((recitation) => recitation.id === "default")!,
			voiceConnection,
			guild,
			requestChannel.id
		);

		await interaction.editReply(
			`Playing إذاعة القرآن الكريم من القاهرة in ${requestChannel.name}`
		);
		return;
	}

	const recitation = recitations.find((edition) => edition.id === reciterValue);

	if (!recitation) {
		await interaction.editReply(`Invalid recitation selected`);
		return;
	}

	const surah = await playerManager.subscribe(
		recitation,
		voiceConnection,
		guild,
		requestChannel.id
	);

	const surahName = translateSurahNumber(surah!);

	await interaction.editReply(
		`▶ ${surahName}\n👳‍♂️ ${recitation.name}\n📍 ${requestChannel.name}`
	);
};

const selectReciter = async (interaction: AutocompleteInteraction) => {
	const recitations = await loadRecitations();
	const focusedOption = interaction.options.getFocused(true);

	const editionsAsOptions = recitations
		.filter((edition) =>
			edition.name.toLowerCase().includes(focusedOption.value.toLowerCase())
		)
		.slice(0, 24)
		.map((edition) => ({
			name: edition.name,
			value: String(edition.id),
		}));

	await interaction.respond(editionsAsOptions);
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
			],
		},
	],
} as CommandType;
