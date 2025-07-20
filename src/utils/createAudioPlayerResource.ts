import { createAudioResource } from "@discordjs/voice";
import prism from "prism-media";
import { Readable } from "stream";
import type { PlaybackRequest } from "~/types";

export const createResourceURL = (data: PlaybackRequest) => {
	if (data.id === "default") {
		return `${data.server}?${Date.now()}`;
	}

	const { surah, server } = data;

	return `${server}/${surah!.toString().padStart(3, "0")}.mp3`;
};

async function createFetchReadStream(url: string, options = {}) {
	const response = await fetch(url, options);
	console.log(url);

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	// Create a custom readable stream
	const readStream = new Readable({
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		read() {}, // No-op, we'll push data manually
	});

	// Check if the response body is a ReadableStream
	if (response.body && response.body.getReader) {
		const reader = response.body.getReader();

		// Read chunks and push to stream
		const processChunk = async () => {
			try {
				const { done, value } = await reader.read();

				if (done) {
					readStream.push(null); // End of stream
					return;
				}

				readStream.push(value);
				processChunk(); // Continue reading
			} catch (error) {
				readStream.destroy();
				console.log(error);
			}
		};

		processChunk();
	} else {
		throw new Error("Response body is not a readable stream");
	}

	return readStream;
}

const createFFmpegStream = async (url: string, seek = 0) => {
	const stream = await createFetchReadStream(url);
	const seekPosition = String(seek);

	const transcoder = new prism.FFmpeg({
		args: [
			"-analyzeduration",
			"0",
			"-loglevel",
			"0",
			"-f",
			"s16le",
			"-ar",
			"48000",
			"-ac",
			"2",
			"-ss",
			seekPosition,
			"-ab",
			"64",
		],
	});

	const s16le = stream.pipe(transcoder);
	const opus = s16le.pipe(
		new prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 })
	);

	return opus;
};

export const createAudioPlayerResource = async (data: PlaybackRequest) => {
	const url = createResourceURL(data);

	if (data.id === "default") {
		return createAudioResource(url);
	}

	const stream = await createFFmpegStream(url);
	return createAudioResource(stream);
};
