export interface FeatureFlags {
  communityUpdates: boolean;
  nearbyAlerts: boolean;
  listAds: boolean;
  impactBannerAd: boolean;
  /** Off = anyone can report anywhere in the world. On = only inside active regions. */
  restrictToRegions: boolean;
}

export interface SafetyLimits {
  autoHideAfterFlags: number;
  reportsPerUserPerHour: number;
  updatesPerUserPerHour: number;
  /** Default life of a report; an active region may override it. */
  reportExpiryDays: number;
  minimumAppVersion: string;
}

export interface AppConfig {
  featureFlags: FeatureFlags;
  safetyLimits: SafetyLimits;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  featureFlags: { communityUpdates: true, nearbyAlerts: true, listAds: true, impactBannerAd: true, restrictToRegions: false },
  safetyLimits: {
    autoHideAfterFlags: 3,
    reportsPerUserPerHour: 3,
    updatesPerUserPerHour: 6,
    reportExpiryDays: 7,
    minimumAppVersion: "1.0.0",
  },
};
