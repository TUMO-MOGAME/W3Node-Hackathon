# Heirloom: status

> Read this first in any new session. The design is in [plan.md](plan.md); the on-chain contract is in [docs/program-spec.md](docs/program-spec.md).
> Update this file at the end of every work session.

**Last updated:** 2026-11-12 (early morning, after the pre-submission audit)
**Phase:** Audit done, demo-ready in mock mode. Remaining: Tumo's decisions (below), video, submit.
**Hackathon:** W3Node Node Engine, **Tether track** (confirmed). **Submit on BuilderBase by Fri 13 Nov 2026, 23:59 SAST** (public repo + README + video ≤ 3 min). Judging Sat 14 Nov: 5-min pitch + 3-min Q&A. Rubric in plan.md §0.

## Done
- [x] Research, stack and plan (plan.md)
- [x] Tether track confirmed; Tether checklist in plan.md §3.2b
- [x] git repo initialised (branch `main`, no commits yet); root `.gitignore` (keys and seeds excluded)
- [x] Ubuntu installed in WSL, plus build packages (build-essential, pkg-config, libssl-dev, libudev-dev)
- [x] Next.js 16.4 app scaffolded in `app/` (React 19.3, Tailwind 4, TS)
- [x] npm packages: @google/genai, @tetherto/wdk-wallet-solana (1.0.0-beta.20), @anchor-lang/core 1.2.2, @solana/web3.js 1, @solana/spl-token, @solana/kit, zod 4, @supabase/supabase-js, motion, lucide-react, clsx, @elevenlabs/react 1.22, tsx, vitest
- [x] Shared contract between agents: `docs/program-spec.md`, `app/src/lib/types.ts`, `app/src/lib/service/{types,index}.ts`, `app/src/lib/wallet/types.ts`, `app/src/lib/voice/types.ts`, `app/src/lib/format.ts`

