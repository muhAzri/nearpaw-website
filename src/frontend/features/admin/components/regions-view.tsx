"use client";

import { useState } from "react";
import { z } from "zod";
import { AppConfigPatchSchema, RegionInputSchema } from "@/contracts";
import { fieldErrorsFrom } from "@/frontend/shared/lib/api-errors";
import { Button } from "@/frontend/shared/ui/button";
import { Checkbox, Field, Input, Switch } from "@/frontend/shared/ui/form";
import { Card } from "@/frontend/shared/ui/surface";
import { DataTable, Td, Th } from "@/frontend/shared/ui/table";
import { Tag } from "@/frontend/shared/ui/tag";
import { adminApi } from "../api/admin-api";
import type { AppConfig, Region } from "../api/schemas";
import { useAction } from "../lib/use-action";
import { useAdminQuery } from "../lib/use-admin-query";
import { AdminPage, Notice, QueryBoundary, SectionTitle } from "./admin-ui";

const FLAGS: { key: keyof AppConfig["featureFlags"]; label: string; hint?: string }[] = [
  { key: "communityUpdates", label: "Community updates" },
  { key: "nearbyAlerts", label: "Nearby alerts" },
  { key: "listAds", label: "List ads" },
  { key: "impactBannerAd", label: "Impact banner ad" },
  { key: "restrictToRegions", label: "Restrict reporting to active regions", hint: "Off: anyone can report anywhere." },
];

const LIMITS: { key: keyof AppConfig["safetyLimits"]; label: string; text?: boolean }[] = [
  { key: "autoHideAfterFlags", label: "Auto-hide after flags" },
  { key: "reportsPerUserPerHour", label: "Reports per user / hour" },
  { key: "updatesPerUserPerHour", label: "Updates per user / hour" },
  { key: "reportExpiryDays", label: "Default report expiry (days)" },
  { key: "minimumAppVersion", label: "Minimum app version", text: true },
];

