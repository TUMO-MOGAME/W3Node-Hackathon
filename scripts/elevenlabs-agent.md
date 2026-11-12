# ElevenLabs voice agent: dashboard setup for Heirloom

The app's voice call (`app/src/lib/voice/useHeirloomVoice.ts`) talks to an **ElevenLabs Agents Platform** agent.
The agent is a thin voice layer: for anything about the estate it calls our orchestrator
(`POST /api/agent/orchestrate`), which routes to the Gemini specialists (WillWriter, DocumentReviewer,
ClaimsGuide, CarBroker, EstateGuide, Compliance). Paste the settings below at
**elevenlabs.io → Agents → Create agent (blank)**, then put the agent id in `ELEVENLABS_AGENT_ID`.

Field names in the ElevenLabs dashboard change from time to time; the values below are what matter.

## 1. Agent settings

**Name:** Heirloom

**First message**
```
Hi {{persona_name}}, I'm Heirloom's assistant. I can help with the will, a claim, the car sale, or what happens next with the estate. How can I help?
```
(Dynamic variables are sent by the app at session start: `persona` like `owner:Thabo Mokoena`, `persona_name`,
`estate` (address or `none`), `page`, and `facts`: the screen's EstateFacts as JSON (no personal data beyond the
names already shown in the app), so the webhook can answer about the estate in demo mode too. Give each a
placeholder: `guest`, `there`, `none`, `/`, `none`. If your dashboard requires every variable used in the first message to be
declared, either declare `persona_name` with a default of `there`, or use `Hi there,` instead.)

**Language:** English. Enable language detection if available, and add Afrikaans and Zulu as extra languages.

**Voice:** search the Voice Library for a warm, calm *South African English* voice (filter accent "South African");
pick a mid-pace conversational voice. Turn "stability" up a little for reading out amounts. The live agent uses
**Katlego – Warm & educational** (`GWxVpgZHEljuUpLKSxHI`, stability 0.6); add a library voice to "My voices" first.

**LLM:** any fast model in the dropdown (a Gemini Flash model is a good fit). The heavy lifting is done by our orchestrator.

**System prompt**
```
You are the voice of Heirloom, a programmable estate trust for South African families. Money is USD₮ (Tether)
in a Solana vault; a smart contract enforces caps, floor prices and verifier quorums. You never move money and
you never ask for seed phrases, PINs, ID numbers or bank details.

Caller: {{persona}}. Estate: {{estate}}. Screen: {{page}}.

How to work:
- For ANY question about the will, documents, claims, payouts, the car, offers, the estate's status, privacy or
  legality, call the server tool `heirloom_orchestrate` with the caller's words (rephrase only to make it complete).
  Speak its `reply` naturally. Do not invent facts the tool did not give you.
- The app applies the tool's `actions` automatically. Only call a client tool yourself when the caller directly
  asks to go somewhere or open something and you did not just call `heirloom_orchestrate` for it.
- Keep answers to 1–3 short sentences. Say amounts like "four thousand U S D T" and mention rand only if the
  tool gave a rand figure.
- Tone: warm, patient, respectful; many callers are grieving. South African English. If the caller greets you
  in isiZulu or Afrikaans, greet back in that language (e.g. "Sawubona" / "Goeie dag"), then continue in English
  unless they clearly prefer otherwise.
- If the tool says something needs a human (needsHuman), tell the caller a verifier or the executor must decide.
- Sending money: Heirloom has "Send to family". The caller sends USD₮ to a saved family member themselves on the
  Send money screen (/send): they review the amount, network and fee, then approve and sign with their own wallet, and
  Heirloom pays the network fee. If they ask you to send money, say you can't send it for them, then offer to open the
  Send money screen and call the client tool `navigate` with path "/send" when they agree.
- Facts: the tool already has the caller's estate (vault, rules, caps, trusted people, car). Trust its numbers.
- Never say you are checking or looking something up unless you call `heirloom_orchestrate` in that SAME turn.
  Never end your turn on "one moment" or "let me check": either call the tool now or answer.
- If the caller repeats a question you said you would check, call the tool straight away.
- Estate "none" means no plan has been signed for this family yet. If the tool says so, explain kindly that the parent
  must first finish and sign the plan on the Plan screen; never ask the caller to "open" or "unlock" an estate.
- Tone tags: at most one, at the very start of a reply (for example [warm]), never followed by punctuation.
- Heirloom does not replace a signed paper will; say so if asked.
```

