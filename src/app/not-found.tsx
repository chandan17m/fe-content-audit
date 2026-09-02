import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f5f4] px-5 text-slate-950">
      <section className="max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-800">
          Financial Express
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This private audit page does not exist or the link has changed.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-teal-700 px-5 text-sm font-semibold text-white"
        >
          Back to Home
        </Link>
      </section>
    </main>
  );
}
