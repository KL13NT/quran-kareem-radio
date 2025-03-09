import http from "http";
import { ActivityType } from "discord.js";

import { initAnalytics } from "~/utils/analytics";
import { onInteractionCreateEvent } from "~/listeners/interaction-create";
import { onVoiceStateUpdateEvent } from "~/listeners/voice-state-update";

import { Locator } from "~/controllers/locator";
import { reconnect } from "~/utils/reconnect";
import { logger } from "./utils/logger";

const { TOKEN, DEBUG } = process.env;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const client = Locator.resolve("client");
const player = Locator.resolve("player");
const connections = Locator.resolve("connections");

const log = logger.create("client");

if (DEBUG === "true") {
	client.on("debug", (info) => log(info));
	client.on("error", (error) => log(error));
	client.on("warn", (info) => log(info));
}

client.once("ready", async () => {
	log("Ready!");

	player.init();
	await connections.init();

	if (client.user) {
		client.user.setActivity({
			type: ActivityType.Playing,
			name: "Quran Kareem Radio",
		});
	}

	initAnalytics(client);

	player.once("playing", reconnect);
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
