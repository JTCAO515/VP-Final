import { describe, expect, it } from "vitest";
import {
  HUMAN_TASK_TRANSITIONS,
  HumanTaskSchema,
  InvalidHumanTaskTransitionError,
  canTransitionHumanTask,
  createHumanTask,
  transitionHumanTask,
  updateHumanTask,
  canAppendHumanTaskEvidence,
  isHumanTaskEvidenceWindowCurrent,
  sanitizeEvidenceDerivedGapPattern,
  sanitizeHumanTaskEvidence,
  SensitiveHumanTaskEvidenceError,
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

describe("Human Task evidence", () => {
  it("allows evidence only after a terminal outcome", () => {
    expect(canAppendHumanTaskEvidence("done")).toBe(true);
    expect(canAppendHumanTaskEvidence("cancelled")).toBe(true);
    expect(canAppendHumanTaskEvidence("fulfilling")).toBe(false);
    expect(canAppendHumanTaskEvidence("triaged")).toBe(false);
  });

  it("requires a current retention window for evidence access", () => {
    const task = HumanTaskSchema.parse({
      id: "task-terminal",
      city: "Shanghai",
      kind: "other",
      description: "Record a minimum private outcome for this completed request.",
      contact: "traveler@example.com",
      status: "cancelled",
      retention_expires_at: "2026-08-01T00:00:00.000Z",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    });
    expect(isHumanTaskEvidenceWindowCurrent(task, new Date("2026-07-31T23:59:59.000Z"))).toBe(true);
    expect(isHumanTaskEvidenceWindowCurrent(task, new Date("2026-08-01T00:00:00.000Z"))).toBe(
      false,
    );
  });

  it("redacts contact data before persistence", () => {
    expect(
      sanitizeHumanTaskEvidence({
        kind: "transcript_excerpt",
        content:
          "Traveler a@example.com confirmed by phone +86 138 0013 8000 that the venue was closed.",
      }),
    ).toEqual({
      content:
        "Traveler [redacted email] confirmed by phone [redacted phone] that the venue was closed.",
      redactionClasses: ["email", "phone"],
    });
  });

  it("rejects credential and document-number evidence", () => {
    expect(() =>
      sanitizeHumanTaskEvidence({
        kind: "outcome",
        content: "The traveler shared an OTP that must never be retained here.",
      }),
    ).toThrow(SensitiveHumanTaskEvidenceError);

    expect(() =>
      sanitizeHumanTaskEvidence({
        kind: "outcome",
        content: "The traveler pasted 4111 1111 1111 1111 into the transcript.",
      }),
    ).toThrow(SensitiveHumanTaskEvidenceError);

    for (const content of [
      "Travel document E12345678 was copied into this private outcome.",
      "The traveler pasted Amex 378282246310005 into this outcome.",
      "The operator accidentally pasted sk-test_12345678901234567890 here.",
    ]) {
      expect(() => sanitizeHumanTaskEvidence({ kind: "outcome", content })).toThrow(
        SensitiveHumanTaskEvidenceError,
      );
    }
  });

  it("sanitizes evidence-derived gaps and rejects named or document-specific patterns", () => {
    expect(
      sanitizeEvidenceDerivedGapPattern(
        "Can traveler@example.com find an accessible entrance near +86 138 0013 8000?",
      ),
    ).toBe("can private email find an accessible entrance near private number");
    expect(() =>
      sanitizeEvidenceDerivedGapPattern("Can traveler John Smith find an accessible entrance?"),
    ).toThrow(SensitiveHumanTaskEvidenceError);
    expect(() =>
      sanitizeEvidenceDerivedGapPattern("Can passport E12345678 be used for this booking?"),
    ).toThrow(SensitiveHumanTaskEvidenceError);
  });
});
