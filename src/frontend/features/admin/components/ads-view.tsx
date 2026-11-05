"use client";

import { Switch } from "@/frontend/shared/ui/form";
import { Card } from "@/frontend/shared/ui/surface";
import { DataTable, Td, Th } from "@/frontend/shared/ui/table";
import { adminApi } from "../api/admin-api";
import { useAction } from "../lib/use-action";
import { useAdminQuery } from "../lib/use-admin-query";
import { AdminPage, Notice, QueryBoundary, SectionTitle } from "./admin-ui";

export function AdsView() {
  const query = useAdminQuery("ad-placements", adminApi.placements);
  const action = useAction();

  async function set(placementId: string, regionId: string | undefined, enabled: boolean) {
    const saved = await action.run(async () => {
      await adminApi.setPlacement(placementId, { regionId, enabled });
      return true;
    });
    if (saved) query.reload();
  }

  return (
    <AdminPage
      breadcrumb="Admin / Ad placements"
      title="Ad placements"
      description="Choose where ads can appear. Some screens can never show ads."
    >
      {action.error && (
        <div className="mb-3">
          <Notice tone="error">{action.error}</Notice>
        </div>
      )}
      <QueryBoundary query={query}>
        {(placements) => {
          const open = placements.filter((p) => !p.locked);
          const locked = placements.filter((p) => p.locked);
          const regions = open[0]?.regions ?? [];
          return (
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-[2_1_560px]">
                <DataTable>
                  <thead>
                    <tr>
                      <Th>Placement</Th>
                      <Th>Where</Th>
                      <Th>Frequency cap</Th>
                      <Th>Everywhere</Th>
                      {regions.map((r) => (
                        <Th key={r.regionId}>{r.regionName}</Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {open.map((p) => (
                      <tr key={p.id}>
                        <Td className="font-bold">{p.label}</Td>
                        <Td>{p.screen}</Td>
                        <Td>{p.frequencyCap}</Td>
                        <Td>
                          <Switch
                            label={`${p.label}: everywhere`}
                            checked={p.global}
                            disabled={action.pending}
                            onChange={(v) => set(p.id, undefined, v)}
                          />
                        </Td>
                        {p.regions.map((r) => (
                          <Td key={r.regionId}>
                            <Switch
                              label={`${p.label}: ${r.regionName}`}
                              checked={r.enabled}
                              disabled={action.pending}
                              onChange={(v) => set(p.id, r.regionId, v)}
                            />
                          </Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
                <p className="mt-2 text-p3 text-ink-muted">
                  A placement shows in a region when it is on there or everywhere, and its feature flag is on in Regions &amp;
                  config.
                </p>
              </div>
              <Card className="min-w-0 flex-[1_1_300px]">
                <SectionTitle>Never allowed</SectionTitle>
                <ul className="list-disc pl-[18px] text-p2">
                  {locked.map((p) => (
                    <li key={p.id}>{p.label}</li>
                  ))}
                </ul>
                <p className="mt-2 text-p3 text-ink-muted">These placements are locked and cannot be enabled.</p>
              </Card>
            </div>
          );
        }}
      </QueryBoundary>
    </AdminPage>
  );
}
