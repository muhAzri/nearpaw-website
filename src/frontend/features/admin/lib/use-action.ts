import { useState } from "react";
import { describeError } from "@/frontend/shared/lib/api-errors";

/** Wraps a mutation with pending / error state. `run` resolves to `undefined` when the call failed. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setPending(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(describeError(e).message);
      return undefined;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, run, clearError: () => setError(null) };
}
