import {
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	type CommandInteraction,
} from "discord.js";
import connect from "~/commands/connect";
import help from "~/commands/help";
import leave from "~/commands/leave";
import type {
	AutocompleteCommandOption,
	CommandOption,
	CommandType,
} from "~/types";

const commands: Record<string, CommandType> = {
	connect,
	leave,
	help,
};

type CommandKey = keyof typeof commands;

const isAutocompleteOption = (
	option: CommandOption
): option is AutocompleteCommandOption => option.autocomplete;

const onInteractionCreate = async (
	interaction: ChatInputCommandInteraction | AutocompleteInteraction
) => {
	if (
		(!interaction.isAutocomplete() && !interaction.isCommand()) ||
		!interaction.member ||
		!interaction.guild
	) {
		return;
	}

	/**
	 * TODO: replace command declaration type with a custom one built on the SlashCommandBuilder type similar to https://discordjs.guide/slash-commands/parsing-options.html#command-options
	 */
	try {
		const { commandName } = interaction;
		const command = commands[commandName as CommandKey];
		const subcommandName =
			"getSubcommand" in interaction.options
				? interaction.options.getSubcommand()
				: null;

		const optionsList = subcommandName
			? command.subcommands?.find(
					(subcommand) => subcommand.name === subcommandName
			  )?.options
			: command.options;

		if (!command) {
			await help.run(interaction as CommandInteraction);
		} else if (interaction.isAutocomplete()) {
			const focusedOption = interaction.options.getFocused(true);

			const matchedOption = optionsList?.find(
				(option) =>
					isAutocompleteOption(option) && focusedOption.name === option.name
			);

			if (matchedOption && isAutocompleteOption(matchedOption)) {
				matchedOption.method(interaction);
			}
		} else {
			await command.run(interaction);
		}
	} catch (error) {
		console.log(error);
	}
};

export const onInteractionCreateEvent = {
	name: "interactionCreate",
	execute: onInteractionCreate,
};
