import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerCaller } from "../../../api/_server";
import { SiteFooter, SiteHeader } from "../../../site-chrome";

type SharedTripPageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: SharedTripPageProps): Promise<Metadata> {
  const { token } = await params;
  const trip = await getServerCaller().trip.shared({ token });
  if (!trip) {
    return {
      title: "Shared trip not found | VisePanda",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${trip.title} | VisePanda shared trip`,
    description: `A read-only China travel plan with ${trip.days.length} days, shared from VisePanda.`,
    openGraph: {
      title: `${trip.title} | VisePanda`,
      description: `Read-only ${trip.days.length}-day China trip canvas.`,
      type: "article",
    },
  };
}

export default async function SharedTripPage({ params }: SharedTripPageProps) {
  const { token } = await params;
  const trip = await getServerCaller().trip.shared({ token });
  if (!trip) notFound();

  return (
    <main className="shell sharedTrip">
      <SiteHeader context="Read-only shared trip" />
      <section className="hero pageHero sharedHero">
        <div>
          <span className="eyebrow">Shared Trip Canvas</span>
          <h1>{trip.title}</h1>
          <p>
            A read-only VisePanda plan for China travel execution. Personal account details and
            editing controls are hidden.
          </p>
        </div>
        <a className="pageAction" href="/">
          Plan with VisePanda
        </a>
      </section>

      <section className="sharedTripGrid">
        {trip.days.map((day) => (
          <article className="panel sharedDay" key={day.id}>
            <div className="panelHeader">
              <div>
                <h2>Day {day.dayNumber}</h2>
                <span>{day.city ?? "China"}</span>
              </div>
              {day.title ? <strong>{day.title}</strong> : null}
            </div>
            <div className="sharedBlocks">
              {day.blocks.length ? (
                day.blocks.map((block) => (
                  <div className="block" key={block.id}>
                    <b>{block.title}</b>
                    <span>{block.description ?? block.address ?? "Details pending"}</span>
                    {block.startTime ? <small>{block.startTime}</small> : null}
                  </div>
                ))
              ) : (
                <div className="empty">Details pending.</div>
              )}
            </div>
          </article>
        ))}
      </section>
      <SiteFooter />
    </main>
  );
}