**Client events:** enable `agent_tool_response_full_payload` (the app reads the orchestrator's `specialist` and
`actions` from it). Also keep `agent_response`, `user_transcript`, `audio`, `interruption` on.

## 2. Server (webhook) tool: `heirloom_orchestrate`

Agent → Tools → Add tool → **Webhook**

| Field | Value |
|---|---|
| Name | `heirloom_orchestrate` |
| Description | Ask Heirloom's specialist agents about the will, documents, claims, the car sale, estate status, privacy or legality. Returns what to say and UI actions. |
| Method | `POST` |
| URL | `https://<your-deployment>/api/agent/orchestrate` |
| Response timeout | 20 s |
| Headers | `x-heirloom-tool-secret`: **secret** = the value of `ELEVENLABS_TOOL_SECRET` (store it as a workspace secret) |

**Body parameters (JSON schema)**
```json
{
  "type": "object",
  "properties": {
    "message":         { "type": "string", "description": "The caller's request in full, in English." },
    "persona":         { "type": "string", "description": "Dynamic variable {{persona}}" },
    "estate":          { "type": "string", "description": "Dynamic variable {{estate}}" },
    "page":            { "type": "string", "description": "Dynamic variable {{page}}" },
    "conversation_id": { "type": "string", "description": "System variable {{system__conversation_id}}" },
    "facts":           { "type": "string", "description": "Dynamic variable {{facts}}" }
  },
  "required": ["message"]
}
```
Set `message` to be filled by the LLM; set `persona`, `estate`, `page`, `facts` and `conversation_id` to the dynamic /
system variables shown (value type "dynamic variable" in the dashboard), so the LLM cannot change them.

**Response** (what the tool returns)
```json
{ "specialist": "ClaimsGuide", "reply": "You can claim up to 4,000 USD₮ for this semester…",
  "actions": [{ "type": "openClaimForm", "rule": "<rule address>", "payee": "<wallet>", "amount": 4000 }],
  "needsHuman": [], "routedBy": "…" }
```

## 3. Client tools (run in the browser)

Agent → Tools → Add tool → **Client**. Turn on "Wait for response" for each (they return `"done"`).

| Name | Description | Parameters |
|---|---|---|
| `navigate` | Open a screen in the Heirloom app. | `path` (string, required): one of `/chat`, `/estate`, `/will`, `/vault`, `/claims`, `/family`, `/inbox`, `/car`, `/hardship`, `/send`, `/people`, `/legacy` |
| `open_claim_form` | Open the claim form prefilled. | `rule` (string, optional) rule address; `payee` (string, optional) payee wallet; `amount` (number, optional) USD₮ |
| `show_rule` | Highlight one payout rule on screen. | `rule` (string, required) rule address |
| `start_upload` | Open the document upload. | `purpose` (string, required, enum `death`, `claim`, `hardship`) |

The app turns these into `heirloom:agent-action` browser events (`lib/agent/actions.ts`); screens subscribe with
`onAgentAction()`.

## 4. Security settings

- Enable **authentication** (private agent) so sessions need the signed URL from `GET /api/voice/session`;
  the API key never reaches the browser.
- Add your deployment domain to the allowlist.
- Do not enable call recording storage beyond what the demo needs (POPIA). Transcripts we keep go to the
  `transcripts` table in Supabase.

## 5. Env

```
ELEVENLABS_API_KEY=...        # server only
ELEVENLABS_AGENT_ID=agent_... # server only
ELEVENLABS_TOOL_SECRET=...    # long random string, same value as the webhook header secret
```
Without these the voice hook reports `status: "unavailable"` and the UI falls back to text chat (in demo mode, to a
labelled simulated call).

Speed: every answer waits on the webhook, so voice calls route by keywords and run the specialists on a fast model
(`GEMINI_VOICE_MODEL`, default `gemini-3.5-flash-lite`): about 2 s per answer instead of about 20 s.

## 6. Legacy Voice (the parent's cloned voice)

