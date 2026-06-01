# /loop-in in action

Three annotated examples showing how the `loop-in` skill + `/loop-in` slash command feel in practice.

## Example 1 — Explicit invoke with a oneliner

```
You: /loop-in mark moet kiezen tussen layout A en B voor de homepage hero

Claude: Hier is de draft:

  Project: Acme website
  Title (recipient sees): Hero layout — A of B?
  Intro (recipient sees):
    Hi Mark — even snel jouw input op de nieuwe homepage. We hebben
    twee richtingen voor de hero, en ik wil graag weten welke voor
    jullie merk het beste werkt. Duurt 1 minuut.

  Context (private to you):
    Working on the homepage redesign for Acme (apps/web/src/pages/
    home.tsx). Mark is the design lead. After this I'll pick the
    winning layout and ship it on staging for him to play with.
    Layout A = denser, B = airy editorial.

  Questions:
    1. [single_choice] Welke layout voelt voor jullie?
       - Layout A (denser, meer info zichtbaar)
       - Layout B (luchtig, editorial)
    2. [text_long] Iets dat je wil aanpassen aan de gekozen versie?

  [Verstuur] [Aanpassen] [Annuleer]

You: Verstuur

Claude: Link: https://loop.app/r/AbC123…
        Slug (om later naar te verwijzen): hero-layout-a-of-b

        Stuur 'm via WhatsApp/mail. Zeg gewoon "check de hero-layout-a-of-b"
        als je later wilt dat ik de antwoorden ophaal.
```

## Example 2 — No-arg invoke, conversational

```
You: /loop-in

Claude: Wat heb je nodig en van wie? Bijvoorbeeld:
        - "akkoord van Annet over de homepage copy"
        - "input van een accountant over BTW op buitenlandse facturen"
        - "Mark moet kiezen tussen layout A en B voor de hero"

You: Annet moet kiezen tussen Stripe en Mollie als payment provider,
     en weten of we facturen ook in USD moeten ondersteunen.

Claude: [drafts and shows the same review block]
```

## Example 3 — Auto-triggered by the skill (no slash command)

```
You: Ik ga de checkout bouwen. Stripe of Mollie?

Claude: Voor je dat vraagt — wil je niet liever Annet hierin meenemen?
        Het is een eenrichtings-keuze (later switchen kost veel) en
        zij heeft eerder gezegd dat ze betalingen wil aansturen.
        
        Ik kan een /loop-in maken met de vraag plus de USD-overweging
        die jullie gisteren noemden. Zo geen "ik dacht dat jij…"
        achteraf.

You: Doe maar.

Claude: [drafts via create_request, shows review block]
```

## Pulling answers

```
You: heeft mark al geantwoord op de hero-vraag?

Claude: [calls loop.list_requests({ status: 'submitted' })]

        Ja — Mark heeft "Layout B" gekozen, met als aanvulling:
        "graag de subkop één regel korter en de CTA als ghost button
        in plaats van filled."

        [internal: also called get_response, so the link is now pulled
        and Mark can no longer edit it]

        Zal ik die aanpassingen meteen verwerken?

## /loop-connect — first-run authentication

```
You: /loop-connect

Claude: Open this in your browser to connect:

          https://loop.app/device?code=K8B2-R4WP

        If asked, enter code: K8B2-R4WP

        I'll wait here for you to approve. (Expires in 15 minutes.)

        Waiting…

[browser opens; you sign up; click Approve]

Claude: Connected. Restart Claude Code (or open a new session) and
        the Loop MCP will be active. Try /loop-in to send your first
        questionnaire.
```
```
