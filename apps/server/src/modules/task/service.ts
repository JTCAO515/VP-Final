import {
  HumanTaskCreateSchema,
  HumanTaskUpdateSchema,
  createHumanTask,
  updateHumanTask,
  type HumanTask,
  type HumanTaskCreate,
  type HumanTaskUpdate,
} from "@visepanda/domain";

export type HumanTaskService = {
  create(input: HumanTaskCreate): Promise<HumanTask>;
  list(): Promise<HumanTask[]>;
  update(input: HumanTaskUpdate): Promise<HumanTask>;
};

export function createInMemoryHumanTaskService(seed: HumanTask[] = []): HumanTaskService {
  let tasks = seed;

  return {
    async create(input) {
      const task = createHumanTask(HumanTaskCreateSchema.parse(input));
      tasks = [task, ...tasks];
      return task;
    },
    async list() {
      return tasks;
    },
    async update(input) {
      const update = HumanTaskUpdateSchema.parse(input);
      const task = tasks.find((item) => item.id === update.id);
      if (!task) throw new Error("Human task not found");

      const next = updateHumanTask(task, update);
      tasks = tasks.map((item) => (item.id === next.id ? next : item));
      return next;
    },
  };
}
