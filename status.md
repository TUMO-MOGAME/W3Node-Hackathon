# Heirloom: status

> Read this first in any new session. The design is in [plan.md](plan.md); the on-chain contract is in [docs/program-spec.md](docs/program-spec.md).
> Update this file at the end of every work session.

**Last updated:** 2026-11-11 (night)
**Phase:** Build. Four agents are writing code in parallel (see "In progress").
**Hackathon:** W3Node Node Engine, **Tether track** (confirmed). **Submit on BuilderBase by Fri 13 Nov 2026, 23:59 SAST** (public repo + README + video ≤ 3 min). Judging Sat 14 Nov: 5-min pitch + 3-min Q&A. Rubric in plan.md §0.

## Done
- [x] Research, stack and plan (plan.md)
- [x] Tether track confirmed; Tether checklist in plan.md §3.2b
- [x] git repo initialised (branch `main`, no commits yet); root `.gitignore` (keys and seeds excluded)
- [x] Ubuntu installed in WSL, plus build packages (build-essential, pkg-config, libssl-dev, libudev-dev)
- [x] Next.js 16.4 app scaffolded in `app/` (React 19.3, Tailwind 4, TS)
- [x] npm packages: @google/genai, @tetherto/wdk-wallet-solana (1.0.0-beta.20), @anchor-lang/core 1.2.2, @solana/web3.js 1, @solana/spl-token, @solana/kit, zod 4, @supabase/supabase-js, motion, lucide-react, clsx, @elevenlabs/react 1.22, tsx, vitest
- [x] Shared contract between agents: `docs/program-spec.md`, `app/src/lib/types.ts`, `app/src/lib/service/{types,index}.ts`, `app/src/lib/wallet/types.ts`, `app/src/lib/voice/types.ts`, `app/src/lib/format.ts`

## In progress (parallel agents, started 2026-11-11)
| Agent | Owns | Output |
|---|---|---|
| Contract | `programs/`, `Anchor.toml`, `app/src/lib/chain/idl/`, `scripts/build-program.sh` | Anchor program + LiteSVM tests + hand-written IDL |
| Backend | `app/src/lib/{chain,wallet,agent,voice}`, `app/src/app/api/`, `scripts/`, `supabase/`, `next.config.ts` | WDK wallets, Gemini orchestrator + specialists, ElevenLabs voice backend, Supabase, FX (VALR), simulated ZAR off-ramp, devnet scripts |
| Design (Fable) | `app/src/app/**` (not api), `components/`, `content/`, `public/`, `service/mock.ts` | Full PWA UI, design system, mock demo mode, voice call UI, privacy/ECTA pages |
| Business | `docs/business.md`, `validation.md`, `pitch.md`, `demo-video-script.md`, `landing-facts.md` | Market research, pricing, GTM, user validation kit, pitch, video script |

## Next up
1. **Tumo:** run the Solana toolchain install in Ubuntu (command in the chat). The auto-mode safety check blocked me from piping a remote script into bash.
2. **Tumo:** send keys for `.env.local`: GEMINI_API_KEY, ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID, SUPABASE_URL + keys
3. Lead: when the agents finish, integrate, then run `tsc`, the tests and `next build`; fix the Rust once the toolchain is in; first commit
4. Build and deploy the program to devnet; run the devnet setup + seed scripts; switch the app to `NEXT_PUBLIC_DATA_MODE=chain`
5. Deploy the app to Vercel; create the public GitHub repo
6. **Tumo:** run the user validation kit (docs/validation.md) with about 10 people before Friday (scores in Business)
7. README "Where Tether is used", demo video, pitch rehearsal

## Decisions log
| Date | Decision | Why |
|---|---|---|
| 2026-11-11 | Solana + native USD₮ SPL; per-estate mint check | The brief; blocks fake USDT |
| 2026-11-11 | **Tether WDK** for every wallet, including the agent's | The Tether track needs visible WDK + USD₮ use |
| 2026-11-11 | **Gemini** instead of Claude for the AI agent | Tumo's choice |
| 2026-11-11 | **Orchestrator + 6 specialist agents**; **ElevenLabs** voice calls go through the same orchestrator | Tumo wants a showpiece agent; one brain for text and voice |
| 2026-11-11 | **PWA** (website + installable phone app) | "A web and an app" within 2 days |
| 2026-11-11 | **Supabase** for off-chain data + evidence files (with an in-memory fallback) | Tumo's choice; POPIA: only hashes on-chain |
| 2026-11-11 | Mock mode + persona switcher in the UI | Demo always works offline; one browser can act as dad, child, verifier and buyer |
| 2026-11-11 | Car title = SPL NFT (Metaplex Core later) | 2-day deadline |
| 2026-11-11 | Death = AI review + 2-of-3 verifiers + waiting period + owner veto | No public Home Affairs API |
| 2026-11-11 | Payouts only to approved institution wallets; ZAR settlement simulated and labelled | The "strict" requirement; honest demo |
| 2026-11-11 | Pitch as a "programmable estate trust" next to a legal will | SA Wills Act requires a signed paper will |
| 2026-11-11 | **Living plans + scheduled payments**: rules can start now (owner approves while alive) and recurring payouts run automatically; the same plan continues after death | Tumo's idea: easier to demo on devnet, gives a monthly-use reason (supports the R99/month model) |
| 2026-11-11 | Demo-friendly settings: 60 s waiting period, 60 s recurring interval, demo panel, persona switcher | Tumo: "shouldn't be too strict" for the demo; the contract still blocks rule-breaking |
| 2026-11-11 | Devnet deployer `FHRjTDqQrPCi7QxvdaTu25RRf6gGMpj6wAhHyybX2LL5` (keypair in WSL `~/.config/solana/id.json`), funded with 5 SOL | For the program deploy |
| 2026-11-11 | Toolchain: rustc 1.99.1, solana-cli 4.3.2, anchor 1.2.2 (avm); no Surfpool (LiteSVM tests instead) | Installed by Tumo + lead |

## Open questions for Tumo
- Solo or team? (needed for BuilderBase)
- Working name "Heirloom": keep it?
- GitHub account/repo name for the public repo

## Blockers
- Solana toolchain (Rust, Agave CLI, Anchor, Surfpool) is not installed yet. It needs Tumo to run the install command.
