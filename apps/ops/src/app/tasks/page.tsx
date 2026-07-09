import { HumanTaskQueue } from "./ui";

export default function TasksPage() {
  return (
    <>
      <section className="heading">
        <h1>Human tasks</h1>
        <p className="muted">
          Minimal concierge queue. Prepare manual quotes and attach payment links after review.
        </p>
      </section>
      <HumanTaskQueue />
    </>
  );
}
