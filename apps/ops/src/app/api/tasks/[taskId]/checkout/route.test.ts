import {
  createInMemoryOpsAuthorizationService,
  HumanTaskPaymentStateError,
  StripeCheckoutProviderError,
  type HumanTaskPaymentCheckoutResult,
  type HumanTaskPaymentCheckoutService,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type { AuthorizedOpsRequest } from "../../../../../lib/opsAccess";
import { handleTaskCheckoutPost } from "./handler";

const operator = {
  userId: "00000000-0000-4000-8000-000000000100",
  role: "operator" as const,
  permissions: ["task.read", "task.contact.read", "task.write"] as const,
};

const authorization: AuthorizedOpsRequest = {
  access: { ...operator, permissions: [...operator.permissions] },
  authorizationService: createInMemoryOpsAuthorizationService(),
  cookieResponse: NextResponse.next(),
};

function request(body: unknown) {
  return new Request("https://ops.example.com/api/tasks/task-id/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function checkoutService(): HumanTaskPaymentCheckoutService {
  const createCheckout = vi.fn(
    async ({
      taskId,
      amountCents,
    }: Parameters<HumanTaskPaymentCheckoutService["createCheckout"]>[0]) => {
      const result: HumanTaskPaymentCheckoutResult = {
        task: {
          id: taskId,
          city: "Shanghai",
          kind: "translation_help",
          description: "This private description must not reach the response.",
          contact: "traveler@example.com",
          status: "payment_pending",
          price_usd: amountCents / 100,
          payment_link: "https://checkout.stripe.com/c/pay/cs_test_checkout_123",
          operator_note: null,
          retention_expires_at: "2026-12-01T00:00:00.000Z",
          created_at: "2026-08-14T00:00:00.000Z",
          updated_at: "2026-08-14T00:00:00.000Z",
        },
        payment: {
          id: "00000000-0000-4000-8000-000000000200",
          task_id: taskId,
          provider: "stripe",
          provider_checkout_session_id: "cs_test_checkout_123",
          provider_payment_intent_id: null,
          provider_event_id: null,
          amount_cents: amountCents,
          currency: "usd",
          checkout_url: "https://checkout.stripe.com/c/pay/cs_test_checkout_123",
          status: "checkout_open",
          paid_at: null,
          retention_expires_at: "2026-12-01T00:00:00.000Z",
          created_at: "2026-08-14T00:00:00.000Z",
          updated_at: "2026-08-14T00:00:00.000Z",
        },
        replayed: false,
      };
      return result;
    },
  );
  return {
    createCheckout,
  };
}

describe("POST /api/tasks/:taskId/checkout", () => {
  it("uses the verified Ops actor and returns a minimized internal checkout projection", async () => {
    const service = checkoutService();
    const response = await handleTaskCheckoutPost(
      request({ amount_cents: 1499 }),
      { params: Promise.resolve({ taskId: "00000000-0000-4000-8000-000000000001" }) },
      {
        authorize: async () => authorization,
        getCheckoutService: () => service,
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(service.createCheckout).toHaveBeenCalledWith({
      taskId: "00000000-0000-4000-8000-000000000001",
      amountCents: 1499,
      actor: expect.objectContaining({ userId: operator.userId }),
    });
    expect(payload).toMatchObject({
      ok: true,
      task: { status: "payment_pending", price_usd: 14.99 },
      payment: { amount_cents: 1499, currency: "usd", status: "checkout_open" },
      replayed: false,
    });
    expect(JSON.stringify(payload)).not.toContain("traveler@example.com");
    expect(JSON.stringify(payload)).not.toContain("private description");
  });

  it("rejects an unauthenticated request before reading the body or composing a checkout service", async () => {
    const getCheckoutService = vi.fn(checkoutService);
    const response = await handleTaskCheckoutPost(
      request({ amount_cents: 1499 }),
      { params: Promise.resolve({ taskId: "00000000-0000-4000-8000-000000000001" }) },
      {
        authorize: async () =>
          NextResponse.json({ ok: false, error: "Ops authentication required." }, { status: 401 }),
        getCheckoutService,
      },
    );

    expect(response.status).toBe(401);
    expect(getCheckoutService).not.toHaveBeenCalled();
  });

  it("rejects a client-authored actor field instead of accepting a forged authority", async () => {
    const service = checkoutService();
    const response = await handleTaskCheckoutPost(
      request({ amount_cents: 1499, actor_id: "00000000-0000-4000-8000-000000000999" }),
      { params: Promise.resolve({ taskId: "00000000-0000-4000-8000-000000000001" }) },
      {
        authorize: async () => authorization,
        getCheckoutService: () => service,
      },
    );

    expect(response.status).toBe(400);
    expect(service.createCheckout).not.toHaveBeenCalled();
  });

  it("returns an honest unavailable response without a configured checkout service", async () => {
    const response = await handleTaskCheckoutPost(
      request({ amount_cents: 1499 }),
      { params: Promise.resolve({ taskId: "00000000-0000-4000-8000-000000000001" }) },
      {
        authorize: async () => authorization,
        getCheckoutService: () => {
          throw new Error("Ops payment checkout is unavailable.");
        },
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      ok: false,
      error: "Payment checkout is not configured. No payment link was created.",
    });
  });

  it("does not turn an invalid task state into a checkout link", async () => {
    const response = await handleTaskCheckoutPost(
      request({ amount_cents: 1499 }),
      { params: Promise.resolve({ taskId: "00000000-0000-4000-8000-000000000001" }) },
      {
        authorize: async () => authorization,
        getCheckoutService: () => ({
          createCheckout: async () => {
            throw new HumanTaskPaymentStateError();
          },
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.ok).toBe(false);
    expect(JSON.stringify(payload)).not.toContain("checkout.stripe.com");
  });

  it("reports a provider failure without returning a false payment link", async () => {
    const response = await handleTaskCheckoutPost(
      request({ amount_cents: 1499 }),
      { params: Promise.resolve({ taskId: "00000000-0000-4000-8000-000000000001" }) },
      {
        authorize: async () => authorization,
        getCheckoutService: () => ({
          createCheckout: async () => {
            throw new StripeCheckoutProviderError();
          },
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      ok: false,
      error: "Payment checkout is temporarily unavailable. No payment link was created.",
    });
  });
});
