import memoize from "lodash/memoize";
import type { RecitationEdition, Response } from "~/types";

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

	return editions
		.map((edition) => {
			const moshaf = edition.moshaf.filter(
				(moshaf) =>
					!moshaf.name.includes("معلم") && !moshaf.name.includes("مجود")
			);

			if (moshaf.length === 0) {
				return null;
			}

			return {
				...edition,
				moshaf,
			};
		})
		.filter(Boolean);
});

setInterval(() => {
	if (loadRecitations.cache.clear) {
		console.log("Clearing recitations cache");
		loadRecitations.cache.clear();
	}
}, 1000 * 60 * 60 * 24 /* 24 hours */);
