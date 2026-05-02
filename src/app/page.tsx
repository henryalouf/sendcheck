"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Verdict = "send" | "reword" | "wait";

type CheckResult = {
  tone: string;
  power: string;
  misread_risks: string[];
  variants: {
    softer: string;
    sharper: string;
    neutral: string;
  };
  verdict: Verdict;
  verdict_reason: string;
};

type HistoryItem = {
  ts: number;
  draft: string;
  channel: string;
  relationship: string;
  verdict: Verdict;
  preview: string;
};

const CHANNELS = [
  { id: "email", label: "Email" },
  { id: "slack", label: "Slack / Teams" },
  { id: "text", label: "Text / DM" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "other", label: "Other" },
];

const RELATIONSHIPS = [
  { id: "manager", label: "Manager / boss" },
  { id: "report", label: "Direct report" },
  { id: "peer", label: "Coworker / peer" },
  { id: "client", label: "Client / customer" },
  { id: "vendor", label: "Vendor / contractor" },
  { id: "friend", label: "Friend" },
  { id: "family", label: "Family" },
  { id: "stranger", label: "Stranger / cold" },
];

const SAMPLES: { name: string; channel: string; relationship: string; draft: string }[] = [
  {
    name: "Asking for a raise",
    channel: "email",
    relationship: "manager",
    draft:
      "Hi Sarah,\n\nI wanted to talk about my salary. I haven't had a raise in 18 months and I think I'm being underpaid for what I do here. I've been getting a lot of recruiter messages lately and I'd hate to leave but I need to know what the path forward looks like.\n\nCan we set something up?",
  },
  {
    name: "Declining a job offer",
    channel: "email",
    relationship: "stranger",
    draft:
      "Hi Mark,\n\nThanks so much for the offer. I really appreciate the time you and the team put into the process. After thinking it over carefully, I've decided to go in a different direction. The role looked great but the comp wasn't quite where I needed it to be.\n\nWishing you and the team the best.",
  },
  {
    name: "Firing a contractor",
    channel: "slack",
    relationship: "vendor",
    draft:
      "Hey — I think we need to part ways. The last two deliverables missed the spec we agreed on and the timeline keeps slipping. I don't think this is working out. We'll pay through the end of the week but I'd like to wrap up by Friday. Can you send over what you have so far?",
  },
  {
    name: "Setting a boundary with family",
    channel: "text",
    relationship: "family",
    draft:
      "Hey mom — I love you and I know you mean well but I really can't keep getting calls about when I'm having kids. It's stressful and it makes me not want to pick up. Can we just not for a while? I'll bring it up if and when there's news.",
  },
];

const LOADING_MESSAGES = [
  "Reading your draft",
  "Listening for tone",
  "Checking power dynamics",
  "Spotting misread risks",
  "Drafting three variants",
  "Picking the verdict",
];

const VERDICT_META: Record<
  Verdict,
  { label: string; bg: string; color: string }
> = {
  send: { label: "Send it", bg: "#E6EFE5", color: "#2D8B5F" },
  reword: { label: "Reword first", bg: "#FAEFE0", color: "#C97D2F" },
  wait: { label: "Don't send yet", bg: "#FAE3DE", color: "#B0392B" },
};

const HISTORY_KEY = "sendcheck.history.v1";
const MAX_HISTORY = 3;
const SOFT_LIMIT = 7000;
const HARD_LIMIT = 8000;

function detectModKey() {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}

