import { HumanTaskCreateSchema, createHumanTask } from "@visepanda/domain";
import { NextResponse } from "next/server";

const store = globalThis as typeof globalThis & {
  __visepandaWebHumanTasks?: ReturnType<typeof createHumanTask>[];
};

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = HumanTaskCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid human task request." }, { status: 400 });
  }

  const task = createHumanTask(parsed.data);
  store.__visepandaWebHumanTasks = [task, ...(store.__visepandaWebHumanTasks ?? [])];

  return NextResponse.json({
    ok: true,
    task,
    payment: {
      mode: "manual_quote",
      message: "A concierge operator will review this request and attach a payment link if needed.",
    },
  });
}
