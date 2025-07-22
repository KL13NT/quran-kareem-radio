import { type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/database.types";
import type { Identifier } from "~/types";

export class PlaybackService {
	private supabase: SupabaseClient<Database>;

	constructor(client: SupabaseClient) {
		this.supabase = client;
	}

	async setPlaybackProgress(recitationId: Identifier, surah: number) {
		const { data, error } = await this.supabase
			.from("recitation progress")
			.upsert({
				recitation_id: recitationId,
				surah,
			})
			.select("*");

		if (error) {
			console.error(`[PLAYBACK-SERVICE] ${error.message}`, console.trace());
			return null;
		}

		return data;
	}

	async getPlaybackProgress(recitationId: Identifier) {
		const { data, error } = await this.supabase
			.from("recitation progress")
			.select("surah")
			.eq("recitation_id", recitationId);

		if (error) {
			console.error(`[SUPABASE] ${error.message}`, console.trace());
			return null;
		}

		if (!data || data.length === 0) {
			return null;
		}

		return data[0].surah;
	}

	async deletePlaybackProgress(recitationId: Identifier) {
		const { data, error } = await this.supabase
			.from("recitation progress")
			.delete()
			.eq("recitation_id", recitationId);

		if (error) {
			console.error(`[PLAYBACK-SERVICE] ${error.message}`, console.trace());
			return null;
		}

		return data;
	}
}
