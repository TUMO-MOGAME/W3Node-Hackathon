-- Legacy Voice: the estate owner's consented voice clone and Legacy Book (personal information, POPIA).
-- Same access model as 0001: the Next.js server uses the service-role key; RLS is ON with NO policies, so the
-- anon/authenticated roles can neither read nor write. The ElevenLabs voice_id / agent_id never leave the server.
-- Nothing here goes on-chain; if anything is anchored later it is a SHA-256 only (book_sha256, consent_sha256).

create table if not exists public.legacy_voices (
  estate                text primary key,                        -- Estate PDA (base58)
  owner_wallet          text not null,                           -- must equal the on-chain estate owner (checked by the API)
  owner_name            text not null,
  voice_id              text,                                    -- ElevenLabs voice id; null = simulated (no key). SERVER ONLY.
  agent_id              text,                                    -- private ElevenLabs agent for live calls. SERVER ONLY.
  requires_verification boolean not null default false,
  consent_text          text not null,                           -- the exact line the owner read aloud
  consent_sha256        text not null check (consent_sha256 ~ '^[0-9a-f]{64}$'),
  consent_path          text not null,                           -- recording of the consent line in `legacy-audio`
  sample_paths          jsonb not null default '[]',
  sample_sha256         jsonb not null default '[]',
  consented_at          timestamptz not null,
  created_at            timestamptz not null default now()
);

create table if not exists public.legacy_books (
  estate       text primary key,
  owner_wallet text not null,
  book         jsonb not null,                                   -- LegacyBook (zod-validated before insert)
  book_sha256  text not null check (book_sha256 ~ '^[0-9a-f]{64}$'),
  opt_ins      jsonb not null default '{}',                      -- child wallet -> true/false (each child's own choice)
  updated_at   timestamptz not null default now()
);

-- Cache of rendered speech (milestone messages and companion replies) so a message is synthesised once.
create table if not exists public.legacy_messages (
  id           bigserial primary key,
  estate       text not null references public.legacy_voices(estate) on delete cascade,
  text_sha256  text not null check (text_sha256 ~ '^[0-9a-f]{64}$'),   -- sha256(voice_id + text): no text stored here
  milestone_id text,
  audio_path   text not null,
  created_at   timestamptz not null default now(),
  unique (estate, text_sha256)
);

alter table public.legacy_voices   enable row level security;
alter table public.legacy_books    enable row level security;
alter table public.legacy_messages enable row level security;
revoke all on public.legacy_voices, public.legacy_books, public.legacy_messages from anon, authenticated;
revoke all on sequence public.legacy_messages_id_seq from anon, authenticated;

-- Private bucket for consent recordings, voice samples and rendered messages (service role only).
-- Paths hold no names: "<kind>/<sha256(estate) prefix>/<sha256>.<ext>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('legacy-audio', 'legacy-audio', false, 3145728, array['audio/webm','audio/ogg','audio/mpeg','audio/wav','audio/mp4'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Retention (placeholder, see the privacy policy): delete when the owner deletes the voice/book, or
-- [N] years after the estate's final payment, by a scheduled job the operator runs.
