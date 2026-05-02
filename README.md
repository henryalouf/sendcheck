# SendCheck

> **A second opinion before you hit send.** Paste any draft (email, Slack, text), get a tone reading, power-dynamic check, two ways it could be misread, three rewrites (softer / neutral / sharper), and a verdict: **send**, **reword**, or **wait**.

Live in 60 seconds — see the [one-click deploy](#deploy-in-60-seconds) below.

## Why this exists

Most "AI writing" tools help you write *more*. SendCheck does the opposite — it helps you *not send the version you'd regret*. Every adult has a Slack/email/text they wish they could un-send. This is the pre-flight check.

## Deploy in 60 seconds

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhenryalouf%2Fsendcheck&env=ANTHROPIC_API_KEY&envDescription=Anthropic%20API%20key%20for%20Claude%20Haiku.&envLink=https%3A%2F%2Fconsole.anthropic.com%2Fsettings%2Fkeys&project-name=sendcheck&repository-name=sendcheck)

1. Click the **Deploy with Vercel** button above.
2. Sign in with the GitHub account that has access to this repo (henryalouf).
3. When asked for the `ANTHROPIC_API_KEY` env var, paste your key from https://console.anthropic.com/settings/keys.
4. Click **Deploy**. Live URL appears in ~90 seconds.

That's literally it.

## Local development

```bash
git clone https://github.com/henryalouf/sendcheck.git
cd sendcheck
npm install

echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

npm run dev
# → http://localhost:3030
```

## Stack

- **Next.js 16.2.3** App Router, TypeScript
- **Tailwind v4** + custom warm/sage palette (no blue/purple AI-slop)
- **Cormorant Garamond** + DM Sans (Google Fonts via `next/font`)
- **Framer Motion** for tasteful entrance animations only
- **Anthropic Claude Haiku** (`claude-haiku-4-5-20251001`) — fast + cheap
- **Vercel** for serverless API routes + edge static hosting

## Project layout

```
sendcheck/
├── src/app/
│   ├── page.tsx              # Single-page UI: chips, textarea, results
│   ├── layout.tsx            # Fonts + metadata
│   ├── globals.css           # Theme tokens + utility classes
│   └── api/check/route.ts    # POST /api/check — calls Claude
├── public/                   # Static assets (favicon only)
├── package.json
├── next.config.ts
└── tsconfig.json
```

## API contract

`POST /api/check`

```jsonc
{
  "draft": "Hi Sarah, I want a raise. Please give me one. Thanks.",
  "channel": "email",                // email | slack | text | linkedin | other
  "relationship": "manager"          // manager | report | peer | client | vendor | friend | family | stranger
}
```

→ `200 OK`

```jsonc
{
  "tone": "Reads as anxious and over-explaining...",
  "power": "Asking up — implicit subordination...",
  "misread_risks": ["Could land as a threat...", "Vague timeline could read as..."],
  "variants": {
    "softer":  "...",
    "neutral": "...",
    "sharper": "..."
  },
  "verdict": "reword",                // send | reword | wait
  "verdict_reason": "Use the neutral variant — your ask is reasonable but..."
}
```

Validation: rejects drafts < 10 chars or > 8000 chars with `400`.

## Monetization roadmap

- **Free (today):** unmetered. No signup. Server-side key.
- **Pro ($9/mo):** longer drafts (16k), team workspace, history, copy of "all 3 variants" in one PDF/email.
- **Enterprise:** Slack/Teams app — pre-send check fires automatically on outgoing DMs/messages with risk score.
- **API:** B2B JSON endpoint for HR platforms, sales tools, CS suites. $0.01 / call.

## License

Private. © 2026 henryalouf.

---

*Built end-to-end in one Claude Code session.*
