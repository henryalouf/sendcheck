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

const SYSTEM_PROMPT = `You are a calm, blunt communications coach. A user is about to send a message and wants a sanity check before hitting send. Your job is to read it the way the recipient will, not the way the sender hopes.

Always respond with ONLY a single valid JSON object — no commentary, no markdown, no code fences. The schema is:

{
  "tone": "1-3 sentences. How this will actually land. Be specific (e.g., 'Reads as anxious and over-explaining' not 'professional').",
  "power": "1-2 sentences. The implicit power dynamic — who has leverage, who is asking, who is approving. Note if the sender is unintentionally subordinating themselves or being too forward given the relationship.",
  "misread_risks": ["First specific way this could be misread, citing a phrase if helpful.", "Second specific way."],
  "variants": {
    "softer": "Rewritten message — warmer, less direct, more relationship-preserving. Same length range as the original.",
    "neutral": "Rewritten message — same intent as the original but tighter, clearer, less emotionally leaky.",
    "sharper": "Rewritten message — more direct, no padding, owns the ask. Polite but no apology spiral."
  },
  "verdict": "send" | "reword" | "wait",
  "verdict_reason": "1-2 sentences. Why this verdict. If 'wait', say what to gather/think about. If 'reword', say which variant to use and why."
}

Rules:
- Variants must preserve names, dates, and concrete facts from the original.
- Variants must be appropriate to the channel (Slack ≠ formal email).
- "wait" only when there is a concrete reason to delay (escalation risk, missing info, emotional state evident).
- Don't lecture. Don't moralize. Be useful.`;

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
