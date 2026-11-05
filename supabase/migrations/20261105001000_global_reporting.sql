-- Global reporting: regions become optional overrides instead of a requirement.
-- Forward-only change on top of the earlier migrations; safe to re-run.

-- 1. app_config: new flag + setting (existing row and column defaults)
update app_config set
  feature_flags = '{"restrictToRegions": false}'::jsonb || feature_flags,
  safety_limits = '{"reportExpiryDays": 7}'::jsonb || safety_limits;

alter table app_config
  alter column feature_flags set default '{"communityUpdates":true,"nearbyAlerts":true,"listAds":true,"impactBannerAd":true,"restrictToRegions":false}',
  alter column safety_limits set default '{"autoHideAfterFlags":3,"reportsPerUserPerHour":3,"updatesPerUserPerHour":6,"reportExpiryDays":7,"minimumAppVersion":"1.0.0"}';

-- 2. Ad placements can apply everywhere (region_id null) as well as per region
alter table ad_placement_regions drop constraint if exists ad_placement_regions_pkey;
alter table ad_placement_regions alter column region_id drop not null;
alter table ad_placement_regions add column if not exists created_at timestamptz not null default now();
create unique index if not exists ad_placement_scope_uniq
  on ad_placement_regions (placement_id, coalesce(region_id, '00000000-0000-0000-0000-000000000000'));

-- 3. Reports no longer need a region: keep a coarse area label instead
alter table reports alter column region_id drop not null;
alter table reports drop constraint if exists reports_region_id_fkey;
alter table reports add constraint reports_region_id_fkey
  foreign key (region_id) references regions(id) on delete set null;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'reports' and column_name = 'region_name') then
    alter table reports rename column region_name to area_name;
  end if;
end $$;
alter table reports alter column area_name drop not null;

-- 4. Remove the three design-sample regions seeded earlier. Reports keep their area_name;
--    their region_id becomes null. Regions you add yourself are untouched.
delete from regions where name in ('South Jakarta', 'Bandung', 'Surabaya');
