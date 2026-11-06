/** Process-wide singleton that survives dev hot reloads (used for clients and the composed backend, never for data). */
export function singleton<T>(key: string, create: () => T): T {
  const store = globalThis as unknown as Record<string, unknown>;
  const k = `__nearpaw_${key}`;
  store[k] ??= create();
  return store[k] as T;
}