Legacy Voice lets the estate owner record their own voice while alive; after unlock, each child can choose to hear
guidance from the owner's Legacy Book in that voice. The server does all ElevenLabs calls with `ELEVENLABS_API_KEY`
(`app/src/lib/legacy/server/elevenlabs.ts`). **Nothing needs to be created in the dashboard for it**; the app makes:

| What | Endpoint | When |
|---|---|---|
| Instant Voice Clone | `POST /v1/voices/add` (multipart `name`, `files[]`, `remove_background_noise`, `description`, `labels`) → `{ voice_id, requires_verification }` | owner taps "Create my voice" (≥ 3 samples + recorded consent line) |
| Text to speech | `POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128` (`eleven_multilingual_v2`) | a milestone message or a companion reply is played; cached in the private `legacy-audio` bucket |
| Private legacy agent | `POST /v1/convai/agents/create`, `PATCH /v1/convai/agents/{id}` (prompt refreshed per call for the verified child + live estate status), `DELETE /v1/convai/agents/{id}` | first live call; deleted with the voice |
| Signed URL | `GET /v1/convai/conversation/get-signed-url?agent_id=…` | each live call (`POST /api/voice/session { mode: "legacy" }`) |
| Delete voice | `DELETE /v1/voices/{voice_id}` | owner taps "Delete my voice" (also deletes the agent, recordings and cached audio) |

**Why a private agent per estate and not client overrides.** The SDK's `overrides` (`tts.voiceId`, `agent.prompt`,
`agent.firstMessage`) are sent *by the browser* in `conversation_initiation_client_data`, so the parent's `voice_id`
and the persona prompt would be visible to, and editable by, the client. Instead each estate gets its own agent with
`conversation_config.tts.voice_id`, `conversation_config.agent.prompt.prompt` (the LegacyCompanion persona built from the
Legacy Book) and `conversation_config.agent.first_message` (the disclosure line, "This is Heirloom, speaking in your
dad's voice…") set server-side, `platform_settings.auth.enable_auth = true`, **no tools**, and no client overrides.
So **no override toggles need enabling** in Security. (If you ever switch to one shared agent with overrides instead,
you would have to enable `agent.prompt.prompt`, `agent.first_message` and `tts.voice_id` under the agent's
**Security → Overrides**, and accept that the voice id reaches the browser; we chose not to.)

**Dashboard / account settings to check**
- The API key needs the permissions *Voices: write* (clone/delete), *Text to speech*, and *Conversational AI / Agents: write*.
- Instant Voice Cloning needs a paid plan (Starter or above). ElevenLabs' terms require that you have the speaker's
  consent; Heirloom records the owner reading the consent line and keeps it (hash + private file) as evidence.
- `requires_verification`: if ElevenLabs flags a new voice as needing verification, the app shows "verify this voice
  in the ElevenLabs dashboard" and refuses to speak until it is cleared (Voices → the voice → Verify).
- Optional multi-voice: set `ELEVENLABS_HEIRLOOM_VOICE_ID` to a default library voice. The agent is then created with
  `tts.supported_voices: [{ label: "Heirloom", voice_id }]`, and the persona prompt tells it to wrap safety messages,
  refusals and disclosures in `<Heirloom>…</Heirloom>` so they are spoken in Heirloom's own voice, never the parent's.
  If your plan rejects it (422), the app retries without it and the agent says "This is Heirloom" in the parent's voice.
- Add the deployment domain to the allowlist of the created agents if you enable domain restrictions (the agents are
  named `Heirloom legacy <hash>`).

**Env**
```
ELEVENLABS_API_KEY=...             # already used by the main agent
ELEVENLABS_HEIRLOOM_VOICE_ID=...   # optional, see multi-voice above
LEGACY_SPEAK_SECRET=...            # HMAC for speak tokens (or ELEVENLABS_TOOL_SECRET); needed on multi-instance hosts
LEGACY_DEMO_WRITES=1               # DEMO ONLY: mock-mode deploy uses the real routes without wallet signatures
```
Without `ELEVENLABS_API_KEY` the whole flow still works with a **simulated** voice (browser speech), labelled
"Simulated voice: the real voice needs ElevenLabs". Run `supabase/migrations/0002_legacy.sql` for persistent storage.
