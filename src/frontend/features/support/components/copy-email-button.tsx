"use client";

import { useState } from "react";
import { Button } from "@/frontend/shared/ui/button";
import { Icon } from "@/frontend/shared/ui/icon";

export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address is visible above, so nothing else to do.
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={copy}>
      <Icon name={copied ? "check" : "copy"} className="size-4" />
      {copied ? "Copied" : "Copy email"}
      <span className="sr-only" role="status">
        {copied ? "Email address copied" : ""}
      </span>
    </Button>
  );
}
