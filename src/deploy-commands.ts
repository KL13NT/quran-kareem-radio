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
		),
	new SlashCommandBuilder()
		.setName("leave")
		.setDescription("Disconnects the bot from a voice channel when connected"),
	new SlashCommandBuilder()
		.setName("help")
		.setDescription("Help on command usage"),
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
