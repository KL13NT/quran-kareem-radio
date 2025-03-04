import { client } from "./client";
import { player } from "./player";
import { connections } from "./connections";

const registered = {
	player,
	client,
	connections,
} as const;

type LocatorKeys = keyof typeof registered;

export class Locator {
	static resolve<T extends LocatorKeys>(name: T) {
		return registered[name];
	}
}
