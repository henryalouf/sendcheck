import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Verdict = "send" | "reword" | "wait";

type CheckResult = {
  tone: string;
  power: string;
  misread_risks: string[];
  variants: { softer: string; sharper: string; neutral: string };
  verdict: Verdict;
  verdict_reason: string;
};

const SYSTEM_PROMPT = `You are a sharp, calm communications coach. Read messages the way the recipient will read them, not the way the sender hopes.

Respond with ONLY one valid JSON object — no commentary, no markdown, no code fences.

Schema:
{
  "tone": "2 sentences max. Specific, observable description (e.g., 'Reads anxious — three apologies in four sentences.' not 'somewhat hesitant'). Quote a phrase from the draft if it's the giveaway.",
  "power": "1-2 sentences. Who has leverage, who is asking, who is approving. Call out if the sender is over-subordinating ('I just wanted to...', 'sorry to bother...') or punching down/up inappropriately for the relationship.",
  "misread_risks": [
    "Concrete way #1 this could be misread. Quote the exact phrase that creates the risk.",
    "Concrete way #2. Different from #1 — different reader, different misread."
  ],
  "variants": {
    "softer": "Rewritten message: warmer, less direct, preserves relationship. Match channel norms (Slack ≠ formal email). Same length range.",
    "neutral": "Rewritten message: same intent as original but tighter, clearer, less emotionally leaky. Cut hedging, keep substance.",
    "sharper": "Rewritten message: direct, no apology spiral, owns the ask. Still respectful — sharper, not rude."
  },
  "verdict": "send" | "reword" | "wait",
  "verdict_reason": "1-2 sentences. State which variant to use if 'reword'. If 'wait', name the missing info or emotional state to address first. If 'send', confirm what's working."
}

Hard rules:
- Quote actual phrases from the draft when calling out tone or risks. Specificity > abstraction.
- Variants MUST preserve names, dates, dollar amounts, deadlines, and other concrete facts.
- Variants must match the channel: Slack/text are casual, email is more formal, LinkedIn is professional but not corporate.
- "wait" only when there's a concrete reason to delay — escalation visible, key info missing, sender clearly emotional. Otherwise "send" or "reword".
- No moralizing. No "consider how this might affect the relationship." Just useful, specific reads.
- If the draft is already well-calibrated, give "send" with a one-sentence confirmation. Don't invent problems.`;

function buildUserMessage({
  draft,
  channel,
  relationship,
}: {
  draft: string;
  channel: string;
  relationship: string;
}) {
  return `Channel: ${channel}
Relationship to recipient: ${relationship}

Draft:
"""
${draft}
"""

Return only the JSON object.`;
}

function isValidResult(x: unknown): x is CheckResult {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  if (typeof r.tone !== "string" || typeof r.power !== "string") return false;
  if (!Array.isArray(r.misread_risks)) return false;
  const v = r.variants as Record<string, unknown> | undefined;
  if (!v || typeof v.softer !== "string" || typeof v.sharper !== "string" || typeof v.neutral !== "string") {
    return false;
  }
  if (r.verdict !== "send" && r.verdict !== "reword" && r.verdict !== "wait") return false;
  if (typeof r.verdict_reason !== "string") return false;
  return true;
}

export async function POST(req: NextRequest) {
  let body: { draft?: unknown; channel?: unknown; relationship?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const draft = typeof body.draft === "string" ? body.draft.trim() : "";
  const channel = typeof body.channel === "string" ? body.channel : "other";
  const relationship = typeof body.relationship === "string" ? body.relationship : "peer";

  if (draft.length < 10) {
    return new Response("Draft is too short — paste at least a few words.", { status: 400 });
  }
  if (draft.length > 8000) {
    return new Response("Draft is too long — keep it under 8000 characters.", { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("Server is missing ANTHROPIC_API_KEY.", { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  let raw: string;
  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage({ draft, channel, relationship }) }],
    });
    const block = resp.content[0];
    if (!block || block.type !== "text") {
      return new Response("Model returned no text.", { status: 502 });
    }
    raw = block.text.trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown model error";
    return new Response(`Model error: ${msg}`, { status: 502 });
  }

  // Strip accidental markdown fences if model added them.
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response("Model output was not valid JSON.", { status: 502 });
  }

  if (!isValidResult(parsed)) {
    return new Response("Model output didn't match expected schema.", { status: 502 });
  }

  return Response.json(parsed);
}
