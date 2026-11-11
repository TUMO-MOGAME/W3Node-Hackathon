# Tether QVAC: the private wallet assistant

Type what you want, for example "Send R500 to Lerato for books". Tether QVAC reads the request on the device
and turns it into a structured intent. The app then checks the details: it matches the name against the
saved recipients and converts rand to USD₮ at the live VALR rate. Finally it opens the same payment review
sheet as every other payment: review, approve, WDK signs, pending, confirmed. **Nothing is sent without the
person's approval.** The assistant only fills in the review.

```
"send R500 to Lerato for books"
  └─► /api/assistant/qvac  (Node runtime)
        ├─ Tether QVAC (@qvac/sdk, local llama.cpp; output constrained by json_schema)
        │     └─ zod check + grounding (the amount and the person must appear in the text or the saved list)
        └─ or the deterministic fallback parser (same zod schema)
  └─► planSend(): savedRecipients() + getFx() → { to, amountUsdt, memo }
  └─► reviewSend() → review sheet → person approves → WDK signs → pending → confirmed
```

## What runs where

| Where | Engine | Why |
|---|---|---|
| `npm run dev` on a laptop with `@qvac/sdk` installed | **Tether QVAC**, on this machine | QVAC runs on Node.js (it starts its own Bare worker) |
| `npm run qvac:local` (no server) | **Tether QVAC**, on this machine | `scripts/qvac-local.ts`: the same parser in plain Node |
| Hosted demo on Vercel | Fallback parser, labelled "QVAC runs locally. The hosted demo uses the fallback parser." | The model and native engines are too large for a serverless function |
| Browser with no connection to the route | Fallback parser, in the browser | Also the path for poor connections |

The UI always says which engine answered: a "Tether QVAC · on-device AI" or "Fallback parser" badge on the
Send screen, and the same label in the chat reply.

**Why not in the browser?** The QVAC JS SDK supports Node.js (≥ 22.17), Bare (≥ 1.30.3) and Expo/React
Native on physical devices. There is no browser or WASM build. On Node, the SDK starts a Bare worker that
runs native llama.cpp. So the closest a Next.js PWA gets to on-device is a Node route on the user's own
machine. A native (Expo) build of Heirloom would run QVAC on the phone itself.

## Model

- Default `QWEN3_600M_INST_Q4`: Qwen3 0.6B Instruct, Q4 quantised, a few hundred MB. It downloads on first
  load into QVAC's cache, and later loads come from disk. It is the model QVAC's own structured-output example uses.
- Override it with `QVAC_MODEL` and any model constant `@qvac/sdk` exports, for example
  `LLAMA_3_2_1B_INST_Q4_0` (the quickstart model). Wally, the reference app, uses Qwen3-4B for broader DeFi intents.
- Output is constrained with `responseFormat: { type: "json_schema" }` to
  `{ action, recipient, amountUsdt, amountZar, memo }`, the same zod schema as the fallback parser
  (`app/src/lib/assistant/intent.ts`). Thinking is off (`/no_think`) and there is one few-shot example.
- Grounding: an amount that does not appear in the text, or a person who is not in the text or the saved
  list, is replaced by the deterministic reading. The model can never invent a payment.

## Run it locally

```bash
cd app
npm run qvac:install            # npm install --no-save @qvac/sdk@0.23.0 (kept out of package.json, see below)
npm run qvac:local -- "send R500 to Lerato for books"     # QVAC in plain Node, prints intent + plan
npm run dev                     # /send → "Ask your wallet", or ask in the Talk to Heirloom chat
curl localhost:3000/api/assistant/qvac                    # { enabled, state: idle|loading|ready, model, progress }
```

The first request starts the model download in the background and answers with the fallback parser,
labelled "QVAC is still loading the model (n%)". Later requests use QVAC.

Environment variables:

- `QVAC_ENABLED`: `1` or `0`. The default is on locally and off when `VERCEL` is set.
- `QVAC_MODEL`
- `QVAC_TIMEOUT_MS`: the default is 20000. After that the fallback answers.

## Limits and honest notes

- **Not in package.json on purpose.** `@qvac/sdk` 0.23 depends on every QVAC engine: llama.cpp, whisper,
  diffusion, TTS, OCR, translation and more, each with native prebuilds. Installing it on the build
  machine (Windows 11, Node 24.19) filled the remaining disk before it finished, and the aborted install
  left `node_modules` intact. Putting it in `dependencies` would bloat every Vercel install for a feature
  the hosted demo can't run. The adapter loads it with a non-analysable `import()`. This keeps it out
  of the server bundle and out of Vercel's file tracing. When it is missing, the route answers with the fallback.
- QVAC does not run on emulators (Expo). It needs a physical device or a desktop.
- The fallback understands send/pay/give/transfer; R, ZAR, rand, USDT, USD₮, USD, $ and dollars; "2k";
  saved names, first names, relationships ("my son"), and pasted Solana addresses; and "for <memo>". A number
  with no currency is read as USD₮, the wallet's currency. An ambiguous name, such as "my daughter" when
  there are two, asks the person to choose.
- The memo is shown in the review ("Lerato Mokoena · for books"). It is not written on-chain.
- Tests: `src/lib/assistant/intent.test.ts` (parser, grounding, recipient matching, rand conversion) and
  `qvac.test.ts` (enable rules, fallback when QVAC is absent).

## References

- QVAC docs: https://docs.qvac.tether.io. The JS/TS quickstart is at https://docs.qvac.tether.io/sdk/js-ts-sdk/#quickstart
- Structured output example: https://github.com/tetherto/qvac/blob/main/packages/sdk/examples/llamacpp-structured-output.ts
- Wally (QVAC + WDK reference): https://github.com/victorchimakanu/wally
