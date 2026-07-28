import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import WebSocket, { type RawData } from "ws";

import { parsePcmS16LeWave, splitPcmIntoFrames } from "./audio.js";
import {
  collectFinalTranscript,
  createFinishTask,
  createSttRunTask,
  createTtsContinueTask,
  createTtsRunTask,
  parseDashScopeEvent,
  type DashScopeEvent,
} from "./dashscopeProtocol.js";
import { createFrameDeliveryPlan } from "./network.js";
import { calculateSpeechCost, getSpeechPriceSnapshot } from "./pricing.js";
import { sanitizeDiagnostic, SpeechSpikeError } from "./safety.js";
import type {
  NetworkProfile,
  SpeechBenchmarkSample,
  SpeechRoundObservation,
  UploadMode,
} from "./types.js";

interface DashScopeRoundOptions {
  sample: SpeechBenchmarkSample;
  fixturePath: string;
  apiKey: string;
  websocketUrl: string;
  region: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
  networkProfile: NetworkProfile;
  uploadMode: UploadMode;
  timeoutMs?: number;
}

interface SocketSession {
  socket: WebSocket;
  events: DashScopeEvent[];
  binaryChunks: Buffer[];
  firstBinaryAt: number | null;
  waitForEvent(event: string, timeoutMs: number): Promise<DashScopeEvent>;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function openDashScopeSocket(
  url: string,
  apiKey: string,
  timeoutMs: number,
): Promise<SocketSession> {
  const socket = new WebSocket(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const events: DashScopeEvent[] = [];
  const binaryChunks: Buffer[] = [];
  let firstBinaryAt: number | null = null;
  const waiters = new Map<
    string,
    Array<{ resolve: (event: DashScopeEvent) => void; reject: (error: Error) => void }>
  >();

  socket.on("message", (data: RawData, isBinary: boolean) => {
    if (isBinary) {
      if (firstBinaryAt === null) {
        firstBinaryAt = performance.now();
      }
      binaryChunks.push(Buffer.from(data as Buffer));
      return;
    }

    try {
      const event = parseDashScopeEvent(data.toString());
      events.push(event);
      const eventName = event.header.event;
      if (eventName) {
        const waiting = waiters.get(eventName)?.shift();
        waiting?.resolve(event);
      }
      if (eventName === "task-failed") {
        const providerMessage = sanitizeDiagnostic(
          `${event.header.error_code ?? "provider_error"}: ${event.header.error_message ?? "Task failed"}`,
        );
        for (const waiting of waiters.values()) {
          for (const waiter of waiting) {
            waiter.reject(new SpeechSpikeError("SPEECH_PROVIDER_FAILED", providerMessage));
          }
        }
      }
    } catch (error) {
      socket.close();
      for (const waiting of waiters.values()) {
        for (const waiter of waiting) {
          waiter.reject(new SpeechSpikeError("INVALID_PROVIDER_EVENT", sanitizeDiagnostic(error)));
        }
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new SpeechSpikeError("SPEECH_PROVIDER_TIMEOUT", "WebSocket open timed out"));
    }, timeoutMs);
    socket.once("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(new SpeechSpikeError("SPEECH_PROVIDER_CONNECTION_FAILED", sanitizeDiagnostic(error)));
    });
  });

  return {
    socket,
    events,
    binaryChunks,
    get firstBinaryAt() {
      return firstBinaryAt;
    },
    waitForEvent(eventName, eventTimeoutMs) {
      const existing = events.find((event) => event.header.event === eventName);
      if (existing) {
        return Promise.resolve(existing);
      }
      return new Promise<DashScopeEvent>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(
            new SpeechSpikeError("SPEECH_PROVIDER_TIMEOUT", `Timed out waiting for ${eventName}`),
          );
        }, eventTimeoutMs);
        const wrappedResolve = (event: DashScopeEvent) => {
          clearTimeout(timer);
          resolve(event);
        };
        const wrappedReject = (error: Error) => {
          clearTimeout(timer);
          reject(error);
        };
        const queue = waiters.get(eventName) ?? [];
        queue.push({ resolve: wrappedResolve, reject: wrappedReject });
        waiters.set(eventName, queue);
      });
    },
  };
}

