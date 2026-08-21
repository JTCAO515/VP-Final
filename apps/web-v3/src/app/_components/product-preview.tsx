import type { LandingCopy } from "../../i18n/landing-copy";

const TIMES = ["09:30", "12:30", "15:00", "19:00"] as const;

export function ProductPreview({ copy }: Readonly<{ copy: LandingCopy }>) {
  return (
    <section className="min-w-0" aria-label={copy.preview.label}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-base font-bold text-brand-ink">{copy.preview.label}</h2>
        <p className="text-xs leading-5 text-brand-muted">{copy.preview.disclaimer}</p>
      </div>
      <div className="overflow-hidden rounded-brand-md border border-brand-gold bg-brand-surface shadow-brand-raised">
        <div className="grid xl:grid-cols-2">
          <section
            className="border-b border-brand-line p-5 xl:border-e xl:border-b-0"
            aria-label={copy.preview.canvasLabel}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-brand-line pb-4">
              <div>
                <p className="text-sm font-bold text-brand-ink">{copy.preview.canvasLabel}</p>
                <p className="mt-1 text-xs text-brand-muted">{copy.preview.day}</p>
              </div>
              <span className="text-xs font-semibold text-brand-red">{copy.preview.blocks}</span>
            </div>
            <div className="relative mt-5 grid gap-5">
              <div
                className="absolute bottom-3 start-14 top-3 w-px bg-brand-red"
                aria-hidden="true"
              />
              {TIMES.map((time, index) => (
                <article key={time} className="relative flex gap-5">
                  <time className="w-10 shrink-0 pt-1 text-xs font-medium text-brand-muted">
                    {time}
                  </time>
                  <span
                    className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-brand-red bg-brand-surface"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 border-b border-brand-line pb-4 last:border-b-0">
                    <h3 className="text-sm font-bold text-brand-ink">
                      {copy.preview.blockTitles[index]}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-brand-muted">
                      {copy.preview.blockNotes[index]}
                    </p>
                    <span className="mt-2 inline-flex min-h-7 items-center rounded-brand-xs border border-brand-line bg-brand-surface-warm px-2 text-xs font-medium text-brand-ink-soft">
                      {copy.preview.tags[index]}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="p-5" aria-label={copy.preview.chatLabel}>
            <div className="flex items-center gap-3 border-b border-brand-line pb-4">
              <span
                className="grid h-8 w-8 place-items-center rounded-full border border-brand-red text-sm font-black text-brand-red"
                aria-hidden="true"
              >
                V
              </span>
              <div>
                <p className="text-sm font-bold text-brand-ink">{copy.preview.chatLabel}</p>
                <p className="mt-1 text-xs text-brand-muted">{copy.preview.chatSubhead}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-5">
              <p className="ms-auto max-w-sm rounded-brand-sm border border-brand-line bg-brand-app px-4 py-3 text-sm leading-6 text-brand-ink">
                {copy.preview.userMessage}
              </p>
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-brand-red text-xs font-black text-brand-red"
                  aria-hidden="true"
                >
                  V
                </span>
                <p className="max-w-md rounded-brand-sm border border-brand-red-soft bg-brand-red-soft px-4 py-3 text-sm leading-6 text-brand-ink">
                  {copy.preview.assistantMessage}
                </p>
              </div>
            </div>
          </section>
        </div>
        <p className="border-t border-brand-line px-5 py-4 text-xs leading-5 text-brand-muted">
          {copy.preview.state}
        </p>
      </div>
    </section>
  );
}
