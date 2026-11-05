import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Shorthand for a no-restricted-imports rule from a list of {group, message}. */
const restrict = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

// Architectural boundaries (see README "Arah dependency")
const boundaries = [
  {
    // Contracts are shared by frontend and backend: pure schemas only.
    files: ["src/contracts/**"],
    rules: restrict({
      group: ["@/frontend/*", "@/backend/*", "@/app/*", "next", "next/*", "react"],
      message: "contracts must stay framework-free (zod + types only).",
    }),
  },
  {
    // Frontend reaches the backend only through HTTP + contracts.
    files: ["src/frontend/**"],
    rules: restrict(
      {
        group: ["@/backend", "@/backend/*"],
        message: "Frontend must call the backend over HTTP (frontend/shared/lib/api-client).",
      },
      {
        group: ["@/frontend/features/*/*"],
        message: "Import other features through their public index (@/frontend/features/<name>).",
      },
    ),
  },
  {
    files: ["src/backend/**"],
    rules: restrict(
      {
        group: ["@/frontend", "@/frontend/*", "@/app/*", "next", "next/*", "react", "react-dom"],
        message: "Backend must stay framework-agnostic so it can be ported (e.g. to Go).",
      },
      {
        group: ["@/backend/modules/*/*"],
        message: "Import other modules through their public index (@/backend/modules/<name>).",
      },
    ),
  },
  {
    // Domain = pure business logic. No DB, no HTTP, no app/infrastructure.
    files: ["src/backend/**/domain/**"],
    rules: restrict(
      {
        group: ["**/application/**", "**/infrastructure/**", "**/presentation/**", "../application", "../infrastructure", "../presentation"],
        message: "Domain layer must not depend on outer layers.",
      },
      { group: ["zod", "server-only", "@/contracts", "@/contracts/*"], message: "Domain layer must be dependency-free." },
    ),
  },
  {
    files: ["src/backend/**/application/**"],
    rules: restrict({
      group: ["**/infrastructure/**", "**/presentation/**", "../infrastructure", "../presentation"],
      message: "Application layer depends on domain ports, not on adapters.",
    }),
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaries,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
