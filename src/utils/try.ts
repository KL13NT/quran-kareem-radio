export async function tryWithFallback<T>(
	callback: () => T | Promise<T>,
	fallback: () => T | Promise<T>
): Promise<T> {
	try {
		return await callback();
	} catch {
		return await fallback();
	}
}
