-- Impact periods and allocations.

create table impact_periods (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  summary text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table allocations (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references impact_periods(id) on delete cascade,
  beneficiary text not null,
  category text not null check (category in ('shelter','rescue_group','vet_clinic','other')),
  amount numeric(18,2) not null check (amount > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  transfer_date date not null,
  public_note text not null default '',
  evidence text[] not null default '{}',
  redaction_checked boolean not null default false,
  transfer_confirmed boolean not null default false,
  status text not null default 'draft' check (status in ('draft','verified','published')),
  published_at timestamptz,
  -- DB-level guard mirroring the domain rule: nothing public without verification
  constraint allocation_publishable check (
    status <> 'published' or (transfer_confirmed and redaction_checked and cardinality(evidence) > 0)
  )
);
create index allocations_period_idx on allocations (period_id);
