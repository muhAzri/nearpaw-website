"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { describeError } from "@/frontend/shared/lib/api-errors";
import { Button } from "@/frontend/shared/ui/button";
import { Field, Input } from "@/frontend/shared/ui/form";
import { Logo } from "@/frontend/shared/ui/logo";
import { adminApi } from "../api/admin-api";
import { safeNextPath, saveAdminSession, useAdminToken } from "../lib/session";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = useAdminToken();
  const next = safeNextPath(params.get("next"));
  const expired = params.get("expired") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Already signed in: skip the form.
  useEffect(() => {
    if (token) router.replace(next);
  }, [token, next, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const session = await adminApi.login({ email: email.trim(), password });
      saveAdminSession(session.token, session.expiresInSeconds);
      router.replace(next);
    } catch (e) {
      setError(describeError(e).message);
      setPassword("");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-[420px] rounded-sheet bg-surface p-8">
      <Logo href={null} markClassName="size-9" label="Nearpaw Admin" />
      <h1 className="mt-5 font-display text-2xl leading-9">Sign in</h1>
      {expired && (
        <p className="mt-2 text-p3 text-ink-muted" role="status">
          Your session expired. Sign in again to continue where you left off.
        </p>
      )}
      <Field label="Email" htmlFor="admin-email" className="mt-3">
        <Input
          id="admin-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Password" htmlFor="admin-password" className="mt-3">
        <Input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button type="submit" block disabled={pending || !email || !password} className="mt-5">
        {pending ? "Signing in…" : "Continue"}
      </Button>
      {error && (
        <p className="mt-3 text-p3 text-danger-ink" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function LoginView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <Suspense fallback={<div className="h-[480px] w-full max-w-[420px] rounded-sheet bg-surface" aria-hidden="true" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
