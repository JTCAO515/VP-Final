"use client";

import React, { useEffect, useState, type FormEvent } from "react";
import type { OpsMembership, OpsRole } from "@visepanda/app-server/ops-authorization";

const ROLE_GUIDANCE: Array<{
  role: OpsRole;
  title: string;
  description: string;
  permissions: string[];
  risks?: string[];
}> = [
  {
    role: "editor",
    title: "Knowledge editor",
    description: "Creates, reviews, and maintains traveler-facing knowledge facts.",
    permissions: ["Read and write knowledge facts"],
  },
  {
    role: "operator",
    title: "Human Help operator",
    description: "Works on Human Help requests and their operational follow-up.",
    permissions: ["Read tasks", "Update tasks", "Read traveler contact details"],
    risks: ["Can view traveler contact details"],
  },
  {
    role: "admin",
    title: "Ops administrator",
    description: "Manages collaborator access, approved partners, costs, and VisePod provisioning.",
    permissions: [
      "Read and change collaborator access",
      "Read and manage approved partners",
      "Read service cost summaries",
      "Issue VisePod provisioning grants",
    ],
    risks: [
      "Can change other collaborators' access",
      "Can view all cost summaries",
      "Can issue VisePod provisioning grants",
    ],
  },
];

type RoleManagerProps = {
  canWrite: boolean;
  currentUserId: string;
  initialMemberships?: OpsMembership[];
};

