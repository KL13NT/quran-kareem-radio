import {
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	type CommandInteraction,
	type Interaction,
} from "discord.js";
import connect from "~/commands/connect";
import help from "~/commands/help";
import leave from "~/commands/leave";
import type {
	AutocompleteCommandOption,
	CommandOption,
	CommandType,
	ListenerType,
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

type InteractionCommandType =
	| ChatInputCommandInteraction
	| AutocompleteInteraction;

const isInteractionCommand = (
	interaction: Interaction
): interaction is InteractionCommandType => {
	return interaction.isCommand() || interaction.isAutocomplete();
};

const onInteractionCreate: ListenerType<"interactionCreate">["execute"] =
	(deps) => async (interaction: Interaction) => {
		if (
			!isInteractionCommand(interaction) ||
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
				"getSubcommand" in interaction.options && command.subcommands?.length
					? interaction.options.getSubcommand()
					: null;

			const optionsList = subcommandName
				? command.subcommands?.find(
						(subcommand) => subcommand.name === subcommandName
				  )?.options
				: command.options;

			if (!command) {
				await help.run(deps)(interaction as CommandInteraction);
			} else if (interaction.isAutocomplete()) {
				const focusedOption = interaction.options.getFocused(true);

				const matchedOption = optionsList?.find(
					(option) =>
						isAutocompleteOption(option) && focusedOption.name === option.name
				);

				if (matchedOption && isAutocompleteOption(matchedOption)) {
					await matchedOption.method(interaction);
				}
			} else {
				await command.run(deps)(interaction);
			}
		} catch (error) {
			console.error(`[INTERACTION-CREATE] FATAL`, (error as Error).message);
		}
	};

export const onInteractionCreateEvent: ListenerType<"interactionCreate"> = {
	name: "interactionCreate",
	execute: onInteractionCreate,
};
