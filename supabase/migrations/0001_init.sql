-- Heirloom off-chain metadata. Personal data lives here (POPIA), never on-chain; the chain stores hashes only.
-- Access model: the Next.js server uses the service-role key (bypasses RLS). RLS is enabled on every table
-- with NO policies for anon/authenticated, so the public anon key can neither read nor write anything.

create extension if not exists pgcrypto;

create table if not exists public.estate_meta (
  estate         text primary key,              -- Estate PDA (base58)
  owner_wallet   text not null,
  owner_name     text not null,
  verifier_names jsonb not null default '["Verifier 1","Verifier 2","Verifier 3"]',
  asset_titles   jsonb not null default '{}',   -- nft mint -> "2019 Toyota Corolla 1.8 Prestige"
  buyer_names    jsonb not null default '{}',   -- buyer wallet -> display name
  updated_at     timestamptz not null default now()
);

create table if not exists public.wallet_profiles (
  wallet       text primary key,
  display_name text not null,
  role         text not null check (role in ('owner','beneficiary','verifier','buyer','agent')),
  created_at   timestamptz not null default now()
);

create table if not exists public.will_drafts (
  id           uuid primary key default gen_random_uuid(),
  owner_wallet text,
  draft        jsonb not null,                   -- WillDraft (validated by zod before insert)
  will_hash    text not null check (will_hash ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz not null default now()
);
create index if not exists will_drafts_owner_idx on public.will_drafts (owner_wallet);

create table if not exists public.evidence (
  path       text primary key,                   -- "<purpose>/<sha256>.<ext>" in the private `evidence` bucket
  sha256     text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  purpose    text not null check (purpose in ('death','claim','hardship','asset')),
  mime       text not null check (mime in ('application/pdf','image/jpeg','image/png')),
  size       integer not null check (size > 0 and size <= 10485760),
  created_at timestamptz not null default now()
);

create table if not exists public.agent_reports (
  report_hash     text primary key check (report_hash ~ '^[0-9a-f]{64}$'), -- = agent_report_hash on-chain
  purpose         text not null check (purpose in ('death','claim','hardship','valuation','offers')),
  estate          text,
  subject         text,                          -- claim / hardship / asset address when known
  evidence_path   text references public.evidence(path) on delete set null,
  evidence_sha256 text,
  report          jsonb not null,                -- AgentReport
  tx_signature    text,                          -- the agent's review_* transaction
  created_at      timestamptz not null default now()
);
create index if not exists agent_reports_estate_idx on public.agent_reports (estate);

create table if not exists public.transcripts (
  id         bigserial primary key,
  session_id text not null,
  channel    text not null check (channel in ('text','voice')),
  persona    text,
  estate     text,
  role       text not null check (role in ('user','agent')),
  specialist text,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists transcripts_session_idx on public.transcripts (session_id, created_at);

alter table public.estate_meta     enable row level security;
alter table public.wallet_profiles enable row level security;
alter table public.will_drafts     enable row level security;
alter table public.evidence        enable row level security;
alter table public.agent_reports   enable row level security;
alter table public.transcripts     enable row level security;

-- Belt and braces: no table privileges for the public roles at all.
revoke all on all tables in schema public from anon, authenticated;

-- Private storage bucket for evidence files (service role only; verifiers get short-lived signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
