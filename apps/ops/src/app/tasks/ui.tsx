"use client";

import { useEffect, useState } from "react";
import type { HumanTask, HumanTaskStatus } from "@visepanda/domain";

const statuses: HumanTaskStatus[] = [
  "requested",
  "triaged",
  "quoted",
  "payment_pending",
  "paid",
  "fulfilling",
  "done",
  "cancelled",
];

type SaveState = "idle" | "saving" | "saved" | "error";

export function HumanTaskQueue() {
  const [tasks, setTasks] = useState<HumanTask[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function loadTasks() {
    const response = await fetch("/api/tasks");
    setTasks((await response.json()) as HumanTask[]);
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  async function saveTask(task: HumanTask) {
    setSaveState("saving");
    const priceInput = document.getElementById(`price-${task.id}`) as HTMLInputElement | null;
    const linkInput = document.getElementById(`link-${task.id}`) as HTMLInputElement | null;
    const noteInput = document.getElementById(`note-${task.id}`) as HTMLInputElement | null;
    const statusInput = document.getElementById(`status-${task.id}`) as HTMLSelectElement | null;

    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        status: statusInput?.value,
        price_usd: priceInput?.value ? Number(priceInput.value) : null,
        payment_link: linkInput?.value || null,
        operator_note: noteInput?.value || null,
      }),
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    const updated = (await response.json()) as HumanTask;
    setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setSaveState("saved");
  }

  if (tasks.length === 0) {
    return <section className="panel empty">No human tasks yet.</section>;
  }

  return (
    <section className="panel">
      <table>
        <thead>
          <tr>
            <th>Request</th>
            <th>Contact</th>
            <th>Status</th>
            <th>Quote</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>
                <strong>{task.city}</strong>
                <br />
                <small>{task.kind}</small>
                <p>{task.description}</p>
              </td>
              <td>{task.contact}</td>
              <td>
                <select defaultValue={task.status} id={`status-${task.id}`}>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <div className="taskQuote">
                  <input
                    defaultValue={task.price_usd ?? ""}
                    id={`price-${task.id}`}
                    min="0"
                    placeholder="USD"
                    type="number"
                  />
                  <input
                    defaultValue={task.payment_link ?? ""}
                    id={`link-${task.id}`}
                    placeholder="Stripe payment link"
                    type="url"
                  />
                  <input
                    defaultValue={task.operator_note ?? ""}
                    id={`note-${task.id}`}
                    placeholder="Operator note"
                  />
                </div>
              </td>
              <td>
                <div className="rowActions">
                  <button
                    disabled={saveState === "saving"}
                    onClick={() => void saveTask(task)}
                    type="button"
                  >
                    Save
                  </button>
                  {saveState !== "idle" ? <small>{saveState}</small> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