## Smart contract: DONE (2026-11-11)
- **Deployed to devnet: program id `b3PBVwkLnyx7eyLPNtc5J3Ds3os3cenqCVRHaCJM7FY`** ([Explorer](https://explorer.solana.com/address/b3PBVwkLnyx7eyLPNtc5J3Ds3os3cenqCVRHaCJM7FY?cluster=devnet)); upgrade authority = deployer in WSL `~/.config/solana/id.json` (~2.29 SOL left)
- `anchor build` clean; **25/25 LiteSVM tests pass**; 27 instructions incl. living plans (`owner_approve_claim`, `execute_scheduled`)
- Build/test/deploy: `wsl -d Ubuntu -u tumo --cd ~ -- bash "/mnt/c/Users/tumom/Hackathons/W3Node Hacathon/scripts/build-program.sh" [deploy]` (builds in `~/heirloom-build` for speed)
- Program keypair `target/deploy/heirloom-keypair.json` is gitignored: **keep it**, or the program id changes
- No on-chain IDL (the IDL upload needs Linux node in WSL); the app uses the bundled IDL
- Repo: github.com/TUMO-MOGAME/W3Node-Hackathon (private for now; Tumo will make it public)

## Backend: DONE (2026-11-11). Devnet demo seeded
- `tsc` clean; **90/90 vitest tests pass**; API routes smoke-tested (live VALR rate R16.69/USD₮)
- Gemini default model `gemini-4-argon` (override with `GEMINI_MODEL`)
- Devnet: test USD₮ mint `8qp8uFHeJMgwQPWCYAKh9mpYw6FgU4iwu6psKiKViKK5`; car title NFT `F9FVooHEzRu92UXDmeUTNK7c1Wxgxi6xwWBRjqub5fLm`; agent wallet `261pQudaK5J4v1WCtcGjWidWU9ww3KyYC4TiU8jDsjNg`
- **Demo estate `JBdsDy67YBfpV8YAc2H1h7w95h8uJ2XUzTDh9vt34G9E`**: 3 beneficiaries, 3 payees (UCT, Tugwell Residence, Westerford), 4 rules, vault deposit, car registered
- 13 demo WDK wallets: seeds in `scripts/.demo-wallets.json` (gitignored); env in `scripts/.env.devnet` (gitignored, includes the agent seed)
- **Tumo must create `app/.env.local`** (Claude is blocked from writing secret files): `Copy-Item scripts\.env.devnet app\.env.local`, then add the GEMINI / ELEVENLABS / SUPABASE keys (names in `app/.env.example`)
- Open gaps: `Claim.ownerApproved` isn't exposed in types; recurring rules created from a new will become claim-based until a payee wallet is known; in-memory rate limits

## UI: DONE. Integrated build green. LIVE (2026-11-11)
- **Live: https://heirloom-one-iota.vercel.app** (Vercel project `heirloom`, account tumo-mogame; currently **mock mode**, from commit 60d53ae)
- Deploy method (since 2026-11-12): Vercel project Root Directory = `app`, so **every push to main builds and deploys from GitHub**. Manual fallback: snapshot worktree `.deploy/` → `git -C .deploy checkout --detach <commit>`; `cd .deploy; npx vercel deploy --prod --yes` (run from `.deploy`, not `.deploy/app`)
- Integrated: tsc clean, 90/90 tests, `next build` OK (36 routes)
- Running now: QA agent (eslint, untested flows, axe, Lighthouse, chain-mode P2P send on devnet) + docs agent (README, LICENSE, submission.md, architecture.md, pitch/video/business updates)
- Still to do: switch production to chain mode (set Vercel env vars incl. the agent seed + Tumo's keys), final redeploy, record the video, make the repo public, submit on BuilderBase

## AUDIT (2026-11-12, 02:00 SAST): main dd5ef34, live (mock mode)
- 2026-11-12 midday: **Gemini fixed** (gemini-4-argon rejected `maxItems` in response schemas → every specialist call 400; stripped in `jsonSchemaOf`, 116e0cd). Vercel Production now has `GEMINI_API_KEY` + `ELEVENLABS_API_KEY` (live `/api/health`: gemini true). **`ELEVENLABS_AGENT_ID` deliberately NOT set:** the id in Tumo's `.env.local` is another project's agent ("Social Assembly: Emma"); a Heirloom agent must be created per `scripts/elevenlabs-agent.md` first (+ `ELEVENLABS_TOOL_SECRET`). Note: in mock mode the chat home and Plan builder use scripted answers; Gemini is used live by the voice agent's webhook and in chain mode. Tumo's `.env.local` is at the repo root; Next reads `app/.env.local`
- Follow-up (Tumo): Plan page "stuck" scrolling fixed: the chat and plan cards used `overscroll-contain`, which blocked the page from scrolling once the mouse was over a card at its end. Removed; deployed
- **All green:** tsc, eslint, **239/239 Vitest**, contrast guard, `next build`; **25/25 LiteSVM** program tests in WSL; devnet sponsored transfer re-run OK (`53NmLwMN…`, Lerato's SOL unchanged; malicious tx refused); README devnet tx links all finalized
- **Lighthouse (live):** desktop perf 96–100 on `/`, `/chat`, `/will`; a11y 100 everywhere; CLS 0. Mobile: `/` 88–92, app pages `/chat` `/will` ~65 (React/Next hydration of the shell; open item)
- **Fixed (16):** Plan page: retry sent message twice, review chip opened incomplete plan, Now/After choice moved to the wrong rule, page jumped on toggle, review opened scrolled down, locked view called every schedule "monthly", "Change the minimum" chip ignored; mock sends didn't show sponsored fee; payout "Try again" re-approved; CLS 0.16 → 0 on `/chat` `/will`; favicon 404; `truncate` broken by unlayered `text-wrap`; gated pages had no h1; `/estate` + `/vault` contrast (fade-in); axe roles on chat log / vault tabpanel / thinking indicator / demo badge / nav names; shell + chat home untranslated in zu/st/af; `/api/review` 500 → 400; legacy companion wrote "i am"; build script hard-coded Tumo's path (+ `.gitattributes` keeps LF)
- **Docs:** README/submission/video script/pitch/architecture match the code and the chat-first UI; README says the live site is mock mode
- **Open:** see "Next up"
- Disk: ~5 GB free. `.next` was deleted and rebuilt; Edge profiles cleaned

## Earlier (2026-11-11 late night): main 0381565, live
- Plan page (`/will`, `app/src/components/screens/will.tsx`): chat card + plan card now equal height and aligned on desktop, each scrolls inside itself, composer pinned, page doesn't jump. Tumo reports **a few bugs still remain on the Plan/will page**: next session starts with a full audit (see the prompt Tumo was given)
- Disk: C: filled up twice (headless Edge profiles in the Claude scratchpad, npm cache). Clean profiles after browser tests
- Agent worktrees merged and removed; only `.deploy/` (Vercel snapshot) remains

## Earlier (2026-11-11 night): main 6e369ee, live
- **Chat-first shell**: left sidebar (grouped nav, saved chats per persona, utilities, persona card; collapses to a rail; mobile drawer), home `/chat` with nudge cards + pinned composer (dictate, call, review a document, send money). Data layer in `app/src/lib/chat/*`
- **Icons: Flaticon UIcons, regular rounded** via `app/src/components/ui/icons.tsx`; subset font 10.7 KB built by `npm run icons` (runs in prebuild). The free licence requires the credit line "Uicons by Flaticon" (footer + README Credits): keep it
- Checks: 230 tests, tsc/eslint clean, mono guard OK, build OK. Live verified
- Open: two contrast issues on `/estate` flagged by axe (`.ml-2`, `.text-display`); nudge copy English only

## Earlier (2026-11-11 evening): main f4c701e
- **Design is now pure black and white** (Tumo's call, replaces Harvest Moon). No hue, no gradients; `node app/scripts/contrast.mjs` guards this (fails on any hue or gradient). Status shown by icons, words and line styles
- **Legacy Voice merged**: `/legacy` (parent consent + voice samples + Legacy Book; child opt-in, messages, chat, live call). ElevenLabs IVC + a private per-estate agent; wallet-signed requests; no money authority; SADAG escape. Needs a paid ElevenLabs plan (Starter+) for real cloning
- Checks: 199/199 tests, tsc + eslint clean, build 44 pages, mono guard passes
- Live https://heirloom-one-iota.vercel.app (mock mode, Tumo approved). Pitch deck converted to black and white
- Remaining: Tumo's keys (Gemini, ElevenLabs, Supabase) → Vercel env; top up the agent/sponsor wallet `261pQ…sjNg`; a devnet-mode launcher for the laptop demo; record the video; make the repo public; submit on BuilderBase by Fri 13 Nov 23:59

## Merged into main (2026-11-11 afternoon); live redeploy 402d07b
- QA ✅ · Gasless + Cape Town + /api/health ✅ · QVAC ✅ · isiZulu/Sesotho/Afrikaans ✅ · Harvest Moon redesign ✅ (landing styling ported into the localised `LandingBody`). 172 tests, eslint clean, build OK
- Live https://heirloom-one-iota.vercel.app (mock mode); `/api/health` reports programDeployed=true
- Waiting: Legacy Voice (`feature/legacy-voice`)
- Decision pending (Tumo): public site in mock mode vs chain mode

## Wave 2 (started 2026-11-11 midday): merge these branches when done
| Agent | Where | Branch |
|---|---|---|
| QA + fixes + chain-mode P2P test | main checkout | **DONE, merged** (66a9995). Devnet P2P send via the UI: `25PK65L8bLSCM6d1jJMBTAAaW9UeyDjk8HBdCp5pBmk8MDGAwu8JpNzKXUYxhLnzPsZeGJNqQpjBxC2Q62ofJYvT` |
| Harvest Moon redesign (Fable): #800020 / #FFCE1B / #A52A2A / #BE5103 | `.claude/worktrees/agent-a4929912d26b8668f` | `worktree-agent-a4929912d26b8668f` |
| isiZulu / Sesotho / Afrikaans | `.claude/worktrees/agent-ae33696ab4b5e1436` | `worktree-agent-ae33696ab4b5e1436` |
| Tether QVAC wallet assistant | `.claude/worktrees/agent-a6233de91ce4e56f2` | `worktree-agent-a6233de91ce4e56f2` |
| Gasless fees + Cape Town region + /api/health | `.claude/worktrees/agent-abc0ddce1a52b0691` | `worktree-agent-abc0ddce1a52b0691` |
| **Legacy Voice** (ElevenLabs clone of the parent, consented while alive; Legacy Book; no money authority; SADAG escape) | `.claude/worktrees/legacy-voice` | `feature/legacy-voice` |
- Pitch deck (3 slides, Harvest Moon): https://claude.ai/artifact/CRBuJE5QBNxVxcVvwJ4neA (private until Tumo shares it)
- Never use `git stash` across worktrees (shared stash list; two agents swapped stashes once). On 2026-11-11 the disk filled up; clearing the npm cache freed about 10 GB

## Fee sponsorship + hosting: DONE, merged (2026-11-11)
- Families need no SOL: the agent's WDK wallet is fee payer. Client builds tx (fee payer = sponsor), user's WDK wallet partially signs, `POST /api/sponsor` validates (`lib/sponsor/policy.ts`, 39 tests), simulates, co-signs; the pay-once pipeline stores the bytes, then broadcasts. Falls back to user-paid if the sponsor is down/refuses
- Tether's `@tetherto/wdk-wallet-solana-gasless` needs a Kora paymaster server (user pays fees in a token); not deployable on Vercel by Friday, so we sponsor ourselves
- Devnet proof: Lerato → Sipho 1 USD₮, Lerato's SOL unchanged: `5NfaB421n92RHKJgcEiczMbDadP9zNo9yDZwgbXVFZyVZBxgYvQtWMdTt7GZWjt4GYpYZAx1pP97xJUY7HULkqVn` (`scripts/sponsor-devnet.ts`)
- `GET /api/health`; `app/vercel.json`: functions in `cpt1` (Cape Town), Vercel Cron daily 06:00 UTC on `/api/scheduler/tick` (Hobby minimum: once per day; set `CRON_SECRET`)
- Agent/sponsor wallet has only ~0.3 SOL on devnet: top it up before the demo

## In progress (parallel agents, started 2026-11-11)
| Agent | Owns | Output |
|---|---|---|
| Contract | `programs/`, `Anchor.toml`, `app/src/lib/chain/idl/`, `scripts/build-program.sh` | Anchor program + LiteSVM tests + hand-written IDL |
| Backend | `app/src/lib/{chain,wallet,agent,voice}`, `app/src/app/api/`, `scripts/`, `supabase/`, `next.config.ts` | WDK wallets, Gemini orchestrator + specialists, ElevenLabs voice backend, Supabase, FX (VALR), simulated ZAR off-ramp, devnet scripts |
| Design (Fable) | `app/src/app/**` (not api), `components/`, `content/`, `public/`, `service/mock.ts` | Full PWA UI, design system, mock demo mode, voice call UI, privacy/ECTA pages |
| Business | `docs/business.md`, `validation.md`, `pitch.md`, `demo-video-script.md`, `landing-facts.md` | Market research, pricing, GTM, user validation kit, pitch, video script |

## Next up
1. **Tumo decides:** live site stays mock mode (honest, labelled) or switches to chain mode (needs Vercel env: agent seed, mint, keys)
2. **Tumo:** add GEMINI / ELEVENLABS keys to Vercel if the video or judges should see real AI answers (live `/api/health` shows all false)
3. ~~Vercel GitHub builds failing~~ fixed 2026-11-12: project Root Directory was `.`; set to `app` (+ `turbopack.root` pinned in next.config.ts)
4. Retake README screenshots (they show the old icons) and record the video (≤ 3 min) per `docs/demo-video-script.md`
5. Confirm the "written 10–13 Nov" pre-existing-code dates in the README; have a first-language speaker check zu/st/af
6. Optional: mobile performance of app pages (~65); review summary text ignores Now/After toggles; persona names differ ("Adv. Ndlovu" vs "Adv. Thandi Ndlovu"); heading font rule overrides utilities (needs design OK)
7. Submit on BuilderBase by Fri 13 Nov 23:59 SAST

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
| 2026-11-12 | Audit before submission; live site kept in mock mode until Tumo decides | Tumo approved fixes + deploy; product changes need his OK |
| 2026-11-11 | Toolchain: rustc 1.99.1, solana-cli 4.3.2, anchor 1.2.2 (avm); no Surfpool (LiteSVM tests instead) | Installed by Tumo + lead |

## Open questions for Tumo
- ~~Solo or team?~~ **Solo** (confirmed 2026-11-11)
- Working name "Heirloom": keep it?
- GitHub account/repo name for the public repo

## Blockers
- None technical. Waiting on Tumo's decisions in "Next up" 1–2.
