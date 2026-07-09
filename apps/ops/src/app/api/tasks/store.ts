import {
  HumanTaskUpdateSchema,
  createHumanTask,
  updateHumanTask,
  type HumanTask,
  type HumanTaskUpdate,
} from "@visepanda/domain";

const store = globalThis as typeof globalThis & {
  __visepandaOpsHumanTasks?: HumanTask[];
};

const seedTasks = [
  createHumanTask(
    {
      city: "Shanghai",
      kind: "call_restaurant",
      description: "Confirm whether the restaurant can hold a table and accept foreign cards.",
      contact: "traveler@example.com",
    },
    new Date("2026-07-09T08:00:00.000Z"),
  ),
  createHumanTask(
    {
      city: "Beijing",
      kind: "ticket_help",
      description: "Check passport-name requirements for a Forbidden City booking.",
      contact: "guest@example.com",
    },
    new Date("2026-07-09T08:10:00.000Z"),
  ),
];

export function listTasks(): HumanTask[] {
  store.__visepandaOpsHumanTasks ??= seedTasks;
  return store.__visepandaOpsHumanTasks;
}

export function updateTask(input: HumanTaskUpdate): HumanTask {
  const update = HumanTaskUpdateSchema.parse(input);
  const task = listTasks().find((candidate) => candidate.id === update.id);
  if (!task) throw new Error("Human task not found");

  const next = updateHumanTask(task, update);
  store.__visepandaOpsHumanTasks = listTasks().map((candidate) =>
    candidate.id === next.id ? next : candidate,
  );
  return next;
}
