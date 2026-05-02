"use client";

import { useState, useRef } from "react";
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
];

const VERDICT_META: Record<
  Verdict,
  { label: string; bg: string; color: string; emoji: string }
> = {
  send: { label: "Send it", bg: "#E8F0E8", color: "#2D8B5F", emoji: "Go" },
  reword: { label: "Reword first", bg: "#FAEFE0", color: "#C97D2F", emoji: "Edit" },
  wait: { label: "Don't send yet", bg: "#FAE3DE", color: "#B0392B", emoji: "Wait" },
};

export default function HomePage() {
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState("email");
  const [relationship, setRelationship] = useState("manager");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function runCheck() {
    if (!draft.trim() || draft.trim().length < 10) {
      setError("Paste at least a couple of sentences for a meaningful check.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/check", {
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
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

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
            Free · No signup · Your draft is never stored
          </span>
        </div>
      </header>

      <main className="pb-24">
        <section className="pt-16 pb-10 md:pt-24 md:pb-14">
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

        <section className="px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="max-w-[820px] mx-auto card shadow-sm"
          >
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Where you&apos;re sending it
                  </label>
                </div>
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
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {draft.length} chars
                  </span>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={9}
                  placeholder="Paste your message here..."
                  className="input font-[var(--font-body)] text-base leading-relaxed resize-y min-h-[200px]"
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

              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="text-xs text-[var(--color-text-muted)] flex-1">
                  Powered by Claude · Your draft is sent to the model and not stored on our
                  side.
                </p>
                <button
                  type="button"
                  onClick={runCheck}
                  disabled={loading || draft.trim().length < 10}
                  className="btn-primary"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      Checking
                      <span className="inline-flex">
                        <span
                          className="dot-pulse"
                          style={{ animationDelay: "0s" }}
                        >
                          .
                        </span>
                        <span
                          className="dot-pulse"
                          style={{ animationDelay: "0.2s" }}
                        >
                          .
                        </span>
                        <span
                          className="dot-pulse"
                          style={{ animationDelay: "0.4s" }}
                        >
                          .
                        </span>
                      </span>
                    </span>
                  ) : (
                    "Check my message"
                  )}
                </button>
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
                      className="text-sm rounded-xl p-4 border"
                      style={{
                        background: "#FAE3DE",
                        borderColor: "#E8B4A8",
                        color: "#7A1A0F",
                      }}
                    >
                      {error}
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
                  <h3 className="font-[var(--font-heading)] text-2xl mb-2">
                    Tone reading
                  </h3>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed">
                    {result.tone}
                  </p>
                </div>

                <div className="card">
                  <h3 className="font-[var(--font-heading)] text-2xl mb-2">
                    Power dynamic
                  </h3>
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
                  <h3 className="font-[var(--font-heading)] text-2xl mb-4">
                    Three rewrites
                  </h3>
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
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-[var(--color-border-light)] py-8 mt-12">
        <div className="max-w-[1100px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-text-muted)]">
          <span>© SendCheck. A second opinion before you hit send.</span>
          <span>
            Built with Claude · Not legal advice · Use your own judgment
          </span>
        </div>
      </footer>
    </>
  );
}
