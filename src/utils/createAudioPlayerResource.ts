import { createAudioResource } from "@discordjs/voice";
import type { PlaybackRequest, URLCreationRequest } from "~/types";

const { STREAM } = process.env;

export const createResourceURL = (data: URLCreationRequest) => {
	if (data === "default") {
		return `${STREAM}?${Date.now()}`;
	}

	const { moshafId, reciter, surah } = data;
	const moshaf = reciter.moshaf.find(
		(moshaf) => moshaf.id === Number(moshafId)
	)!;

	return `${moshaf?.server}/${surah.toString().padStart(3, "0")}.mp3`;
};

export const createAudioPlayerResource = (data: PlaybackRequest, surah = 1) => {
	const url = createResourceURL(
		data === "default"
			? "default"
			: {
					...data,
					surah,
			  }
	);

	return createAudioResource(url);
};
