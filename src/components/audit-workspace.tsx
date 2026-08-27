"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  CheckCircle2,
  Clock3,
  Eraser,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Play,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import { createInitialSteps, type PipelineOutput, type PipelineStep } from "@/lib/pipeline";

type RunState = "idle" | "cleaning" | "running" | "complete" | "error";

type RunResult = {
  runId: string;
  cleaned: string;
  output: PipelineOutput;
};

const formatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
  timeZoneName: "short",
});

export function AuditWorkspace({ userEmail }: { userEmail: string }) {
  const [istNow, setIstNow] = useState(() => formatter.format(new Date()));
  const [headline, setHeadline] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [feedback, setFeedback] = useState("");
  const [expected, setExpected] = useState("");
  const [runState, setRunState] = useState<RunState>("idle");
  const [steps, setSteps] = useState<PipelineStep[]>(createInitialSteps);
  const [estimatedSeconds, setEstimatedSeconds] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [notice, setNotice] = useState("Ready for prototype input.");
  const outputRef = useRef<HTMLElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          "Paste article body, author bio, source notes, disclaimer, and any draft context here.",
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "rounded-b-lg border border-t-0 border-slate-200 bg-white text-[15px] leading-7 text-slate-900",
      },
    },
  });

  const canRun = useMemo(() => {
    return Boolean(editor?.getText().trim()) && runState !== "cleaning" && runState !== "running";
  }, [editor, runState]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIstNow(formatter.format(new Date()));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (runState !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      setEstimatedSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [runState]);

  async function cleanJunk() {
    if (!editor) {
      return;
    }

    setRunState("cleaning");
    setNotice("Step 0 is cleaning pasted body text.");
    setResult(null);
    setSteps((items) =>
      items.map((step) =>
        step.id === "step-0" ? { ...step, status: "running" } : { ...step, status: "queued" },
      ),
    );

    const response = await fetch("/api/clean-junk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editor.getText() }),
    });
    const data = (await response.json()) as { cleaned: string };

    editor.commands.setContent(data.cleaned || "");
    setSteps((items) =>
      items.map((step) => (step.id === "step-0" ? { ...step, status: "complete" } : step)),
    );
    setRunState("idle");
    setNotice("Step 0 complete. Cleaned content is ready for the full run.");
  }

  async function runPipeline() {
    if (!editor) {
      return;
    }

    setRunState("running");
    setEstimatedSeconds(26);
    setResult(null);
    setNotice("Pipeline started. Prototype backend is processing all modules.");
    setSteps(createInitialSteps().map((step) => ({ ...step, status: "queued" })));

    const sequence: PipelineStep["id"][] = ["step-0", "module-1", "module-2", "module-3"];
    for (const stepId of sequence) {
      setSteps((items) =>
        items.map((step) =>
          step.id === stepId
            ? { ...step, status: "running" }
            : step.status === "running"
              ? { ...step, status: "complete" }
              : step,
        ),
      );
      await wait(650);
    }

    const response = await fetch("/api/run-pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headline,
        authorName,
        content: editor.getText(),
      }),
    });

    if (!response.ok) {
      setRunState("error");
      setNotice("Run failed. Check API configuration and try again.");
      return;
    }

    const data = (await response.json()) as RunResult;
    editor.commands.setContent(data.cleaned || "");
    setResult(data);
    setSteps((items) => items.map((step) => ({ ...step, status: "complete" })));
    setRunState("complete");
    setNotice("Run complete. Final output is ready below.");

    window.setTimeout(() => {
      outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }

  async function submitFeedback() {
    if (!result || !feedback.trim()) {
      return;
    }

    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: result.runId, feedback, expected }),
    });

    setFeedback("");
    setExpected("");
    setNotice("Feedback submitted for admin review.");
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Financial Express Content Audit
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
              Pipeline Prototype
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              <Clock3 className="h-4 w-4 text-teal-700" />
              <span>{istNow}</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 font-medium text-teal-800">
              <ShieldCheck className="h-4 w-4" />
              <span>{userEmail}</span>
            </div>
            <a
              href="/auth/sign-out"
              className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Headline</span>
              <input
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600"
                placeholder="Paste headline"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Author name</span>
              <input
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600"
                placeholder="Byline"
              />
            </label>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Toolbar editor={editor} onClean={cleanJunk} onRun={runPipeline} canRun={canRun} runState={runState} />
            <EditorContent editor={editor} />
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-950">Run Status</h2>
            <p className="mt-1 text-sm text-slate-600">{notice}</p>
            <div className="mt-4 space-y-3">
              {steps.map((step) => (
                <div key={step.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{step.label}</p>
                    <p className="text-xs text-slate-500">{step.detail}</p>
                  </div>
                  <StepBadge status={step.status} />
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              Estimated time:{" "}
              <span className="font-semibold text-slate-950">
                {runState === "running" ? `${estimatedSeconds}s` : "ready"}
              </span>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-950">Prototype Stack</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Next.js", "Vercel", "Supabase", "Google OAuth", "Tiptap", "TypeScript"].map((item) => (
                <span key={item} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {item}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section ref={outputRef} className="mx-auto max-w-7xl px-5 pb-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Final Output</h2>
            {result ? (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Metric label="Action Tag" value={result.output.actionTag} />
                <Metric label="Domain Signal" value={result.output.domainSignalImpact} />
                <Metric label="Confidence" value={result.output.confidence} />
                <div className="md:col-span-3">
                  <p className="text-sm font-medium text-slate-700">Editorial summary</p>
                  <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-800">
                    {result.output.editorialSummary}
                  </p>
                </div>
                <div className="md:col-span-3">
                  <p className="text-sm font-medium text-slate-700">Recommendations</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-800">
                    {result.output.recommendations.map((item) => (
                      <li key={item} className="rounded-md border border-slate-200 px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100 md:col-span-3">
                  {JSON.stringify(result.output.json, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Run the pipeline to generate JSON and editorial output.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Feedback Review</h2>
            <p className="mt-1 text-sm text-slate-600">
              Submitted feedback is staged as pending admin review.
            </p>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              className="mt-4 min-h-28 w-full resize-y rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-teal-600"
              placeholder="What happened?"
            />
            <textarea
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
              className="mt-3 min-h-24 w-full resize-y rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-teal-600"
              placeholder="What should have happened?"
            />
            <button
              onClick={submitFeedback}
              disabled={!result || !feedback.trim()}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Submit for admin review
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Toolbar({
  editor,
  onClean,
  onRun,
  canRun,
  runState,
}: {
  editor: Editor | null;
  onClean: () => void;
  onRun: () => void;
  canRun: boolean;
  runState: RunState;
}) {
  const tools = [
    { label: "Bold", icon: Bold, action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive("bold") },
    { label: "Italic", icon: Italic, action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive("italic") },
    {
      label: "Heading",
      icon: Heading2,
      action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor?.isActive("heading", { level: 2 }),
    },
    {
      label: "Bullet list",
      icon: List,
      action: () => editor?.chain().focus().toggleBulletList().run(),
      active: editor?.isActive("bulletList"),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      action: () => editor?.chain().focus().toggleOrderedList().run(),
      active: editor?.isActive("orderedList"),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-2">
      {tools.map((tool) => (
        <button
          key={tool.label}
          title={tool.label}
          onClick={tool.action}
          className={clsx(
            "inline-flex h-9 w-9 items-center justify-center rounded-md border text-slate-700",
            tool.active ? "border-teal-300 bg-teal-50 text-teal-800" : "border-slate-200 bg-white hover:bg-slate-100",
          )}
        >
          <tool.icon className="h-4 w-4" />
        </button>
      ))}
      <div className="ml-auto flex flex-wrap gap-2">
        <button
          onClick={onClean}
          disabled={!canRun}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <Eraser className="h-4 w-4" />
          Clean Junk
        </button>
        <button
          onClick={onRun}
          disabled={!canRun}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {runState === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run
        </button>
      </div>
    </div>
  );
}

function StepBadge({ status }: { status: PipelineStep["status"] }) {
  if (status === "complete") {
    return <CheckCircle2 className="h-5 w-5 text-teal-700" />;
  }

  if (status === "running") {
    return <Loader2 className="h-5 w-5 animate-spin text-blue-700" />;
  }

  return <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
