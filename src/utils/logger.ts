import { resolve } from "node:path";
import { ensureFile } from "~/utils/ensure-file";

const { MODE } = process.env;

const directory =
	MODE === "PRODUCTION"
		? resolve(__dirname, "/data")
		: resolve(__dirname, "../../data");

const filePath =
	MODE === "PRODUCTION"
		? resolve(directory, `logs.json`)
		: resolve(directory, `logs.json`);

class Logger {
	constructor() {
		ensureFile(filePath);
	}

	create(scope: string) {
		return this.log.bind(this, scope);
	}

	log(scope = "GENERIC", ...data: unknown[]) {
		const prefix = MODE === "PRODUCTION" ? "" : `${new Date().toISOString()} `;
		const logEntry = `${prefix}[${scope.toUpperCase()}] ${data.map((log) =>
			String(log).replaceAll(/\n/g, "\n\t")
		)}`;

		console.log(logEntry);
	}
}

export const logger = new Logger();
