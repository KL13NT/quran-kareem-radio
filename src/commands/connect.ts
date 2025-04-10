import {
	entersState,
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
import { connections } from "~/controllers/connections";
import { playerManager } from "~/controllers/player-manager";
import type { CommandType } from "~/types";
import { loadRecitations } from "~/utils/loadRecitations";

const surahs = [
	"الفاتحة",
	"البقرة",
	"آل عمران",
	"النساء",
	"المائدة",
	"الأنعام",
	"الأعراف",
	"الأنفال",
	"التوبة",
	"يونس",
	"هود",
	"يوسف",
	"الرعد",
	"ابراهيم",
	"الحجر",
	"النحل",
	"الإسراء",
	"الكهف",
	"مريم",
	"طه",
	"الأنبياء",
	"الحج",
	"المؤمنون",
	"النور",
	"الفرقان",
	"الشعراء",
	"النمل",
	"القصص",
	"العنكبوت",
	"الروم",
	"لقمان",
	"السجدة",
	"الأحزاب",
	"سبإ",
	"فاطر",
	"يس",
	"الصافات",
	"ص",
	"الزمر",
	"غافر",
	"فصلت",
	"الشورى",
	"الزخرف",
	"الدخان",
	"الجاثية",
	"الأحقاف",
	"محمد",
	"الفتح",
	"الحجرات",
	"ق",
	"الذاريات",
	"الطور",
	"النجم",
	"القمر",
	"الرحمن",
	"الواقعة",
	"الحديد",
	"المجادلة",
	"الحشر",
	"الممتحنة",
	"الصف",
	"الجمعة",
	"المنافقون",
	"التغابن",
	"الطلاق",
	"التحريم",
	"الملك",
	"القلم",
	"الحاقة",
	"المعارج",
	"نوح",
	"الجن",
	"المزمل",
	"المدثر",
	"القيامة",
	"الانسان",
	"المرسلات",
	"النبإ",
	"النازعات",
	"عبس",
	"التكوير",
	"الإنفطار",
	"المطففين",
	"الإنشقاق",
	"البروج",
	"الطارق",
	"الأعلى",
	"الغاشية",
	"الفجر",
	"البلد",
	"الشمس",
	"الليل",
	"الضحى",
	"الشرح",
	"التين",
	"العلق",
	"القدر",
	"البينة",
	"الزلزلة",
	"العاديات",
	"القارعة",
	"التكاثر",
	"العصر",
	"الهمزة",
	"الفيل",
	"قريش",
	"الماعون",
	"الكوثر",
	"الكافرون",
	"النصر",
	"المسد",
	"الإخلاص",
	"الفلق",
	"الناس",
];

const { CLIENT_ID } = process.env;

const createVoiceConnection = async (
	channelId: string,
	guildId: string,
	adapterCreator: DiscordGatewayAdapterCreator
) => {
	const newConnection = joinVoiceChannel({
		channelId,
		guildId,
		adapterCreator,
	});

	newConnection.configureNetworking();

	await entersState(newConnection, VoiceConnectionStatus.Ready, 5_000);

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
	const moshafValue = interaction.options.getString("moshaf");

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

	if (subcommand === "radio") {
		const newConnection = await createVoiceConnection(
			requestChannel.id,
			guild.id,
			guild!.voiceAdapterCreator
		);
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

	const newConnection = await createVoiceConnection(
		requestChannel.id,
		guild.id,
		guild!.voiceAdapterCreator
	);

	const surah = await playerManager.subscribe(
		{
			moshafId: moshaf.id,
			reciter: recitation,
			surah: 1,
		},
		newConnection,
		guild
	);

	const surahName = surahs[surah! - 1];

	await interaction.editReply(
		`▶ ${surahName}\n👳‍♂️ ${recitation.name}-${moshaf.name}\n📍 ${requestChannel.name}`
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

const selectMoshaf = async (interaction: AutocompleteInteraction) => {
	const recitations = await loadRecitations();
	const selectedRecitation = interaction.options.get("reciter");
	const selectedRecitationId = Number(selectedRecitation?.value);

	if (!selectedRecitation || Number.isNaN(selectedRecitationId)) {
		await interaction.respond([]);
		return;
	}

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
