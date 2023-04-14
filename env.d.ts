/* eslint-disable no-unused-vars */
declare global {
	namespace NodeJS {
		interface ProcessEnv {
			CLIENT_ID: string;
			STREAM: string;
			MODE: "DEVELOPMENT" | "PRODUCTION";
		}
	}
}

export {};
