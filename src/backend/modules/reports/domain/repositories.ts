import type { Page } from "@/backend/shared/domain/page";
import type { GeoPoint } from "@/backend/shared/domain/geo";
import type { CommunityUpdate } from "./community-update";
import type { Flag, FlagTarget } from "./flag";
import type { Animal, Condition, Report, ReportState, Urgency } from "./report";

export type ReportSort = "nearby" | "latest" | "urgent" | "newest" | "most_flags";

export interface ReportQuery {
  /** "Now", so effective state (expiry) is evaluated consistently. */
  now: Date;
  /** Effective states to include. */
  states?: ReportState[];
  refContains?: string;
  regionId?: string;
  animals?: Animal[];
  conditions?: Condition[];
  urgency?: Urgency;
  reporterId?: string;
  excludeReporterIds?: string[];
  center?: GeoPoint;
  radiusKm?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  minOpenFlags?: number;
  sort: ReportSort;
  limit: number;
  offset: number;
}

export interface ReportRepository {
  add(report: Report): Promise<void>;
  save(report: Report): Promise<void>;
  findById(id: string): Promise<Report | null>;
  findByRef(ref: string): Promise<Report | null>;
  search(query: ReportQuery): Promise<Page<Report>>;
  countByReporterSince(reporterId: string, since: Date): Promise<number>;
  listByReporter(reporterId: string): Promise<Report[]>;
  /**
   * Reports that still hold photo keys although they are no longer worth showing: expired before `cutoff`, removed, or
   * closed before `cutoff`. Oldest first.
   */
  listWithStalePhotos(cutoff: Date, limit: number): Promise<Report[]>;
}

export interface UpdateSearch {
  filter: "flagged" | "all" | "hidden";
  limit: number;
  offset: number;
}

export interface UpdateRepository {
  add(update: CommunityUpdate): Promise<void>;
  save(update: CommunityUpdate): Promise<void>;
  findById(id: string): Promise<CommunityUpdate | null>;
  listByReport(reportId: string): Promise<CommunityUpdate[]>;
  listByAuthor(authorId: string): Promise<CommunityUpdate[]>;
  countByAuthorSince(authorId: string, since: Date): Promise<number>;
  search(criteria: UpdateSearch): Promise<Page<CommunityUpdate>>;
}

export interface FlagRepository {
  nextNumber(): Promise<number>;
  add(flag: Flag): Promise<void>;
  save(flag: Flag): Promise<void>;
  findById(id: string): Promise<Flag | null>;
  findByNumber(n: number): Promise<Flag | null>;
  openFor(targetType: FlagTarget, targetId: string): Promise<Flag[]>;
  hasFlagged(flaggerId: string, targetType: FlagTarget, targetId: string): Promise<boolean>;
  search(criteria: { status: "open" | "resolved"; limit: number; offset: number }): Promise<Page<Flag>>;
  /** All flags (any status) aimed at these targets. */
  countAgainst(targetType: FlagTarget, targetIds: string[]): Promise<number>;
  allOpen(): Promise<Flag[]>;
}
