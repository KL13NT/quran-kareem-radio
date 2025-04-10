import { readFile } from "fs/promises";
import { resolve } from "path";
import { type CommandInteraction } from "discord.js";
import type { CommandType } from "~/types";
import console from "console";

let helpText: string;

const help = async (interaction: CommandInteraction) => {
	await interaction.deferReply();

	if (!helpText) {
		console.log("Loading help text for the first time");
		helpText = await readFile(resolve(__dirname, "../../help.txt"), "utf-8");
	}

	await interaction.editReply(helpText);
};

export default {
	name: "help",
	description: "Bot usage guide",
	run: help,
} as CommandType;
