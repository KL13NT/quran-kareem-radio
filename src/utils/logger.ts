import { writeFile } from "node:fs/promises";
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
	logs: string[] = [];
	limit = 300;
	fileInterval = 100;

	constructor() {
		ensureFile(filePath);
		setInterval(this.saveLogsToFile, this.fileInterval * 1000);
	}

	create(scope: string) {
		return this.log.bind(this, scope);
	}

	log(scope = "GENERIC", ...data: unknown[]) {
		const logEntry = `${new Date().toISOString()} [${scope.toUpperCase()}] ${data.map(
			(log) => String(log).replaceAll(/\n/g, "\n\t")
		)}`;

		this.logs.push(logEntry);

		if (this.logs.length > this.limit) {
			this.logs.shift();
		}

		console.log(logEntry);
	}

	saveLogsToFile = async () => {
		const data = this.logs.join("\n");

		try {
			await writeFile(filePath, data, "utf-8");
			this.logs = [];
		} catch (err) {
			console.error(err);
		}
	};
}

export const logger = new Logger();
