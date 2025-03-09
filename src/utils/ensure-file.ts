import { access, mkdir } from "fs/promises";
import { dirname } from "path";

export const ensureFile = async function (filePath: string) {
	try {
		await access(filePath);
	} catch {
		await mkdir(dirname(filePath), { recursive: true });
	}
};
