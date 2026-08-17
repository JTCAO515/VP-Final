"use client";

import { useEffect, useState } from "react";
import type { HumanTask } from "@visepanda/domain";
import { displayHumanTaskKind, displayLifecycleValue } from "../../lib/presentation";

type LoadState = "loading" | "ready" | "error";

export function HumanTaskQueue() {
  const [tasks, setTasks] = useState<HumanTask[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    async function loadTasks() {
      try {
        const response = await fetch("/api/tasks");
        if (!response.ok) throw new Error("人工协助任务队列暂不可用。");
        setTasks((await response.json()) as HumanTask[]);
        setLoadState("ready");
      } catch {
        setLoadState("error");
      }
    }
    void loadTasks();
  }, []);

  if (loadState === "loading") return <section className="panel empty">正在加载请求…</section>;
  if (loadState === "error") {
    return <section className="panel empty">无法加载持久化人工协助任务队列。</section>;
  }
  if (tasks.length === 0) return <section className="panel empty">暂时没有人工协助任务。</section>;

  return (
    <section className="panel">
      <table>
        <thead>
          <tr>
            <th>请求</th>
            <th>联系方式</th>
            <th>状态</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>
                <strong>{task.city}</strong>
                <br />
                <small>{displayHumanTaskKind(task.kind)}</small>
                <p>{task.description}</p>
              </td>
              <td>{task.contact}</td>
              <td>{displayLifecycleValue(task.status)}</td>
              <td>{new Date(task.created_at).toLocaleString()}</td>
              <td>
                <a className="taskLink" href={`/tasks/${encodeURIComponent(task.id)}`}>
                  打开任务
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
