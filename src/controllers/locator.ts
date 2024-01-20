import { client } from "./client";
import { player } from "./player";
import { memory } from "./memory";

const registered = {
	player,
	client,
	memory,
} as const;

type LocatorKeys = keyof typeof registered;

export class Locator {
	static resolve<T extends LocatorKeys>(name: T) {
		return registered[name];
	}
}
