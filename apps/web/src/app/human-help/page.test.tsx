import { describe, expect, it } from "vitest";
import { selectPendingPaymentTasks } from "./paymentTasks";

describe("Human Help payment entry", () => {
  it("renders an external payment entry only for a payment-pending task with both a server-provided amount and link", () => {
    const pending = selectPendingPaymentTasks([
      {
        id: "task-pending",
        status: "payment_pending",
        created_at: "2026-08-14T00:00:00.000Z",
        updated_at: "2026-08-14T00:00:00.000Z",
        price_usd: 14.99,
        payment_link: "https://checkout.stripe.com/c/pay/cs_test_owner_001",
      },
      {
        id: "task-paid",
        status: "paid",
        created_at: "2026-08-14T00:00:00.000Z",
        updated_at: "2026-08-14T00:00:00.000Z",
        price_usd: 14.99,
        payment_link: "https://checkout.stripe.com/c/pay/cs_test_owner_002",
      },
      {
        id: "task-incomplete",
        status: "payment_pending",
        created_at: "2026-08-14T00:00:00.000Z",
        updated_at: "2026-08-14T00:00:00.000Z",
        price_usd: null,
        payment_link: null,
      },
    ]);

    expect(pending).toEqual([expect.objectContaining({ id: "task-pending", price_usd: 14.99 })]);
  });
});
