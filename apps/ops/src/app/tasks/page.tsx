const tasks = [
  {
    id: "task-call-restaurant",
    city: "Shanghai",
    kind: "Call restaurant",
    status: "requested",
    summary: "Confirm foreign-card friendly dinner reservation flow.",
  },
  {
    id: "task-ticket-help",
    city: "Beijing",
    kind: "Ticket help",
    status: "queued",
    summary: "Check passport-name requirements for Forbidden City booking.",
  },
];

export default function TasksPage() {
  return (
    <>
      <section className="heading">
        <h1>Human tasks</h1>
        <p className="muted">Minimal queue view for Phase 0 concierge work.</p>
      </section>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>City</th>
              <th>Kind</th>
              <th>Summary</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.city}</td>
                <td>{task.kind}</td>
                <td>{task.summary}</td>
                <td>
                  <span className="pill">{task.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
