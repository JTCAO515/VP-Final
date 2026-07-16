"use client";

import { useEffect, useState } from "react";
import type { HumanTask } from "@visepanda/domain";

type LoadState = "loading" | "ready" | "error";

export function HumanTaskQueue() {
  const [tasks, setTasks] = useState<HumanTask[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    async function loadTasks() {
      try {
        const response = await fetch("/api/tasks");
        if (!response.ok) throw new Error("Human Task intake is unavailable.");
        setTasks((await response.json()) as HumanTask[]);
        setLoadState("ready");
      } catch {
        setLoadState("error");
      }
    }
    void loadTasks();
  }, []);

  if (loadState === "loading")
    return <section className="panel empty">Loading requests...</section>;
  if (loadState === "error") {
    return <section className="panel empty">Could not load the durable Human Task queue.</section>;
  }
  if (tasks.length === 0) return <section className="panel empty">No human tasks yet.</section>;

  return (
    <section className="panel">
      <table>
        <thead>
          <tr>
            <th>Request</th>
            <th>Contact</th>
            <th>Status</th>
            <th>Submitted</th>
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
              <td>{task.status}</td>
              <td>{new Date(task.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
