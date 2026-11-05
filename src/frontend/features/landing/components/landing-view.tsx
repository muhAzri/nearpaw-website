import { ButtonLink } from "@/frontend/shared/ui/button";
import { SITE_NAME } from "@/frontend/shared/lib/site";

export function LandingView() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold tracking-tight">{SITE_NAME}</span>
        <ButtonLink href="#download" size="sm">
          Get the app
        </ButtonLink>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 py-24">
        <h1 className="max-w-2xl text-5xl font-bold leading-tight tracking-tight">
          Everything your pet needs, right around the corner.
        </h1>
        <p className="max-w-xl text-lg text-ink-muted">
          Replace this copy with the real NearPaw pitch.
        </p>
        <div id="download" className="flex gap-3">
          <ButtonLink href="#" size="lg">
            Download on the App Store
          </ButtonLink>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-sm text-ink-muted">
        © {SITE_NAME}
      </footer>
    </>
  );
}
