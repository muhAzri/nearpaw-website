export interface DashboardSources {
  reports: {
    dashboard(): Promise<{
      liveReports: number;
      reportsLast24h: number;
      openFlags: number;
      oldestOpenFlagMinutes: number | null;
      autoHiddenToday: number;
      reportsWithMultipleFlags: number;
      newest: unknown[];
    }>;
  };
  alerts: { stats24h(): Promise<{ sent: number; failed: number }> };
  support: { counts(): Promise<{ unreadMessages: number; openPrivacyRequests: number; dueSoon: number }> };
  audit: { execute(limit: number): Promise<unknown[]> };
}

/** Read-only aggregate for the admin Dashboard screen. */
export class DashboardQuery {
  constructor(private readonly src: DashboardSources) {}

  async execute() {
    const [reports, alerts, support, recentActions] = await Promise.all([
      this.src.reports.dashboard(),
      this.src.alerts.stats24h(),
      this.src.support.counts(),
      this.src.audit.execute(5),
    ]);
    return {
      liveReports: reports.liveReports,
      reportsLast24h: reports.reportsLast24h,
      openFlags: reports.openFlags,
      oldestOpenFlagMinutes: reports.oldestOpenFlagMinutes,
      autoHiddenToday: reports.autoHiddenToday,
      alerts24h: alerts,
      newestReports: reports.newest,
      needsAttention: {
        reportsWithMultipleFlags: reports.reportsWithMultipleFlags,
        privacyRequestsDueSoon: support.dueSoon,
        unreadSupportMessages: support.unreadMessages,
      },
      recentActions,
    };
  }
}
