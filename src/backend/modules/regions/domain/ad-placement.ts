export interface PlacementDefinition {
  readonly id: string;
  readonly label: string;
  readonly screen: string;
  readonly frequencyCap: string;
  /** Locked placements can never be enabled (map, report flows, onboarding, website). */
  readonly locked: boolean;
}

export const AD_PLACEMENTS: readonly PlacementDefinition[] = [
  { id: "list_feed_native", label: "List feed native ad", screen: "Nearby list (S13)", frequencyCap: "1 per 8–10 cards", locked: false },
  { id: "impact_banner", label: "Impact banner", screen: "Impact overview (S40)", frequencyCap: "1 per screen", locked: false },
  { id: "map", label: "Map", screen: "Home map", frequencyCap: "Never", locked: true },
  { id: "report_creation", label: "Report creation", screen: "Report flow", frequencyCap: "Never", locked: true },
  { id: "report_detail", label: "Report detail", screen: "Report detail", frequencyCap: "Never", locked: true },
  { id: "onboarding", label: "Onboarding and permission screens", screen: "Onboarding", frequencyCap: "Never", locked: true },
  { id: "website", label: "Website", screen: "Public website", frequencyCap: "Never", locked: true },
];

export const findPlacement = (id: string) => AD_PLACEMENTS.find((p) => p.id === id);
