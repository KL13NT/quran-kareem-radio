type Result<T> = { data: T | null; error: Error | null };

export function tryCall<T>(callback: () => T): Result<T> {
	try {
		const data = callback();
		return { data, error: null };
	} catch (error) {
		return { data: null, error: error as Error };
	}
}
