import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { REST, Routes } from "discord.js";
import { DeployCommandsResponse } from "~/types";

const { CLIENT_ID, TOKEN } = process.env;

const rest = new REST({ version: "10" }).setToken(TOKEN!);

const commands = [
	new SlashCommandBuilder()
		.setName("connect")
		.setDescription(
			"Connects the bot to a voice channel indefinitely or until disconnected!"
		)
		.addSubcommand((subcommand) =>
			subcommand.setName("radio").setDescription("Play Quran Radio")
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("recitation")
				.setDescription("Play a specific recitation instead of Quran Radio")
				.addStringOption((option) =>
					option
						.setName("reciter")
						.setDescription("Name of the reciter")
						.setRequired(true)
						.setAutocomplete(true)
				)
		)
		.setContexts([InteractionContextType.Guild]),
	new SlashCommandBuilder()
		.setName("leave")
		.setDescription("Disconnects the bot from a voice channel when connected")
		.setContexts([InteractionContextType.Guild]),
	new SlashCommandBuilder()
		.setName("help")
		.setDescription("Help on command usage")
		.setContexts([InteractionContextType.Guild]),
].map((command) => command.toJSON());

(async () => {
	await rest
		.put(Routes.applicationCommands(CLIENT_ID!), { body: commands })
		.then((data) =>
			console.log(
				`Successfully registered ${
					(data as DeployCommandsResponse).length
				} application commands.`
			)
		)
		.catch(console.log);
})();
