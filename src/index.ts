import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import http from "http";
import { ActivityType } from "discord.js";

import { initAnalytics } from "~/utils/analytics";
import { onInteractionCreateEvent } from "~/listeners/interaction-create";
import { onVoiceStateUpdateEvent } from "~/listeners/voice-state-update";

import { client } from "./controllers/client";
import { PlayerManager } from "./controllers/player-manager";
import { loadRecitations } from "./utils/loadRecitations";
import { createClient } from "@supabase/supabase-js";
import { environment } from "./controllers/environment";
import { PlaybackService } from "./services/PlaybackService";
import { SubscriptionService } from "./services/SubscriptionService";

globalThis["env"] = environment;

const TOKEN = environment.get("TOKEN");
const DEBUG = environment.get("DEBUG");
const SUPABASE_URL = environment.get("SUPABASE_URL");
const SUPABASE_KEY = environment.get("SUPABASE_KEY");

if (DEBUG === "true") {
	client.on("debug", (info) => console.log(info));
	client.on("error", (error) => console.error(error));
	client.on("warn", (info) => console.log(info));
}

client.once("ready", async () => {
	console.log("Ready!");

	const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
	const playbackService = new PlaybackService(supabase);
	const subscriptionService = new SubscriptionService(supabase);

	const playerManager = new PlayerManager(playbackService, subscriptionService);

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

	const listenerDeps = {
		playbackService,
		playerManager,
		subscriptionService,
	};

	console.log(`[CORE] attaching client listeners`);
	client.on(
		onVoiceStateUpdateEvent.name,
		onVoiceStateUpdateEvent.execute(listenerDeps)
	);
	client.on(
		onInteractionCreateEvent.name,
		onInteractionCreateEvent.execute(listenerDeps)
	);
});

client.login(TOKEN);

http
	.createServer(function (_, res) {
		res.writeHead(200, { "Content-Type": "text/plain" });
		res.write("Hello World!");
		res.end();
	})
	.listen(3000);
