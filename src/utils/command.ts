import {
	Client,
	Locale,
	REST,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
	Routes,
} from "discord.js";
import { getFiles } from "./file";
import { error, info, success, warn } from "./logger";
import CommandManager from "../classes/CommandManager";
import path from "path";
import { SHA256 } from "./crypto";
import TempManager from "../classes/TempManager";

export const getCommands = () =>
	getFiles("./src/commands", ["ts", "js"], ["node_modules"]);

export async function loadCommands(
	client: Client & { command: CommandManager<Locale> }
) {
	const commands = await getCommands();

	if (!commands?.success) return error("Failed to load commands");

	if (!commands.files.length) return warn("No commands found");

	if (!client.command) client.command = new CommandManager(Locale.EnglishUS);

	commands.files.forEach((command) => {
		const { default: exportedContent } = require(path.join(
			process.cwd(),
			"src/commands",
			command
		));
		client.command.addCommand(exportedContent);
	});
}

export async function putCommands(
	client: Client & { temp: TempManager },
	commands: RESTPostAPIChatInputApplicationCommandsJSONBody[]
) {
	info("Checking for changes in commands");
	if (client.temp) {
		let hash = SHA256(JSON.stringify(commands));
		if (hash === client.temp.get("command-hash")) {
			return info("No changes in commands, skipping reload");
		} else {
			client.temp.set("command-hash", hash, true);
		}
	}

	const rest = new REST().setToken(process.env.TOKEN!);

	try {
		info(
			`Started refreshing ${commands.length} application (/) commands.`
		);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = (await rest.put(
			Routes.applicationCommands(process.env.APPLICATION_ID!),
			{ body: commands }
		)) as any;

		success(
			`Successfully reloaded ${data?.length} application (/) commands.`
		);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
}
