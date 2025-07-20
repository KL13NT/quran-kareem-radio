import http from "http";
import { ActivityType } from "discord.js";

import { initAnalytics } from "~/utils/analytics";
import { onInteractionCreateEvent } from "~/listeners/interaction-create";
import { onVoiceStateUpdateEvent } from "~/listeners/voice-state-update";

import { client } from "./controllers/client";
import { playerManager } from "./controllers/player-manager";
import { loadRecitations } from "./utils/loadRecitations";

const { TOKEN, DEBUG } = process.env;

if (DEBUG === "true") {
	client.on("debug", (info) => console.log(info));
	client.on("error", (error) => console.error(error));
	client.on("warn", (info) => console.log(info));
}

client.once("ready", async () => {
	console.log("Ready!");

	await loadRecitations();

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

	await playerManager.reconnect();
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
