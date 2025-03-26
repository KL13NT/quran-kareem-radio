import http from "http";
import { ActivityType } from "discord.js";

import { initAnalytics } from "~/utils/analytics";
import { onInteractionCreateEvent } from "~/listeners/interaction-create";
import { onVoiceStateUpdateEvent } from "~/listeners/voice-state-update";

import { reconnect } from "~/utils/reconnect";
import { logger } from "./utils/logger";
import { client } from "./controllers/client";
import { connections } from "./controllers/connections";
import { playerManager } from "./controllers/player-manager";

const { TOKEN, DEBUG } = process.env;

const log = logger.create("client");

if (DEBUG === "true") {
	client.on("debug", (info) => log(info));
	client.on("error", (error) => log(error));
	client.on("warn", (info) => log(info));
}

client.once("ready", async () => {
	log("Ready!");

	await connections.init();

	if (client.user) {
		client.user.setPresence({
			status: "online",
			activities: [
				{
					name: "status",
					type: ActivityType.Custom,
					state: "/help | /connect",
				},
			],
		});
	}

	initAnalytics(client);

	playerManager.once("playing", reconnect);
	client.on(onVoiceStateUpdateEvent.name, onVoiceStateUpdateEvent.execute);
	client.on(onInteractionCreateEvent.name, onInteractionCreateEvent.execute);
});

client.login(TOKEN);

http
	.createServer(function (_, res) {
		res.writeHead(200, { "Content-Type": "text/plain" });
		res.write("Hello World!");
		res.end();
	})
	.listen(3000);
