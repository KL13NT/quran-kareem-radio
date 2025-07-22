export class ServiceController {
	private services: Map<string, unknown> = new Map();

	registerService<T>(key: string, service: T): void {
		this.services.set(key, service);
	}

	getService<T>(key: string): T {
		return this.services.get(key) as T;
	}
}
