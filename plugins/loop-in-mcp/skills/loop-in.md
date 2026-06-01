---
name: loop-in
description: Use when the developer says they need input from another person to make progress — a client, colleague, expert, friend, or anyone outside the current Claude Code session. Triggers on phrases like "moet [iemand] vragen", "input nodig van [iemand]", "[naam] moet kiezen tussen", "wachten op feedback van", "even bij [iemand] checken", "weet [naam] of [topic]". Also use when about to guess or make an assumption that the developer just flagged should be confirmed by someone else.
---

# loop-in — request input from someone outside this session

Use the Loop MCP server to send a structured questionnaire to a non-developer and pull the answers back later. The developer shares the resulting link via WhatsApp/email; the recipient answers in a clean step-by-step form; you pull the structured answers back when the developer says "check ff" or "any updates" or similar.

## When this skill activates

Activate when the developer:
- Names a person and a topic that requires their input ("Annet moet kiezen tussen layout A en B")
- Says they're blocked on someone ("wachten op feedback van Mark", "moet eerst even bij de accountant checken")
- Is about to guess at something an external party should confirm ("ik weet niet of de klant USD-facturen wil — maar laten we Stripe nemen")
- Explicitly invokes `/loop-in`

If you're 50% sure this skill applies, run it. The worst case is one extra `list_requests` call.

## The MCP tools you have

You have five tools registered under the `loop` MCP server:

- `create_request({ title, intro?, context?, projectName?, slug?, questions[] })` — Returns `{ id, slug, url, status: 'pending' }`. The `url` is what the developer shares. Use `context` to leave a briefing for future-you (see below). NOT shown to recipient.
- `list_requests({ status?, projectName?, limit? })` — Default returns `pending` + `submitted`. Use at session start if the developer hints at "what's open" or returns from a break. Returns summaries with a `contextExcerpt`.
- `get_response({ ref })` — `ref` is the slug or id. **Side effect: transitions submitted → pulled.** After this, the recipient can no longer edit. Use this when the developer wants to act on the answers.
- `peek_response({ ref })` — Same shape, no side effect. Use when you want to look without claiming.
- `cancel_request({ ref })` — Closes the link. Irreversible.

## How to compose a good request

When you call `create_request`, the quality of these fields determines the quality of the answer you get back:

**`title`** — short, specific, recipient-facing. "Design feedback voor homepage" not "Vragen". The recipient sees this as the page heading.

**`intro`** (optional, markdown, recipient-facing) — 1–3 sentences in begrijpelijke taal. Explain the context to a non-developer. Mention how long this should take. Be warm, not corporate. Example:

> "Hi Annet — voor de nieuwe homepage wil ik je input op een paar keuzes. Duurt 3 minuten, je antwoorden komen direct bij mij terug."

**`context`** (optional but **strongly recommended**, NOT recipient-facing) — your briefing for future-you (or a future Claude session). Include:
- What project / feature this is about
- Why these specific questions, in enough detail that a fresh session understands
- What you intend to do with the answers
- Any file paths or decisions that are mid-air

Example:
> "Working on the homepage redesign for Acme (apps/web/src/pages/home.tsx). Annet has final say on the visual direction. After her answers I'll prototype the chosen layout, then pull her in again for the final hero copy. The 'Strak en zakelijk' option maps to the editorial direction we discussed yesterday."

**`projectName`** (optional) — groups requests in the dashboard and in `list_requests` output. Use the same string consistently across requests for the same project.

**`questions[]`** — the actual questions. Pick the right type for each:

- `text_short` for names, dates, short specifics
- `text_long` for free-form opinions, descriptions ("waarom?", "wat zou je toevoegen?")
- `single_choice` for "kies één", with 2–6 options. Add `allowOther: true` if the options likely don't cover everything.
- `multi_choice` for "kies alle die passen". Set `minSelections` / `maxSelections` when meaningful.

Each question gets:
- `id` — short, lowercase, descriptive (`vibe`, `must_have_features`, `naam`). Use these to interpret the answer.
- `prompt` — the actual question, recipient-facing. Be specific and short. If you need to provide examples, do it in the prompt itself; the recipient will read this without further context.
- `required: true` for questions you actually need an answer to.
- `placeholder` for text questions, only when it genuinely helps.

**Aim for the minimum viable questionnaire.** 3–6 questions is usually right. If you find yourself listing 10 questions, you probably haven't thought about what you actually need — sit with the developer's request again.

## The pull pattern

The developer is unblocked the moment they share the link. They might come back to you minutes or days later. When they do:

- "check ff" / "iets terug?" / "any updates?" → `list_requests({ status: 'submitted' })` first. If there's a match, `get_response({ ref })` to pull.
- "wat staat er open?" → `list_requests({})` (default: pending + submitted). Summarize back with context excerpts.
- Specific reference ("de design-vragen", "Annet's input") → `get_response({ ref: 'design-vragen' })` directly, using the slug. If it doesn't match, fall back to `list_requests`.
- If they say "cancel het [X]" → `cancel_request({ ref })`.

After a successful `get_response`, parse the `answers` object using the `questions` array (also returned) to pair question prompts with answers. Restate the key answers in your reply to the developer before acting on them — confirms they actually got what they wanted.

## When you're starting a new session

If the developer's first message hints at past Loop activity ("waar waren we", "ik denk dat Annet al heeft geantwoord"), call `list_requests({})` early to refresh on what's open. Read the `contextExcerpt` to remember what each link was about.

## Anti-patterns to avoid

- **Don't `get_response` to peek** — that pulls. Use `peek_response` if you just want to look.
- **Don't skip `context`** — when you come back to this in two weeks (or a different Claude session does), you'll thank yourself.
- **Don't write developer-jargon into `prompt`** — the recipient is not a developer. "API endpoint" → "manier waarop andere systemen jullie data kunnen ophalen".
- **Don't auto-create a request from a vague hint.** Confirm scope first: "Zal ik een Loop-link maken met deze vragen, of mis je nog iets?"
- **Don't share the URL before confirming the questions** — see the `/loop-in` review step.

## Working with the developer

Before you call `create_request`, you almost always want to confirm the question set with the developer. The recipient will see what you write — you only get one good draft. Show the developer the draft questions (and the intro you wrote) and ask: "Verstuur, aanpassen of annuleren?" Use the `/loop-in` slash command for the canonical version of this flow.
