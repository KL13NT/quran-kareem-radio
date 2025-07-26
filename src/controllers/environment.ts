type EnvironmentConfig = {
	[K in keyof NodeJS.ProcessEnv]: {
		type: "string";
		values?: string[];
		optional?: boolean;
	};
};

export class Environment {
	private config: EnvironmentConfig;

	constructor(config: EnvironmentConfig) {
		this.config = config;
		this.check();
	}

	private check(): void {
		for (const key in this.config) {
			const configItem = this.config[key];
			const value = process.env[key];

			console.log(`[ENV] ${key}: ${value}`);

			if (value === undefined && !configItem.optional) {
				throw new Error(`Environment variable ${key} is required`);
			} else if (value === undefined && configItem.optional) {
				continue;
			}

			if (configItem.values && value && !configItem.values.includes(value)) {
				throw new Error(
					`Environment variable ${key} should be one of ${configItem.values.join(
						", "
					)} but is ${value}`
				);
			}

			if (typeof value !== configItem.type) {
				throw new Error(
					`Environment variable ${key} should be of type ${
						configItem.type
					} but is of type ${typeof value}`
				);
			}
		}
	}
	get<T extends keyof EnvironmentConfig>(key: T): string {
		const value = process.env[key];
		return value as string;
	}
}

export const environment = new Environment({
	TOKEN: { type: "string" },
	DEBUG: {
		type: "string",
		values: ["true", "false"],
		optional: true,
	},
	SUPABASE_URL: { type: "string" },
	SUPABASE_KEY: { type: "string" },
	ANALYTICS_CHANNEL_ID: { type: "string" },
	CLIENT_ID: { type: "string" },
	CLIENT_SECRET: { type: "string" },
	DEV_SERVER_ID: { type: "string" },
	PERMISSIONS: { type: "string" },
	PUBLIC_KEY: { type: "string" },
	MODE: {
		type: "string",
		values: ["DEVELOPMENT", "PRODUCTION"],
	},
	STREAM: { type: "string" },
	STREAM_FALLBACK: { type: "string" },
});
