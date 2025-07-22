import { createAudioResource } from "@discordjs/voice";
import prism from "prism-media";
import { Readable } from "stream";
import type { PlaybackRequest } from "~/types";
import { Throttle } from "stream-throttle";
import https from "https";
import http from "http";

export const createResourceURL = (data: PlaybackRequest) => {
	if (data.id === "default") {
		return `${data.server}?${Date.now()}`;
	}

	const { surah, server } = data;

	return `${server}/${surah!.toString().padStart(3, "0")}.mp3`;
};

interface ThrottleOptions {
	rate?: number; // bytes per second
	chunkSize?: number; // chunk size in bytes
}

// Simple HTTP stream creation
async function createHttpStream(url: string): Promise<Readable> {
	return new Promise<Readable>((resolve, reject) => {
		const parsedUrl = new URL(url);
		const client = parsedUrl.protocol === "https:" ? https : http;

		const request = client.get(url, (response) => {
			if (response.statusCode !== 200) {
				reject(new Error(`HTTP error! status: ${response.statusCode}`));
				return;
			}

			// Response is already a readable stream
			resolve(response);
		});

		request.on("error", reject);
		request.setTimeout(30000, () => {
			request.destroy();
			reject(new Error("Request timeout"));
		});
	});
}

// Create throttled HTTP stream
async function createThrottledHttpStream(
	url: string,
	options: ThrottleOptions = {}
): Promise<Readable> {
	const {
		rate = 512 * 1024, // Default 512 KB/s
		chunkSize = 1024, // Default 1KB chunks
	} = options;

	const httpStream = await createHttpStream(url);

	// Create throttle stream
	const throttle = new Throttle({ rate, chunksize: chunkSize });

	// Pipe HTTP stream through throttle
	return httpStream.pipe(throttle);
}

const createFFmpegStream = async (url: string, seek = 0) => {
	const stream = await createThrottledHttpStream(url);
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
	const stream = await createFFmpegStream(url);
	return createAudioResource(stream);
};
