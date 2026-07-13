import { DemoModelExecutionError, DemoModelUnavailableError } from "@visepanda/app-server";

export type DemoModelFailure = DemoModelUnavailableError | DemoModelExecutionError;

export function findModelFailure(error: unknown): DemoModelFailure | null {
  if (error instanceof DemoModelUnavailableError || error instanceof DemoModelExecutionError) {
    return error;
  }
  if (error && typeof error === "object" && "cause" in error) {
    return findModelFailure((error as { cause?: unknown }).cause);
  }
  return null;
}
