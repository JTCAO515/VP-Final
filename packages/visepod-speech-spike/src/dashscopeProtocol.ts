import { randomUUID } from "node:crypto";

export interface DashScopeHeader {
  action?: string;
  event?: string;
  task_id: string;
  streaming?: "duplex";
  error_code?: string;
  error_message?: string;
}

export interface DashScopeEvent {
  header: DashScopeHeader;
  payload?: {
    output?: {
      sentence?: {
        text?: string;
        sentence_end?: boolean;
      };
    };
    usage?: {
      characters?: number;
    };
  };
}

export function createSttRunTask(model: string, taskId: string = randomUUID()): object {
  return {
    header: { action: "run-task", task_id: taskId, streaming: "duplex" },
    payload: {
      task_group: "audio",
      task: "asr",
      function: "recognition",
      model,
      parameters: {
        format: "pcm",
        sample_rate: 16_000,
        language_hints: ["en", "zh"],
      },
      input: {},
    },
  };
}

export function createTtsRunTask(
  model: string,
  voice: string,
  taskId: string = randomUUID(),
): object {
  return {
    header: { action: "run-task", task_id: taskId, streaming: "duplex" },
    payload: {
      task_group: "audio",
      task: "tts",
      function: "SpeechSynthesizer",
      model,
      parameters: {
        text_type: "PlainText",
        voice,
        format: "pcm",
        sample_rate: 16_000,
      },
      input: {},
    },
  };
}

export function createTtsContinueTask(taskId: string, text: string): object {
  return {
    header: { action: "continue-task", task_id: taskId, streaming: "duplex" },
    payload: { input: { text } },
  };
}

export function createFinishTask(taskId: string): object {
  return {
    header: { action: "finish-task", task_id: taskId, streaming: "duplex" },
    payload: { input: {} },
  };
}

export function parseDashScopeEvent(value: string): DashScopeEvent {
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("header" in parsed) ||
    typeof parsed.header !== "object" ||
    parsed.header === null ||
    !("task_id" in parsed.header) ||
    typeof parsed.header.task_id !== "string"
  ) {
    throw new Error("INVALID_DASHSCOPE_EVENT");
  }
  return parsed as DashScopeEvent;
}

export function collectFinalTranscript(events: readonly DashScopeEvent[]): string {
  return events
    .map((event) => event.payload?.output?.sentence)
    .filter((sentence) => sentence?.sentence_end && sentence.text)
    .map((sentence) => sentence!.text!.trim())
    .filter(Boolean)
    .join(" ");
}
