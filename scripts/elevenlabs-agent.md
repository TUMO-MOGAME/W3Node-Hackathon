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
(Dynamic variables are sent by the app at session start: `persona` like `owner:Thabo Mokoena`, `estate`
(address or `none`) and `page`. If your dashboard requires every variable used in the first message to be
declared, either declare `persona_name` with a default of `there`, or use `Hi there,` instead.)

**Language:** English. Enable language detection if available, and add Afrikaans and Zulu as extra languages.

**Voice:** search the Voice Library for a warm, calm *South African English* voice (filter accent "South African");
pick a mid-pace conversational voice. Turn "stability" up a little for reading out amounts.

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
    "conversation_id": { "type": "string", "description": "System variable {{system__conversation_id}}" }
  },
  "required": ["message"]
}
```
Set `message` to be filled by the LLM; set `persona`, `estate`, `page` and `conversation_id` to the dynamic /
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
| `navigate` | Open a screen in the Heirloom app. | `path` (string, required): `/owner`, `/family`, `/verifier`, `/buyer` or `/audit` |
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
Without these the voice hook reports `status: "unavailable"` and the UI falls back to text chat.