export default function HomePage() {
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState("email");
  const [relationship, setRelationship] = useState("manager");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState(LOADING_MESSAGES[0]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [modKey, setModKey] = useState("Ctrl");
  const resultRef = useRef<HTMLDivElement>(null);

  // Load history + detect platform on mount.
  useEffect(() => {
    setModKey(detectModKey());
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryItem[];
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, MAX_HISTORY));
      }
    } catch {
      /* ignore corrupt history */
    }
  }, []);

  // Rotate loading messages while waiting.
  useEffect(() => {
    if (!loading) return;
    let i = 0;
    setProgressMsg(LOADING_MESSAGES[0]);
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setProgressMsg(LOADING_MESSAGES[i]);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  function persistHistory(next: HistoryItem[]) {
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* quota or disabled — silently ignore */
    }
  }

  function saveToHistory(d: string, c: string, r: string, v: Verdict) {
    const item: HistoryItem = {
      ts: Date.now(),
      draft: d,
      channel: c,
      relationship: r,
      verdict: v,
      preview: d.replace(/\s+/g, " ").slice(0, 60).trim(),
    };
    const next = [item, ...history.filter((h) => h.draft !== d)].slice(0, MAX_HISTORY);
    persistHistory(next);
  }

  function loadFromHistory(item: HistoryItem) {
    setDraft(item.draft);
    setChannel(item.channel);
    setRelationship(item.relationship);
    setResult(null);
    setError(null);
  }

  function clearHistory() {
    persistHistory([]);
  }

  function resetForm() {
    setDraft("");
    setResult(null);
    setError(null);
  }

  const runCheck = useCallback(async () => {
    if (loading) return;
    if (!draft.trim() || draft.trim().length < 10) {
      setError("Paste at least a couple of sentences for a meaningful check.");
      return;
    }
    if (draft.length > HARD_LIMIT) {
      setError(`Draft is ${draft.length} chars — keep it under ${HARD_LIMIT}.`);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const res = await fetch(`${basePath}/api/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, channel, relationship }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as CheckResult;
      setResult(data);
      saveToHistory(draft, channel, relationship, data.verdict);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, [draft, channel, relationship, loading, history]);

  // Cmd/Ctrl + Enter from anywhere triggers submit.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runCheck();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runCheck]);

  function loadSample(s: (typeof SAMPLES)[number]) {
    setDraft(s.draft);
    setChannel(s.channel);
    setRelationship(s.relationship);
    setResult(null);
    setError(null);
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — silently ignore */
    }
  }

  function copyAllVariants() {
    if (!result) return;
    const block =
      `--- SOFTER ---\n${result.variants.softer}\n\n` +
      `--- NEUTRAL ---\n${result.variants.neutral}\n\n` +
      `--- SHARPER ---\n${result.variants.sharper}\n`;
    copyText(block, "all-variants");
  }

  const charCount = draft.length;
  const charColor =
    charCount >= HARD_LIMIT
      ? "var(--color-danger)"
      : charCount >= SOFT_LIMIT
      ? "var(--color-warning)"
      : "var(--color-text-muted)";
  const charsLeft = HARD_LIMIT - charCount;
  const charLabel =
    charCount >= SOFT_LIMIT ? `${charsLeft} chars left` : `${charCount} chars`;

  return (
    <>
      <header className="border-b border-[var(--color-border-light)]">
        <div className="max-w-[1100px] mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-[var(--font-heading)] font-bold text-lg"
              style={{ background: "var(--color-primary)", color: "var(--color-background)" }}
            >
              S
            </div>
            <span className="font-[var(--font-heading)] text-xl font-semibold text-[var(--color-primary)]">
              SendCheck
            </span>
          </div>
          <span className="text-xs text-[var(--color-text-muted)] hidden sm:block">
            Free · No signup · Drafts never stored
          </span>
        </div>
      </header>

      <main className="pb-24">
        <section className="pt-14 pb-8 md:pt-20 md:pb-12">
          <div className="max-w-[820px] mx-auto px-6 text-center">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--color-accent)] mb-4"
            >
              The pre-send second opinion
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="font-[var(--font-heading)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-[var(--color-primary)] leading-[0.98] tracking-tight mb-5"
            >
              Should you <em className="text-[var(--color-accent)]">actually</em> send this?
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-base md:text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto"
            >
              Paste any message you&apos;re about to send — email, Slack, text. Get a read on
              tone, power dynamics, and how it might be misread.{" "}
              <span className="text-[var(--color-text)] font-medium">Then a verdict.</span>
            </motion.p>
          </div>
        </section>

        {history.length > 0 && (
          <section className="px-6 mb-6">
            <div className="max-w-[820px] mx-auto flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Recent
              </span>
              {history.map((h) => (
                <button
                  key={h.ts}
                  type="button"
                  onClick={() => loadFromHistory(h)}
                  className="chip"
                  title={`${h.channel} · ${h.relationship}`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: VERDICT_META[h.verdict].color }}
                  />
                  <span className="truncate max-w-[200px]">{h.preview}…</span>
                </button>
              ))}
              <button
                type="button"
                onClick={clearHistory}
                className="text-xs text-[var(--color-text-muted)] underline decoration-1 underline-offset-2 hover:text-[var(--color-accent)]"
              >
                clear
              </button>
            </div>
          </section>
        )}

        <section className="px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="max-w-[820px] mx-auto card shadow-sm"
          >
            <div className="space-y-6">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block mb-2">
                  Where you&apos;re sending it
                </label>
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChannel(c.id)}
                      className={`chip ${channel === c.id ? "chip-active" : ""}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block mb-2">
                  Who you&apos;re sending it to
                </label>
                <div className="flex flex-wrap gap-2">
                  {RELATIONSHIPS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRelationship(r.id)}
                      className={`chip ${relationship === r.id ? "chip-active" : ""}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Your draft
                  </label>
                  <span
                    className="text-xs tabular-nums"
                    style={{ color: charColor }}
                  >
                    {charLabel}
                  </span>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={9}
                  placeholder="Paste your message here..."
                  className="input font-[var(--font-body)] text-base leading-relaxed resize-y min-h-[200px]"
                  style={charCount >= HARD_LIMIT ? { borderColor: "var(--color-danger)" } : undefined}
                />
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-[var(--color-text-muted)]">Try one:</span>
                  {SAMPLES.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => loadSample(s)}
                      className="text-xs underline decoration-[var(--color-accent)] decoration-2 underline-offset-4 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <p className="text-xs text-[var(--color-text-muted)] flex-1">
                  Powered by Claude · Drafts go to the model and aren&apos;t stored on our side.
                </p>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className="text-xs text-[var(--color-text-muted)] hidden sm:block tabular-nums">
                    {modKey}+Enter
                  </span>
                  <button
                    type="button"
                    onClick={runCheck}
                    disabled={loading || draft.trim().length < 10 || charCount > HARD_LIMIT}
                    className="btn-primary"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block min-w-[140px] text-left">{progressMsg}</span>
                        <span className="inline-flex">
                          <span className="dot-pulse" style={{ animationDelay: "0s" }}>.</span>
                          <span className="dot-pulse" style={{ animationDelay: "0.2s" }}>.</span>
                          <span className="dot-pulse" style={{ animationDelay: "0.4s" }}>.</span>
                        </span>
                      </span>
                    ) : (
                      "Check my message"
                    )}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="text-sm rounded-xl p-4 border flex items-start justify-between gap-3"
                      style={{
                        background: "#FAE3DE",
                        borderColor: "#E8B4A8",
                        color: "#7A1A0F",
                      }}
                    >
                      <span className="leading-relaxed">{error}</span>
                      <button
                        type="button"
                        onClick={() => setError(null)}
                        className="shrink-0 text-xs underline underline-offset-2 hover:no-underline"
                      >
                        dismiss
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </section>

        <AnimatePresence>
          {result && (
            <motion.section
              ref={resultRef}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-14 px-6"
            >
              <div className="max-w-[820px] mx-auto space-y-4">
                <div
                  className="card flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
                  style={{
                    background: VERDICT_META[result.verdict].bg,
                    borderColor: VERDICT_META[result.verdict].color + "30",
                  }}
                >
                  <div
                    className="px-4 py-2 rounded-full font-[var(--font-heading)] font-semibold text-lg shrink-0"
                    style={{
                      background: VERDICT_META[result.verdict].color,
                      color: "#FAF7F2",
                    }}
                  >
                    {VERDICT_META[result.verdict].label}
                  </div>
                  <p className="text-[var(--color-text)] leading-relaxed">
                    {result.verdict_reason}
                  </p>
                </div>

                <div className="card">
                  <h3 className="font-[var(--font-heading)] text-2xl mb-2">Tone reading</h3>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed">
                    {result.tone}
                  </p>
                </div>

                <div className="card">
                  <h3 className="font-[var(--font-heading)] text-2xl mb-2">Power dynamic</h3>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed">
                    {result.power}
                  </p>
                </div>

                <div className="card">
                  <h3 className="font-[var(--font-heading)] text-2xl mb-3">
                    How this could be misread
                  </h3>
                  <ul className="space-y-2 list-disc pl-5 text-[var(--color-text-secondary)]">
                    {result.misread_risks.map((r, i) => (
                      <li key={i} className="leading-relaxed">{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="card">
                  <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <h3 className="font-[var(--font-heading)] text-2xl">Three rewrites</h3>
                    <button
                      type="button"
                      onClick={copyAllVariants}
                      className="text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] underline decoration-2 underline-offset-4"
                    >
                      {copied === "all-variants" ? "All copied" : "Copy all three"}
                    </button>
                  </div>
                  <div className="space-y-4">
                    {(["softer", "neutral", "sharper"] as const).map((variantKey) => {
                      const text = result.variants[variantKey];
                      const labelMap = {
                        softer: { name: "Softer", desc: "warmer, less direct" },
                        neutral: { name: "Neutral", desc: "polished version of yours" },
                        sharper: { name: "Sharper", desc: "more direct, no padding" },
                      };
                      const meta = labelMap[variantKey];
                      const copyKey = `variant-${variantKey}`;
                      return (
                        <div
                          key={variantKey}
                          className="rounded-xl border border-[var(--color-border-light)] overflow-hidden"
                        >
                          <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-warm)]">
                            <span className="text-sm font-semibold text-[var(--color-primary)]">
                              {meta.name}{" "}
                              <span className="font-normal text-[var(--color-text-muted)]">
                                — {meta.desc}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText(text, copyKey)}
                              className="text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                            >
                              {copied === copyKey ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <pre className="px-4 py-4 text-sm leading-relaxed text-[var(--color-text)] whitespace-pre-wrap font-[var(--font-body)]">
                            {text}
                          </pre>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm font-medium text-[var(--color-text-secondary)] underline decoration-2 underline-offset-4 decoration-[var(--color-border)] hover:decoration-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    Start over with a new draft
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-[var(--color-border-light)] py-10 mt-12">
        <div className="max-w-[1100px] mx-auto px-6 grid sm:grid-cols-3 gap-6 text-xs text-[var(--color-text-muted)]">
          <div>
            <div className="font-[var(--font-heading)] text-base font-semibold text-[var(--color-primary)] mb-2">
              SendCheck
            </div>
            <p className="leading-relaxed">
              A second opinion before you hit send. Free, no signup, runs on Claude.
            </p>
          </div>
          <div>
            <div className="font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
              Privacy
            </div>
            <p className="leading-relaxed">
              Drafts are sent to the language model for analysis and not persisted on our
              servers. History stays in your browser only.
            </p>
          </div>
          <div>
            <div className="font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
              Use it well
            </div>
            <p className="leading-relaxed">
              SendCheck is a sanity check, not legal/HR advice. Final call is yours.
            </p>
          </div>
        </div>
        <div className="max-w-[1100px] mx-auto px-6 mt-8 pt-4 border-t border-[var(--color-border-light)] text-center text-xs text-[var(--color-text-muted)]">
          © 2026 SendCheck · Built end-to-end with Claude
        </div>
      </footer>
    </>
  );
}
