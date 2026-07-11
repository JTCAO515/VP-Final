"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { OpsMembership, OpsRole } from "@visepanda/app-server/ops-authorization";

export function RoleManager() {
  const [memberships, setMemberships] = useState<OpsMembership[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<OpsRole>("editor");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/roles");
    if (!response.ok) return setError("Could not load memberships.");
    setMemberships((await response.json()) as OpsMembership[]);
  }

  useEffect(() => void load(), []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/roles", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (!response.ok) return setError("Could not save membership.");
    setUserId("");
    await load();
  }

  return (
    <section className="panel">
      <form className="inlineForm" onSubmit={(event) => void save(event)}>
        <input
          aria-label="Supabase user id"
          onChange={(event) => setUserId(event.target.value)}
          placeholder="Supabase user UUID"
          required
          value={userId}
        />
        <select
          aria-label="Role"
          onChange={(event) => setRole(event.target.value as OpsRole)}
          value={role}
        >
          <option value="editor">Editor</option>
          <option value="operator">Operator</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit">Save role</button>
      </form>
      {error ? <p className="empty danger">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>User id</th>
            <th>Role</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((membership) => (
            <tr key={membership.userId}>
              <td>{membership.userId}</td>
              <td>{membership.role}</td>
              <td>{new Date(membership.updatedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
