/**
 * Process-wide singleton that survives dev hot reloads.
 * Used by the in-memory adapters until the Supabase adapters replace them.
 */
export function singleton<T>(key: string, create: () => T): T {
  const store = globalThis as unknown as Record<string, unknown>;
  const k = `__nearpaw_${key}`;
  store[k] ??= create();
  return store[k] as T;
}