async function runStt(
  options: DashScopeRoundOptions,
  pcm: Buffer,
): Promise<{
  transcript: string;
  completedMs: number;
}> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const startedAt = performance.now();
  const session = await openDashScopeSocket(options.websocketUrl, options.apiKey, timeoutMs);
  const task = createSttRunTask(options.sttModel) as {
    header: { task_id: string };
  };

  try {
    session.socket.send(JSON.stringify(task));
    await session.waitForEvent("task-started", timeoutMs);
    const deliveries = createFrameDeliveryPlan(
      splitPcmIntoFrames(pcm),
      options.networkProfile,
      options.uploadMode,
    );
    for (const delivery of deliveries) {
      if (delivery.disconnect) {
        session.socket.terminate();
        throw new SpeechSpikeError(
          "SIMULATED_NETWORK_DISCONNECT",
          "The selected network profile disconnected the STT stream",
        );
      }
      if (delivery.delayMs > 0) {
        await sleep(delivery.delayMs);
      }
      session.socket.send(delivery.frame, { binary: true });
    }
    session.socket.send(JSON.stringify(createFinishTask(task.header.task_id)));
    await session.waitForEvent("task-finished", timeoutMs);
    const transcript = collectFinalTranscript(session.events);
    if (!transcript) {
      throw new SpeechSpikeError("EMPTY_STT_TRANSCRIPT", "Provider returned no final transcript");
    }
    return { transcript, completedMs: performance.now() - startedAt };
  } finally {
    session.socket.close();
  }
}

async function runTts(
  options: DashScopeRoundOptions,
  text: string,
): Promise<{
  firstAudioMs: number;
  completedMs: number;
  characters: number;
}> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const startedAt = performance.now();
  const session = await openDashScopeSocket(options.websocketUrl, options.apiKey, timeoutMs);
  const task = createTtsRunTask(options.ttsModel, options.ttsVoice) as {
    header: { task_id: string };
  };

  try {
    session.socket.send(JSON.stringify(task));
    await session.waitForEvent("task-started", timeoutMs);
    session.socket.send(JSON.stringify(createTtsContinueTask(task.header.task_id, text)));
    session.socket.send(JSON.stringify(createFinishTask(task.header.task_id)));
    const finished = await session.waitForEvent("task-finished", timeoutMs);
    if (session.binaryChunks.length === 0 || session.firstBinaryAt === null) {
      throw new SpeechSpikeError("EMPTY_TTS_AUDIO", "Provider returned no binary audio");
    }
    const characters = finished.payload?.usage?.characters;
    if (characters === undefined) {
      throw new SpeechSpikeError(
        "MISSING_TTS_USAGE",
        "Provider task-finished event did not include character usage",
      );
    }
    return {
      firstAudioMs: session.firstBinaryAt - startedAt,
      completedMs: performance.now() - startedAt,
      characters,
    };
  } finally {
    session.socket.close();
  }
}

export async function runDashScopeSpeechRound(
  options: DashScopeRoundOptions,
): Promise<SpeechRoundObservation> {
  const roundStartedAt = performance.now();
  try {
    const wave = parsePcmS16LeWave(await readFile(options.fixturePath));
    const stt = await runStt(options, wave.pcm);
    const tts = await runTts(options, stt.transcript);
    return {
      sampleId: options.sample.id,
      provider: "dashscope",
      sttModel: options.sttModel,
      ttsModel: options.ttsModel,
      networkProfile: options.networkProfile.id,
      uploadMode: options.uploadMode,
      providerEvidence: "real_provider",
      networkEvidence:
        options.networkProfile.id === "wifi_good" ? "local_baseline" : "client_simulation",
      status: "succeeded",
      transcript: stt.transcript,
      sttCompletedMs: stt.completedMs,
      ttsFirstAudioMs: tts.firstAudioMs,
      ttsCompletedMs: tts.completedMs,
      totalRoundMs: performance.now() - roundStartedAt,
      sttAudioSeconds: wave.durationSeconds,
      ttsCharacters: tts.characters,
      sttCost: calculateSpeechCost(
        wave.durationSeconds,
        getSpeechPriceSnapshot("dashscope", options.sttModel, options.region),
      ),
      ttsCost: calculateSpeechCost(
        tts.characters,
        getSpeechPriceSnapshot("dashscope", options.ttsModel, options.region),
      ),
    };
  } catch (error) {
    return {
      sampleId: options.sample.id,
      provider: "dashscope",
      sttModel: options.sttModel,
      ttsModel: options.ttsModel,
      networkProfile: options.networkProfile.id,
      uploadMode: options.uploadMode,
      providerEvidence: "real_provider",
      networkEvidence:
        options.networkProfile.id === "wifi_good" ? "local_baseline" : "client_simulation",
      status: "failed",
      totalRoundMs: performance.now() - roundStartedAt,
      failureCode: error instanceof SpeechSpikeError ? error.code : "SPEECH_SPIKE_FAILED",
      failureMessage: sanitizeDiagnostic(error, [options.apiKey]),
    };
  }
}
