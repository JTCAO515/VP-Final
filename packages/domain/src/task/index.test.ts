import { describe, expect, it } from "vitest";
import {
  HUMAN_TASK_TRANSITIONS,
  HumanTaskSchema,
  InvalidHumanTaskTransitionError,
  canTransitionHumanTask,
  createHumanTask,
  transitionHumanTask,
  updateHumanTask,
} from "./index.js";

describe("human task domain", () => {
  it("creates a requested task", () => {
    const task = createHumanTask(
      {
        city: "Shanghai",
        kind: "call_restaurant",
        description: "Please call a restaurant to confirm the reservation flow.",
        contact: "traveler@example.com",
      },
      new Date("2026-07-09T00:00:00.000Z"),
    );

    expect(task.status).toBe("requested");
    expect(task.created_at).toBe("2026-07-09T00:00:00.000Z");
  });

  it("accepts the full concierge status machine", () => {
    for (const status of [
      "requested",
      "triaged",
      "quoted",
      "payment_pending",
      "paid",
      "fulfilling",
      "done",
      "cancelled",
    ]) {
      expect(
        HumanTaskSchema.parse({
          id: `task-${status}`,
          city: "Beijing",
          kind: "ticket_help",
          description: "Help confirm ticket requirements for a passport booking.",
          contact: "traveler@example.com",
          status,
          created_at: "2026-07-09T00:00:00.000Z",
          updated_at: "2026-07-09T00:00:00.000Z",
        }).status,
      ).toBe(status);
    }
  });

  it("updates manual quote fields", () => {
    const task = createHumanTask({
      city: "Chengdu",
      kind: "other",
      description: "Please help confirm whether this spa can serve English speakers.",
      contact: "traveler@example.com",
    });

    const updated = updateHumanTask(task, {
      price_usd: 24,
      payment_link: "https://buy.stripe.com/test",
      operator_note: "Manual quote prepared.",
    });

    expect(updated.status).toBe("requested");
    expect(updated.payment_link).toBe("https://buy.stripe.com/test");
  });

  it("accepts every declared lifecycle edge and records the transition time", () => {
    const timestamp = new Date("2026-07-16T02:00:00.000Z");
    for (const [from, targets] of Object.entries(HUMAN_TASK_TRANSITIONS)) {
      for (const to of targets) {
        const task = HumanTaskSchema.parse({
          id: `task-${from}`,
          city: "Shanghai",
          kind: "translation_help",
          description: "Please translate this request for the hotel reception team.",
          contact: "traveler@example.com",
          status: from,
          created_at: "2026-07-16T01:00:00.000Z",
          updated_at: "2026-07-16T01:00:00.000Z",
        });

        expect(transitionHumanTask(task, to, timestamp)).toMatchObject({
          status: to,
          updated_at: timestamp.toISOString(),
        });
      }
    }
  });

  it("rejects every undeclared edge, including requested to done and cancelled recovery", () => {
    const statuses = HumanTaskSchema.shape.status.removeDefault().options;
    for (const from of statuses) {
      for (const to of statuses) {
        const allowed = HUMAN_TASK_TRANSITIONS[from].includes(to);
        expect(canTransitionHumanTask(from, to)).toBe(allowed);
        if (!allowed) {
          const task = HumanTaskSchema.parse({
            id: `task-${from}`,
            city: "Shanghai",
            kind: "translation_help",
            description: "Please translate this request for the hotel reception team.",
            contact: "traveler@example.com",
            status: from,
            created_at: "2026-07-16T01:00:00.000Z",
            updated_at: "2026-07-16T01:00:00.000Z",
          });
          expect(() => transitionHumanTask(task, to)).toThrow(InvalidHumanTaskTransitionError);
        }
      }
    }

    const requested = createHumanTask({
      city: "Shanghai",
      kind: "ticket_help",
      description: "Please confirm the correct ticket requirement for tomorrow.",
      contact: "traveler@example.com",
    });
    expect(() => transitionHumanTask(requested, "done")).toThrow(InvalidHumanTaskTransitionError);
    const cancelled = transitionHumanTask(requested, "cancelled");
    expect(() => transitionHumanTask(cancelled, "requested")).toThrow(
      InvalidHumanTaskTransitionError,
    );
  });
});
