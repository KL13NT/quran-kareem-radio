import { resolve } from "path";
import { access, constants, readFile, writeFile } from "node:fs/promises";

const filePath = resolve(__dirname, "../../", "connections.json");

async function exists(filePath: string) {
	try {
		await access(filePath, constants.F_OK);
		return true;
	} catch (err) {
		return false;
	}
}

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
			if (await exists(filePath)) {
				const contents = await readFile(filePath, "utf-8");
				const parsed = JSON.parse(contents);
				this.data = new Map(Object.entries(parsed));
			}
		} catch (error) {
			console.error("Couldn't load memory cache file", error);
		}

		setInterval(async () => {
			try {
				await writeFile(
					filePath,
					JSON.stringify(Object.fromEntries(this.data.entries()))
				);
			} catch (error) {
				console.error("Couldn't write memory cache file", error);
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
