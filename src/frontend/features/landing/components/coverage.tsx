import { getCoverage } from "../api/coverage";

/** "Where we're active" copy. Reads live config, so it must render inside <Suspense>. */
export async function Coverage() {
  const coverage = await getCoverage();
  const names = coverage?.regions ?? [];
  const list = names.length > 0 ? names.join(", ") : null;

  if (coverage?.restricted) {
    return (
      <>
        Browsing works anywhere. Reporting opens city by city.{" "}
        {list ? (
          <>
            Active regions: <span className="rounded-md bg-muted px-1.5 font-semibold text-ink">{list}</span> — more coming.
          </>
        ) : (
          "New regions are coming soon."
        )}
      </>
    );
  }
  return (
    <>
      Browsing and reporting work wherever you are — there’s no list of cities to wait for.
      {list && (
        <>
          {" "}
          Local settings are in place for <span className="rounded-md bg-muted px-1.5 font-semibold text-ink">{list}</span>.
        </>
      )}
    </>
  );
}
