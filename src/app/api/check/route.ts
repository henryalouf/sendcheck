import { spawn } from "child_process";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

type Verdict = "send" | "reword" | "wait";

type CheckResult = {
  tone: string;
  power: string;
  misread_risks: string[];
  variants: { softer: string; sharper: string; neutral: string };
  verdict: Verdict;
  verdict_reason: string;
};

const PROMPT_HEADER = `You are a sharp, calm communications coach. Read messages the way the recipient will read them, not the way the sender hopes.

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
- "wait" only when there's a concrete reason to delay. Otherwise "send" or "reword".
- No moralizing. Just useful, specific reads.
- If the draft is already well-calibrated, give "send" with a one-sentence confirmation. Don't invent problems.`;

function buildPrompt({
  draft,
  channel,
  relationship,
}: {
  draft: string;
  channel: string;
  relationship: string;
}) {
  return `${PROMPT_HEADER}

---

Channel: ${channel}
Relationship to recipient: ${relationship}

Draft:
"""
${draft}
"""

Return only the JSON object now.`;
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

function callClaudeCode(prompt: string, timeoutMs = 110_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "text", "--allowedTools", ""];
    const proc = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, CI: "1", NO_COLOR: "1" },
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      reject(new Error(`claude -p timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const tail = (stderr || stdout).trim().slice(-400);
        reject(new Error(`claude -p exit ${code}: ${tail || "no output"}`));
      }
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

function stripFences(s: string): string {
  let t = s.trim();
  // Strip leading ```json or ```
  t = t.replace(/^```(?:json|JSON)?\s*\n?/, "");
  // Strip trailing ```
  t = t.replace(/\n?\s*```\s*$/, "");
  // Some models include a leading "Here is the JSON:" preamble; cut to first {
  const firstBrace = t.indexOf("{");
  const lastBrace = t.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) {
    t = t.slice(firstBrace, lastBrace + 1);
  }
  return t.trim();
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

  let raw: string;
  try {
    raw = await callClaudeCode(buildPrompt({ draft, channel, relationship }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Backend (claude -p) error: ${msg}`, { status: 502 });
  }

  const cleaned = stripFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return new Response(`Model output was not valid JSON. First 200 chars: ${cleaned.slice(0, 200)}`, { status: 502 });
  }

  if (!isValidResult(parsed)) {
    return new Response("Model output didn't match expected schema.", { status: 502 });
  }

  return Response.json(parsed);
}
