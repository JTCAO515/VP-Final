import { INITIAL_KNOWLEDGE_GAPS } from "@visepanda/domain";

export default function GapsPage() {
  return (
    <>
      <section className="heading">
        <h1>Knowledge gaps</h1>
        <p className="muted">Seed gaps from early China travel execution questions.</p>
      </section>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>City</th>
              <th>Pattern</th>
              <th>Frequency</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {INITIAL_KNOWLEDGE_GAPS.map((gap) => (
              <tr key={gap.id}>
                <td>{gap.city ?? "All cities"}</td>
                <td>{gap.questionPattern}</td>
                <td>{gap.frequency}</td>
                <td>
                  <span className="pill">{gap.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
