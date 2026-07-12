export const COPILOT_MODULE = "copilot";

export { copilotRouter } from "./router.js";
export {
  CopilotRunInputSchema,
  CopilotRunResultSchema,
  RetrievalFactSchema,
  createCopilotPipeline,
  defaultGenerateEnvelope,
  defaultRetrieveContext,
  defaultRouteIntent,
} from "./service.js";
export { CompleteTripInputSchema, createTwoPassWorker } from "./twoPassWorker.js";
export {
  createDemoCopilotModelDependencies,
  createDemoModelRuntime,
  DemoModelExecutionError,
  DemoModelUnavailableError,
} from "./modelRuntime.js";
export type { CopilotRunInput, CopilotRunResult, RetrievalFact } from "./service.js";
export type { CompleteTripInput } from "./twoPassWorker.js";
