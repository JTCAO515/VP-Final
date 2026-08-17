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
    title: "知识编辑",
    description: "创建、审核并维护面向旅行者的知识事实。",
    permissions: ["读取和编辑知识事实"],
  },
  {
    role: "operator",
    title: "人工协助专员",
    description: "处理人工协助请求及其运营跟进。",
    permissions: ["读取任务", "更新任务", "读取旅行者联系方式"],
    risks: ["可查看旅行者联系方式"],
  },
  {
    role: "admin",
    title: "运营管理员",
    description: "管理协作者权限、已批准合作伙伴、成本和 VisePod 灌装。",
    permissions: [
      "读取和更改协作者权限",
      "读取和管理已批准合作伙伴",
      "读取服务成本汇总",
      "签发 VisePod 灌装授权",
    ],
    risks: ["可更改其他协作者的权限", "可查看全部成本汇总", "可签发 VisePod 灌装授权"],
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
        setError("无法加载成员资格，请稍后重试。");
        return;
      }
      setMemberships((await response.json()) as OpsMembership[]);
    } catch {
      setError("无法加载成员资格，请稍后重试。");
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
      return setError("无法添加此协作者。请先请对方自行注册，再核对完整邮箱地址。");
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
        setError("无法更改此协作者的角色；服务端可能拒绝了该变更。");
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
        setError("无法移除此协作者；服务端可能拒绝了该变更。");
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
            <p className="eyebrow">添加协作者</p>
            <h2>分配一个固定角色</h2>
            <p className="muted">
              输入协作者注册时使用的完整邮箱地址。运营后台不会搜索或浏览用户账号。
            </p>
          </div>
        </div>
        {canWrite ? (
          <form
            className="membershipAssignmentForm"
            onSubmit={(event) => void assignByEmail(event)}
          >
            <label>
              已注册邮箱地址
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
              角色
              <RoleSelect onChange={setRole} value={role} />
            </label>
            <button type="submit">添加协作者</button>
          </form>
        ) : (
          <p className="empty">你可以查看成员资格，但只有运营管理员可以更改它们。</p>
        )}
        <p className="membershipNote">
          如果该邮箱尚未注册，请让对方先自行创建账号。运营后台不会创建账号，也不会透露邮箱是否存在。
        </p>
      </section>

      <section className="panel membershipDirectory" aria-labelledby="member-list-title">
        <div className="membershipHeading">
          <div>
            <p className="eyebrow">当前权限</p>
            <h2 id="member-list-title">逐位协作者控制</h2>
            <p className="muted">每一次角色变更和移除都会被审计，且不提供批量批准。</p>
          </div>
        </div>
        {error ? (
          <p className="empty danger" role="alert">
            {error}
          </p>
        ) : null}
        {isLoading ? (
          <p className="empty">正在加载成员资格…</p>
        ) : memberships.length === 0 ? (
          <p className="empty">没有可用的运营成员资格。</p>
        ) : (
          <div className="membershipList">
            {memberships.map((membership) => {
              const isSelf = membership.userId === currentUserId;
              const isRevoked = Boolean(membership.revokedAt);
              const isBusy = savingUserId === membership.userId;
              return (
                <article className="membershipRow" key={membership.userId}>
                  <div className="membershipIdentity">
                    <strong>{isSelf ? "当前账号" : "协作者"}</strong>
                    <code>{membership.userId}</code>
                    <small>
                      {isRevoked
                        ? `已于 ${formatDate(membership.revokedAt!)} 移除权限`
                        : `更新于 ${formatDate(membership.updatedAt)}`}
                    </small>
                  </div>
                  <div className="membershipControl">
                    <label>
                      角色
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
                    {isSelf ? <small className="muted">你不能更改自己的访问权限。</small> : null}
                  </div>
                  <div className="membershipActions">
                    {canWrite && !isSelf && !isRevoked ? (
                      <button
                        className="secondaryButton dangerButton"
                        disabled={isBusy}
                        onClick={() => setPendingRemoval(membership)}
                        type="button"
                      >
                        移除权限
                      </button>
                    ) : null}
                    {isRevoked ? (
                      <span className="pill">已移除</span>
                    ) : (
                      <span className="pill">有效</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="roleCapabilityGrid" aria-label="角色能力说明">
        {ROLE_GUIDANCE.map((entry) => (
          <article className="panel roleCapability" key={entry.role}>
            <p className="eyebrow">{entry.role}</p>
            <h2>{entry.title}</h2>
            <p className="muted">{entry.description}</p>
            <h3>包含权限</h3>
            <ul>
              {entry.permissions.map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>
            {entry.risks ? (
              <div className="roleRisk">
                <strong>高风险权限</strong>
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
            <p className="eyebrow">确认移除</p>
            <h2 id="remove-access-title">移除此协作者的运营后台权限？</h2>
            <p>此人的现有会话会在下一次受保护请求时失去运营权限；该操作会记入审计记录。</p>
          </div>
          <div className="rowActions">
            <button
              className="secondaryButton"
              disabled={savingUserId !== null}
              onClick={() => setPendingRemoval(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="dangerButton"
              disabled={savingUserId !== null}
              onClick={() => void confirmRemoval()}
              type="button"
            >
              确认移除
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
            <p className="eyebrow">确认角色变更</p>
            <h2 id="change-role-title">将此协作者改为「{roleLabel(pendingRoleChange.role)}」？</h2>
            <p>
              该变更会在下一次受保护请求时更新权限，并创建审计记录。服务端会拒绝自我变更或移除最后一位管理员的操作。
            </p>
          </div>
          <div className="rowActions">
            <button
              className="secondaryButton"
              disabled={savingUserId !== null}
              onClick={() => setPendingRoleChange(null)}
              type="button"
            >
              取消
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
              确认角色变更
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
      <option value="editor">知识编辑</option>
      <option value="operator">人工协助专员</option>
      <option value="admin">运营管理员</option>
    </select>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function roleLabel(role: OpsRole) {
  return ROLE_GUIDANCE.find((entry) => entry.role === role)?.title ?? role;
}
