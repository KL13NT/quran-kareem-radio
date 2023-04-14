import { createAudioResource } from "@discordjs/voice";

const { STREAM } = process.env;

export const createAudioPlayerSource = () =>
	createAudioResource(STREAM, {
		silencePaddingFrames: 0,
	});
