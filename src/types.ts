import { createClient } from "redis";

export type DeployCommandsResponse = {
	length: number;
};

export type RedisClient = ReturnType<typeof createClient>;
