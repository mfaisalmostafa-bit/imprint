-- Per-SKU print-zone corrections. Unowned rows so a correction one person
-- makes is there for the next person. No accounts. No bulk wipe.
create table if not exists placement_overrides (
  sku        text primary key,
  quad       text not null,
  rect       text not null,
  surface    text not null,
  curvature  real not null default 0,
  updated_at timestamptz not null default now()
);
