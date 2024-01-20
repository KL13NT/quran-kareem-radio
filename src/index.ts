import { ActivityType } from "discord.js";
import { config } from "dotenv";

import { initAnalytics } from "~/utils/analytics";
import { onInteractionCreateEvent } from "~/listeners/interaction-create";
import { onVoiceStateUpdateEvent } from "~/listeners/voice-state-update";

import { Locator } from "~/controllers/locator";
import { reconnect } from "~/utils/reconnect";

config();

const { TOKEN } = process.env;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const client = Locator.resolve("client");
const player = Locator.resolve("player");

client.once("ready", async () => {
	console.log("Ready!");

	player.init();

	if (client.user) {
		client.user.setActivity({
			type: ActivityType.Playing,
			name: "Quran Kareem Radio",
		});
	}

	initAnalytics(client);
	reconnect();

	client.on(onVoiceStateUpdateEvent.name, onVoiceStateUpdateEvent.execute);
	client.on(onInteractionCreateEvent.name, onInteractionCreateEvent.execute);
});

client.login(TOKEN);
