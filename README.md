# SendCheck

A second-opinion tool for any message you're about to send. Paste an email/Slack/text draft, get an honest read on tone, power dynamics, and how it might be misread — plus three rewrites and a verdict (send / reword / wait).

Built on Next.js 16 + Tailwind v4 + Anthropic Claude Haiku.

## Local development

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
# → http://localhost:3030
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo at https://vercel.com/new.
3. Add `ANTHROPIC_API_KEY` as an environment variable (Production scope).
4. Deploy.

That's it — the API route auto-runs as a Vercel function. Free tier covers far more traffic than this app needs at launch.

## How it works

- `src/app/page.tsx` — single-page UI with channel chips, relationship chips, draft textarea, and result cards.
- `src/app/api/check/route.ts` — POSTs `{draft, channel, relationship}` to Claude Haiku with a structured prompt, returns JSON `{tone, power, misread_risks, variants, verdict, verdict_reason}`.
- Drafts never persist server-side.

## Monetization next steps

- **Free tier (current):** 1-3 checks per day per IP. No signup.
- **Pro ($9/mo):** unlimited checks, longer drafts (10k chars), team mode.
- **Enterprise:** Slack/Teams app — pre-send check on outgoing DMs/messages.
- **API:** simple JSON API for HR tools, sales platforms, customer-success suites.

## License

Private. © 2026.
