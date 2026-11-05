import { useEffect, useRef, useState } from "react";
import { describeError } from "@/frontend/shared/lib/api-errors";

export interface AdminQuery<T> {
  data: T | undefined;
  /** true while the request for the current `key` is in flight (old data stays available meanwhile). */
  loading: boolean;
  error: string | null;
  reload: () => void;
}

type Result<T> = { key: string; data?: T; error?: string };

/**
 * Fetches when `key` changes (put every input of the request in it) and exposes the latest result.
 * Previous data stays on screen while a new request runs, so filtering doesn't flash empty.
 */
export function useAdminQuery<T>(key: string, fetcher: () => Promise<T>): AdminQuery<T> {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const fullKey = `${key}#${nonce}`;

  useEffect(() => {
    let cancelled = false;
    fetcherRef.current().then(
      (data) => {
        if (!cancelled) setResult({ key: fullKey, data });
      },
      (error: unknown) => {
        if (!cancelled) setResult({ key: fullKey, error: describeError(error).message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fullKey]);

  const settled = result?.key === fullKey;
  return {
    data: result?.data,
    loading: !settled,
    error: settled ? (result.error ?? null) : null,
    reload: () => setNonce((n) => n + 1),
  };
}
