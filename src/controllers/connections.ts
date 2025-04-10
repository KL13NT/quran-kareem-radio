import { resolve } from "path";
import { readFile, writeFile } from "node:fs/promises";
import { ensureFile } from "~/utils/ensure-file";

const { MODE } = process.env;

const directory =
	MODE === "PRODUCTION"
		? resolve(__dirname, "/data")
		: resolve(__dirname, "../../data");

const filePath =
	MODE === "PRODUCTION"
		? resolve(directory, `connections.json`)
		: resolve(directory, `connections.json`);

class ConnectionsCache {
	/**
	 * Guild ID -> Channel ID
	 */
	data: Map<string, string>;

	constructor() {
		this.data = new Map();
	}

	async init() {
		try {
			await ensureFile(filePath);

			const contents = await readFile(filePath, "utf-8");
			const parsed = JSON.parse(contents);
			this.data = new Map(Object.entries(parsed));
		} catch (error) {
			console.log("Couldn't load memory cache file", error);
		}

		setInterval(async () => {
			try {
				await writeFile(
					filePath,
					JSON.stringify(Object.fromEntries(this.data.entries()))
				);
			} catch (error) {
				console.log("Couldn't write memory cache file", error);
			}
		}, 1000 * 5);
	}

	add(guildId: string, channelId: string) {
		this.data.set(guildId, channelId);
	}

	del(guildId: string) {
		this.data.delete(guildId);
	}

	list() {
		return this.data;
	}

	get(guildId: string) {
		return this.data.get(guildId);
	}
}

export const connections = new ConnectionsCache();
