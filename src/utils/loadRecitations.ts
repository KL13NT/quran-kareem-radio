import memoize from "lodash/memoize";
import type {
	MappedRecitationEdition,
	RecitationEdition,
	Response,
} from "~/types";

export const surahs = [
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

export const translateSurahNumber = (surah: number) => surahs[surah - 1];

export const transformSurahList = (surahList: number[]) =>
	surahList.map(translateSurahNumber);

/**
 * Memoizes the loading of recitations. Cleared every 24 hours.
 */
export const loadRecitations = memoize(async () => {
	console.log("Loading recitations");
	const editions: RecitationEdition[] = await fetch(
		"https://www.mp3quran.net/api/v3/reciters?language=ar"
	)
		.then((res) => res.json())
		.then((data) => (data as Response).reciters);

	const mappedEditions = editions
		.map((edition) => {
			const filteredMoshafs = edition.moshaf.filter(
				(moshaf) =>
					!moshaf.name.includes("معلم") && !moshaf.name.includes("مجود")
			);

			if (filteredMoshafs.length === 0) {
				return null;
			}

			return filteredMoshafs.map((moshaf) => {
				return {
					id: `${edition.id}-${moshaf.id}`,
					name: `${edition.name} ${moshaf.name}`,
					surahs: JSON.parse(`[${moshaf.surah_list}]`) as number[],
					server: moshaf.server,
				};
			});
		})
		.filter(Boolean)
		.flat();

	return [
		{
			id: "default",
			name: "إذاعة القرآن الكريم من القاهرة - Cairo's Quran Karim Radio",
			server: process.env.STREAM,
		},
		...mappedEditions,
	] as MappedRecitationEdition[];
});

setInterval(() => {
	if (loadRecitations.cache.clear) {
		console.log("Clearing recitations cache");
		loadRecitations.cache.clear();
	}
}, 1000 * 60 * 60 * 24 /* 24 hours */);
