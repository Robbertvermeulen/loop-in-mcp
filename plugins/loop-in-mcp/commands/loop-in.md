---
description: Send a structured questionnaire to someone outside this session (client, colleague, expert, anyone) via the Loop MCP. With no args, asks what you need and from whom; with args, drafts directly from the oneliner.
argument-hint: [optional: "<person> needs to decide on <topic>"]
---

# /loop-in — send a Loop questionnaire

You are about to compose and send a Loop questionnaire on the developer's behalf. The Loop MCP server is configured under the name `loop`. Use its `create_request` tool when the developer approves the draft.

## Step 1: Get the brief

Look at the arguments passed to this command.

**If no arguments were provided** ($ARGUMENTS is empty): ask the developer what they need and from whom, with concrete examples to anchor them. Use natural language, no bullet UI:

> Wat heb je nodig en van wie? Bijvoorbeeld:
> - "akkoord van Annet over de homepage copy"
> - "input van een accountant over BTW op buitenlandse facturen"
> - "Mark moet kiezen tussen layout A en B voor de hero"

Wait for their answer before continuing.

**If arguments were provided** ($ARGUMENTS is non-empty): treat that as the brief and skip the ask. Example arguments:
- "mark moet kiezen tussen layout A en B voor de homepage hero"
- "annet input op homepage copy"
- "accountant BTW vraag voor USD facturen"

## Step 2: Draft

Based on the brief, draft:

- **title** — short, specific, in the recipient's language (Dutch if the brief is Dutch, English otherwise). What the recipient sees as the page heading.
- **intro** — 1–3 warm sentences. Mention who is asking (the developer's first name if you know it), why, and roughly how long it'll take. No corporate boilerplate.
- **context** — your private briefing for future-you. What project/feature, why these questions, what you'll do with the answers. NOT shown to the recipient.
- **projectName** (optional) — if the brief implies a project, use a consistent string.
- **questions[]** — the smallest set of questions that actually unblocks the developer. 3–6 is usually right. Pick the right type per question:
  - `text_short` for names/short specifics
  - `text_long` for free-form
  - `single_choice` for "kies één" (use `allowOther: true` if your options likely don't cover everything)
  - `multi_choice` for "kies alle die passen" (set `minSelections` when meaningful)

Aim for prompts a non-developer will understand without context. Don't use jargon.

## Step 3: Review with the developer

Before sending, show the developer the draft. Use a structured choice (AskUserQuestion or equivalent) with three options:

- **Verstuur** — proceed to call `create_request` with the drafted fields, then return the resulting URL with a one-line suggestion of how to share it.
- **Aanpassen** — ask which question(s) need editing, or whether the intro/title/context needs work. Make the changes, then re-show the draft.
- **Annuleer** — drop the draft. Don't send.

When showing the draft, format it like this so the developer can scan it fast:

```
Project: <projectName or "—">
Title (recipient sees): <title>
Intro (recipient sees):
  <intro>

Context (private to you):
  <context>

Questions:
  1. [text_short] <prompt>
  2. [single_choice] <prompt>
     - <option 1>
     - <option 2>
  ...
```

## Step 4: Send

On "Verstuur", call:

```
loop.create_request({
  title: "...",
  intro: "...",
  context: "...",
  projectName: "...",
  questions: [...]
})
```

The response gives you a `url` and a `slug`. Reply to the developer with both, plus a short suggestion for how to share:

> Link: <url>
> Slug (om later naar te verwijzen): <slug>
>
> Stuur 'm via WhatsApp/mail. Zeg gewoon "check de [slug]" als je later wilt dat ik de antwoorden ophaal.

## Don't

- Don't ask the developer 10 clarifying questions before drafting. Draft something with the info you have, then iterate via the review step.
- Don't include questions about things you can answer yourself (e.g., implementation details).
- Don't skip the review step. Sent is sent — the recipient sees the questions immediately.
- Don't send without `context`. If you don't have enough info to fill it, ask the developer for two more sentences before the review step.

$ARGUMENTS
