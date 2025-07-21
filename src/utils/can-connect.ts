import { PermissionsBitField, type Guild } from "discord.js";

export const canConnect = (guild: Guild, channelId: string) => {
	try {
		return guild.members
			.me!.permissionsIn(channelId)
			.has(PermissionsBitField.Flags.Connect);
	} catch {
		return false;
	}
};