export function RoleManager({
  canWrite,
  currentUserId,
  initialMemberships = [],
}: RoleManagerProps) {
  const [memberships, setMemberships] = useState<OpsMembership[]>(initialMemberships);
  const [isLoading, setIsLoading] = useState(initialMemberships.length === 0);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OpsRole>("editor");
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    membership: OpsMembership;
    role: OpsRole;
  } | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<OpsMembership | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/roles");
      if (!response.ok) {
        setError("Could not load memberships.");
        return;
      }
      setMemberships((await response.json()) as OpsMembership[]);
    } catch {
      setError("Could not load memberships.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => void load(), []);

  async function assignByEmail(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/roles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) {
      return setError(
        "Could not add this collaborator. Ask them to register first, then verify the email.",
      );
    }
    setEmail("");
    await load();
  }

  async function changeRole(membership: OpsMembership, nextRole: OpsRole) {
    setError(null);
    setSavingUserId(membership.userId);
    try {
      const response = await fetch("/api/roles", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: membership.userId, role: nextRole }),
      });
      if (!response.ok) {
        setError(
          "Could not change this collaborator's role. The server may have rejected the change.",
        );
        return;
      }
      await load();
    } finally {
      setSavingUserId(null);
    }
  }

  async function confirmRemoval() {
    if (!pendingRemoval) return;
    setError(null);
    setSavingUserId(pendingRemoval.userId);
    try {
      const response = await fetch("/api/roles", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: pendingRemoval.userId }),
      });
      if (!response.ok) {
        setError("Could not remove this collaborator. The server may have rejected the change.");
        return;
      }
      setPendingRemoval(null);
      await load();
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <div className="membershipWorkspace">
      <section className="panel membershipAssignment">
        <div className="membershipHeading">
          <div>
            <p className="eyebrow">Add collaborator</p>
            <h2>Assign one fixed role</h2>
            <p className="muted">
              Enter the complete email address the collaborator used to register. We never search or
              browse user accounts from Ops.
            </p>
          </div>
        </div>
        {canWrite ? (
          <form
            className="membershipAssignmentForm"
            onSubmit={(event) => void assignByEmail(event)}
          >
            <label>
              Registered email address
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              Role
              <RoleSelect onChange={setRole} value={role} />
            </label>
            <button type="submit">Add collaborator</button>
          </form>
        ) : (
          <p className="empty">
            You can view memberships, but only an Ops administrator can change them.
          </p>
        )}
        <p className="membershipNote">
          If this address has not registered yet, ask the person to create their own account first.
          Ops does not create accounts or reveal whether an address exists.
        </p>
      </section>

      <section className="panel membershipDirectory" aria-labelledby="member-list-title">
        <div className="membershipHeading">
          <div>
            <p className="eyebrow">Current access</p>
            <h2 id="member-list-title">Individual collaborator controls</h2>
            <p className="muted">
              Every role change and removal is audited. There is no bulk approval.
            </p>
          </div>
        </div>
        {error ? (
          <p className="empty danger" role="alert">
            {error}
          </p>
        ) : null}
        {isLoading ? (
          <p className="empty">Loading memberships…</p>
        ) : memberships.length === 0 ? (
          <p className="empty">No Ops memberships are available.</p>
        ) : (
          <div className="membershipList">
            {memberships.map((membership) => {
              const isSelf = membership.userId === currentUserId;
              const isRevoked = Boolean(membership.revokedAt);
              const isBusy = savingUserId === membership.userId;
              return (
                <article className="membershipRow" key={membership.userId}>
                  <div className="membershipIdentity">
                    <strong>{isSelf ? "You" : "Collaborator"}</strong>
                    <code>{membership.userId}</code>
                    <small>
                      {isRevoked
                        ? `Access removed ${formatDate(membership.revokedAt!)}`
                        : `Updated ${formatDate(membership.updatedAt)}`}
                    </small>
                  </div>
                  <div className="membershipControl">
                    <label>
                      Role
                      <RoleSelect
                        disabled={!canWrite || isSelf || isBusy}
                        onChange={(nextRole) => {
                          if (nextRole !== membership.role) {
                            setPendingRoleChange({ membership, role: nextRole });
                          }
                        }}
                        value={membership.role}
                      />
                    </label>
                    {isSelf ? (
                      <small className="muted">You cannot change your own access.</small>
                    ) : null}
                  </div>
                  <div className="membershipActions">
                    {canWrite && !isSelf && !isRevoked ? (
                      <button
                        className="secondaryButton dangerButton"
                        disabled={isBusy}
                        onClick={() => setPendingRemoval(membership)}
                        type="button"
                      >
                        Remove access
                      </button>
                    ) : null}
                    {isRevoked ? (
                      <span className="pill">Removed</span>
                    ) : (
                      <span className="pill">Active</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="roleCapabilityGrid" aria-label="Role capability guide">
        {ROLE_GUIDANCE.map((entry) => (
          <article className="panel roleCapability" key={entry.role}>
            <p className="eyebrow">{entry.role}</p>
            <h2>{entry.title}</h2>
            <p className="muted">{entry.description}</p>
            <h3>Includes</h3>
            <ul>
              {entry.permissions.map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>
            {entry.risks ? (
              <div className="roleRisk">
                <strong>High-risk access</strong>
                <ul>
                  {entry.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      {pendingRemoval ? (
        <section
          className="membershipRemovalConfirmation"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="remove-access-title"
        >
          <div>
            <p className="eyebrow">Confirm removal</p>
            <h2 id="remove-access-title">Remove this collaborator’s Ops access?</h2>
            <p>
              Their existing session loses Ops authority on the next protected request. This action
              is recorded in the audit ledger.
            </p>
          </div>
          <div className="rowActions">
            <button
              className="secondaryButton"
              disabled={savingUserId !== null}
              onClick={() => setPendingRemoval(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="dangerButton"
              disabled={savingUserId !== null}
              onClick={() => void confirmRemoval()}
              type="button"
            >
              Confirm removal
            </button>
          </div>
        </section>
      ) : null}

      {pendingRoleChange ? (
        <section
          aria-labelledby="change-role-title"
          aria-modal="true"
          className="membershipRemovalConfirmation"
          role="alertdialog"
        >
          <div>
            <p className="eyebrow">Confirm role change</p>
            <h2 id="change-role-title">
              Change this collaborator to {roleLabel(pendingRoleChange.role)}?
            </h2>
            <p>
              This updates their access on the next protected request and creates an audit record.
              The server rejects a self-change or a change that would remove the final
              administrator.
            </p>
          </div>
          <div className="rowActions">
            <button
              className="secondaryButton"
              disabled={savingUserId !== null}
              onClick={() => setPendingRoleChange(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              disabled={savingUserId !== null}
              onClick={() => {
                const { membership, role: nextRole } = pendingRoleChange;
                setPendingRoleChange(null);
                void changeRole(membership, nextRole);
              }}
              type="button"
            >
              Confirm role change
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function RoleSelect({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (role: OpsRole) => void;
  value: OpsRole;
}) {
  return (
    <select
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as OpsRole)}
      value={value}
    >
      <option value="editor">Knowledge editor</option>
      <option value="operator">Human Help operator</option>
      <option value="admin">Ops administrator</option>
    </select>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function roleLabel(role: OpsRole) {
  return ROLE_GUIDANCE.find((entry) => entry.role === role)?.title ?? role;
}
