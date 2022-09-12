require("dotenv").config();

const { Routes } = require("discord-api-types/v10");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { REST } = require("@discordjs/rest");
const { dev, prod } = require("./config");

const { clientId, token } = process.env.mode === "PRODUCTION" ? prod : dev;

const rest = new REST({ version: "10" }).setToken(token);

const commands = [
  new SlashCommandBuilder()
    .setName("connect")
    .setDescription(
      "Connects the bot to a voice channel indefinitely or until disconnected!"
    ),
  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Disconnects the bot from a voice channel when connected"),
].map((command) => command.toJSON());

(async () => {
  await rest
    .put(Routes.applicationCommands(clientId), { body: commands })
    .then((data) =>
      console.log(
        `Successfully registered ${data.length} application commands.`
      )
    )
    .catch(console.error);
})();
