export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-app px-5 py-16 text-brand-ink">
      <section className="w-full max-w-xl rounded-brand-md border border-brand-line bg-brand-surface p-8 shadow-brand-raised">
        <p className="text-sm font-bold text-brand-red">404</p>
        <h1 className="mt-3 text-3xl font-black">This V3 route is not available yet.</h1>
        <p className="mt-4 leading-7 text-brand-muted">
          Early Access is the first active V3 surface. Planned routes stay unavailable until their
          own evidence gates pass.
        </p>
        <a
          className="mt-8 inline-flex min-h-11 items-center rounded-brand-sm border border-brand-red bg-brand-red px-5 font-bold text-brand-on-primary hover:bg-brand-red-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
          href="/"
        >
          Return to Early Access
        </a>
      </section>
    </main>
  );
}