export function RegionsView() {
  const regions = useAdminQuery("regions", adminApi.regions);
  const config = useAdminQuery("config", adminApi.config);
  const [selected, setSelected] = useState<string | "new" | null>(null);

  return (
    <AdminPage breadcrumb="Admin / Regions & config" title="Regions & configuration">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[2_1_560px]">
          <QueryBoundary query={regions}>
            {(list) => {
              const region = list.find((r) => r.id === selected) ?? null;
              return (
                <>
                  <SectionTitle action={<Button size="sm" onClick={() => setSelected("new")}>Add region</Button>}>Regions</SectionTitle>
                  <DataTable>
                    <thead>
                      <tr>
                        <Th>Region</Th>
                        <Th>Status</Th>
                        <Th>Languages</Th>
                        <Th>Default expiry</Th>
                        <Th>Support contact</Th>
                        <Th>
                          <span className="sr-only">Open</span>
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => (
                        <tr key={r.id} className={r.id === selected ? "bg-muted/60" : ""}>
                          <Td className="font-bold">{r.name}</Td>
                          <Td>
                            <Tag tone={r.status === "active" ? "ok" : "neutral"}>{r.status === "active" ? "Active" : "Inactive"}</Tag>
                          </Td>
                          <Td>{r.languages.map((l) => l.toUpperCase()).join(", ") || "—"}</Td>
                          <Td>{r.defaultExpiryDays} days</Td>
                          <Td>{r.supportContact ?? "Not set"}</Td>
                          <Td>
                            <button type="button" aria-pressed={r.id === selected} onClick={() => setSelected(r.id)} className="cursor-pointer font-bold underline">
                              Open
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                  {list.length === 0 && (
                    <p className="px-3 py-6 text-center text-p2 text-ink-muted">
                      No regions yet. Reporting works everywhere; add a region only to override settings such as report expiry.
                    </p>
                  )}
                  {selected !== null && (
                    <RegionForm
                      key={selected}
                      region={region}
                      onSaved={(id) => {
                        setSelected(id);
                        regions.reload();
                      }}
                    />
                  )}
                </>
              );
            }}
          </QueryBoundary>
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <QueryBoundary query={config}>
            {(c) => (
              <>
                <FlagsCard flags={c.featureFlags} onChanged={config.reload} />
                <LimitsCard key={JSON.stringify(c.safetyLimits)} limits={c.safetyLimits} onChanged={config.reload} />
              </>
            )}
          </QueryBoundary>
        </div>
      </div>
    </AdminPage>
  );
}

function RegionForm({ region, onSaved }: { region: Region | null; onSaved: (id: string) => void }) {
  const [form, setForm] = useState({
    name: region?.name ?? "",
    languages: region?.languages ?? (["en"] as ("en" | "id")[]),
    defaultExpiryDays: String(region?.defaultExpiryDays ?? 7),
    supportContact: region?.supportContact ?? "",
    lat: region ? String(region.center.lat) : "",
    lng: region ? String(region.center.lng) : "",
    radiusKm: String(region?.radiusKm ?? 10),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const action = useAction();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDone(null);
  };

  const toggleLanguage = (lang: "en" | "id", on: boolean) =>
    set("languages", on ? [...new Set([...form.languages, lang])] : form.languages.filter((l) => l !== lang));

  const canActivate = form.supportContact.trim().length >= 2 && form.languages.length > 0;

  async function save(status?: "active" | "inactive") {
    const parsed = RegionInputSchema.safeParse({
      name: form.name,
      languages: form.languages,
      defaultExpiryDays: Number(form.defaultExpiryDays),
      supportContact: form.supportContact.trim() || null,
      center: { lat: Number(form.lat), lng: Number(form.lng) },
      radiusKm: Number(form.radiusKm),
    });
    if (!parsed.success || form.lat === "" || form.lng === "") {
      const flat = parsed.success ? {} : fieldErrorsFrom(z.flattenError(parsed.error));
      if (form.lat === "" || form.lng === "") flat.center = "Enter the centre latitude and longitude";
      setErrors(flat);
      return;
    }
    setErrors({});
    const saved = await action.run(() =>
      region ? adminApi.updateRegion(region.id, { ...parsed.data, ...(status && { status }) }) : adminApi.createRegion(parsed.data),
    );
    if (saved) {
      setDone(status === "active" ? "Region is active." : status === "inactive" ? "Region is inactive." : "Saved.");
      onSaved(saved.id);
    }
  }

  return (
    <Card className="mt-4">
      <SectionTitle>{region ? `Edit region · ${region.name}` : "New region"}</SectionTitle>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <Field label="Name" htmlFor="region-name" error={errors.name}>
          <Input id="region-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Support contact" htmlFor="region-support" error={errors.supportContact}>
          <Input id="region-support" value={form.supportContact} onChange={(e) => set("supportContact", e.target.value)} placeholder="Name or email" />
        </Field>
        <Field label="Centre latitude" htmlFor="region-lat" error={errors.center}>
          <Input id="region-lat" type="number" step="any" value={form.lat} onChange={(e) => set("lat", e.target.value)} />
        </Field>
        <Field label="Centre longitude" htmlFor="region-lng">
          <Input id="region-lng" type="number" step="any" value={form.lng} onChange={(e) => set("lng", e.target.value)} />
        </Field>
        <Field label="Radius (km)" htmlFor="region-radius" error={errors.radiusKm}>
          <Input id="region-radius" type="number" min="1" max="200" step="any" value={form.radiusKm} onChange={(e) => set("radiusKm", e.target.value)} />
        </Field>
        <Field label="Default report expiry (days)" htmlFor="region-expiry" error={errors.defaultExpiryDays}>
          <Input id="region-expiry" type="number" min="1" max="60" value={form.defaultExpiryDays} onChange={(e) => set("defaultExpiryDays", e.target.value)} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="text-p2 font-bold">Languages</legend>
          <div className="mt-1 flex gap-5">
            <Checkbox label="English" checked={form.languages.includes("en")} onChange={(e) => toggleLanguage("en", e.target.checked)} />
            <Checkbox label="Bahasa Indonesia" checked={form.languages.includes("id")} onChange={(e) => toggleLanguage("id", e.target.checked)} />
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" size="sm" variant="outline" disabled={action.pending}>
            {region ? "Save" : "Create region"}
          </Button>
          {region &&
            (region.status === "active" ? (
              <Button size="sm" variant="danger" disabled={action.pending} onClick={() => save("inactive")}>
                Deactivate region
              </Button>
            ) : (
              <Button size="sm" disabled={!canActivate || action.pending} onClick={() => save("active")}>
                Activate region
              </Button>
            ))}
        </div>
      </form>
      <p className="mt-2 text-p3 text-ink-muted">
        The boundary is the centre point plus the radius. A region can be activated once a support contact and languages are
        set. Regions only override local settings unless “Restrict reporting to active regions” is on.
      </p>
      <div className="mt-2 space-y-2" aria-live="polite">
        {action.error && <Notice tone="error">{action.error}</Notice>}
        {done && !action.error && <Notice>{done}</Notice>}
      </div>
    </Card>
  );
}

function FlagsCard({ flags, onChanged }: { flags: AppConfig["featureFlags"]; onChanged: () => void }) {
  const action = useAction();

  async function toggle(key: keyof AppConfig["featureFlags"], value: boolean) {
    const saved = await action.run(() => adminApi.updateConfig({ featureFlags: { [key]: value } }));
    if (saved) onChanged();
  }

  return (
    <Card>
      <SectionTitle>Feature flags</SectionTitle>
      {FLAGS.map((f) => (
        <div key={f.key} className="flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-b-0">
          <span className="flex-1">
            <span className="block text-p2">{f.label}</span>
            {f.hint && <span className="block text-p3 text-ink-muted">{f.hint}</span>}
          </span>
          <Switch label={f.label} checked={flags[f.key]} disabled={action.pending} onChange={(v) => toggle(f.key, v)} />
        </div>
      ))}
      {action.error && (
        <div className="mt-2">
          <Notice tone="error">{action.error}</Notice>
        </div>
      )}
    </Card>
  );
}

function LimitsCard({ limits, onChanged }: { limits: AppConfig["safetyLimits"]; onChanged: () => void }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(LIMITS.map((l) => [l.key, String(limits[l.key])])));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const action = useAction();
  const dirty = LIMITS.some((l) => draft[l.key] !== String(limits[l.key]));

  async function save() {
    const parsed = AppConfigPatchSchema.safeParse({
      safetyLimits: {
        autoHideAfterFlags: Number(draft.autoHideAfterFlags),
        reportsPerUserPerHour: Number(draft.reportsPerUserPerHour),
        updatesPerUserPerHour: Number(draft.updatesPerUserPerHour),
        reportExpiryDays: Number(draft.reportExpiryDays),
        minimumAppVersion: draft.minimumAppVersion.trim(),
      },
    });
    if (!parsed.success) {
      setError("Check the numbers (whole numbers, 1 or more) and the version, e.g. 1.0.0.");
      return;
    }
    setError(null);
    const saved = await action.run(() => adminApi.updateConfig(parsed.data));
    if (saved) {
      setDone(true);
      onChanged();
    }
  }

  return (
    <Card>
      <SectionTitle>Safety limits</SectionTitle>
      {LIMITS.map((l, i) => (
        <div key={l.key} className={`flex items-center gap-3 py-2 ${i < LIMITS.length - 1 ? "border-b border-border-subtle" : ""}`}>
          <label htmlFor={`limit-${l.key}`} className="flex-1 text-p2 text-ink-muted">
            {l.label}
          </label>
          <Input
            id={`limit-${l.key}`}
            type={l.text ? "text" : "number"}
            min={l.text ? undefined : 1}
            value={draft[l.key]}
            onChange={(e) => {
              setDraft((d) => ({ ...d, [l.key]: e.target.value }));
              setDone(false);
            }}
            className="!w-24 !py-1.5 text-right font-bold"
          />
        </div>
      ))}
      <Button size="sm" className="mt-3" disabled={!dirty || action.pending} onClick={save}>
        {action.pending ? "Saving…" : "Save limits"}
      </Button>
      <div className="mt-2 space-y-2" aria-live="polite">
        {(error || action.error) && <Notice tone="error">{error ?? action.error}</Notice>}
        {done && !dirty && <Notice>Saved. The app picks this up on its next launch.</Notice>}
      </div>
    </Card>
  );
}
