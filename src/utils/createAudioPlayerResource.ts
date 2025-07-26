import { createAudioResource } from "@discordjs/voice";
import type { PlaybackRequest } from "~/types";

export const createResourceURL = (data: PlaybackRequest, fallback = false) => {
	if (data.id === "default") {
		return `${fallback ? data.fallbackServer : data.server}?${Date.now()}`;
	}

	const { surah, server } = data;

	return `${server}/${surah!.toString().padStart(3, "0")}.mp3`;
};

export const createAudioPlayerResource = (
	data: PlaybackRequest,
	fallback = false
) => {
	const resource = createAudioResource(createResourceURL(data, fallback));

	return resource;
};
