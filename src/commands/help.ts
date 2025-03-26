import { readFile } from "fs/promises";
import { resolve } from "path";
import { ApplicationCommandType, type CommandInteraction } from "discord.js";
import { logger } from "~/utils/logger";
import type { CommandType } from "~/types";

const log = logger.create("interaction-create");

let helpText: string;

const help = async (interaction: CommandInteraction) => {
	await interaction.deferReply();

	if (!helpText) {
		log("Loading help text for the first time");
		helpText = await readFile(resolve(__dirname, "../../help.txt"), "utf-8");
	}

	await interaction.editReply(helpText);
};

export default {
	name: "help",
	description: "Bot usage guide",
	type: ApplicationCommandType.ChatInput,
	run: help,
} as CommandType;
