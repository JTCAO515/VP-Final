import { describe, expect, it } from "vitest";

import {
  collectFinalTranscript,
  createFinishTask,
  createSttRunTask,
  createTtsContinueTask,
  createTtsRunTask,
  parseDashScopeEvent,
} from "./dashscopeProtocol.js";

describe("DashScope experimental WebSocket protocol", () => {
  it("builds PCM S16LE 16k STT and TTS tasks without embedding credentials", () => {
    const stt = JSON.stringify(createSttRunTask("stt-model", "task-1"));
    const tts = JSON.stringify(createTtsRunTask("tts-model", "voice-1", "task-2"));
    expect(stt).toContain('"sample_rate":16000');
    expect(stt).toContain('"format":"pcm"');
    expect(tts).toContain('"voice":"voice-1"');
    expect(`${stt}${tts}`).not.toMatch(/api.?key|authorization|cookie|signature/i);
  });

  it("builds bounded continue and finish actions", () => {
    expect(createTtsContinueTask("task-2", "hello")).toMatchObject({
      header: { action: "continue-task", task_id: "task-2" },
      payload: { input: { text: "hello" } },
    });
    expect(createFinishTask("task-2")).toMatchObject({
      header: { action: "finish-task", task_id: "task-2" },
    });
  });

  it("collects only final transcript segments", () => {
    const events = [
      parseDashScopeEvent(
        JSON.stringify({
          header: { task_id: "task-1", event: "result-generated" },
          payload: { output: { sentence: { text: "partial", sentence_end: false } } },
        }),
      ),
      parseDashScopeEvent(
        JSON.stringify({
          header: { task_id: "task-1", event: "result-generated" },
          payload: { output: { sentence: { text: "final text", sentence_end: true } } },
        }),
      ),
    ];
    expect(collectFinalTranscript(events)).toBe("final text");
  });
});
