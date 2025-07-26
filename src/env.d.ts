import type { Environment } from "./controllers/environment";

/* eslint-disable no-unused-vars */
declare global {
	// eslint-disable-next-line no-var
	var env: Environment;

	namespace NodeJS {
		interface ProcessEnv {
			CLIENT_ID: string;
			CLIENT_SECRET: string;
			STREAM: string;
			STREAM_FALLBACK: string;
			MODE: "DEVELOPMENT" | "PRODUCTION";
			PERMISSIONS: string;
			PUBLIC_KEY: string;
			TOKEN: string;
			ANALYTICS_CHANNEL_ID: string;
			DEV_SERVER_ID: string;
			SUPABASE_URL: string;
			SUPABASE_KEY: string;
			DEBUG?: "true" | "false";
		}
	}
}

export {};
