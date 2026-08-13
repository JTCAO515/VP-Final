"use client";

import { useState } from "react";

type WebErrorFallbackProps = Readonly<{
  correlationId: string;
  reset: () => void;
}>;

export function WebErrorFallback({ correlationId, reset }: WebErrorFallbackProps) {
  return (
    <main className="runtimeErrorPage" id="page-content">
      <section aria-labelledby="runtime-error-title" className="runtimeErrorPanel">
        <p className="pageEyebrow">VisePanda</p>
        <h1 id="runtime-error-title">We could not finish that page.</h1>
        <p>
          No travel action was completed. Try again, or return to VisePanda and continue from a
          fresh page.
        </p>
        <p className="runtimeErrorReference">
          Support reference <code>{correlationId}</code>
        </p>
        <div className="runtimeErrorActions">
          <button onClick={reset} type="button">
            Try again
          </button>
          <a href="/visepanda">Return to VisePanda</a>
        </div>
      </section>
    </main>
  );
}

export default function ErrorBoundary({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const [correlationId] = useState(() => crypto.randomUUID());
  return <WebErrorFallback correlationId={correlationId} reset={reset} />;
}
