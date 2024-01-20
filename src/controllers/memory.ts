import { resolve } from "path";
import { writeFile, readFileSync, existsSync } from "fs";
import { promisify } from "util";

const write = promisify(writeFile);
const filePath = resolve(process.cwd(), "memory-cache.json");

class MemoryCache {
	data: Record<string, any>;

	constructor() {
		this.data = {};

		try {
			if (existsSync(filePath)) {
				this.data = JSON.parse(readFileSync(filePath).toString());
			}
		} catch (error) {
			console.error("Couldn't load memory cache file", error);
		}

		setInterval(async () => {
			try {
				await write(filePath, JSON.stringify(this.data));
			} catch (error) {
				console.error("Couldn't write memory cache file", error);
			}
		}, 1000 * 60 /* 1 minute */);
	}

	set(key: string, value: any) {
		this.data[key] = value;
	}

	del(key: string) {
		delete this.data[key];
	}

	keys(search: string) {
		return Object.keys(this.data).filter((key) => {
			if (search.endsWith("*")) {
				return key.startsWith(search.slice(0, -1));
			}
		});
	}
}

export const memory = new MemoryCache();
