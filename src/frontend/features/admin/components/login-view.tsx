"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { describeError } from "@/frontend/shared/lib/api-errors";
import { Button } from "@/frontend/shared/ui/button";
import { Field, Input, fieldClass } from "@/frontend/shared/ui/form";
import { Logo } from "@/frontend/shared/ui/logo";
import { adminApi } from "../api/admin-api";
import { safeNextPath, saveAdminSession, useAdminToken } from "../lib/session";

const CODE_LENGTH = 6;

/** Six single-digit boxes for the authenticator code. Handles typing, backspace, arrows and paste. */
function CodeInput({ value, onChange, invalid }: { value: string; onChange: (next: string) => void; invalid: boolean }) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? "");

  const focus = (i: number) => boxes.current[Math.min(Math.max(i, 0), CODE_LENGTH - 1)]?.focus();

  function setDigit(i: number, digit: string) {
    const next = digits.slice();
    next[i] = digit;
    onChange(next.join("").slice(0, CODE_LENGTH));
  }

  function onKeyDown(i: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[i]) {
      event.preventDefault();
      setDigit(i - 1, "");
      focus(i - 1);
    } else if (event.key === "ArrowLeft") focus(i - 1);
    else if (event.key === "ArrowRight") focus(i + 1);
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    focus(pasted.length);
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Authentication code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          value={digit}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid}
          className={`${fieldClass} !h-[52px] !w-12 shrink-0 !px-0 text-center`}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            setDigit(i, d);
            if (d) focus(i + 1);
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = useAdminToken();
  const next = safeNextPath(params.get("next"));
  const expired = params.get("expired") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Already signed in: skip the form.
  useEffect(() => {
    if (token) router.replace(next);
  }, [token, next, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const session = await adminApi.login({ email: email.trim(), password, code });
      saveAdminSession(session.token, session.expiresInSeconds);
      router.replace(next);
    } catch (e) {
      setError(describeError(e).message);
      setCode("");
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
      <div className="mt-3">
        <p className="text-p2 font-bold" id="code-label">
          Authentication code
        </p>
        <div className="mt-1" aria-labelledby="code-label">
          <CodeInput value={code} onChange={setCode} invalid={!!error} />
        </div>
        <p className="mt-1 text-p3 text-ink-muted">From your authenticator app. MFA is required.</p>
      </div>
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
