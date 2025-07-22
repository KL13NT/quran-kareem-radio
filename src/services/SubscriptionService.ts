import { type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/database.types";
import type { DiscordIdentifier, Identifier } from "~/types";

export class SubscriptionService {
	private supabase: SupabaseClient<Database>;

	constructor(client: SupabaseClient) {
		this.supabase = client;
	}

	async getGuildSubscription(guildId: DiscordIdentifier) {
		const { data, error } = await this.supabase
			.from("players")
			.select("*")
			.eq("guild_id", guildId);

		if (error) {
			console.error(`[SUPABASE] ${error.message}`, console.trace());
			return null;
		}

		return data.length >= 1 ? data[0] : null;
	}

	async getAllRecitations() {
		const { data, error } = await this.supabase.from("players").select("*");

		if (error) {
			console.error(`[SUPABASE] ${error.message}`, console.trace());
			return [];
		}

		return data;
	}

	async subscribeGuild(
		guildId: DiscordIdentifier,
		channelId: DiscordIdentifier,
		recitationId: Identifier
	) {
		await this.supabase.from("players").delete().eq("guild_id", guildId);

		const { data, error } = await this.supabase
			.from("players")
			.upsert({
				guild_id: guildId,
				recitation_id: recitationId,
				channel_id: channelId,
			})
			.select("*");

		if (error) {
			console.error(`[SUPABASE] ${error.message}`, console.trace());
			return null;
		}

		return data;
	}

	async updateGuildSubscription(
		guildId: DiscordIdentifier,
		update: Partial<{
			channel_id: string;
			guild_id: string;
			recitation_id: string;
		}>
	) {
		const { data, error } = await this.supabase
			.from("players")
			.update(update)
			.eq("guild_id", guildId);

		if (error) {
			console.error(`[SUPABASE] ${error.message}`, console.trace());
			return null;
		}

		return data;
	}

	async unsubscribeGuild(guildId: DiscordIdentifier) {
		const { data, error } = await this.supabase
			.from("players")
			.delete()
			.eq("guild_id", guildId)
			.select("*");

		if (error) {
			console.error(`[SUPABASE] ${error.message}`, console.trace());
			return null;
		}

		return data[0];
	}
}
