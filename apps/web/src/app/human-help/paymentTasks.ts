export type TravelerHumanTask = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  price_usd: number | null;
  payment_link: string | null;
};

export type PendingPaymentTask = TravelerHumanTask & {
  price_usd: number;
  payment_link: string;
};

export function selectPendingPaymentTasks(tasks: TravelerHumanTask[]): PendingPaymentTask[] {
  return tasks.filter(
    (task): task is PendingPaymentTask =>
      task.status === "payment_pending" &&
      typeof task.price_usd === "number" &&
      typeof task.payment_link === "string",
  );
}
