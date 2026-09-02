"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Activity,
  Bold,
  CheckCircle2,
  Clock3,
  Eye,
  Eraser,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Play,
  Trash2,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import clsx from "clsx";
import { createInitialSteps, type PipelineOutput, type PipelineStep } from "@/lib/pipeline";

type RunState = "idle" | "cleaning" | "running" | "complete" | "error";
type WorkspaceTab = "editorial" | "admin";

type RunResult = {
  runId: string;
  cleaned: string;
  wordCount?: number;
  estimatedCostInr?: number;
  output: PipelineOutput;
};

type SavedAnalysis = {
  id: string;
  headline: string;
  authorUrl: string;
  userEmail: string;
  checkedAt: string;
  actionTag: string;
  wordCount: number;
};

type AdminDashboard = {
  summary: {
    checksRun: number;
    uniqueArticlesChecked: number;
    activeUsers: number;
    totalTokensUsed: number;
    totalEstimatedCostInr: number;
  };
  recentUsage: Array<{
    id: string;
    userEmail: string;
    loggedInAt: string | null;
    checkedOn: string;
    status: string;
    reason: string;
    urlCount: number;
    wordCount: number;
    estimatedCostInr: number;
  }>;
  userActivity: Array<{
    id: string;
    userEmail: string;
    role: "admin" | "user";
    dateTime: string;
  }>;
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

export function AuditWorkspace({ userEmail, role }: { userEmail: string; role: "admin" | "user" }) {
  const isAdmin = role === "admin";
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("editorial");
  const [istNow, setIstNow] = useState(() => formatter.format(new Date()));
  const [headline, setHeadline] = useState("");
  const [authorUrl, setAuthorUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [feedback, setFeedback] = useState("");
  const [expected, setExpected] = useState("");
  const [runState, setRunState] = useState<RunState>("idle");
  const [steps, setSteps] = useState<PipelineStep[]>(createInitialSteps);
  const [estimatedSeconds, setEstimatedSeconds] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [editorText, setEditorText] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [notice, setNotice] = useState("Ready for prototype input.");
  const [topMessage, setTopMessage] = useState("");
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const outputRef = useRef<HTMLElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          "Paste article body, source notes, disclaimer, and any draft context here.",
      }),
    ],
    content: "",
    onUpdate: ({ editor: currentEditor }) => {
      setEditorText(currentEditor.getText());
    },
    editorProps: {
      attributes: {
        class:
          "h-[460px] overflow-y-auto rounded-b-lg border border-t-0 border-slate-200 bg-white text-[15px] leading-7 text-slate-900",
      },
    },
  });

  const canRun = useMemo(() => {
    return Boolean(editorText.trim()) && headline.length <= 120 && excerptWordCount(excerpt) <= 60 && runState !== "cleaning" && runState !== "running";
  }, [editorText, excerpt, headline, runState]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIstNow(formatter.format(new Date()));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    loadSavedAnalyses();
  }, []);

  useEffect(() => {
    if (activeTab === "admin" && isAdmin) {
      loadDashboard();
    }
  }, [activeTab, isAdmin]);

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
    setEditorText(data.cleaned || "");
    setWordCount(countWords(data.cleaned || ""));
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
    setTopMessage("");
    setNotice("Pipeline started. The model is processing all modules.");
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
        authorUrl,
        excerpt,
        content: editor.getText(),
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
      setRunState("error");
      setSteps((items) =>
        items.map((step) =>
          step.status === "running" ? { ...step, status: "blocked" } : step,
        ),
      );
      setNotice(errorData?.message || "Run failed. Check API configuration and try again.");
      setTopMessage(errorData?.message || "Run failed. Please report the issue or return home.");
      return;
    }

    const data = (await response.json()) as RunResult;
    editor.commands.setContent(data.cleaned || "");
    setEditorText(data.cleaned || "");
    setWordCount(data.wordCount ?? countWords(data.cleaned || ""));
    setResult(data);
    await loadSavedAnalyses();
    if (isAdmin) {
      await loadDashboard();
    }
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

  async function loadSavedAnalyses() {
    const response = await fetch("/api/analyses");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { analyses: SavedAnalysis[] };
    setSavedAnalyses(data.analyses);
  }

  async function loadDashboard() {
    const response = await fetch("/api/admin/dashboard");

    if (!response.ok) {
      return;
    }

    setDashboard((await response.json()) as AdminDashboard);
  }

  async function deleteSavedAnalysis(id: string) {
    const response = await fetch(`/api/analyses?id=${encodeURIComponent(id)}`, { method: "DELETE" });

    if (!response.ok) {
      setTopMessage("Delete failed. Admin access may be missing or the record may already be removed.");
      return;
    }

    await loadSavedAnalyses();
    await loadDashboard();
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

      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-2 px-5">
          <TabButton active={activeTab === "editorial"} onClick={() => setActiveTab("editorial")}>
            Editorial Check
          </TabButton>
          {isAdmin ? (
            <TabButton active={activeTab === "admin"} onClick={() => setActiveTab("admin")}>
              Administration
            </TabButton>
          ) : null}
        </div>
      </nav>

      {activeTab === "admin" && isAdmin ? (
        <AdminPanel dashboard={dashboard} onRefresh={loadDashboard} />
      ) : (
        <EditorialCheck
          authorUrl={authorUrl}
          canRun={canRun}
          cleanJunk={cleanJunk}
          editor={editor}
          estimatedSeconds={estimatedSeconds}
          excerpt={excerpt}
          expected={expected}
          feedback={feedback}
          headline={headline}
          isAdmin={isAdmin}
          notice={notice}
          outputRef={outputRef}
          result={result}
          runPipeline={runPipeline}
          runState={runState}
          savedAnalyses={savedAnalyses}
          setAuthorUrl={setAuthorUrl}
          setExcerpt={setExcerpt}
          setExpected={setExpected}
          setFeedback={setFeedback}
          setHeadline={setHeadline}
          steps={steps}
          submitFeedback={submitFeedback}
          topMessage={topMessage}
          wordCount={wordCount}
          onDeleteAnalysis={deleteSavedAnalysis}
        />
      )}
    </main>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "h-12 border-b-2 px-2 text-sm font-semibold",
        active ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function EditorialCheck({
  authorUrl,
  canRun,
  cleanJunk,
  editor,
  estimatedSeconds,
  excerpt,
  expected,
  feedback,
  headline,
  isAdmin,
  notice,
  outputRef,
  result,
  runPipeline,
  runState,
  savedAnalyses,
  setAuthorUrl,
  setExcerpt,
  setExpected,
  setFeedback,
  setHeadline,
  steps,
  submitFeedback,
  topMessage,
  wordCount,
  onDeleteAnalysis,
}: {
  authorUrl: string;
  canRun: boolean;
  cleanJunk: () => void;
  editor: Editor | null;
  estimatedSeconds: number;
  excerpt: string;
  expected: string;
  feedback: string;
  headline: string;
  isAdmin: boolean;
  notice: string;
  outputRef: RefObject<HTMLElement | null>;
  result: RunResult | null;
  runPipeline: () => void;
  runState: RunState;
  savedAnalyses: SavedAnalysis[];
  setAuthorUrl: Dispatch<SetStateAction<string>>;
  setExcerpt: Dispatch<SetStateAction<string>>;
  setExpected: Dispatch<SetStateAction<string>>;
  setFeedback: Dispatch<SetStateAction<string>>;
  setHeadline: Dispatch<SetStateAction<string>>;
  steps: PipelineStep[];
  submitFeedback: () => void;
  topMessage: string;
  wordCount: number;
  onDeleteAnalysis: (id: string) => void;
}) {
  return (
    <>
      {topMessage ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-amber-900">
            <span>{topMessage}</span>
            <span className="flex gap-2">
              <a className="rounded-md border border-amber-300 bg-white px-3 py-1 font-semibold" href="mailto:chandan.kumar@indianexpress.com">
                Report
              </a>
              <Link className="rounded-md border border-amber-300 bg-white px-3 py-1 font-semibold" href="/">
                Back to Home
              </Link>
            </span>
          </div>
        </div>
      ) : null}
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-sm font-medium text-slate-700">
                Headline <span className="text-xs text-slate-400">{headline.length}/120</span>
              </span>
              <input
                maxLength={120}
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600"
                placeholder="Paste headline"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Author URL</span>
              <input
                value={authorUrl}
                onChange={(event) => setAuthorUrl(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600"
                placeholder="https://www.financialexpress.com/author/..."
              />
            </label>
          </div>
          <label className="mb-4 block">
            <span className="mb-1 flex items-center justify-between text-sm font-medium text-slate-700">
              Excerpt/Strap <span className="text-xs text-slate-400">{excerptWordCount(excerpt)}/60 words</span>
            </span>
            <textarea
              value={excerpt}
              onChange={(event) => setExcerpt(limitWords(event.target.value, 60))}
              className="min-h-20 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
              placeholder="Paste short excerpt or strap"
            />
          </label>

          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-950">Article Body</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Words: {wordCount || countWords(editor?.getText() || "")}
            </span>
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
            <h2 className="text-sm font-semibold text-slate-950">System Stack</h2>
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
                {isAdmin ? (
                  <details className="md:col-span-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700">Technical JSON</summary>
                    <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                      {JSON.stringify(result.output.json, null, 2)}
                    </pre>
                  </details>
                ) : null}
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
      <SavedAnalyses analyses={savedAnalyses} isAdmin={isAdmin} onDelete={onDeleteAnalysis} />
    </>
  );
}

function AdminPanel({ dashboard, onRefresh }: { dashboard: AdminDashboard | null; onRefresh: () => void }) {
  const [accessEmail, setAccessEmail] = useState("");
  const [accessRole, setAccessRole] = useState<"admin" | "user">("user");
  const [accessMessage, setAccessMessage] = useState("");
  const summary = [
    { label: "Checks Run", value: String(dashboard?.summary.checksRun ?? 0), detail: "All attempts" },
    { label: "Unique Articles Checked", value: String(dashboard?.summary.uniqueArticlesChecked ?? 0), detail: "Distinct article keys" },
    { label: "Active Users", value: String(dashboard?.summary.activeUsers ?? 0), detail: "Google sign-in + granted access" },
    { label: "Total API Tokens Used", value: formatNumber(dashboard?.summary.totalTokensUsed ?? 0), detail: "Input + output tokens" },
    { label: "Total Est. Cost (₹)", value: formatInr(dashboard?.summary.totalEstimatedCostInr ?? 0), detail: "Claude cost at ₹95/$" },
  ];

  async function grantAccess() {
    setAccessMessage("");
    const response = await fetch("/api/admin/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: accessEmail, role: accessRole }),
    });

    const data = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setAccessMessage(data?.message || "Access update failed.");
      return;
    }

    setAccessEmail("");
    setAccessMessage("Access updated.");
    onRefresh();
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5 px-5 py-5">
      <h2 className="text-xl font-semibold text-slate-950">Overall Dashboard</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {summary.map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</p>
            <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <AdminTable
        title="Recent Usage"
        headers={["User ID", "Logged in", "Checked on", "Status", "Reason", "URLs", "Words", "Est. Cost (₹)"]}
        rows={(dashboard?.recentUsage ?? []).map((row) => [
          row.userEmail,
          formatIst(row.loggedInAt),
          formatIst(row.checkedOn),
          titleCase(row.status),
          row.reason,
          String(row.urlCount),
          formatNumber(row.wordCount),
          formatInr(row.estimatedCostInr),
        ])}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <AdminTable
          title="User Activity"
          headers={["User ID", "Role", "Date/Time"]}
          rows={(dashboard?.userActivity ?? []).map((row) => [
            row.userEmail,
            titleCase(row.role),
            formatIst(row.dateTime),
          ])}
        />
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-950">User Access</h2>
          </div>
          <div className="mt-4 space-y-3">
            <input
              value={accessEmail}
              onChange={(event) => setAccessEmail(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-teal-600"
              placeholder="employee@indianexpress.com"
            />
            <select
              value={accessRole}
              onChange={(event) => setAccessRole(event.target.value === "admin" ? "admin" : "user")}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={grantAccess}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white"
            >
              Give Access
            </button>
          </div>
          {accessMessage ? <p className="mt-3 text-sm leading-6 text-slate-600">{accessMessage}</p> : null}
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-teal-700" />
          <h2 className="text-lg font-semibold text-slate-950">Operational Notes</h2>
        </div>
        <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
          <p className="rounded-md bg-slate-50 p-3">Usage rows now come from Supabase audit run records.</p>
          <p className="rounded-md bg-slate-50 p-3">Feedback is saved as pending admin review before training use.</p>
          <p className="rounded-md bg-slate-50 p-3">API keys and role operations remain server-only.</p>
        </div>
      </section>
    </section>
  );
}

function AdminTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.join("|")} className="text-slate-700">
                {row.map((cell) => (
                  <td key={cell} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SavedAnalyses({
  analyses,
  isAdmin,
  onDelete,
}: {
  analyses: SavedAnalysis[];
  isAdmin: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-12">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-red-800">
        Saved Analyses
      </h2>
      {analyses.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Completed checks will appear here for everyone after the database tables are active.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {analyses.map((analysis) => (
            <article key={analysis.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="p-5">
                <h3 className="text-lg font-semibold leading-7 text-slate-950">{analysis.headline}</h3>
                <p className="mt-3 text-sm text-slate-600">
                  {analysis.userEmail} · {analysis.actionTag}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatIst(analysis.checkedAt)} · {formatNumber(analysis.wordCount)} words
                </p>
              </div>
              <div className="grid grid-cols-2 border-t border-slate-200">
                <a
                  href={analysis.authorUrl || "#"}
                  className="inline-flex h-12 items-center justify-center gap-2 border-r border-slate-200 text-sm font-semibold text-slate-900"
                >
                  <Eye className="h-4 w-4" />
                  View
                </a>
                {isAdmin ? (
                  <button
                    onClick={() => onDelete(analysis.id)}
                    className="inline-flex h-12 items-center justify-center gap-2 text-sm font-semibold text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                ) : (
                  <span className="inline-flex h-12 items-center justify-center text-sm font-semibold text-slate-400">
                    Saved
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
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

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function excerptWordCount(text: string) {
  return countWords(text);
}

function limitWords(text: string, limit: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= limit) {
    return text;
  }

  return words.slice(0, limit).join(" ");
}

function formatIst(value?: string | null) {
  if (!value) {
    return "-";
  }

  return formatter.format(new Date(value));
}

function formatInr(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
