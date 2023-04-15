import { client } from "./client";
import { redis } from "./redis";
import { player } from "./player";

const registered = {
	redis,
	player,
	client,
} as const;

type LocatorKeys = keyof typeof registered;

export class Locator {
	static resolve<T extends LocatorKeys>(name: T) {
		return registered[name];
	}
}
