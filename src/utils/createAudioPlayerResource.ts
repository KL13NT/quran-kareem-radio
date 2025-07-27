import { createAudioResource } from "@discordjs/voice";
import type { Readable } from "stream";
import { Throttle } from "stream-throttle";
import type { PlaybackRequest } from "~/types";
import https from "https";
import http from "http";
import prism from "prism-media";
import { tryWithFallback } from "./try";

export const createResourceURL = (data: PlaybackRequest, fallback = false) => {
	if (data.id === "default") {
		return `${fallback ? data.fallbackServer : data.server}?${Date.now()}`;
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
		let redirectCount = 0;

		const followRedirect = (response: http.IncomingMessage) => {
			if (response.statusCode === 302) {
				redirectCount++;

				if (redirectCount >= 5) {
					reject(new Error("Too many redirects"));
					return;
				}

				const location = response.headers.location;

				if (!location) {
					return reject(new Error("Redirect location not found"));
				}

				const parsedUrl = new URL(location);

				const client = parsedUrl.protocol === "https:" ? https : http;
				const request = client.get(parsedUrl, (res) => {
					followRedirect(res);
				});

				request.on("error", reject);
				request.setTimeout(30000, () => {
					request.destroy();
					reject(new Error("Request timeout"));
				});
			} else if (response.statusCode !== 200) {
				console.log(`[CREATE_AUDIO_PLAYER_RESOURCE] Could not connect ${url}`);
				reject("Resource cannot be loaded");
			} else {
				resolve(response);
			}
		};

		const parsedUrl = new URL(url);
		const client = parsedUrl.protocol === "https:" ? https : http;

		const request = client.get(url, followRedirect);

		request.on("error", reject);
		request.setTimeout(10_000, () => {
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
		rate = 16 * 1024, // Default 64kbps
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
	const stream = await tryWithFallback(
		() => createFFmpegStream(createResourceURL(data, false)),
		() => createFFmpegStream(createResourceURL(data, true))
	);

	return createAudioResource(stream);
};
