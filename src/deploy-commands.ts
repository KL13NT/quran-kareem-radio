import { SlashCommandBuilder } from "discord.js";
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
				.addStringOption((option) =>
					option
						.setName("moshaf")
						.setDescription("The moshaf edition (rewaya) to read")
						.setRequired(true)
						.setAutocomplete(true)
				)
		),
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
